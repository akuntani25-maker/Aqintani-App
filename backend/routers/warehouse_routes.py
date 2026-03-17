from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import uuid
from datetime import datetime, timezone

from database import db
from auth import get_current_user, require_admin_panel_access, require_pos_access
from models import StockAdjustmentCreate, StockTransferCreate
from services import recalculate_product_stock, ensure_warehouse_stock, log_audit

router = APIRouter()


@router.get("/warehouses")
async def get_warehouses(current_user: dict = Depends(get_current_user)):
    warehouses = await db.warehouses.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    if not warehouses:
        defaults = [
            {"id": "gudang_utama", "name": "Gudang Utama", "unit": "dus", "sort_order": 1},
            {"id": "gudang_toko", "name": "Gudang Toko", "unit": "satuan", "sort_order": 2},
            {"id": "gudang_lainnya", "name": "Gudang Lainnya", "unit": "dus", "sort_order": 3},
        ]
        await db.warehouses.insert_many(defaults)
        warehouses = defaults
    return [{k: v for k, v in w.items() if k != "_id"} for w in warehouses]


@router.get("/warehouse-stock")
async def get_warehouse_stock(
    product_id: Optional[str] = None, warehouse_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if product_id:
        query["product_id"] = product_id
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    stocks = await db.warehouse_stock.find(query, {"_id": 0}).to_list(10000)
    return stocks


@router.put("/warehouse-stock")
async def update_warehouse_stock(product_id: str, warehouse_id: str, stock: int, admin: dict = Depends(require_admin_panel_access)):
    await db.warehouse_stock.update_one(
        {"product_id": product_id, "warehouse_id": warehouse_id},
        {"$set": {"stock": stock}}, upsert=True
    )
    await recalculate_product_stock(product_id)
    return {"message": "Stock updated"}


@router.post("/stock-adjustments")
async def create_stock_adjustment(data: StockAdjustmentCreate, admin: dict = Depends(require_admin_panel_access)):
    product = await db.products.find_one({"id": data.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    wh_entry = await db.warehouse_stock.find_one({"product_id": data.product_id, "warehouse_id": data.warehouse_id})
    old_stock = wh_entry["stock"] if wh_entry else 0
    diff = data.new_stock - old_stock
    adjustment = {
        "id": str(uuid.uuid4()), "product_id": data.product_id,
        "product_name": product.get("name", ""), "warehouse_id": data.warehouse_id,
        "old_stock": old_stock, "new_stock": data.new_stock, "difference": diff,
        "reason": data.reason, "adjusted_by": admin.get("name", admin.get("email", "")),
        "date": datetime.now(timezone.utc).isoformat()
    }
    await db.stock_adjustments.insert_one(adjustment)
    await db.warehouse_stock.update_one(
        {"product_id": data.product_id, "warehouse_id": data.warehouse_id},
        {"$set": {"stock": data.new_stock}}, upsert=True
    )
    await recalculate_product_stock(data.product_id)
    return {"message": f"Stok disesuaikan: {old_stock} -> {data.new_stock} ({'+' if diff >= 0 else ''}{diff})", "adjustment": {k: v for k, v in adjustment.items() if k != '_id'}}


@router.get("/stock-adjustments")
async def get_stock_adjustments(product_id: Optional[str] = None, admin: dict = Depends(require_admin_panel_access)):
    query = {}
    if product_id:
        query["product_id"] = product_id
    adjustments = await db.stock_adjustments.find(query, {"_id": 0}).sort("date", -1).to_list(200)
    return adjustments


@router.get("/stock-transfers")
async def get_stock_transfers(product_id: Optional[str] = None, admin: dict = Depends(require_pos_access)):
    query = {}
    if product_id:
        query["product_id"] = product_id
    transfers = await db.stock_transfers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return transfers


@router.post("/stock-transfers")
async def create_stock_transfer(data: StockTransferCreate, admin: dict = Depends(require_pos_access)):
    if data.from_warehouse_id == data.to_warehouse_id:
        raise HTTPException(status_code=400, detail="Gudang asal dan tujuan tidak boleh sama")
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Jumlah harus lebih dari 0")
    product = await db.products.find_one({"id": data.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    from_wh = await db.warehouses.find_one({"id": data.from_warehouse_id}, {"_id": 0})
    to_wh = await db.warehouses.find_one({"id": data.to_warehouse_id}, {"_id": 0})
    if not from_wh or not to_wh:
        raise HTTPException(status_code=404, detail="Gudang tidak ditemukan")
    from_stock_doc = await db.warehouse_stock.find_one({"product_id": data.product_id, "warehouse_id": data.from_warehouse_id})
    from_stock = from_stock_doc["stock"] if from_stock_doc else 0
    if from_stock < data.quantity:
        raise HTTPException(status_code=400, detail=f"Stok {from_wh['name']} tidak cukup ({from_stock} {from_wh['unit']})")
    items_per_box = product.get("items_per_box", 1) or 1
    from_unit = from_wh["unit"]
    to_unit = to_wh["unit"]
    if from_unit == "dus" and to_unit == "satuan":
        converted_qty = data.quantity * items_per_box
    elif from_unit == "satuan" and to_unit == "dus":
        if items_per_box > 0 and data.quantity % items_per_box != 0:
            raise HTTPException(status_code=400, detail=f"Jumlah satuan ({data.quantity}) harus kelipatan {items_per_box} untuk konversi ke dus")
        converted_qty = data.quantity / items_per_box if items_per_box > 0 else data.quantity
    else:
        converted_qty = data.quantity
    await db.warehouse_stock.update_one(
        {"product_id": data.product_id, "warehouse_id": data.from_warehouse_id},
        {"$inc": {"stock": -data.quantity}}
    )
    await db.warehouse_stock.update_one(
        {"product_id": data.product_id, "warehouse_id": data.to_warehouse_id},
        {"$inc": {"stock": converted_qty}}, upsert=True
    )
    now = datetime.now(timezone.utc)
    transfer_doc = {
        "id": str(uuid.uuid4()), "product_id": data.product_id, "product_name": product["name"],
        "from_warehouse_id": data.from_warehouse_id, "from_warehouse_name": from_wh["name"],
        "to_warehouse_id": data.to_warehouse_id, "to_warehouse_name": to_wh["name"],
        "quantity": data.quantity, "from_unit": from_unit,
        "converted_quantity": converted_qty, "to_unit": to_unit, "notes": data.notes,
        "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")
    }
    await db.stock_transfers.insert_one(transfer_doc)
    await recalculate_product_stock(data.product_id)

    # Detect source page from notes
    source_page = "Admin"
    notes_lower = (data.notes or "").lower()
    if "kasir" in notes_lower or "pos" in notes_lower or "oleh:" in notes_lower:
        source_page = "POS"
    await log_audit(
        user=admin,
        action="TRANSFER_STOK",
        entity_type="stock_transfer",
        entity_id=transfer_doc["id"],
        details={
            "product_name": product["name"],
            "product_id": data.product_id,
            "from_warehouse": from_wh["name"],
            "to_warehouse": to_wh["name"],
            "quantity": data.quantity,
            "from_unit": from_unit,
            "converted_quantity": converted_qty,
            "to_unit": to_unit,
            "notes": data.notes,
            "source_page": source_page
        }
    )

    return {k: v for k, v in transfer_doc.items() if k != "_id"}
