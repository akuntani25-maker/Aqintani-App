from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user, require_admin_panel_access, require_pos_access
from datetime import datetime, timezone, timedelta
from services import log_audit
import uuid

router = APIRouter()

WITA = timezone(timedelta(hours=8))


@router.get("/vehicle-stock")
async def get_vehicle_stock(vehicle_id: str = None, current_user: dict = Depends(get_current_user)):
    """Get all vehicle stock, optionally filtered by vehicle."""
    query = {}
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    stocks = await db.vehicle_stock.find(query, {"_id": 0}).sort("loaded_at", -1).to_list(10000)
    return stocks


@router.get("/vehicle-stock/summary")
async def get_vehicle_stock_summary(current_user: dict = Depends(get_current_user)):
    """Get summary of stock per vehicle."""
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(100)
    products = {p["id"]: p for p in await db.products.find({}, {"_id": 0}).to_list(10000)}

    summaries = []
    for v in vehicles:
        stocks = await db.vehicle_stock.find(
            {"vehicle_id": v["id"], "remaining_qty": {"$gt": 0}}, {"_id": 0}
        ).to_list(10000)

        total_items = len(stocks)
        total_value = 0
        for s in stocks:
            prod = products.get(s["product_id"], {})
            cost = prod.get("cost_price", 0) or 0
            ipb = prod.get("items_per_box", 1) or 1
            total_value += (cost / ipb) * s["remaining_qty"]

        summaries.append({
            "vehicle_id": v["id"],
            "vehicle_name": v.get("name", ""),
            "plate_number": v.get("plate_number", ""),
            "total_items": total_items,
            "total_value": round(total_value),
            "stocks": stocks
        })

    return summaries


@router.post("/vehicle-stock/load")
async def load_vehicle_stock(data: dict, admin: dict = Depends(require_admin_panel_access)):
    """Load items onto a vehicle (from warehouse to vehicle)."""
    vehicle_id = data.get("vehicle_id")
    items = data.get("items", [])
    notes = data.get("notes", "")

    if not vehicle_id or not items:
        raise HTTPException(status_code=400, detail="Vehicle dan items harus diisi")

    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Kendaraan tidak ditemukan")

    now = datetime.now(WITA)
    loaded_items = []

    for item in items:
        product_id = item["product_id"]
        quantity = int(item["quantity"])
        warehouse_id = item.get("warehouse_id", "gudang_toko")

        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        if not product:
            continue

        # Deduct from warehouse
        wh_stock = await db.warehouse_stock.find_one(
            {"product_id": product_id, "warehouse_id": warehouse_id}
        )
        current = wh_stock["stock"] if wh_stock else 0

        ipb = product.get("items_per_box", 1) or 1
        wh = await db.warehouses.find_one({"id": warehouse_id}, {"_id": 0})
        wh_unit = wh.get("unit", "satuan") if wh else "satuan"
        qty_in_wh_unit = quantity / ipb if wh_unit == "dus" else quantity

        # Convert quantity to satuan (pcs) for vehicle stock
        qty_in_pcs = quantity * ipb if wh_unit == "dus" else quantity

        if current < qty_in_wh_unit:
            raise HTTPException(
                status_code=400,
                detail=f"Stok {product['name']} di gudang tidak cukup ({current} tersedia, butuh {qty_in_wh_unit})"
            )

        await db.warehouse_stock.update_one(
            {"product_id": product_id, "warehouse_id": warehouse_id},
            {"$inc": {"stock": -qty_in_wh_unit}}
        )

        # Update total product stock
        await db.products.update_one(
            {"id": product_id},
            {"$inc": {"stock": -qty_in_wh_unit}}
        )

        # Check if same product already on vehicle
        existing = await db.vehicle_stock.find_one(
            {"vehicle_id": vehicle_id, "product_id": product_id, "remaining_qty": {"$gt": 0}},
        )

        if existing:
            await db.vehicle_stock.update_one(
                {"id": existing["id"]},
                {"$inc": {"quantity": qty_in_pcs, "remaining_qty": qty_in_pcs}}
            )
        else:
            stock_doc = {
                "id": str(uuid.uuid4()),
                "vehicle_id": vehicle_id,
                "vehicle_name": vehicle.get("name", ""),
                "product_id": product_id,
                "product_name": product["name"],
                "quantity": qty_in_pcs,
                "remaining_qty": qty_in_pcs,
                "sold_qty": 0,
                "returned_qty": 0,
                "price": item.get("price", product.get("sell_price", 0)),
                "warehouse_id": warehouse_id,
                "loaded_at": now.isoformat(),
                "notes": notes,
                "status": "active"
            }
            await db.vehicle_stock.insert_one(stock_doc)

        loaded_items.append({
            "product_name": product["name"],
            "quantity": qty_in_pcs
        })

    await log_audit(admin, "LOAD_VEHICLE_STOCK", "vehicle_stock", vehicle_id, {
        "vehicle_name": vehicle.get("name", ""),
        "items": loaded_items, "notes": notes
    })

    return {"message": f"{len(loaded_items)} item dimuat ke {vehicle.get('name', '')}"}


