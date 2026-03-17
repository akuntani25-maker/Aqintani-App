from fastapi import APIRouter, HTTPException, Depends, Query, Request as FastAPIRequest
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

from database import db
from auth import get_current_user, require_admin_panel_access
from models import (
    PartnerStoreCreate, PartnerStore,
    PartnerOrderCreate, PartnerOrder
)
from services import recalculate_product_stock, log_audit

router = APIRouter()


@router.get("/partner-stores", response_model=List[PartnerStore])
async def get_partner_stores(current_user: dict = Depends(get_current_user)):
    stores = await db.partner_stores.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return stores


@router.post("/partner-stores", response_model=PartnerStore)
async def create_partner_store(data: PartnerStoreCreate, admin: dict = Depends(require_admin_panel_access)):
    store_doc = {
        "id": str(uuid.uuid4()), **data.model_dump(),
        "current_debt": 0, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.partner_stores.insert_one(store_doc)
    return store_doc


@router.put("/partner-stores/{store_id}", response_model=PartnerStore)
async def update_partner_store(store_id: str, data: PartnerStoreCreate, admin: dict = Depends(require_admin_panel_access)):
    result = await db.partner_stores.find_one_and_update(
        {"id": store_id}, {"$set": data.model_dump()},
        return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Partner store not found")
    return result


@router.delete("/partner-stores/{store_id}")
async def delete_partner_store(store_id: str, admin: dict = Depends(require_admin_panel_access)):
    result = await db.partner_stores.delete_one({"id": store_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Partner store not found")
    return {"message": "Partner store deleted"}


@router.post("/partner-stores/{store_id}/pay")
async def pay_partner_store(store_id: str, amount: float, notes: str = "", admin: dict = Depends(require_admin_panel_access)):
    store = await db.partner_stores.find_one({"id": store_id})
    if not store:
        raise HTTPException(status_code=404, detail="Partner store not found")
    new_debt = max(0, store.get("current_debt", 0) - amount)
    await db.partner_stores.update_one({"id": store_id}, {"$set": {"current_debt": new_debt}})
    payment_doc = {
        "id": str(uuid.uuid4()), "type": "partner_store", "reference_id": store_id,
        "partner_store_name": store["name"], "amount": amount,
        "notes": notes or f"Setoran dari {store['name']}",
        "created_at": datetime.now(timezone.utc).isoformat(), "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    await db.payment_history.insert_one(payment_doc)
    return {"message": "Payment recorded", "new_debt": new_debt, "payment": {k: v for k, v in payment_doc.items() if k != "_id"}}


@router.get("/partner-stores/{store_id}/payments")
async def get_partner_store_payments(store_id: str, current_user: dict = Depends(get_current_user)):
    payments = await db.payment_history.find(
        {"type": "partner_store", "reference_id": store_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return payments


@router.put("/partner-stores/{store_id}/edit-debt")
async def edit_partner_store_debt(store_id: str, req: FastAPIRequest, admin: dict = Depends(require_admin_panel_access)):
    """Edit piutang kios mitra: koreksi manual atau pembayaran."""
    req_body = await req.json()
    store = await db.partner_stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Kios mitra tidak ditemukan")

    edit_type = req_body.get("type", "correction")  # "correction" or "payment"
    amount = float(req_body.get("amount", 0))
    notes = req_body.get("notes", "")
    old_debt = store.get("current_debt", 0)

    WITA = timezone(timedelta(hours=8))
    now = datetime.now(WITA)

    if edit_type == "payment":
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Jumlah pembayaran harus lebih dari 0")
        new_debt = max(0, old_debt - amount)
        # Record payment in payment_history
        payment_doc = {
            "id": str(uuid.uuid4()), "type": "partner_store", "reference_id": store_id,
            "partner_store_name": store["name"], "amount": amount,
            "notes": notes or f"Pembayaran piutang {store['name']}",
            "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")
        }
        await db.payment_history.insert_one(payment_doc)
    elif edit_type == "correction":
        if amount < 0:
            raise HTTPException(status_code=400, detail="Nilai piutang tidak boleh negatif")
        new_debt = amount
    else:
        raise HTTPException(status_code=400, detail="Tipe edit tidak valid")

    await db.partner_stores.update_one({"id": store_id}, {"$set": {"current_debt": new_debt}})

    await log_audit(
        user=admin, action="EDIT_PIUTANG_MITRA", entity_type="partner_store",
        entity_id=store_id,
        details={
            "store_name": store["name"], "type": edit_type,
            "old_debt": old_debt, "new_debt": new_debt,
            "amount": amount, "notes": notes
        }
    )

    return {"message": "Piutang berhasil diperbarui", "old_debt": old_debt, "new_debt": new_debt}


# ============= PARTNER ORDERS =============
@router.get("/partner-orders", response_model=List[PartnerOrder])
async def get_partner_orders(partner_store_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if partner_store_id:
        query["partner_store_id"] = partner_store_id
    orders = await db.partner_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders


@router.get("/partner-orders/{order_id}")
async def get_partner_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.partner_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    partner_store = await db.partner_stores.find_one({"id": order["partner_store_id"]}, {"_id": 0})
    order["partner_debt_total"] = partner_store.get("current_debt", 0) if partner_store else 0
    order["partner_phone"] = partner_store.get("phone", "") if partner_store else ""
    order["partner_address"] = partner_store.get("address", "") if partner_store else ""
    return order


@router.post("/partner-orders", response_model=PartnerOrder)
async def create_partner_order(data: PartnerOrderCreate, current_user: dict = Depends(get_current_user)):
    partner_store = await db.partner_stores.find_one({"id": data.partner_store_id}, {"_id": 0})
    if not partner_store:
        raise HTTPException(status_code=404, detail="Partner store not found")
    canvasser_name = ""
    if data.canvasser_id:
        canvasser = await db.canvassers.find_one({"id": data.canvasser_id}, {"_id": 0})
        if canvasser:
            canvasser_name = canvasser["name"]

    default_wh_id = data.warehouse_id or "gudang_utama"
    for item in data.items:
        item_wh_id = item.warehouse_id or default_wh_id
        wh = await db.warehouses.find_one({"id": item_wh_id}, {"_id": 0})
        if wh:
            wh_stock = await db.warehouse_stock.find_one({"product_id": item.product_id, "warehouse_id": item_wh_id})
            current_qty = wh_stock["stock"] if wh_stock else 0
            if current_qty < item.quantity:
                wh_name = wh.get("name", item_wh_id)
                raise HTTPException(status_code=400, detail=f"Stok {wh_name} tidak cukup untuk {item.product_name}")
            await db.warehouse_stock.update_one(
                {"product_id": item.product_id, "warehouse_id": item_wh_id},
                {"$inc": {"stock": -item.quantity}}
            )
            await recalculate_product_stock(item.product_id)

    now = datetime.now(timezone.utc)
    order_number = f"PO{now.strftime('%Y%m%d%H%M%S')}"
    order_doc = {
        "id": str(uuid.uuid4()), "order_number": order_number,
        "partner_store_id": data.partner_store_id, "partner_store_name": partner_store["name"],
        "items": [item.model_dump() for item in data.items],
        "subtotal": data.subtotal, "discount": data.discount, "total": data.total,
        "paid": data.paid, "remaining": data.total - data.paid,
        "delivery_date": data.delivery_date or now.strftime("%Y-%m-%d"),
        "canvasser_id": data.canvasser_id or "", "canvasser_name": canvasser_name,
        "warehouse_id": default_wh_id, "status": "pending",
        "order_type": data.order_type or "regular",
        "is_settled": False,
        "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")
    }
    await db.partner_orders.insert_one(order_doc)
    new_debt = partner_store.get("current_debt", 0) + order_doc["remaining"]
    await db.partner_stores.update_one({"id": data.partner_store_id}, {"$set": {"current_debt": new_debt}})
    return order_doc


@router.put("/partner-orders/{order_id}/status")
async def update_order_status(order_id: str, order_status: str = Query(..., alias="status"), current_user: dict = Depends(get_current_user)):
    result = await db.partner_orders.find_one_and_update(
        {"id": order_id}, {"$set": {"status": order_status}},
        return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


@router.delete("/partner-orders/{order_id}")
async def delete_partner_order(order_id: str, admin: dict = Depends(require_admin_panel_access)):
    order = await db.partner_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    remaining = order.get("remaining", 0)
    if remaining > 0:
        partner = await db.partner_stores.find_one({"id": order["partner_store_id"]})
        if partner:
            new_debt = max(0, partner.get("current_debt", 0) - remaining)
            await db.partner_stores.update_one({"id": order["partner_store_id"]}, {"$set": {"current_debt": new_debt}})
    await db.partner_orders.delete_one({"id": order_id})
    await db.returns.delete_many({"source_id": order_id})
    return {"message": "Pesanan berhasil dihapus"}


@router.post("/partner-orders/{order_id}/pay")
async def pay_partner_order(order_id: str, amount: float, current_user: dict = Depends(get_current_user)):
    order = await db.partner_orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    new_paid = order["paid"] + amount
    new_remaining = order["total"] - new_paid
    result = await db.partner_orders.find_one_and_update(
        {"id": order_id}, {"$set": {"paid": new_paid, "remaining": new_remaining}},
        return_document=True, projection={"_id": 0}
    )
    partner_store = await db.partner_stores.find_one({"id": order["partner_store_id"]})
    if partner_store:
        new_debt = max(0, partner_store.get("current_debt", 0) - amount)
        await db.partner_stores.update_one({"id": order["partner_store_id"]}, {"$set": {"current_debt": new_debt}})
    return result


# ============= PARTNER PRICING =============
@router.get("/partner-prices")
async def get_partner_prices(partner_store_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if partner_store_id:
        query["partner_store_id"] = partner_store_id
    prices = await db.partner_prices.find(query, {"_id": 0}).to_list(10000)
    return prices


@router.put("/partner-prices")
async def set_partner_price(partner_store_id: str, product_id: str, custom_price: float, admin: dict = Depends(require_admin_panel_access)):
    await db.partner_prices.update_one(
        {"partner_store_id": partner_store_id, "product_id": product_id},
        {"$set": {"custom_price": custom_price, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Harga mitra diperbarui"}


@router.delete("/partner-prices")
async def delete_partner_price(partner_store_id: str, product_id: str, admin: dict = Depends(require_admin_panel_access)):
    await db.partner_prices.delete_one({"partner_store_id": partner_store_id, "product_id": product_id})
    return {"message": "Harga mitra dihapus"}


# ============= ORDER SETTLEMENT (Partial Return) =============
from pydantic import BaseModel as PydanticBaseModel
from typing import List as TypingList

class SettlementItem(PydanticBaseModel):
    product_id: str
    product_name: str
    qty_sold: int
    original_qty: int
    price: float

class SettlementRequest(PydanticBaseModel):
    items: TypingList[SettlementItem]


@router.post("/partner-orders/{order_id}/settle")
async def settle_partner_order(order_id: str, data: SettlementRequest, current_user: dict = Depends(get_current_user)):
    """
    Selesaikan pesanan: kanvaser melaporkan item yang laku.
    Sisa otomatis kembali ke stok (satuan → gudang_toko, utuh dus → gudang_utama).
    """
    order = await db.partner_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if order.get("is_settled"):
        raise HTTPException(status_code=400, detail="Pesanan sudah diselesaikan")

    return_items = []
    new_total = 0

    for settle_item in data.items:
        product = await db.products.find_one({"id": settle_item.product_id}, {"_id": 0})
        items_per_box = product.get("items_per_box", 1) if product else 1

        # Find original order item
        order_item = None
        for oi in order.get("items", []):
            if oi.get("product_id") == settle_item.product_id:
                order_item = oi
                break

        original_wh_id = order_item.get("warehouse_id", order.get("warehouse_id", "gudang_utama")) if order_item else "gudang_utama"
        original_wh = await db.warehouses.find_one({"id": original_wh_id}, {"_id": 0})
        original_unit = original_wh.get("unit", "satuan") if original_wh else "satuan"

        # Calculate what was sold in satuan
        if original_unit == "dus":
            original_qty_satuan = settle_item.original_qty * items_per_box
            sold_satuan = settle_item.qty_sold  # qty_sold is in satuan
        else:
            original_qty_satuan = settle_item.original_qty
            sold_satuan = settle_item.qty_sold

        remaining_satuan = original_qty_satuan - sold_satuan
        sold_total = sold_satuan * settle_item.price
        new_total += sold_total

        if remaining_satuan > 0:
            # Calculate full boxes and partial
            full_boxes = int(remaining_satuan // items_per_box) if items_per_box > 0 else 0
            partial_pcs = remaining_satuan - (full_boxes * items_per_box)

            # Return full boxes to gudang_utama
            if full_boxes > 0:
                await db.warehouse_stock.update_one(
                    {"product_id": settle_item.product_id, "warehouse_id": "gudang_utama"},
                    {"$inc": {"stock": full_boxes}}, upsert=True
                )
                return_items.append({
                    "product_id": settle_item.product_id,
                    "product_name": settle_item.product_name,
                    "quantity": full_boxes,
                    "unit": "dus",
                    "warehouse_id": "gudang_utama"
                })

            # Return partial pieces to gudang_toko
            if partial_pcs > 0:
                await db.warehouse_stock.update_one(
                    {"product_id": settle_item.product_id, "warehouse_id": "gudang_toko"},
                    {"$inc": {"stock": partial_pcs}}, upsert=True
                )
                return_items.append({
                    "product_id": settle_item.product_id,
                    "product_name": settle_item.product_name,
                    "quantity": partial_pcs,
                    "unit": "satuan",
                    "warehouse_id": "gudang_toko"
                })

            await recalculate_product_stock(settle_item.product_id)

    # Update order with settled info
    old_total = order.get("total", 0)
    debt_diff = old_total - new_total  # How much debt decreases

    await db.partner_orders.update_one({"id": order_id}, {"$set": {
        "is_settled": True,
        "settled_at": datetime.now(timezone.utc).isoformat(),
        "settled_items": [si.model_dump() for si in data.items],
        "original_total": old_total,
        "total": new_total,
        "subtotal": new_total,
        "remaining": max(0, new_total - order.get("paid", 0)),
        "return_items": return_items,
    }})

    # Adjust partner store debt
    if debt_diff > 0:
        partner = await db.partner_stores.find_one({"id": order["partner_store_id"]})
        if partner:
            new_debt = max(0, partner.get("current_debt", 0) - debt_diff)
            await db.partner_stores.update_one({"id": order["partner_store_id"]}, {"$set": {"current_debt": new_debt}})

    return {
        "message": "Pesanan berhasil diselesaikan",
        "new_total": new_total,
        "return_items": return_items,
        "debt_reduced": debt_diff
    }
