from fastapi import APIRouter, HTTPException, Depends, Query, Request as FastAPIRequest
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

from database import db
from auth import get_current_user, require_admin_panel_access, require_pos_access
from models import (
    TransactionCreate, Transaction, TransactionItem,
    ReturnCreate
)
from services import recalculate_product_stock

router = APIRouter()

# WITA timezone (UTC+8) with business day reset at 20:00
WITA = timezone(timedelta(hours=8))
BUSINESS_RESET_HOUR = 20

def get_business_date(dt=None):
    """Get business date in WITA. Resets at 20:00 WITA - transactions after 20:00 count as next day."""
    now_wita = dt or datetime.now(WITA)
    if now_wita.hour >= BUSINESS_RESET_HOUR:
        return (now_wita + timedelta(days=1)).strftime("%Y-%m-%d")
    return now_wita.strftime("%Y-%m-%d")

def get_wita_today():
    """Get today's date in WITA (without business reset logic, for default date picker)."""
    return datetime.now(WITA).strftime("%Y-%m-%d")


@router.get("/pos/daily-summary")
async def get_pos_daily_summary(current_user: dict = Depends(get_current_user)):
    today = get_business_date()
    transactions = await db.transactions.find({"date": today}, {"_id": 0}).to_list(10000)
    total_sales = sum(t.get("total", 0) for t in transactions)
    total_cost = 0
    for t in transactions:
        for item in t.get("items", []):
            total_cost += item.get("cost_price", 0) * item.get("quantity", 0)
    return {
        "count": len(transactions), "total_sales": total_sales,
        "total_cost": total_cost, "total_margin": total_sales - total_cost
    }


@router.get("/pos/business-date")
async def get_current_business_date():
    """Return current business date in WITA timezone (resets at 20:00)."""
    return {"date": get_business_date(), "wita_today": get_wita_today()}