@router.post("/vehicle-stock/{stock_id}/sell")
async def sell_vehicle_stock(stock_id: str, data: dict, admin: dict = Depends(require_pos_access)):
    """Sell items from vehicle stock to a partner store."""
    partner_store_id = data.get("partner_store_id")
    quantity = int(data.get("quantity", 0))
    payment_type = data.get("payment_type", "bon")  # "cash" or "bon"

    if not partner_store_id or quantity <= 0:
        raise HTTPException(status_code=400, detail="Data penjualan tidak valid")

    stock = await db.vehicle_stock.find_one({"id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stok kendaraan tidak ditemukan")

    if quantity > stock["remaining_qty"]:
        raise HTTPException(
            status_code=400,
            detail=f"Stok tidak cukup (tersedia: {stock['remaining_qty']})"
        )

    store = await db.partner_stores.find_one({"id": partner_store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Kios mitra tidak ditemukan")

    now = datetime.now(WITA)
    subtotal = quantity * stock["price"]

    # Update vehicle stock
    await db.vehicle_stock.update_one({"id": stock_id}, {
        "$inc": {"remaining_qty": -quantity, "sold_qty": quantity}
    })

    # Create partner order
    order_doc = {
        "id": str(uuid.uuid4()),
        "order_number": f"VS-{now.strftime('%Y%m%d%H%M%S')}",
        "partner_store_id": partner_store_id,
        "partner_store_name": store["name"],
        "canvasser_id": "",
        "canvasser_name": "",
        "delivery_date": now.strftime("%Y-%m-%d"),
        "date": now.strftime("%Y-%m-%d"),
        "items": [{
            "product_id": stock["product_id"],
            "product_name": stock["product_name"],
            "quantity": quantity,
            "price": stock["price"],
            "subtotal": subtotal,
            "warehouse_id": stock["warehouse_id"]
        }],
        "subtotal": subtotal,
        "discount": 0,
        "total": subtotal,
        "paid": subtotal if payment_type == "cash" else 0,
        "remaining": 0 if payment_type == "cash" else subtotal,
        "status": "delivered",
        "order_type": "kondisional",
        "warehouse_id": stock["warehouse_id"],
        "source": "vehicle_stock",
        "vehicle_stock_id": stock_id,
        "is_settled": True,
        "settled_items": [{
            "product_id": stock["product_id"],
            "product_name": stock["product_name"],
            "qty_sold": quantity,
            "original_qty": quantity,
            "price": stock["price"]
        }],
        "return_items": [],
        "created_at": now.isoformat()
    }
    await db.partner_orders.insert_one(order_doc)

    # If bon, add to partner debt
    if payment_type == "bon":
        await db.partner_stores.update_one(
            {"id": partner_store_id},
            {"$inc": {"current_debt": subtotal}}
        )

    # Record in payment_history if cash
    if payment_type == "cash":
        payment_doc = {
            "id": str(uuid.uuid4()),
            "type": "partner_store_cash",
            "reference_id": partner_store_id,
            "partner_store_name": store["name"],
            "amount": subtotal,
            "notes": f"Pembayaran tunai dari stok mobil: {stock['product_name']} x{quantity}",
            "created_at": now.isoformat(),
            "date": now.strftime("%Y-%m-%d")
        }
        await db.payment_history.insert_one(payment_doc)

    return {
        "message": f"{quantity}x {stock['product_name']} terjual ke {store['name']} ({payment_type})",
        "order_id": order_doc["id"],
        "subtotal": subtotal
    }


@router.post("/vehicle-stock/{stock_id}/return")
async def return_vehicle_stock(stock_id: str, data: dict, admin: dict = Depends(require_pos_access)):
    """Return items from vehicle stock back to warehouse."""
    quantity = int(data.get("quantity", 0))
    notes = data.get("notes", "")
    target_warehouse = data.get("warehouse_id", "")

    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Jumlah retur harus > 0")

    stock = await db.vehicle_stock.find_one({"id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stok kendaraan tidak ditemukan")

    if quantity > stock["remaining_qty"]:
        raise HTTPException(
            status_code=400,
            detail=f"Jumlah retur melebihi sisa stok (tersedia: {stock['remaining_qty']})"
        )

    product = await db.products.find_one({"id": stock["product_id"]}, {"_id": 0})
    ipb = product.get("items_per_box", 1) or 1 if product else 1
    warehouse_id = target_warehouse or stock.get("warehouse_id", "gudang_toko")
    wh = await db.warehouses.find_one({"id": warehouse_id}, {"_id": 0})
    wh_unit = wh.get("unit", "satuan") if wh else "satuan"
    qty_in_wh_unit = quantity / ipb if wh_unit == "dus" else quantity

    # Update vehicle stock
    await db.vehicle_stock.update_one({"id": stock_id}, {
        "$inc": {"remaining_qty": -quantity, "returned_qty": quantity}
    })

    # Return to warehouse
    await db.warehouse_stock.update_one(
        {"product_id": stock["product_id"], "warehouse_id": warehouse_id},
        {"$inc": {"stock": qty_in_wh_unit}},
        upsert=True
    )
    await db.products.update_one(
        {"id": stock["product_id"]},
        {"$inc": {"stock": qty_in_wh_unit}}
    )

    now = datetime.now(WITA)
    await log_audit(admin, "RETURN_VEHICLE_STOCK", "vehicle_stock", stock_id, {
        "product_name": stock["product_name"],
        "quantity": quantity, "notes": notes,
        "vehicle_name": stock.get("vehicle_name", "")
    })

    return {
        "message": f"{quantity}x {stock['product_name']} dikembalikan ke gudang",
        "new_remaining": stock["remaining_qty"] - quantity
    }


@router.get("/vehicle-stock/total-value")
async def get_vehicle_stock_total_value(current_user: dict = Depends(get_current_user)):
    """Get total value of all vehicle stock for asset calculation."""
    stocks = await db.vehicle_stock.find({"remaining_qty": {"$gt": 0}}, {"_id": 0}).to_list(10000)
    products = {p["id"]: p for p in await db.products.find({}, {"_id": 0}).to_list(10000)}

    total = 0
    for s in stocks:
        prod = products.get(s["product_id"], {})
        cost = prod.get("cost_price", 0) or 0
        ipb = prod.get("items_per_box", 1) or 1
        total += (cost / ipb) * s["remaining_qty"]

    return {"total_value": round(total)}



@router.put("/vehicle-stock/{stock_id}/edit-price")
async def edit_vehicle_stock_price(stock_id: str, data: dict, admin: dict = Depends(require_pos_access)):
    """Edit harga jual item di stok kendaraan."""
    new_price = float(data.get("price", 0))
    if new_price < 0:
        raise HTTPException(status_code=400, detail="Harga tidak boleh negatif")

    stock = await db.vehicle_stock.find_one({"id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(status_code=404, detail="Stok kendaraan tidak ditemukan")

    await db.vehicle_stock.update_one({"id": stock_id}, {"$set": {"price": new_price}})

    return {"message": f"Harga {stock['product_name']} diubah ke {new_price}", "new_price": new_price}
