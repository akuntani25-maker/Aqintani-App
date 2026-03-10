from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from io import StringIO
import csv
import uuid
from datetime import datetime, timezone, timedelta
from starlette.responses import StreamingResponse

from database import db
from auth import get_current_user, require_admin_panel_access
from models import SupplierCreate, Supplier, PurchaseCreate, Purchase
from services import ensure_warehouse_stock, recalculate_product_stock

router = APIRouter()


@router.get("/suppliers")
async def get_suppliers(
    search: Optional[str] = None,
    page: Optional[int] = None,
    per_page: int = 15,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if page is not None:
        total = await db.suppliers.count_documents(query)
        skip = (page - 1) * per_page
        suppliers = await db.suppliers.find(query, {"_id": 0}).sort("name", 1).skip(skip).limit(per_page).to_list(per_page)
        return {"data": suppliers, "total": total, "page": page, "per_page": per_page, "total_pages": (total + per_page - 1) // per_page}
    suppliers = await db.suppliers.find(query, {"_id": 0}).sort("name", 1).to_list(10000)
    return suppliers


@router.post("/suppliers", response_model=Supplier)
async def create_supplier(data: SupplierCreate, admin: dict = Depends(require_admin_panel_access)):
    supplier_doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "contact_person": data.contact_person,
        "phone": data.phone,
        "email": data.email,
        "address": data.address,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.suppliers.insert_one(supplier_doc)
    return supplier_doc


@router.put("/suppliers/{supplier_id}", response_model=Supplier)
async def update_supplier(supplier_id: str, data: SupplierCreate, admin: dict = Depends(require_admin_panel_access)):
    result = await db.suppliers.find_one_and_update(
        {"id": supplier_id},
        {"$set": data.model_dump()},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return result


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, admin: dict = Depends(require_admin_panel_access)):
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deleted"}


@router.get("/suppliers/{supplier_id}/purchases")
async def get_supplier_purchases(supplier_id: str, admin: dict = Depends(require_admin_panel_access)):
    purchases = await db.purchases.find({"supplier_id": supplier_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return purchases


@router.get("/suppliers/{supplier_id}/payments")
async def get_supplier_payments(supplier_id: str, current_user: dict = Depends(get_current_user)):
    payments = await db.payment_history.find(
        {"type": "supplier", "supplier_id": supplier_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return payments


@router.get("/suppliers/{supplier_id}/debt")
async def get_supplier_debt(supplier_id: str, admin: dict = Depends(require_admin_panel_access)):
    purchases = await db.purchases.find({"supplier_id": supplier_id}, {"_id": 0}).to_list(1000)
    total_purchases = sum(p.get("total", 0) for p in purchases)
    total_paid = sum(p.get("paid", 0) for p in purchases)
    total_remaining = total_purchases - total_paid
    return {
        "supplier_id": supplier_id,
        "total_purchases": total_purchases,
        "total_paid": total_paid,
        "total_remaining": total_remaining,
        "purchase_count": len(purchases)
    }


# ============= PURCHASES =============
@router.get("/purchases")
async def get_purchases(supplier_id: Optional[str] = None, admin: dict = Depends(require_admin_panel_access)):
    query = {}
    if supplier_id:
        query["supplier_id"] = supplier_id
    purchases = await db.purchases.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return purchases


@router.put("/purchases/{purchase_id}/due-date")
async def set_purchase_due_date(purchase_id: str, due_date: str = "", admin: dict = Depends(require_admin_panel_access)):
    update = {"$set": {"due_date": due_date}} if due_date else {"$unset": {"due_date": ""}}
    result = await db.purchases.update_one({"id": purchase_id}, update)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pembelian tidak ditemukan")
    return {"message": "Tanggal jatuh tempo berhasil diperbarui"}


@router.post("/purchases/{purchase_id}/return")
async def process_purchase_return(purchase_id: str, request: Request, admin: dict = Depends(require_admin_panel_access)):
    body = await request.json()
    items = body.get("items", [])
    notes = body.get("notes", "")
    warehouse_id = body.get("warehouse_id", "gudang_utama")

    purchase = await db.purchases.find_one({"id": purchase_id}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Pembelian tidak ditemukan")

    now = datetime.now(timezone.utc)
    total_return_value = 0
    return_items = []

    for item in items:
        product_id = item.get("product_id")
        qty = int(item.get("quantity", 0))
        if qty <= 0:
            continue
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        if not product:
            continue
        purchase_item = next((pi for pi in purchase.get("items", []) if pi["product_id"] == product_id), None)
        cost = purchase_item["cost_price"] if purchase_item else product.get("cost_price", 0)
        subtotal = qty * cost
        total_return_value += subtotal
        return_items.append({
            "product_id": product_id, "product_name": product["name"],
            "quantity": qty, "cost_price": cost, "subtotal": subtotal
        })
        wh_stock = await db.warehouse_stock.find_one({"product_id": product_id, "warehouse_id": warehouse_id})
        if wh_stock:
            new_stock = max(0, wh_stock.get("stock", 0) - qty)
            await db.warehouse_stock.update_one(
                {"product_id": product_id, "warehouse_id": warehouse_id},
                {"$set": {"stock": new_stock}}
            )
        await recalculate_product_stock(product_id)

    if not return_items:
        raise HTTPException(status_code=400, detail="Tidak ada item yang diretur")

    new_remaining = max(0, purchase.get("remaining", 0) - total_return_value)
    await db.purchases.update_one({"id": purchase_id}, {"$set": {"remaining": new_remaining}})

    return_doc = {
        "id": str(uuid.uuid4()), "type": "supplier_return", "purchase_id": purchase_id,
        "supplier_id": purchase.get("supplier_id"), "supplier_name": purchase.get("supplier_name"),
        "items": return_items, "total": total_return_value, "warehouse_id": warehouse_id,
        "notes": notes or f"Retur ke {purchase.get('supplier_name', '')}",
        "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")
    }
    await db.payment_history.insert_one(return_doc)

    return {"message": f"Retur berhasil. Hutang berkurang {total_return_value}", "return_value": total_return_value, "new_remaining": new_remaining}


@router.post("/purchases", response_model=Purchase)
async def create_purchase(data: PurchaseCreate, admin: dict = Depends(require_admin_panel_access)):
    supplier = await db.suppliers.find_one({"id": data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    warehouse_id = data.warehouse_id or "gudang_utama"
    now = datetime.now(timezone.utc)
    purchase_doc = {
        "id": str(uuid.uuid4()), "supplier_id": data.supplier_id,
        "supplier_name": supplier["name"], "items": data.items, "total": data.total,
        "paid": data.paid, "remaining": data.total - data.paid,
        "warehouse_id": warehouse_id, "notes": data.notes,
        "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")
    }
    await db.purchases.insert_one(purchase_doc)
    for item in data.items:
        pid = item.get("product_id")
        qty = item.get("quantity", 0)
        if pid and qty > 0:
            await ensure_warehouse_stock(pid)
            await db.warehouse_stock.update_one(
                {"product_id": pid, "warehouse_id": warehouse_id},
                {"$inc": {"stock": qty}}, upsert=True
            )
            await recalculate_product_stock(pid)
    return purchase_doc


@router.post("/purchases/{purchase_id}/pay")
async def pay_purchase(purchase_id: str, amount: float, admin: dict = Depends(require_admin_panel_access)):
    purchase = await db.purchases.find_one({"id": purchase_id})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    new_paid = purchase["paid"] + amount
    new_remaining = purchase["total"] - new_paid
    result = await db.purchases.find_one_and_update(
        {"id": purchase_id},
        {"$set": {"paid": new_paid, "remaining": new_remaining}},
        return_document=True, projection={"_id": 0}
    )
    await db.payment_history.insert_one({
        "id": str(uuid.uuid4()), "type": "supplier", "reference_id": purchase_id,
        "supplier_id": purchase.get("supplier_id", ""), "supplier_name": purchase.get("supplier_name", ""),
        "amount": amount, "notes": f"Pembayaran pembelian {purchase.get('id', '')}",
        "created_at": datetime.now(timezone.utc).isoformat(), "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    })
    return result


@router.delete("/purchases/{purchase_id}")
async def delete_purchase(purchase_id: str, admin: dict = Depends(require_admin_panel_access)):
    result = await db.purchases.delete_one({"id": purchase_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return {"message": "Purchase deleted"}


# ============= PAYMENT HISTORY =============
@router.get("/payment-history")
async def get_payment_history(type: Optional[str] = None, reference_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if type:
        query["type"] = type
    if reference_id:
        query["reference_id"] = reference_id
    history = await db.payment_history.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return history


# ============= SUPPLIER DEBT MANAGEMENT =============
@router.get("/supplier-debts/overview")
async def get_supplier_debts_overview(admin: dict = Depends(require_admin_panel_access)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    purchases = await db.purchases.find({}, {"_id": 0}).to_list(10000)
    supplier_purchases = {}
    for p in purchases:
        sid = p.get("supplier_id", "")
        if sid not in supplier_purchases:
            supplier_purchases[sid] = []
        supplier_purchases[sid].append(p)

    result = []
    for s in suppliers:
        sid = s["id"]
        sp = supplier_purchases.get(sid, [])
        total_purchases = sum(p.get("total", 0) for p in sp)
        total_paid = sum(p.get("paid", 0) for p in sp)
        outstanding = total_purchases - total_paid
        unpaid_purchases = [p for p in sp if p.get("remaining", 0) > 0]
        last_purchase_date = max((p.get("date", "") for p in sp), default="") if sp else ""
        oldest_unpaid_date = ""
        if unpaid_purchases:
            oldest_unpaid_date = min(p.get("date", "") for p in unpaid_purchases)
        result.append({
            "supplier_id": sid, "supplier_name": s["name"], "phone": s.get("phone", ""),
            "contact_person": s.get("contact_person", ""), "total_purchases": total_purchases,
            "total_paid": total_paid, "outstanding": outstanding, "purchase_count": len(sp),
            "unpaid_count": len(unpaid_purchases), "last_purchase_date": last_purchase_date,
            "oldest_unpaid_date": oldest_unpaid_date,
        })
    result.sort(key=lambda x: (-1 if x["outstanding"] > 0 else 0, -x["outstanding"]))
    return result


@router.get("/supplier-debts/summary")
async def get_supplier_debts_summary(admin: dict = Depends(require_admin_panel_access)):
    purchases = await db.purchases.find({}, {"_id": 0}).to_list(10000)
    total_debt = sum(max(0, p.get("remaining", 0)) for p in purchases)
    suppliers_with_debt = len(set(p["supplier_id"] for p in purchases if p.get("remaining", 0) > 0))
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    payments_this_month = await db.payment_history.find(
        {"type": "supplier", "created_at": {"$gte": month_start}}, {"_id": 0}
    ).to_list(10000)
    total_paid_this_month = sum(p.get("amount", 0) for p in payments_this_month)
    thirty_days_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    overdue_purchases = [p for p in purchases if p.get("remaining", 0) > 0 and p.get("date", "") <= thirty_days_ago]
    overdue_total = sum(p.get("remaining", 0) for p in overdue_purchases)
    return {
        "total_debt": total_debt, "suppliers_with_debt": suppliers_with_debt,
        "total_paid_this_month": total_paid_this_month, "payments_this_month_count": len(payments_this_month),
        "overdue_count": len(overdue_purchases), "overdue_total": overdue_total,
    }


@router.get("/supplier-debts/{supplier_id}/purchases")
async def get_supplier_unpaid_purchases(supplier_id: str, show_all: bool = False, admin: dict = Depends(require_admin_panel_access)):
    query = {"supplier_id": supplier_id}
    if not show_all:
        query["remaining"] = {"$gt": 0}
    purchases = await db.purchases.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return purchases


@router.post("/supplier-debts/{supplier_id}/pay")
async def pay_supplier_debt(supplier_id: str, amount: float, notes: str = "", admin: dict = Depends(require_admin_panel_access)):
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    unpaid = await db.purchases.find(
        {"supplier_id": supplier_id, "remaining": {"$gt": 0}}, {"_id": 0}
    ).sort("date", 1).to_list(1000)
    if not unpaid:
        raise HTTPException(status_code=400, detail="Tidak ada hutang untuk supplier ini")
    remaining_amount = amount
    paid_purchases = []
    for purchase in unpaid:
        if remaining_amount <= 0:
            break
        purchase_remaining = purchase.get("remaining", 0)
        pay_this = min(remaining_amount, purchase_remaining)
        new_paid = purchase["paid"] + pay_this
        new_remaining = purchase["total"] - new_paid
        await db.purchases.update_one(
            {"id": purchase["id"]},
            {"$set": {"paid": new_paid, "remaining": max(0, new_remaining)}}
        )
        paid_purchases.append({"purchase_id": purchase["id"], "amount": pay_this})
        remaining_amount -= pay_this
    payment_doc = {
        "id": str(uuid.uuid4()), "type": "supplier", "reference_id": supplier_id,
        "supplier_id": supplier_id, "supplier_name": supplier["name"], "amount": amount,
        "notes": notes or f"Pembayaran hutang ke {supplier['name']}",
        "paid_purchases": paid_purchases,
        "created_at": datetime.now(timezone.utc).isoformat(), "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    await db.payment_history.insert_one(payment_doc)
    all_purchases = await db.purchases.find({"supplier_id": supplier_id}, {"_id": 0}).to_list(1000)
    new_total_debt = sum(max(0, p.get("remaining", 0)) for p in all_purchases)
    return {
        "message": "Pembayaran berhasil dicatat", "amount_paid": amount,
        "new_total_debt": new_total_debt, "paid_purchases": paid_purchases, "payment_id": payment_doc["id"]
    }


@router.get("/supplier-debts/export-csv")
async def export_supplier_debts_csv(admin: dict = Depends(require_admin_panel_access)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    purchases = await db.purchases.find({}, {"_id": 0}).to_list(10000)
    supplier_purchases = {}
    for p in purchases:
        sid = p.get("supplier_id", "")
        if sid not in supplier_purchases:
            supplier_purchases[sid] = []
        supplier_purchases[sid].append(p)
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Supplier", "Kontak", "Telepon", "Jml Pembelian", "Total Pembelian", "Total Dibayar", "Sisa Hutang", "Pembelian Belum Lunas", "Tanggal Pembelian Terakhir"])
    for s in suppliers:
        sid = s["id"]
        sp = supplier_purchases.get(sid, [])
        total = sum(p.get("total", 0) for p in sp)
        paid = sum(p.get("paid", 0) for p in sp)
        outstanding = total - paid
        unpaid_count = len([p for p in sp if p.get("remaining", 0) > 0])
        last_date = max((p.get("date", "") for p in sp), default="-") if sp else "-"
        if outstanding > 0 or len(sp) > 0:
            writer.writerow([
                s["name"], s.get("contact_person", ""), s.get("phone", ""),
                len(sp), f"{total:.0f}", f"{paid:.0f}", f"{outstanding:.0f}",
                unpaid_count, last_date
            ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=hutang_supplier_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
    )
