from fastapi import APIRouter, HTTPException, Depends
from typing import List
import uuid
from datetime import datetime, timezone

from database import db
from auth import get_current_user, require_admin
from models import CanvasserCreate, Canvasser, PartnerOrder

router = APIRouter()


@router.get("/canvassers", response_model=List[Canvasser])
async def get_canvassers(current_user: dict = Depends(get_current_user)):
    canvassers = await db.canvassers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return canvassers


@router.get("/canvassers/my-orders")
async def get_my_orders(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "canvasser":
        raise HTTPException(status_code=403, detail="Canvasser access only")
    canvasser_id = current_user.get("canvasser_id")
    if not canvasser_id:
        raise HTTPException(status_code=400, detail="Canvasser ID not found")
    orders = await db.partner_orders.find({"canvasser_id": canvasser_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # Enrich with partner store debt info
    store_ids = list(set(o.get("partner_store_id", "") for o in orders if o.get("partner_store_id")))
    stores = await db.partner_stores.find({"id": {"$in": store_ids}}, {"_id": 0, "id": 1, "current_debt": 1}).to_list(500)
    store_debt_map = {s["id"]: s.get("current_debt", 0) for s in stores}

    # Collect all product IDs and warehouse IDs for enrichment
    product_ids = set()
    warehouse_ids = set()
    for o in orders:
        for item in o.get("items", []):
            product_ids.add(item.get("product_id", ""))
            wh_id = item.get("warehouse_id") or o.get("warehouse_id", "gudang_utama")
            warehouse_ids.add(wh_id)

    products = await db.products.find({"id": {"$in": list(product_ids)}}, {"_id": 0, "id": 1, "items_per_box": 1}).to_list(10000)
    prod_ipb_map = {p["id"]: p.get("items_per_box", 1) or 1 for p in products}

    warehouses = await db.warehouses.find({"id": {"$in": list(warehouse_ids)}}, {"_id": 0, "id": 1, "unit": 1}).to_list(100)
    wh_unit_map = {w["id"]: w.get("unit", "satuan") for w in warehouses}

    result = []
    for o in orders:
        od = {k: v for k, v in o.items() if k != "_id"}
        od["store_current_debt"] = store_debt_map.get(o.get("partner_store_id", ""), 0)
        # Enrich items with items_per_box and warehouse_unit
        enriched_items = []
        for item in od.get("items", []):
            ei = {**item}
            ei["items_per_box"] = prod_ipb_map.get(item.get("product_id", ""), 1)
            wh_id = item.get("warehouse_id") or o.get("warehouse_id", "gudang_utama")
            ei["warehouse_unit"] = wh_unit_map.get(wh_id, "satuan")
            enriched_items.append(ei)
        od["items"] = enriched_items
        result.append(od)
    return result


@router.get("/canvassers/notifications")
async def get_canvasser_notifications(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "canvasser":
        raise HTTPException(status_code=403, detail="Canvasser access only")
    canvasser_id = current_user.get("canvasser_id")
    if not canvasser_id:
        return {"new_orders": 0, "pending_orders": 0, "total_remaining": 0}
    pending = await db.partner_orders.count_documents({"canvasser_id": canvasser_id, "status": "pending"})
    orders = await db.partner_orders.find({"canvasser_id": canvasser_id}, {"_id": 0, "remaining": 1}).to_list(1000)
    total_remaining = sum(o.get("remaining", 0) for o in orders)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    new_today = await db.partner_orders.count_documents({"canvasser_id": canvasser_id, "date": today})
    return {"new_orders": new_today, "pending_orders": pending, "total_remaining": total_remaining}


@router.get("/canvassers/my-recap")
async def get_my_recap(date: str = "", current_user: dict = Depends(get_current_user)):
    """Rekap harian untuk kanvaser sendiri."""
    if current_user.get("role") != "canvasser":
        raise HTTPException(status_code=403, detail="Canvasser access only")
    canvasser_id = current_user.get("canvasser_id")
    if not canvasser_id:
        raise HTTPException(status_code=400, detail="Canvasser ID not found")
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    orders = await db.partner_orders.find({"canvasser_id": canvasser_id, "date": date}, {"_id": 0}).to_list(1000)

    total_orders = len(orders)
    total_settled = sum(1 for o in orders if o.get("is_settled"))
    total_value = sum(o.get("total", 0) for o in orders)
    total_paid = sum(o.get("paid", 0) for o in orders)
    stores_visited = list(set(o.get("partner_store_name", "") for o in orders if o.get("partner_store_name")))
    return_items = []
    for o in orders:
        for ri in o.get("return_items", []):
            return_items.append(ri)

    store_details = []
    for o in orders:
        store_details.append({
            "order_number": o.get("order_number"),
            "partner_store_name": o.get("partner_store_name"),
            "total": o.get("total", 0),
            "paid": o.get("paid", 0),
            "remaining": o.get("remaining", 0),
            "status": o.get("status", ""),
            "order_type": o.get("order_type", "regular"),
            "is_settled": o.get("is_settled", False),
            "items_count": len(o.get("items", [])),
        })

    # External purchase expenses
    expenses = await db.canvasser_expenses.find({"canvasser_id": canvasser_id, "date": date}, {"_id": 0}).to_list(100)
    total_external_cost = sum(e.get("total_cost", 0) for e in expenses)

    return {
        "date": date,
        "total_orders": total_orders,
        "total_settled": total_settled,
        "total_value": total_value,
        "total_paid": total_paid,
        "total_remaining": total_value - total_paid,
        "stores_visited": stores_visited,
        "return_items": return_items,
        "store_details": store_details,
        "total_external_cost": total_external_cost,
        "net_sales": total_paid - total_external_cost,
    }




@router.get("/canvassers/product-search")
async def canvasser_product_search(q: str = "", current_user: dict = Depends(get_current_user)):
    if not q or len(q) < 1:
        return []
    query = {"name": {"$regex": q, "$options": "i"}}
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(50)
    warehouses = await db.warehouses.find({}, {"_id": 0}).to_list(100)
    wh_map = {w["id"]: w["name"] for w in warehouses}
    result = []
    for p in products:
        stocks = await db.warehouse_stock.find({"product_id": p["id"]}, {"_id": 0}).to_list(10)
        wh_stocks = [{"warehouse": wh_map.get(s["warehouse_id"], s["warehouse_id"]), "stock": s.get("stock", 0)} for s in stocks if s.get("stock", 0) > 0]
        result.append({
            "id": p["id"], "name": p["name"], "barcode": p.get("barcode", ""),
            "stock": p.get("stock", 0), "price": p.get("price", 0),
            "box_price": p.get("box_price", 0), "items_per_box": p.get("items_per_box", 1),
            "cost_price": p.get("cost_price", 0), "warehouse_stock": wh_stocks
        })
    return result


@router.post("/canvassers", response_model=Canvasser)
async def create_canvasser(data: CanvasserCreate, admin: dict = Depends(require_admin)):
    canvasser_doc = {
        "id": str(uuid.uuid4()), **data.model_dump(),
        "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.canvassers.insert_one(canvasser_doc)
    return canvasser_doc


@router.put("/canvassers/{canvasser_id}", response_model=Canvasser)
async def update_canvasser(canvasser_id: str, data: CanvasserCreate, admin: dict = Depends(require_admin)):
    result = await db.canvassers.find_one_and_update(
        {"id": canvasser_id}, {"$set": data.model_dump()},
        return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Canvasser not found")
    return result


@router.delete("/canvassers/{canvasser_id}")
async def delete_canvasser(canvasser_id: str, admin: dict = Depends(require_admin)):
    result = await db.canvassers.delete_one({"id": canvasser_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Canvasser not found")
    return {"message": "Canvasser deleted"}
