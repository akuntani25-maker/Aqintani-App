from database import db
from datetime import datetime, timezone
import uuid


async def log_audit(user: dict, action: str, entity_type: str, entity_id: str, details: dict):
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user.get("id", ""),
        "user_name": user.get("name", user.get("email", "")),
        "user_role": user.get("role", ""),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_log.insert_one(entry)


async def recalculate_product_stock(product_id: str):
    """Recalculate total product stock in satuan equivalent"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        return
    items_per_box = product.get("items_per_box", 1) or 1
    stocks = await db.warehouse_stock.find({"product_id": product_id}, {"_id": 0}).to_list(100)
    total = 0
    for s in stocks:
        wh = await db.warehouses.find_one({"id": s["warehouse_id"]}, {"_id": 0})
        if wh and wh.get("unit") == "dus":
            total += s["stock"] * items_per_box
        else:
            total += s["stock"]
    await db.products.update_one({"id": product_id}, {"$set": {"stock": total}})


async def ensure_warehouse_stock(product_id: str):
    """Ensure warehouse stock entries exist for all warehouses"""
    warehouses = await db.warehouses.find({}, {"_id": 0}).to_list(100)
    for wh in warehouses:
        exists = await db.warehouse_stock.find_one({"product_id": product_id, "warehouse_id": wh["id"]})
        if not exists:
            await db.warehouse_stock.insert_one({
                "product_id": product_id,
                "warehouse_id": wh["id"],
                "stock": 0
            })
