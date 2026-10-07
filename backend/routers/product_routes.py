from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request as FastAPIRequest, Response
from typing import List, Optional
import uuid
import os
from datetime import datetime, timezone

from database import db
from auth import get_current_user, require_admin, require_admin_panel_access
from models import (
    ProductCreate, Product, CategoryCreate, Category
)
from services import ensure_warehouse_stock, recalculate_product_stock, log_audit
from storage import put_object, get_object, MIME_MAP, APP_NAME

router = APIRouter()


@router.post("/products/upload-image/{product_id}")
async def upload_product_image(product_id: str, file: UploadFile = File(...), admin: dict = Depends(require_admin_panel_access)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(status_code=400, detail="Format gambar tidak didukung (jpg/png/webp)")

    data = await file.read()
    content_type = MIME_MAP.get(ext, "application/octet-stream")
    path = f"{APP_NAME}/products/{product_id}.{ext}"
    try:
        put_object(path, data, content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal upload gambar: {str(e)}")

    image_url = f"/api/products/image-file/{product_id}.{ext}"
    await db.products.update_one({"id": product_id}, {"$set": {"image_url": image_url}})
    return {"image_url": image_url}


@router.get("/products/image-file/{filename}")
async def serve_product_image(filename: str):
    """Serve product image from object storage (public read for simplicity)."""
    path = f"{APP_NAME}/products/{filename}"
    try:
        data, ct = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    return Response(content=data, media_type=ct, headers={"Cache-Control": "public, max-age=86400"})


@router.delete("/products/image/{product_id}")
async def delete_product_image(product_id: str, admin: dict = Depends(require_admin_panel_access)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    # Object storage has no delete API; cukup kosongkan referensi di DB
    await db.products.update_one({"id": product_id}, {"$set": {"image_url": ""}})
    return {"message": "Gambar berhasil dihapus"}


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


@router.get("/products/search-autocomplete")
async def search_products_autocomplete(q: str = "", current_user: dict = Depends(get_current_user)):
    """Search products for autocomplete with stock & supplier info."""
    if len(q) < 1:
        return []
    query = {"$or": [
        {"name": {"$regex": q, "$options": "i"}},
        {"barcode": {"$regex": q, "$options": "i"}}
    ]}
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).limit(15).to_list(15)
    # Enrich with supplier name and warehouse stock
    supplier_ids = list(set(p.get("supplier_id", "") for p in products if p.get("supplier_id")))
    suppliers = await db.suppliers.find({"id": {"$in": supplier_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    sup_map = {s["id"]: s["name"] for s in suppliers}
    result = []
    for p in products:
        result.append({
            "id": p["id"],
            "name": p["name"],
            "barcode": p.get("barcode", ""),
            "stock": p.get("stock", 0),
            "category_id": p.get("category_id", ""),
            "supplier_id": p.get("supplier_id", ""),
            "supplier_name": sup_map.get(p.get("supplier_id", ""), "-"),
            "price": p.get("price", 0),
            "cost_price": p.get("cost_price", 0),
            "supplier_cost_price": p.get("supplier_cost_price", 0),
            "box_price": p.get("box_price", 0),
            "items_per_box": p.get("items_per_box", 1),
            "min_stock_alert": p.get("min_stock_alert", 10),
            "expiry_date": p.get("expiry_date", ""),
            "batch_number": p.get("batch_number", ""),
            "description": p.get("description", ""),
        })
    return result


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


@router.post("/products/bulk")
async def bulk_create_products(req: FastAPIRequest, admin: dict = Depends(require_admin_panel_access)):
    """Bulk add/restock products from a single supplier delivery."""
    body = await req.json()
    supplier_id = body.get("supplier_id", "")
    items = body.get("items", [])
    initial_paid = float(body.get("initial_paid", 0))
    invoice_number = body.get("invoice_number", "")
    due_date = body.get("due_date", "")
    warehouse_id = body.get("warehouse_id", "gudang_utama")

    if not supplier_id or not items:
        raise HTTPException(status_code=400, detail="Supplier dan item harus diisi")

    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier tidak ditemukan")

    now = datetime.now(timezone.utc)
    total_purchase = 0
    purchase_items = []
    created_products = []

    for item in items:
        existing_product_id = item.get("existing_product_id", "")
        name = item.get("name", "")
        stock_dus = int(item.get("stock", 0))
        items_per_box = float(item.get("items_per_box", 1)) or 1
        supplier_cost = float(item.get("supplier_cost_price", 0))
        cost_price = float(item.get("cost_price", 0))
        price = float(item.get("price", 0))
        box_price = float(item.get("box_price", 0))
        barcode = item.get("barcode", "")
        category_id = item.get("category_id", "")
        total_satuan = int(stock_dus * items_per_box)

        if stock_dus <= 0:
            continue

        unit_cost = supplier_cost or cost_price

        if existing_product_id:
            existing = await db.products.find_one({"id": existing_product_id}, {"_id": 0})
            if not existing:
                continue

            wh = await db.warehouses.find_one({"id": warehouse_id}, {"_id": 0})
            if wh and wh.get("unit") == "satuan":
                await db.warehouse_stock.update_one(
                    {"product_id": existing_product_id, "warehouse_id": warehouse_id},
                    {"$inc": {"stock": total_satuan}}, upsert=True
                )
            else:
                await db.warehouse_stock.update_one(
                    {"product_id": existing_product_id, "warehouse_id": warehouse_id},
                    {"$inc": {"stock": stock_dus}}, upsert=True
                )

            update_fields = {"updated_at": now.isoformat()}
            if supplier_cost > 0:
                update_fields["supplier_cost_price"] = supplier_cost
            await db.products.update_one({"id": existing_product_id}, {"$set": update_fields})
            await recalculate_product_stock(existing_product_id)

            purchase_items.append({
                "product_id": existing_product_id,
                "product_name": existing["name"],
                "quantity": stock_dus,
                "cost_price": unit_cost,
                "subtotal": unit_cost * stock_dus
            })
            total_purchase += unit_cost * stock_dus
            created_products.append({"id": existing_product_id, "name": existing["name"], "action": "restock"})
        else:
            product_id = str(uuid.uuid4())
            product_doc = {
                "id": product_id,
                "name": name, "barcode": barcode,
                "category_id": category_id, "supplier_id": supplier_id,
                "stock": total_satuan, "price": price,
                "cost_price": cost_price,
                "supplier_cost_price": supplier_cost or cost_price,
                "box_price": box_price, "items_per_box": items_per_box,
                "expiry_date": "", "batch_number": "",
                "description": "", "min_stock_alert": 10, "image_url": "",
                "created_at": now.isoformat(), "updated_at": now.isoformat()
            }
            await db.products.insert_one(product_doc)
            await ensure_warehouse_stock(product_id)

            wh = await db.warehouses.find_one({"id": warehouse_id}, {"_id": 0})
            if wh and wh.get("unit") == "satuan":
                await db.warehouse_stock.update_one(
                    {"product_id": product_id, "warehouse_id": warehouse_id},
                    {"$set": {"stock": total_satuan}}
                )
            else:
                await db.warehouse_stock.update_one(
                    {"product_id": product_id, "warehouse_id": warehouse_id},
                    {"$set": {"stock": stock_dus}}
                )

            purchase_items.append({
                "product_id": product_id, "product_name": name,
                "quantity": stock_dus, "cost_price": unit_cost,
                "subtotal": unit_cost * stock_dus
            })
            total_purchase += unit_cost * stock_dus
            created_products.append({"id": product_id, "name": name, "action": "new"})

    if purchase_items:
        paid = min(initial_paid, total_purchase)
        remaining = total_purchase - paid
        purchase_doc = {
            "id": str(uuid.uuid4()),
            "purchase_number": invoice_number or "",
            "supplier_id": supplier_id, "supplier_name": supplier["name"],
            "items": purchase_items,
            "total": total_purchase, "paid": paid, "remaining": remaining,
            "warehouse_id": warehouse_id,
            "notes": f"Pembelian bulk - {len(purchase_items)} item" + (" (Tempo)" if remaining > 0 else ""),
            "due_date": due_date or "",
            "source": "bulk_entry",
            "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")
        }
        await db.purchases.insert_one(purchase_doc)
        await log_audit(admin, "bulk_create", "products", "", {
            "supplier": supplier["name"],
            "items_count": len(created_products),
            "total_purchase": total_purchase
        })

    return {
        "message": f"{len(created_products)} barang berhasil diproses",
        "products": created_products,
        "total_purchase": total_purchase,
        "remaining_debt": max(0, total_purchase - initial_paid)
    }


@router.post("/products", response_model=Product)
async def create_product(data: ProductCreate, admin: dict = Depends(require_admin_panel_access)):
    now = datetime.now(timezone.utc)
    items_per_box = data.items_per_box or 1
    warehouse_id = data.warehouse_id or "gudang_utama"
    total_satuan = data.stock * items_per_box
    supplier_cost = data.supplier_cost_price or data.cost_price

    # Handle restock of existing product
    if data.is_restock and data.existing_product_id:
        existing = await db.products.find_one({"id": data.existing_product_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Produk tidak ditemukan")

        # Add stock to warehouse
        if data.stock > 0:
            wh = await db.warehouses.find_one({"id": warehouse_id}, {"_id": 0})
            if wh and wh.get("unit") == "satuan":
                await db.warehouse_stock.update_one(
                    {"product_id": data.existing_product_id, "warehouse_id": warehouse_id},
                    {"$inc": {"stock": total_satuan}}, upsert=True
                )
            else:
                await db.warehouse_stock.update_one(
                    {"product_id": data.existing_product_id, "warehouse_id": warehouse_id},
                    {"$inc": {"stock": data.stock}}, upsert=True
                )

            # Create purchase record for supplier debt (use supplier_cost_price)
            if data.supplier_id:
                supplier = await db.suppliers.find_one({"id": data.supplier_id}, {"_id": 0})
                supplier_name = supplier["name"] if supplier else ""
                purchase_total = supplier_cost * data.stock
                paid = min(data.initial_paid or 0, purchase_total)
                remaining = purchase_total - paid

                purchase_doc = {
                    "id": str(uuid.uuid4()),
                    "purchase_number": data.invoice_number or "",
                    "supplier_id": data.supplier_id,
                    "supplier_name": supplier_name,
                    "items": [{
                        "product_id": data.existing_product_id,
                        "product_name": existing["name"],
                        "quantity": data.stock,
                        "cost_price": supplier_cost,
                        "subtotal": purchase_total
                    }],
                    "total": purchase_total,
                    "paid": paid,
                    "remaining": remaining,
                    "warehouse_id": warehouse_id,
                    "notes": f"Restok - {existing['name']}" + (" (Tempo)" if remaining > 0 else ""),
                    "due_date": data.due_date or "",
                    "source": "product_restock",
                    "created_at": now.isoformat(),
                    "date": now.strftime("%Y-%m-%d")
                }
                await db.purchases.insert_one(purchase_doc)

        # Update supplier_cost_price on product if provided
        update_fields = {"updated_at": now.isoformat()}
        if data.supplier_cost_price:
            update_fields["supplier_cost_price"] = data.supplier_cost_price
        await db.products.update_one({"id": data.existing_product_id}, {"$set": update_fields})

        await recalculate_product_stock(data.existing_product_id)
        await log_audit(admin, "restock", "product", data.existing_product_id, {"name": existing["name"], "qty": data.stock})
        result = await db.products.find_one({"id": data.existing_product_id}, {"_id": 0})
        return result

    # Normal new product creation
    product_data = data.model_dump()
    product_data.pop("warehouse_id", None)
    product_data.pop("is_restock", None)
    product_data.pop("existing_product_id", None)
    product_data["stock"] = total_satuan
    product_data["supplier_cost_price"] = supplier_cost

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
            purchase_total = supplier_cost * data.stock
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
                    "cost_price": supplier_cost,
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
