from fastapi import APIRouter, HTTPException, Depends, Request as FastAPIRequest
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta

from database import db
from auth import get_current_user, require_admin, require_admin_or_manager

router = APIRouter()


# ============= BORROWERS / PIUTANG PRIBADI =============

@router.get("/personal-loans/overview")
async def get_personal_loans_overview(current_user: dict = Depends(require_admin_or_manager)):
    loans = await db.personal_loans.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    total_lent = sum(l.get("amount", 0) for l in loans)
    total_paid = sum(l.get("paid", 0) for l in loans)
    total_remaining = sum(l.get("remaining", 0) for l in loans)
    active_count = len([l for l in loans if l.get("remaining", 0) > 0])
    return {
        "loans": loans,
        "total_lent": total_lent,
        "total_paid": total_paid,
        "total_remaining": total_remaining,
        "active_count": active_count,
        "total_count": len(loans)
    }


@router.post("/personal-loans")
async def create_personal_loan(
    borrower_name: str, amount: float,
    borrower_phone: str = "", loan_type: str = "cash",
    description: str = "", initial_paid: float = 0,
    current_user: dict = Depends(require_admin_or_manager)
):
    now = datetime.now(timezone.utc)
    paid = min(initial_paid, amount)
    doc = {
        "id": str(uuid.uuid4()),
        "borrower_name": borrower_name,
        "borrower_phone": borrower_phone,
        "loan_type": loan_type,
        "description": description,
        "amount": amount,
        "paid": paid,
        "remaining": amount - paid,
        "status": "lunas" if paid >= amount else "aktif",
        "created_by": current_user.get("name", ""),
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d")
    }
    await db.personal_loans.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/personal-loans/{loan_id}")
