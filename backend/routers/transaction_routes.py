from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from database import db
from auth import get_current_user, require_admin
from models import (
    TransactionCreate, Transaction, TransactionItem,
    ReturnCreate
)
from services import recalculate_product_stock

router = APIRouter()


@router.get("/pos/daily-summary")
async def get_pos_daily_summary(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
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


@router.get("/pos/daily-transactions")
async def get_pos_daily_transactions(date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    transactions = await db.transactions.find({"date": target_date}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    farmer_txns = await db.farmer_transactions.find({"date": target_date}, {"_id": 0}).sort("created_at", -1).to_list(10000)
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
    now = datetime.now(timezone.utc)
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
        "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")
    }
    await db.transactions.insert_one(transaction_doc)
    return transaction_doc


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


# ============= RETURNS =============
@router.post("/returns")
async def create_return(data: ReturnCreate, admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    return_doc = {
        "id": str(uuid.uuid4()), "return_number": f"RTN{now.strftime('%Y%m%d%H%M%S')}",
        "source_type": data.source_type, "source_id": data.source_id,
        "items": data.items, "notes": data.notes, "warehouse_id": data.warehouse_id,
        "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")
    }
    await db.returns.insert_one(return_doc)
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
                new_debt = max(0, partner_store.get("current_debt", 0) - return_total)
                await db.partner_stores.update_one({"id": order["partner_store_id"]}, {"$set": {"current_debt": new_debt}})
    return_doc.pop("_id", None)
    return return_doc


@router.get("/returns")
async def get_returns(source_id: str = None, admin: dict = Depends(require_admin)):
    query = {}
    if source_id:
        query["source_id"] = source_id
    returns = await db.returns.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return returns
