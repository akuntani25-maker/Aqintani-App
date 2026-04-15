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
    new_debt = store.get("current_debt", 0) - amount
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
        new_debt = old_debt - amount
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
    order = await db.partner_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.get("status", "pending")

    # Auto retur stok ketika cancel
    if order_status in ("canceled", "cancelled") and old_status not in ("canceled", "cancelled"):
        await db.warehouses.find({}, {"_id": 0}).to_list(100)

        for item in order.get("items", []):
            item_wh_id = item.get("warehouse_id") or order.get("warehouse_id", "gudang_utama")
            # Skip external purchases - no stock to return
            if item.get("source") == "external":
                continue
            item_wh_id = item.get("warehouse_id") or order.get("warehouse_id", "gudang_utama")
            await db.warehouse_stock.update_one(
                {"product_id": item["product_id"], "warehouse_id": item_wh_id},
                {"$inc": {"stock": item["quantity"]}}, upsert=True
            )
            await recalculate_product_stock(item["product_id"])

        # Kurangi hutang kios mitra
        remaining = order.get("remaining", 0)
        if remaining > 0:
            partner = await db.partner_stores.find_one({"id": order["partner_store_id"]})
            if partner:
                new_debt = max(0, partner.get("current_debt", 0) - remaining)
                await db.partner_stores.update_one({"id": order["partner_store_id"]}, {"$set": {"current_debt": new_debt}})

        await log_audit(
            user=current_user, action="CANCEL_ORDER_RETUR",
            entity_type="partner_order", entity_id=order_id,
            details={
                "order_number": order.get("order_number"),
                "partner_store_name": order.get("partner_store_name"),
                "items_returned": [{"product_name": i["product_name"], "quantity": i["quantity"],
                    "warehouse_id": i.get("warehouse_id") or order.get("warehouse_id", "gudang_utama")}
                    for i in order.get("items", [])],
                "debt_reduced": remaining
            }
        )

    result = await db.partner_orders.find_one_and_update(
        {"id": order_id}, {"$set": {"status": order_status}},
        return_document=True, projection={"_id": 0}
    )
    return result