@router.get("/pos/daily-transactions")
async def get_pos_daily_transactions(date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    target_date = date or get_business_date()
    transactions = await db.transactions.find({"date": target_date}, {"_id": 0}).sort("created_at", 1).to_list(10000)
    farmer_txns = await db.farmer_transactions.find({"date": target_date}, {"_id": 0}).sort("created_at", 1).to_list(10000)
    total_sales = sum(t.get("total", 0) for t in transactions)
    total_farmer = sum(t.get("total", 0) for t in farmer_txns)
    return {
        "date": target_date,
        "transactions": transactions,
        "farmer_transactions": farmer_txns,
        "total_sales": total_sales,
        "total_farmer_sales": total_farmer,
        "grand_total": total_sales + total_farmer,
        "count": len(transactions),
        "farmer_count": len(farmer_txns)
    }


@router.post("/transactions", response_model=Transaction)
async def create_transaction(data: TransactionCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(WITA)
    business_date = get_business_date(now)
    transaction_number = f"TRX{now.strftime('%Y%m%d%H%M%S')}"
    for item in data.items:
        product = await db.products.find_one({"id": item.product_id})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_name} not found")
        toko_stock = await db.warehouse_stock.find_one({"product_id": item.product_id, "warehouse_id": "gudang_toko"})
        toko_qty = toko_stock["stock"] if toko_stock else 0
        if toko_qty < item.quantity:
            raise HTTPException(status_code=400, detail=f"Stok Gudang Toko tidak cukup untuk {item.product_name} (tersedia: {toko_qty} satuan)")
        await db.warehouse_stock.update_one(
            {"product_id": item.product_id, "warehouse_id": "gudang_toko"},
            {"$inc": {"stock": -item.quantity}}
        )
        await recalculate_product_stock(item.product_id)
    transaction_doc = {
        "id": str(uuid.uuid4()), "transaction_number": transaction_number,
        "cashier_id": current_user["id"], "cashier_name": current_user["name"],
        "items": [item.model_dump() for item in data.items],
        "subtotal": data.subtotal, "tax": data.tax, "discount": data.discount,
        "total": data.total, "payment_method": data.payment_method,
        "payment_amount": data.payment_amount, "change": data.change,
        "created_at": now.isoformat(), "date": business_date
    }
    await db.transactions.insert_one(transaction_doc)
    return transaction_doc


@router.get("/transactions/search")
async def search_transaction(q: str = "", current_user: dict = Depends(get_current_user)):
    if not q:
        return []
    query = {"$or": [
        {"transaction_number": {"$regex": q, "$options": "i"}},
        {"id": q}
    ]}
    txns = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(20)
    return txns


@router.get("/transactions", response_model=List[Transaction])
async def get_transactions(
    start_date: Optional[str] = None, end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    transactions = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return transactions


@router.get("/transactions/{transaction_id}", response_model=Transaction)
async def get_transaction(transaction_id: str, current_user: dict = Depends(get_current_user)):
    transaction = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.put("/transactions/{transaction_id}/edit-prices")
async def edit_transaction_prices(transaction_id: str, req: FastAPIRequest, current_user: dict = Depends(get_current_user)):
    """Edit harga jual dan qty item dalam transaksi (untuk koreksi kasir)."""
    body = await req.json()
    updated_items = body.get("items", [])
    txn = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")

    new_items = []
    stock_adjustments = []
    for existing_item in txn.get("items", []):
        match = next((u for u in updated_items if u["product_id"] == existing_item["product_id"]), None)
        if match:
            new_price = float(match["price"])
            new_qty = int(match.get("quantity", existing_item["quantity"]))
            old_qty = existing_item["quantity"]
            qty_diff = old_qty - new_qty  # positive = return stock, negative = take more stock
            if qty_diff != 0:
                stock_adjustments.append({"product_id": existing_item["product_id"], "diff": qty_diff, "name": existing_item.get("product_name", "")})
            new_items.append({**existing_item, "price": new_price, "quantity": new_qty, "subtotal": new_price * new_qty})
        else:
            new_items.append(existing_item)

    # Validate stock for items that need MORE stock
    for adj in stock_adjustments:
        if adj["diff"] < 0:  # need more stock
            toko_stock = await db.warehouse_stock.find_one({"product_id": adj["product_id"], "warehouse_id": "gudang_toko"})
            available = toko_stock["stock"] if toko_stock else 0
            needed = abs(adj["diff"])
            if available < needed:
                raise HTTPException(status_code=400, detail=f"Stok tidak cukup untuk {adj['name']} (perlu {needed}, tersedia {available})")

    # Apply stock adjustments
    for adj in stock_adjustments:
        await db.warehouse_stock.update_one(
            {"product_id": adj["product_id"], "warehouse_id": "gudang_toko"},
            {"$inc": {"stock": adj["diff"]}}, upsert=True
        )
        await recalculate_product_stock(adj["product_id"])

    new_subtotal = sum(it.get("subtotal", 0) for it in new_items)
    new_total = new_subtotal - txn.get("discount", 0) + txn.get("tax", 0)

    now = datetime.now(WITA)
    edit_note = f"[EDIT {now.strftime('%d/%m/%Y %H:%M')} oleh {current_user.get('name', '')}]"
    edit_notes = txn.get("edit_notes", [])
    edit_notes.append(edit_note)

    await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {"items": new_items, "subtotal": new_subtotal, "total": new_total, "edit_notes": edit_notes}}
    )

    updated_txn = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    return updated_txn