async def update_personal_loan(
    loan_id: str, borrower_name: str = None, borrower_phone: str = None,
    description: str = None, amount: float = None,
    current_user: dict = Depends(require_admin_or_manager)
):
    loan = await db.personal_loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Piutang tidak ditemukan")
    update = {}
    if borrower_name is not None:
        update["borrower_name"] = borrower_name
    if borrower_phone is not None:
        update["borrower_phone"] = borrower_phone
    if description is not None:
        update["description"] = description
    if amount is not None:
        update["amount"] = amount
        update["remaining"] = amount - loan.get("paid", 0)
        update["status"] = "lunas" if update["remaining"] <= 0 else "aktif"
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada data yang diubah")
    result = await db.personal_loans.find_one_and_update(
        {"id": loan_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    return result


@router.delete("/personal-loans/{loan_id}")
async def delete_personal_loan(loan_id: str, current_user: dict = Depends(require_admin_or_manager)):
    result = await db.personal_loans.delete_one({"id": loan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Piutang tidak ditemukan")
    await db.loan_payments.delete_many({"loan_id": loan_id})
    return {"message": "Piutang berhasil dihapus"}


@router.post("/personal-loans/{loan_id}/pay")
async def pay_personal_loan(
    loan_id: str, amount: float, notes: str = "",
    current_user: dict = Depends(require_admin_or_manager)
):
    loan = await db.personal_loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Piutang tidak ditemukan")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Jumlah harus lebih dari 0")
    new_paid = loan["paid"] + amount
    new_remaining = max(0, loan["amount"] - new_paid)
    new_status = "lunas" if new_remaining <= 0 else "aktif"
    await db.personal_loans.update_one(
        {"id": loan_id},
        {"$set": {"paid": new_paid, "remaining": new_remaining, "status": new_status}}
    )
    now = datetime.now(timezone.utc)
    payment = {
        "id": str(uuid.uuid4()),
        "loan_id": loan_id,
        "borrower_name": loan["borrower_name"],
        "amount": amount,
        "notes": notes,
        "recorded_by": current_user.get("name", ""),
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d")
    }
    await db.loan_payments.insert_one(payment)
    return {"message": "Pembayaran berhasil", "new_paid": new_paid, "new_remaining": new_remaining, "status": new_status}


@router.get("/personal-loans/{loan_id}/payments")
async def get_loan_payments(loan_id: str, current_user: dict = Depends(require_admin_or_manager)):
    payments = await db.loan_payments.find({"loan_id": loan_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return payments


# ============= FARMERS / PETANI =============

@router.get("/farmers")
async def get_farmers(current_user: dict = Depends(get_current_user)):
    farmers = await db.farmers.find({}, {"_id": 0}).sort("name", 1).to_list(10000)
    return farmers


@router.post("/farmers")
async def create_farmer(
    name: str, phone: str = "", address: str = "", debt_limit: float = 0,
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "phone": phone,
        "address": address,
        "debt_limit": debt_limit,
        "current_debt": 0,
        "created_at": now.isoformat()
    }
    await db.farmers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/farmers/{farmer_id}")
async def update_farmer(
    farmer_id: str, name: str = None, phone: str = None,
    address: str = None, debt_limit: float = None,
    current_user: dict = Depends(get_current_user)
):
    farmer = await db.farmers.find_one({"id": farmer_id}, {"_id": 0})
    if not farmer:
        raise HTTPException(status_code=404, detail="Petani tidak ditemukan")
    update = {}
    if name is not None:
        update["name"] = name
    if phone is not None:
        update["phone"] = phone
    if address is not None:
        update["address"] = address
    if debt_limit is not None:
        update["debt_limit"] = debt_limit
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada data yang diubah")
    result = await db.farmers.find_one_and_update(
        {"id": farmer_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    return result


@router.delete("/farmers/{farmer_id}")
async def delete_farmer(farmer_id: str, current_user: dict = Depends(require_admin_or_manager)):
    result = await db.farmers.delete_one({"id": farmer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Petani tidak ditemukan")
    return {"message": "Petani berhasil dihapus"}


@router.get("/farmer-debts/overview")
async def get_farmer_debts_overview(current_user: dict = Depends(get_current_user)):
    farmers = await db.farmers.find({}, {"_id": 0}).sort("name", 1).to_list(10000)
    total_debt = sum(f.get("current_debt", 0) for f in farmers)
    active_count = len([f for f in farmers if f.get("current_debt", 0) > 0])
    return {
        "farmers": farmers,
        "total_debt": total_debt,
        "active_debtors": active_count,
        "total_farmers": len(farmers)
    }


@router.post("/farmer-debts/transaction")
async def create_farmer_debt_transaction(
    req: FastAPIRequest,
    current_user: dict = Depends(get_current_user)
):
    request = await req.json()
    farmer_id = request.get("farmer_id")
    items = request.get("items", [])
    total = float(request.get("total", 0))
    paid = float(request.get("paid", 0))
    notes = request.get("notes", "")

    farmer = await db.farmers.find_one({"id": farmer_id}, {"_id": 0})
    if not farmer:
        raise HTTPException(status_code=404, detail="Petani tidak ditemukan")
    debt_amount = total - paid
    if farmer.get("debt_limit", 0) > 0:
        new_debt = farmer.get("current_debt", 0) + debt_amount
        if new_debt > farmer["debt_limit"]:
            raise HTTPException(
                status_code=400,
                detail=f"Melebihi limit hutang ({new_debt:,.0f} > {farmer['debt_limit']:,.0f})"
            )
    now = datetime.now(timezone(timedelta(hours=8)))
    from services import recalculate_product_stock
    for item in items:
        product_id = item.get("product_id")
        qty = item.get("quantity", 0)
        if product_id and qty > 0:
            wh_stock = await db.warehouse_stock.find_one({"product_id": product_id, "warehouse_id": "gudang_toko"})
            current_qty = wh_stock["stock"] if wh_stock else 0
            if current_qty < qty:
                raise HTTPException(status_code=400, detail=f"Stok Gudang Toko tidak cukup untuk {item.get('product_name', '')} (tersedia: {current_qty})")
            await db.warehouse_stock.update_one(
                {"product_id": product_id, "warehouse_id": "gudang_toko"},
                {"$inc": {"stock": -qty}}
            )
            await recalculate_product_stock(product_id)
    txn_doc = {
        "id": str(uuid.uuid4()),
        "farmer_id": farmer_id,
        "farmer_name": farmer["name"],
        "items": items,
        "total": total,
        "paid": paid,
        "remaining": debt_amount,
        "notes": notes,
        "cashier_name": current_user.get("name", ""),
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d") if now.hour < 20 else (now + timedelta(days=1)).strftime("%Y-%m-%d")
    }
    await db.farmer_transactions.insert_one(txn_doc)
    await db.farmers.update_one(
        {"id": farmer_id},
        {"$inc": {"current_debt": debt_amount}}
    )
    return {k: v for k, v in txn_doc.items() if k != "_id"}


@router.get("/farmer-debts/{farmer_id}/transactions")
async def get_farmer_transactions(farmer_id: str, current_user: dict = Depends(get_current_user)):
    txns = await db.farmer_transactions.find({"farmer_id": farmer_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return txns


@router.get("/farmer-debts/{farmer_id}/payments")
async def get_farmer_payments(farmer_id: str, current_user: dict = Depends(get_current_user)):
    payments = await db.farmer_payments.find({"farmer_id": farmer_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return payments


@router.post("/farmer-debts/{farmer_id}/pay")
async def pay_farmer_debt(
    farmer_id: str, amount: float, notes: str = "",
    current_user: dict = Depends(get_current_user)
):
    farmer = await db.farmers.find_one({"id": farmer_id}, {"_id": 0})
    if not farmer:
        raise HTTPException(status_code=404, detail="Petani tidak ditemukan")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Jumlah harus lebih dari 0")
    new_debt = max(0, farmer.get("current_debt", 0) - amount)
    await db.farmers.update_one({"id": farmer_id}, {"$set": {"current_debt": new_debt}})
    # Also reduce remaining in oldest transactions first
    unpaid_txns = await db.farmer_transactions.find(
        {"farmer_id": farmer_id, "remaining": {"$gt": 0}}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    left = amount
    for txn in unpaid_txns:
        if left <= 0:
            break
        pay_this = min(left, txn["remaining"])
        new_paid = txn["paid"] + pay_this
        new_rem = max(0, txn["total"] - new_paid)
        await db.farmer_transactions.update_one(
            {"id": txn["id"]}, {"$set": {"paid": new_paid, "remaining": new_rem}}
        )
        left -= pay_this
    now = datetime.now(timezone.utc)
    payment = {
        "id": str(uuid.uuid4()),
        "farmer_id": farmer_id,
        "farmer_name": farmer["name"],
        "amount": amount,
        "notes": notes,
        "recorded_by": current_user.get("name", ""),
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d")
    }
    await db.farmer_payments.insert_one(payment)
    return {"message": "Pembayaran berhasil", "new_debt": new_debt}