@router.post("/partner-orders/{order_id}/add-items")
async def add_items_to_order(order_id: str, req: FastAPIRequest, current_user: dict = Depends(get_current_user)):
    """Tambah item ke pesanan existing. Sumber: gudang_utama, gudang_toko, atau external (beli dari luar)."""
    body = await req.json()
    new_items = body.get("items", [])
    if not new_items:
        raise HTTPException(status_code=400, detail="Tidak ada item untuk ditambahkan")

    order = await db.partner_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if order.get("status") in ("canceled", "cancelled"):
        raise HTTPException(status_code=400, detail="Tidak bisa menambah item ke pesanan yang dibatalkan")

    WITA = timezone(timedelta(hours=8))
    now = datetime.now(WITA)
    added_items = []
    total_addition = 0
    total_external_cost = 0

    for ni in new_items:
        source = ni.get("source", "gudang_toko")  # gudang_utama, gudang_toko, external
        product_id = ni["product_id"]
        product_name = ni["product_name"]
        quantity = int(ni["quantity"])
        price = float(ni["price"])
        warehouse_id = ni.get("warehouse_id", source if source != "external" else "")
        external_cost = float(ni.get("external_cost", 0))

        if source in ("gudang_utama", "gudang_toko"):
            wh_stock = await db.warehouse_stock.find_one({"product_id": product_id, "warehouse_id": source})
            current_qty = wh_stock["stock"] if wh_stock else 0
            if current_qty < quantity:
                raise HTTPException(status_code=400, detail=f"Stok tidak cukup untuk {product_name} di {source} (tersedia: {current_qty})")
            await db.warehouse_stock.update_one(
                {"product_id": product_id, "warehouse_id": source},
                {"$inc": {"stock": -quantity}}
            )
            await recalculate_product_stock(product_id)

        wh = await db.warehouses.find_one({"id": warehouse_id}, {"_id": 0}) if warehouse_id else None
        wh_unit = wh.get("unit", "satuan") if wh else "satuan"
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        ipb = product.get("items_per_box", 1) or 1 if product else 1
        subtotal = price * quantity * ipb if wh_unit == "dus" else price * quantity

        item_doc = {
            "product_id": product_id, "product_name": product_name,
            "quantity": quantity, "price": price, "subtotal": subtotal,
            "warehouse_id": warehouse_id,
            "is_addition": True, "source": source,
            "added_at": now.isoformat()
        }
        if source == "external":
            item_doc["external_cost"] = external_cost
            total_external_cost += external_cost * quantity

        added_items.append(item_doc)
        total_addition += subtotal

    # Update order
    existing_items = order.get("items", [])
    all_items = existing_items + added_items
    new_total = order["total"] + total_addition
    new_remaining = order["remaining"] + total_addition
    new_subtotal = order.get("subtotal", order["total"]) + total_addition

    update_data = {
        "items": all_items, "total": new_total, "remaining": new_remaining, "subtotal": new_subtotal
    }
    await db.partner_orders.update_one({"id": order_id}, {"$set": update_data})

    # Update hutang kios mitra
    partner = await db.partner_stores.find_one({"id": order["partner_store_id"]})
    if partner:
        new_debt = partner.get("current_debt", 0) + total_addition
        await db.partner_stores.update_one({"id": order["partner_store_id"]}, {"$set": {"current_debt": new_debt}})

    # Record external purchases as expense for canvasser recap
    if total_external_cost > 0:
        expense_doc = {
            "id": str(uuid.uuid4()), "type": "external_purchase",
            "order_id": order_id, "order_number": order.get("order_number"),
            "canvasser_id": order.get("canvasser_id", ""),
            "canvasser_name": order.get("canvasser_name", ""),
            "partner_store_name": order.get("partner_store_name", ""),
            "items": [i for i in added_items if i["source"] == "external"],
            "total_cost": total_external_cost,
            "created_at": now.isoformat(),
            "date": now.strftime("%Y-%m-%d") if now.hour < 20 else (now + timedelta(days=1)).strftime("%Y-%m-%d")
        }
        await db.canvasser_expenses.insert_one(expense_doc)

    await log_audit(
        user=current_user, action="TAMBAH_ITEM_PESANAN",
        entity_type="partner_order", entity_id=order_id,
        details={
            "order_number": order.get("order_number"),
            "partner_store_name": order.get("partner_store_name"),
            "added_items": [{"name": i["product_name"], "qty": i["quantity"], "source": i["source"]} for i in added_items],
            "total_addition": total_addition,
            "external_cost": total_external_cost
        }
    )

    updated_order = await db.partner_orders.find_one({"id": order_id}, {"_id": 0})
    return updated_order



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
    Sisa otomatis masuk ke stok mobil box (vehicle_stock).
    """
    order = await db.partner_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if order.get("is_settled"):
        raise HTTPException(status_code=400, detail="Pesanan sudah diselesaikan")

    # Find the vehicle for this canvasser
    canvasser_id = order.get("canvasser_id", "")
    canvasser = await db.canvassers.find_one({"id": canvasser_id}, {"_id": 0}) if canvasser_id else None
    vehicle_id = canvasser.get("vehicle_id", "") if canvasser else ""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0}) if vehicle_id else None

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
            sold_satuan = settle_item.qty_sold
        else:
            original_qty_satuan = settle_item.original_qty
            sold_satuan = settle_item.qty_sold

        remaining_satuan = original_qty_satuan - sold_satuan
        sold_total = sold_satuan * settle_item.price
        new_total += sold_total

        if remaining_satuan > 0:
            if vehicle_id and vehicle:
                # Return to vehicle stock
                existing_vs = await db.vehicle_stock.find_one(
                    {"vehicle_id": vehicle_id, "product_id": settle_item.product_id, "remaining_qty": {"$gt": 0}}
                )
                if existing_vs:
                    await db.vehicle_stock.update_one(
                        {"id": existing_vs["id"]},
                        {"$inc": {"remaining_qty": remaining_satuan, "quantity": remaining_satuan}}
                    )
                else:
                    vs_doc = {
                        "id": str(uuid.uuid4()),
                        "vehicle_id": vehicle_id,
                        "vehicle_name": vehicle.get("name", ""),
                        "product_id": settle_item.product_id,
                        "product_name": settle_item.product_name,
                        "quantity": remaining_satuan,
                        "remaining_qty": remaining_satuan,
                        "sold_qty": 0,
                        "returned_qty": 0,
                        "price": settle_item.price,
                        "warehouse_id": original_wh_id,
                        "loaded_at": datetime.now(timezone.utc).isoformat(),
                        "notes": f"Retur dari pesanan {order.get('order_number', '')}",
                        "status": "active"
                    }
                    await db.vehicle_stock.insert_one(vs_doc)

                return_items.append({
                    "product_id": settle_item.product_id,
                    "product_name": settle_item.product_name,
                    "quantity": remaining_satuan,
                    "unit": "satuan",
                    "warehouse_id": f"vehicle:{vehicle_id}",
                    "vehicle_name": vehicle.get("name", "")
                })
            else:
                # Fallback: return to warehouse if no vehicle found
                full_boxes = int(remaining_satuan // items_per_box) if items_per_box > 0 else 0
                partial_pcs = remaining_satuan - (full_boxes * items_per_box)

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
    debt_diff = old_total - new_total

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
            new_debt = partner.get("current_debt", 0) - debt_diff
            await db.partner_stores.update_one({"id": order["partner_store_id"]}, {"$set": {"current_debt": new_debt}})

    return {
        "message": "Pesanan berhasil diselesaikan",
        "new_total": new_total,
        "return_items": return_items,
        "debt_reduced": debt_diff
    }


@router.post("/partner-orders/{order_id}/transfer")
async def transfer_partner_order(order_id: str, req: FastAPIRequest, current_user: dict = Depends(get_current_user)):
    """
    Oper pesanan: pindahkan sebagian/seluruh item dari satu kios ke kios lain.
    Jika kios tujuan sudah punya pesanan aktif, tambahkan ke pesanan yang ada.
    """
    body = await req.json()
    new_store_id = body.get("new_partner_store_id")
    transfer_items = body.get("items", [])
    payment_type = body.get("payment_type", "bon")

    if not new_store_id or not transfer_items:
        raise HTTPException(status_code=400, detail="Data oper pesanan tidak lengkap")

    order = await db.partner_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")

    new_store = await db.partner_stores.find_one({"id": new_store_id}, {"_id": 0})
    if not new_store:
        raise HTTPException(status_code=404, detail="Kios mitra tujuan tidak ditemukan")

    old_store_id = order["partner_store_id"]

    WITA = timezone(timedelta(hours=8))
    now = datetime.now(WITA)

    new_order_items = []
    total_transferred = 0
    old_debt_reduction = 0
    remaining_items = list(order.get("items", []))

    for ti in transfer_items:
        pid = ti["product_id"]
        qty = int(ti["quantity"])
        new_price = float(ti.get("new_price", 0))

        for i, oi in enumerate(remaining_items):
            if oi["product_id"] == pid:
                orig_price = oi["price"]
                if qty > oi["quantity"]:
                    raise HTTPException(status_code=400, detail=f"Qty oper melebihi qty pesanan untuk {oi['product_name']}")
                old_debt_reduction += qty * orig_price
                remaining_items[i] = {**oi, "quantity": oi["quantity"] - qty, "subtotal": (oi["quantity"] - qty) * orig_price}
                subtotal = qty * new_price
                new_order_items.append({
                    "product_id": pid, "product_name": oi["product_name"],
                    "quantity": qty, "price": new_price, "subtotal": subtotal,
                    "warehouse_id": oi.get("warehouse_id", order.get("warehouse_id", "gudang_toko"))
                })
                total_transferred += subtotal
                break

    remaining_items = [it for it in remaining_items if it["quantity"] > 0]
    new_old_total = sum(it["subtotal"] for it in remaining_items)

    # Update original order
    await db.partner_orders.update_one({"id": order_id}, {"$set": {
        "items": remaining_items,
        "subtotal": new_old_total,
        "total": new_old_total,
        "remaining": max(0, new_old_total - order.get("paid", 0)),
    }})

    # Reduce old store debt
    if old_debt_reduction > 0 and order.get("remaining", 0) > 0:
        debt_reduce = min(old_debt_reduction, order.get("remaining", 0))
        await db.partner_stores.update_one({"id": old_store_id}, {"$inc": {"current_debt": -debt_reduce}})

    # Check if target store already has an active order (pending, not settled)
    existing_order = await db.partner_orders.find_one({
        "partner_store_id": new_store_id,
        "status": {"$nin": ["cancelled", "canceled"]},
        "is_settled": {"$ne": True}
    }, {"_id": 0})

    if existing_order:
        # Add items to existing order
        updated_items = list(existing_order.get("items", []))
        for ni in new_order_items:
            found = False
            for j, ei in enumerate(updated_items):
                if ei["product_id"] == ni["product_id"]:
                    new_qty = ei["quantity"] + ni["quantity"]
                    updated_items[j] = {**ei, "quantity": new_qty, "price": ni["price"], "subtotal": new_qty * ni["price"]}
                    found = True
                    break
            if not found:
                updated_items.append(ni)

        new_existing_total = sum(it["subtotal"] for it in updated_items)
        await db.partner_orders.update_one({"id": existing_order["id"]}, {"$set": {
            "items": updated_items,
            "subtotal": new_existing_total,
            "total": new_existing_total,
            "remaining": new_existing_total - existing_order.get("paid", 0),
        }})
        target_order_id = existing_order["id"]
    else:
        # Create new order
        new_order_doc = {
            "id": str(uuid.uuid4()),
            "order_number": f"TR-{now.strftime('%Y%m%d%H%M%S')}",
            "partner_store_id": new_store_id,
            "partner_store_name": new_store["name"],
            "canvasser_id": order.get("canvasser_id", ""),
            "canvasser_name": order.get("canvasser_name", ""),
            "delivery_date": now.strftime("%Y-%m-%d"),
            "date": now.strftime("%Y-%m-%d"),
            "items": new_order_items,
            "subtotal": total_transferred, "discount": 0, "total": total_transferred,
            "paid": total_transferred if payment_type == "cash" else 0,
            "remaining": 0 if payment_type == "cash" else total_transferred,
            "status": "delivered",
            "order_type": "transfer",
            "source_order_id": order_id,
            "warehouse_id": order.get("warehouse_id", "gudang_toko"),
            "is_settled": False, "return_items": [],
            "created_at": now.isoformat()
        }
        await db.partner_orders.insert_one(new_order_doc)
        target_order_id = new_order_doc["id"]

    # Update new store debt if bon
    if payment_type == "bon":
        await db.partner_stores.update_one({"id": new_store_id}, {"$inc": {"current_debt": total_transferred}})

    await log_audit(current_user, "TRANSFER_ORDER", "partner_orders", order_id, {
        "from_store": order.get("partner_store_name", ""),
        "to_store": new_store["name"],
        "items": [{"name": ni["product_name"], "qty": ni["quantity"], "price": ni["price"]} for ni in new_order_items],
        "payment_type": payment_type, "total": total_transferred,
        "merged_to_existing": existing_order is not None
    })

    return {
        "message": f"Pesanan berhasil dioper ke {new_store['name']}" + (" (ditambahkan ke pesanan yang ada)" if existing_order else ""),
        "target_order_id": target_order_id,
        "total_transferred": total_transferred,
        "old_order_new_total": new_old_total
    }



@router.get("/partner-stores/{store_id}/order-items")
async def get_store_order_items(
    store_id: str, search: str = "", date_from: str = "", date_to: str = "",
    admin: dict = Depends(require_admin_panel_access)
):
    """Flatten order items for detailed view with search/filter."""
    query = {"partner_store_id": store_id, "status": {"$nin": ["cancelled", "canceled"]}}
    date_filter = {}
    if date_from:
        date_filter["$gte"] = date_from
    if date_to:
        date_filter["$lte"] = date_to + "T23:59:59"
    if date_filter:
        query["created_at"] = date_filter

    orders = await db.partner_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)

    # Get payments for this store from payment_history collection
    payments = await db.payment_history.find(
        {"type": "partner_store", "reference_id": store_id}, {"_id": 0}
    ).to_list(10000)
    # Group payments by date
    payments_by_date = {}
    for p in payments:
        pdate = p.get("date", p.get("created_at", "")[:10])
        payments_by_date.setdefault(pdate, 0)
        payments_by_date[pdate] += p.get("amount", 0)

    # Batch fetch products for items_per_box
    all_pids = set()
    for o in orders:
        for item in o.get("items", []):
            pid = item.get("product_id", "")
            if pid:
                all_pids.add(pid)
    products_map = {}
    if all_pids:
        prods = await db.products.find({"id": {"$in": list(all_pids)}}, {"_id": 0, "id": 1, "items_per_box": 1}).to_list(10000)
        products_map = {pr["id"]: pr for pr in prods}

    result = []
    for o in orders:
        order_date = o.get("created_at", "")[:10]
        setoran = payments_by_date.get(order_date, 0)
        for item in o.get("items", []):
            product_name = item.get("product_name", "")
            if search and search.lower() not in product_name.lower():
                continue
            prod = products_map.get(item.get("product_id", ""), {})
            ipb = prod.get("items_per_box", 1) or 1
            qty = item.get("quantity", 0)
            unit = item.get("unit") or item.get("sell_unit") or "satuan"
            result.append({
                "order_id": o["id"],
                "order_number": o.get("order_number", ""),
                "date": order_date,
                "product_name": product_name,
                "qty": qty,
                "unit": unit,
                "qty_dus": qty if unit == "dus" else 0,
                "qty_satuan": qty if unit != "dus" else int(qty * ipb),
                "items_per_box": ipb,
                "price": item.get("price", 0),
                "subtotal": item.get("subtotal", qty * item.get("price", 0)),
                "setoran": setoran,
            })
    # Ensure sorted by date descending
    result.sort(key=lambda x: x.get("date", ""), reverse=True)
    return result


@router.post("/partner-stores/{store_id}/import-orders-csv")
async def import_store_orders_csv(store_id: str, req: FastAPIRequest, admin: dict = Depends(require_admin_panel_access)):
    """Import riwayat pesanan dari CSV."""
    body = await req.json()
    rows = body.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="Data import kosong")

    store = await db.partner_stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Kios mitra tidak ditemukan")

    now = datetime.now(timezone.utc)

    # Group rows by date
    grouped = {}
    for row in rows:
        date = row.get("date", now.strftime("%Y-%m-%d"))
        grouped.setdefault(date, []).append(row)

    total_items = 0
    for date, items_list in grouped.items():
        items = []
        total = 0
        for row in items_list:
            qty = int(row.get("qty", 0) or 0)
            price = float(row.get("price", 0) or 0)
            unit = row.get("unit", "satuan").lower()
            subtotal = price * qty
            items.append({
                "product_name": row.get("product_name", ""),
                "product_id": "", "quantity": qty,
                "unit": unit, "price": price, "subtotal": subtotal
            })
            total += subtotal
            total_items += 1

        order_doc = {
            "id": str(uuid.uuid4()),
            "order_number": f"IMP-{date.replace('-', '')}{len(items_list):02d}",
            "partner_store_id": store_id,
            "partner_store_name": store["name"],
            "canvasser_id": "", "canvasser_name": "Import CSV",
            "items": items,
            "total": total, "subtotal": total, "discount": 0,
            "paid": 0, "remaining": total,
            "status": "delivered", "order_type": "reguler",
            "notes": f"Import CSV - {len(items)} item",
            "is_settled": False,
            "date": date,
            "delivery_date": date,
            "warehouse_id": "",
            "created_at": f"{date}T00:00:00",
            "updated_at": now.isoformat()
        }
        await db.partner_orders.insert_one(order_doc)

    # Update store debt
    total_imported = sum(
        float(r.get("price", 0) or 0) * int(r.get("qty", 0) or 0) for r in rows
    )
    await db.partner_stores.update_one(
        {"id": store_id},
        {"$inc": {"current_debt": total_imported}}
    )

    await log_audit(admin, "import_csv", "partner_orders", store_id, {
        "store": store["name"], "dates": len(grouped), "items": total_items
    })

    return {"message": f"Berhasil import {total_items} item dari {len(grouped)} tanggal"}



@router.post("/partner-stores/{store_id}/import-payments-csv")
async def import_store_payments_csv(store_id: str, req: FastAPIRequest, admin: dict = Depends(require_admin_panel_access)):
    """Import riwayat setoran kios mitra dari CSV. Mengurangi piutang."""
    body = await req.json()
    rows = body.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="Data import kosong")

    store = await db.partner_stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Kios mitra tidak ditemukan")

    total_paid = 0
    for row in rows:
        amount = float(row.get("amount", 0) or 0)
        if amount <= 0:
            continue
        date = row.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        notes = row.get("notes", "Import CSV")
        payment_doc = {
            "id": str(uuid.uuid4()), "type": "partner_store", "reference_id": store_id,
            "partner_store_name": store["name"], "amount": amount,
            "notes": notes,
            "created_at": f"{date}T00:00:00", "date": date
        }
        await db.payment_history.insert_one(payment_doc)
        total_paid += amount

    # Reduce store debt
    if total_paid > 0:
        await db.partner_stores.update_one(
            {"id": store_id},
            {"$inc": {"current_debt": -total_paid}}
        )

    await log_audit(admin, "import_payments_csv", "partner_store", store_id, {
        "store": store["name"], "count": len(rows), "total": total_paid
    })

    return {"message": f"Berhasil import {len([r for r in rows if float(r.get('amount',0) or 0) > 0])} pembayaran senilai Rp {total_paid:,.0f}"}