# ============= RETURNS =============
@router.post("/returns")
async def create_return(data: ReturnCreate, admin: dict = Depends(require_pos_access)):
    now = datetime.now(timezone.utc)
    vehicle_id = data.vehicle_id if data.vehicle_id else None
    return_doc = {
        "id": str(uuid.uuid4()), "return_number": f"RTN{now.strftime('%Y%m%d%H%M%S')}",
        "source_type": data.source_type, "source_id": data.source_id,
        "items": data.items, "notes": data.notes,
        "warehouse_id": data.warehouse_id if not vehicle_id else f"vehicle:{vehicle_id}",
        "vehicle_id": vehicle_id or "",
        "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")
    }
    await db.returns.insert_one(return_doc)

    if vehicle_id:
        # Return to vehicle stock instead of warehouse
        vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
        vehicle_name = vehicle.get("name", "") if vehicle else ""
        for item in data.items:
            existing_vs = await db.vehicle_stock.find_one(
                {"vehicle_id": vehicle_id, "product_id": item["product_id"], "remaining_qty": {"$gt": 0}}
            )
            if existing_vs:
                await db.vehicle_stock.update_one(
                    {"id": existing_vs["id"]},
                    {"$inc": {"remaining_qty": item["quantity"], "quantity": item["quantity"]}}
                )
            else:
                vs_doc = {
                    "id": str(uuid.uuid4()),
                    "vehicle_id": vehicle_id, "vehicle_name": vehicle_name,
                    "product_id": item["product_id"], "product_name": item["product_name"],
                    "quantity": item["quantity"], "remaining_qty": item["quantity"],
                    "sold_qty": 0, "returned_qty": 0,
                    "price": item.get("price", 0),
                    "warehouse_id": data.warehouse_id or "gudang_toko",
                    "loaded_at": now.isoformat(),
                    "notes": f"Retur dari pesanan {data.source_id}", "status": "active"
                }
                await db.vehicle_stock.insert_one(vs_doc)
    else:
        for item in data.items:
            await db.warehouse_stock.update_one(
                {"product_id": item["product_id"], "warehouse_id": data.warehouse_id},
                {"$inc": {"stock": item["quantity"]}}, upsert=True
            )
            await recalculate_product_stock(item["product_id"])

    if data.source_type == "transaction":
        await db.transactions.update_one({"id": data.source_id}, {"$set": {"has_return": True}})
    elif data.source_type == "partner_order":
        await db.partner_orders.update_one({"id": data.source_id}, {"$set": {"has_return": True}})
        order = await db.partner_orders.find_one({"id": data.source_id}, {"_id": 0})
        if order:
            return_total = sum(i.get("subtotal", 0) for i in data.items)
            new_remaining = max(0, order.get("remaining", 0) - return_total)
            await db.partner_orders.update_one({"id": data.source_id}, {"$set": {"remaining": new_remaining}})
            partner_store = await db.partner_stores.find_one({"id": order["partner_store_id"]})
            if partner_store:
                new_debt = partner_store.get("current_debt", 0) - return_total
                await db.partner_stores.update_one({"id": order["partner_store_id"]}, {"$set": {"current_debt": new_debt}})
    return_doc.pop("_id", None)
    return return_doc


@router.get("/returns")
async def get_returns(source_id: str = None, admin: dict = Depends(require_admin_panel_access)):
    query = {}
    if source_id:
        query["source_id"] = source_id
    returns = await db.returns.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return returns


