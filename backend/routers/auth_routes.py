from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone

from database import db
from auth import (
    get_current_user, require_admin, hash_password, verify_password,
    create_access_token, ROLE_PERMISSIONS, VALID_ROLES, MIN_PASSWORD_LENGTH
)
from models import UserCreate, UserLogin, User, TokenResponse, ProfileUpdate, StoreSettings

router = APIRouter()

# --- batas percobaan login (mencegah tebak password) ---
LOGIN_WINDOW = 15 * 60          # detik
MAX_FAILS_PER_ACCOUNT = 5       # per email + IP
MAX_FAILS_PER_IP = 20
_fails = defaultdict(deque)
# hash palsu supaya waktu respons sama untuk email yang ada / tidak ada
_DUMMY_HASH = hash_password("dummy-password-for-timing")


def _recent(key):
    q = _fails[key]
    cutoff = time.monotonic() - LOGIN_WINDOW
    while q and q[0] < cutoff:
        q.popleft()
    if not q:
        _fails.pop(key, None)
    return len(q)


def _check_password_strength(pw: str):
    if len(pw or "") < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password minimal {MIN_PASSWORD_LENGTH} karakter")


@router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate, admin: dict = Depends(require_admin)):
    if user_data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Peran tidak dikenal")
    _check_password_strength(user_data.password)
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": user_data.role,
        "canvasser_id": user_data.canvasser_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("password")
    return user_doc


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, request: Request):
    ip = request.client.host if request.client else "?"
    acct_key = ("acct", credentials.email.lower(), ip)
    ip_key = ("ip", ip)
    if _recent(acct_key) >= MAX_FAILS_PER_ACCOUNT or _recent(ip_key) >= MAX_FAILS_PER_IP:
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan login gagal. Coba lagi 15 menit lagi.")
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    ok = verify_password(credentials.password, user["password"] if user else _DUMMY_HASH)
    if not user or not ok:
        now = time.monotonic()
        _fails[acct_key].append(now)
        _fails[ip_key].append(now)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _fails.pop(acct_key, None)
    token = create_access_token({"sub": user["id"]})
    user.pop("password")
    return {"token": token, "user": user}


@router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.put("/auth/profile", response_model=User)
async def update_profile(profile_data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_fields = {}
    if profile_data.name:
        update_fields["name"] = profile_data.name
    if profile_data.email:
        existing = await db.users.find_one({"email": profile_data.email, "id": {"$ne": current_user["id"]}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_fields["email"] = profile_data.email
    if profile_data.new_password:
        if not profile_data.current_password:
            raise HTTPException(status_code=400, detail="Current password required")
        user_full = await db.users.find_one({"id": current_user["id"]})
        if not verify_password(profile_data.current_password, user_full["password"]):
            raise HTTPException(status_code=400, detail="Current password incorrect")
        _check_password_strength(profile_data.new_password)
        update_fields["password"] = hash_password(profile_data.new_password)
        # semua sesi lama (HP/komputer lain) otomatis keluar
        update_fields["password_changed_at"] = int(time.time())
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_fields})
    return await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})


@router.get("/users", response_model=List[User])
async def get_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("name", 1).to_list(1000)
    return users


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}


@router.get("/role-permissions")
async def get_role_permissions(current_user: dict = Depends(get_current_user)):
    return {"permissions": ROLE_PERMISSIONS, "current_role": current_user.get("role", ""), "current_permissions": ROLE_PERMISSIONS.get(current_user.get("role", ""), [])}


@router.get("/store-settings")
async def get_store_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.store_settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "store_name": "UD. AQIN TANI",
            "address": "Jl. Contoh No. 123, Kota Anda",
            "phone": "(021) 1234-5678",
            "email": "info@aqintani.com",
            "logo_url": ""
        }
    return settings


@router.put("/store-settings")
async def update_store_settings(settings: StoreSettings, admin: dict = Depends(require_admin)):
    settings_doc = settings.model_dump()
    await db.store_settings.delete_many({})
    await db.store_settings.insert_one(settings_doc)
    return settings.model_dump()
