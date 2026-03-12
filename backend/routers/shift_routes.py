from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from database import db
from auth import get_current_user, require_pos_access
import uuid

router = APIRouter()


@router.post("/shifts/open")
async def open_shift(opening_balance: float = 0, current_user: dict = Depends(require_pos_access)):
    existing = await db.shifts.find_one(
        {"user_id": current_user["id"], "status": "open"}, {"_id": 0}
    )
    if existing:
        return existing

    shift_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "opened_at": datetime.now(timezone.utc).isoformat(),
        "closed_at": None,
        "opening_balance": opening_balance,
        "closing_balance": None,
        "total_sales": 0,
        "total_transactions": 0,
        "status": "open",
    }
    await db.shifts.insert_one(shift_doc)
    return {k: v for k, v in shift_doc.items() if k != "_id"}


@router.get("/shifts/current")
async def get_current_shift(current_user: dict = Depends(require_pos_access)):
    shift = await db.shifts.find_one(
        {"user_id": current_user["id"], "status": "open"}, {"_id": 0}
    )
    if not shift:
        return None
    # Calculate real-time totals from transactions during this shift
    transactions = await db.transactions.find(
        {"cashier_id": current_user["id"], "created_at": {"$gte": shift["opened_at"]}},
        {"_id": 0, "total": 1}
    ).to_list(10000)
    shift["total_sales"] = sum(t.get("total", 0) for t in transactions)
    shift["total_transactions"] = len(transactions)
    return shift


@router.post("/shifts/close")
async def close_shift(closing_balance: float = 0, notes: str = "", current_user: dict = Depends(require_pos_access)):
    shift = await db.shifts.find_one(
        {"user_id": current_user["id"], "status": "open"}, {"_id": 0}
    )
    if not shift:
        raise HTTPException(status_code=404, detail="Tidak ada shift yang terbuka")

    transactions = await db.transactions.find(
        {"cashier_id": current_user["id"], "created_at": {"$gte": shift["opened_at"]}},
        {"_id": 0, "total": 1, "payment_method": 1}
    ).to_list(10000)

    total_sales = sum(t.get("total", 0) for t in transactions)
    cash_sales = sum(t.get("total", 0) for t in transactions if t.get("payment_method") == "cash")
    now = datetime.now(timezone.utc).isoformat()

    await db.shifts.update_one({"id": shift["id"]}, {"$set": {
        "closed_at": now,
        "closing_balance": closing_balance,
        "total_sales": total_sales,
        "cash_sales": cash_sales,
        "total_transactions": len(transactions),
        "notes": notes,
        "status": "closed",
    }})

    updated = await db.shifts.find_one({"id": shift["id"]}, {"_id": 0})
    return updated


@router.get("/shifts/history")
async def get_shift_history(user_id: str = None, limit: int = 20, current_user: dict = Depends(require_pos_access)):
    query = {"status": "closed"}
    if user_id:
        query["user_id"] = user_id
    shifts = await db.shifts.find(query, {"_id": 0}).sort("closed_at", -1).limit(limit).to_list(limit)
    return shifts