@router.post("/pos/return-exchange")
async def pos_return_exchange(req: FastAPIRequest, current_user: dict = Depends(get_current_user)):
    body = await req.json()
    transaction_id = body.get("transaction_id")
    return_items = body.get("return_items", [])
    exchange_items = body.get("exchange_items", [])
    action_type = body.get("action_type", "return")

    txn = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")

    txn_date = datetime.fromisoformat(txn["created_at"].replace("Z", "+00:00")) if "T" in txn.get("created_at", "") else datetime.now(timezone.utc)
    days_diff = (datetime.now(timezone.utc) - txn_date).days
    if days_diff > 2:
        raise HTTPException(status_code=400, detail=f"Retur/tukar hanya berlaku 2 hari setelah pembelian (transaksi sudah {days_diff} hari)")

    now = datetime.now(timezone.utc)
    total_return_value = 0
    return_details = []

    for ri in return_items:
        product_id = ri.get("product_id")
        qty = int(ri.get("quantity", 0))
        if qty <= 0:
            continue
        original_item = next((it for it in txn.get("items", []) if it["product_id"] == product_id), None)
        if not original_item:
            raise HTTPException(status_code=400, detail=f"Barang tidak ditemukan dalam transaksi")
        if qty > original_item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Jumlah retur ({qty}) melebihi jumlah beli ({original_item['quantity']}) untuk {original_item['product_name']}")
        return_value = original_item["price"] * qty
        total_return_value += return_value
        return_details.append({
            "product_id": product_id, "product_name": original_item["product_name"],
            "quantity": qty, "price": original_item["price"], "return_value": return_value
        })
        await db.warehouse_stock.update_one(
            {"product_id": product_id, "warehouse_id": "gudang_toko"},
            {"$inc": {"stock": qty}}, upsert=True
        )
        await recalculate_product_stock(product_id)

    total_exchange_value = 0
    exchange_details = []

    for ei in exchange_items:
        product_id = ei.get("product_id")
        qty = int(ei.get("quantity", 0))
        price = float(ei.get("price", 0))
        product_name = ei.get("product_name", "")
        if qty <= 0:
            continue
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Barang pengganti tidak ditemukan")
        toko_stock = await db.warehouse_stock.find_one({"product_id": product_id, "warehouse_id": "gudang_toko"})
        toko_qty = toko_stock["stock"] if toko_stock else 0
        if toko_qty < qty:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup untuk {product['name']} (tersedia: {toko_qty})")
        exchange_value = price * qty
        total_exchange_value += exchange_value
        exchange_details.append({
            "product_id": product_id, "product_name": product["name"],
            "quantity": qty, "price": price, "exchange_value": exchange_value
        })
        await db.warehouse_stock.update_one(
            {"product_id": product_id, "warehouse_id": "gudang_toko"},
            {"$inc": {"stock": -qty}}
        )
        await recalculate_product_stock(product_id)

    price_diff = total_exchange_value - total_return_value
    label = "RETUR" if action_type == "return" else "TUKAR"

    updated_items = list(txn.get("items", []))
    for ri in return_details:
        for i, item in enumerate(updated_items):
            if item["product_id"] == ri["product_id"]:
                new_qty = item["quantity"] - ri["quantity"]
                if new_qty > 0:
                    updated_items[i] = {**item, "quantity": new_qty, "subtotal": new_qty * item["price"]}
                else:
                    updated_items[i] = {**item, "quantity": 0, "subtotal": 0, "product_name": item["product_name"] + f" [{label}]"}
                break

    for ei in exchange_details:
        existing_idx = next((i for i, it in enumerate(updated_items) if it["product_id"] == ei["product_id"]), None)
        if existing_idx is not None:
            item = updated_items[existing_idx]
            new_qty = item["quantity"] + ei["quantity"]
            updated_items[existing_idx] = {**item, "quantity": new_qty, "subtotal": new_qty * ei["price"]}
        else:
            updated_items.append({
                "product_id": ei["product_id"], "product_name": ei["product_name"] + f" [{label}]",
                "quantity": ei["quantity"], "price": ei["price"],
                "subtotal": ei["exchange_value"], "warehouse_id": "", "sell_unit": ""
            })

    updated_items = [it for it in updated_items if it.get("quantity", 0) > 0 or "[" in it.get("product_name", "")]
    new_subtotal = sum(it.get("subtotal", 0) for it in updated_items)
    new_total = new_subtotal - txn.get("discount", 0) + txn.get("tax", 0)

    return_note = f"[{label} {now.strftime('%d/%m/%Y %H:%M')} oleh {current_user.get('name','')}]"
    existing_notes = txn.get("return_notes", [])
    existing_notes.append(return_note)

    await db.transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "items": updated_items,
            "subtotal": new_subtotal,
            "total": new_total,
            "return_notes": existing_notes,
            "has_return": True
        }}
    )

    return_log = {
        "id": str(uuid.uuid4()),
        "transaction_id": transaction_id,
        "transaction_number": txn.get("transaction_number", ""),
        "action_type": action_type,
        "return_items": return_details,
        "exchange_items": exchange_details,
        "total_return_value": total_return_value,
        "total_exchange_value": total_exchange_value,
        "price_difference": price_diff,
        "processed_by": current_user.get("name", ""),
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d")
    }
    await db.pos_returns.insert_one(return_log)

    return {
        "message": f"{label} berhasil diproses",
        "total_return_value": total_return_value,
        "total_exchange_value": total_exchange_value,
        "price_difference": price_diff,
        "return_log_id": return_log["id"]
    }
