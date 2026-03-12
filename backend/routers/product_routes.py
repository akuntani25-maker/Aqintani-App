from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from database import db
from auth import get_current_user, require_admin, require_admin_panel_access
from models import (
    ProductCreate, Product, CategoryCreate, Category
)
from services import ensure_warehouse_stock, recalculate_product_stock, log_audit

router = APIRouter()


@router.get("/categories", response_model=List[Category])
async def get_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return categories


@router.post("/categories", response_model=Category)
async def create_category(data: CategoryCreate, admin: dict = Depends(require_admin_panel_access)):
    category_doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.categories.insert_one(category_doc)
    return category_doc


@router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, data: CategoryCreate, admin: dict = Depends(require_admin_panel_access)):
    result = await db.categories.find_one_and_update(
        {"id": category_id},
        {"$set": {"name": data.name, "description": data.description}},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    return result


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, admin: dict = Depends(require_admin_panel_access)):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


@router.get("/products")
async def get_products(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    page: Optional[int] = None,
    per_page: int = 15,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}}
        ]
    if category_id:
        query["category_id"] = category_id
    if page is not None:
        total = await db.products.count_documents(query)
        skip = (page - 1) * per_page
        products = await db.products.find(query, {"_id": 0}).sort("name", 1).skip(skip).limit(per_page).to_list(per_page)
        return {"data": products, "total": total, "page": page, "per_page": per_page, "total_pages": (total + per_page - 1) // per_page}
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(100000)
    return products


@router.get("/products/barcode/{barcode}", response_model=Product)
async def get_product_by_barcode(barcode: str, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"barcode": barcode}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/products/low-stock", response_model=List[Product])
async def get_low_stock_products(current_user: dict = Depends(get_current_user)):
    products = await db.products.find(
        {"$expr": {"$lte": ["$stock", "$min_stock_alert"]}},
        {"_id": 0}
    ).to_list(1000)
    return products


@router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/products", response_model=Product)
async def create_product(data: ProductCreate, admin: dict = Depends(require_admin_panel_access)):
    now = datetime.now(timezone.utc)
    items_per_box = data.items_per_box or 1
    warehouse_id = data.warehouse_id or "gudang_utama"
    total_satuan = data.stock * items_per_box

    product_data = data.model_dump()
    product_data.pop("warehouse_id", None)
    product_data["stock"] = total_satuan

    product_doc = {
        "id": str(uuid.uuid4()),
        **product_data,
        "box_price": data.box_price or 0,
        "items_per_box": items_per_box,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.products.insert_one(product_doc)
    await ensure_warehouse_stock(product_doc["id"])

    if data.stock > 0:
        wh = await db.warehouses.find_one({"id": warehouse_id}, {"_id": 0})
        if wh and wh.get("unit") == "satuan":
            await db.warehouse_stock.update_one(
                {"product_id": product_doc["id"], "warehouse_id": warehouse_id},
                {"$set": {"stock": total_satuan}}
            )
        else:
            await db.warehouse_stock.update_one(
                {"product_id": product_doc["id"], "warehouse_id": warehouse_id},
                {"$set": {"stock": data.stock}}
            )

        if data.supplier_id:
            supplier = await db.suppliers.find_one({"id": data.supplier_id}, {"_id": 0})
            supplier_name = supplier["name"] if supplier else ""
            purchase_total = data.cost_price * data.stock
            paid = min(data.initial_paid or 0, purchase_total)
            remaining = purchase_total - paid

            purchase_doc = {
                "id": str(uuid.uuid4()),
                "purchase_number": data.invoice_number or "",
                "supplier_id": data.supplier_id,
                "supplier_name": supplier_name,
                "items": [{
                    "product_id": product_doc["id"],
                    "product_name": data.name,
                    "quantity": data.stock,
                    "cost_price": data.cost_price,
                    "subtotal": purchase_total
                }],
                "total": purchase_total,
                "paid": paid,
                "remaining": remaining,
                "warehouse_id": warehouse_id,
                "notes": f"Pembelian awal - {data.name}" + (" (Tempo)" if remaining > 0 else ""),
                "due_date": data.due_date or "",
                "source": "product_entry",
                "created_at": now.isoformat(),
                "date": now.strftime("%Y-%m-%d")
            }
            await db.purchases.insert_one(purchase_doc)

    return product_doc


@router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, data: ProductCreate, admin: dict = Depends(require_admin_panel_access)):
    old_product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not old_product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = data.model_dump()
    update_data.pop("warehouse_id", None)
    update_data.pop("stock", None)
    update_data.pop("initial_paid", None)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Log price changes
    old_cp = old_product.get("cost_price", 0)
    old_sp = old_product.get("price", 0)
    if old_cp != data.cost_price or old_sp != data.price:
        await db.price_history.insert_one({
            "id": str(uuid.uuid4()),
            "product_id": product_id,
            "product_name": data.name,
            "old_cost_price": old_cp,
            "new_cost_price": data.cost_price,
            "old_price": old_sp,
            "new_price": data.price,
            "changed_by": admin.get("name", ""),
            "changed_at": datetime.now(timezone.utc).isoformat(),
        })

    result = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": update_data},
        return_document=True,
        projection={"_id": 0}
    )

    await ensure_warehouse_stock(product_id)
    await recalculate_product_stock(product_id)
    await log_audit(admin, "update", "product", product_id, {"name": data.name})

    result = await db.products.find_one({"id": product_id}, {"_id": 0})
    return result


@router.get("/products/{product_id}/price-history")
async def get_price_history(product_id: str, current_user: dict = Depends(get_current_user)):
    history = await db.price_history.find(
        {"product_id": product_id}, {"_id": 0}
    ).sort("changed_at", -1).to_list(100)
    return history


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(require_admin_panel_access)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    await log_audit(admin, "delete", "product", product_id, {"name": product.get("name", "") if product else ""})
    return {"message": "Product deleted"}


@router.get("/products/{product_id}/price-comparison")
async def get_product_price_comparison(product_id: str, admin: dict = Depends(require_admin_panel_access)):
    all_purchases = await db.purchases.find({}, {"_id": 0}).to_list(10000)
    price_data = {}
    for purchase in all_purchases:
        for item in purchase.get("items", []):
            if item.get("product_id") == product_id:
                sid = purchase["supplier_id"]
                sname = purchase["supplier_name"]
                if sid not in price_data:
                    price_data[sid] = {"supplier_id": sid, "supplier_name": sname, "prices": [], "last_price": 0, "total_qty": 0}
                price_data[sid]["prices"].append({"price": item.get("cost_price", 0), "date": purchase.get("date", ""), "quantity": item.get("quantity", 0)})
                price_data[sid]["last_price"] = item.get("cost_price", 0)
                price_data[sid]["total_qty"] += item.get("quantity", 0)
    return list(price_data.values())
