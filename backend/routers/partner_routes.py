from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from database import db
from auth import get_current_user, require_admin_panel_access
from models import (
    PartnerStoreCreate, PartnerStore,
    PartnerOrderCreate, PartnerOrder
)
from services import recalculate_product_stock

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
