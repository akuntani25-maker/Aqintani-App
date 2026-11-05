from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import jwt
from datetime import datetime, timezone, timedelta
import os
import re

from database import db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = os.environ.get('SECRET_KEY') or os.environ.get('JWT_SECRET')
if not SECRET_KEY:
    # Never fall back to a fixed, publicly known key: anyone could sign their own login tokens.
    import secrets, logging
    SECRET_KEY = secrets.token_urlsafe(48)
    logging.getLogger(__name__).warning(
        "SECRET_KEY is not set: using a random key for this run. Everyone is logged out on restart; set SECRET_KEY in .env.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
VALID_ROLES = ("admin", "manager", "office_staff", "cashier", "canvasser")
MIN_PASSWORD_LENGTH = 8

ROLE_PERMISSIONS = {
    "admin": ["dashboard", "products", "categories", "suppliers", "supplier_debts", "partner_stores", "partner_orders", "canvassers", "analytics", "reports", "users", "store_settings", "import_data", "printer", "profile", "vehicles", "vehicle_stock", "audit_log", "pos", "personal_loans"],
    "manager": ["dashboard", "products", "categories", "suppliers", "supplier_debts", "partner_stores", "partner_orders", "canvassers", "analytics", "reports", "store_settings", "import_data", "printer", "profile", "vehicles", "vehicle_stock", "audit_log", "pos", "personal_loans"],
    "office_staff": ["dashboard", "products", "categories", "suppliers", "supplier_debts", "partner_stores", "partner_orders", "analytics", "reports", "profile", "vehicles", "vehicle_stock", "pos"],
    "cashier": ["pos", "profile"],
    "canvasser": ["canvasser_dashboard", "profile"],
}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    to_encode.update({"exp": now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS), "iat": int(now.timestamp())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# Kasir dan kanvaser hanya boleh memanggil endpoint yang dipakai halaman mereka.
# Semua yang tidak ada di daftar ditolak, jadi endpoint baru otomatis tertutup bagi mereka.
_COMMON = [r"/api/auth/(me|profile)", r"/api/role-permissions", r"/api/store-settings"]
ROLE_PATH_ALLOWLIST = {
    "cashier": [re.compile(f"^{p}$") for p in _COMMON + [
        r"/api/products(/[^/]+)?", r"/api/products/barcode/[^/]+", r"/api/products/search-autocomplete",
        r"/api/products/low-stock", r"/api/categories", r"/api/warehouses", r"/api/warehouse-stock",
        r"/api/canvassers/product-search", r"/api/transactions(/[^/]+)?", r"/api/transactions/search",
        r"/api/transactions/[^/]+/edit-prices", r"/api/pos/[a-z-]+", r"/api/returns", r"/api/stock-transfers",
        r"/api/shifts/(open|current|close|history)", r"/api/farmers(/[^/]+)?",
        r"/api/farmer-debts/(overview|transaction)", r"/api/farmer-debts/[^/]+/(transactions|payments|pay)",
    ]],
    "canvasser": [re.compile(f"^{p}$") for p in _COMMON + [
        r"/api/canvassers/(my-orders|notifications|my-recap|product-search)",
        r"/api/partner-stores", r"/api/partner-stores/[^/]+/location",
        r"/api/partner-orders/[^/]+", r"/api/partner-orders/[^/]+/(status|pay|settle|transfer|return-vehicles)",
    ]],
}


async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not isinstance(user_id, str):
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    # token lama tidak berlaku lagi setelah password diganti
    changed = user.get("password_changed_at")
    if changed and int(payload.get("iat", 0)) < int(changed):
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login lagi")

    role = user.get("role")
    allow = ROLE_PATH_ALLOWLIST.get(role) if role in VALID_ROLES else ROLE_PATH_ALLOWLIST["canvasser"][:len(_COMMON)]
    if allow is not None and not any(p.match(request.url.path) for p in allow):
        raise HTTPException(status_code=403, detail="Tidak punya akses")
    user.pop("password", None)
    return user


async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_admin_or_manager(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    return current_user


async def require_admin_panel_access(current_user: dict = Depends(get_current_user)):
    """Allow admin, manager, and office_staff to access admin panel"""
    if current_user.get("role") not in ("admin", "manager", "office_staff"):
        raise HTTPException(status_code=403, detail="Admin panel access required")
    return current_user


async def require_pos_access(current_user: dict = Depends(get_current_user)):
    """Allow admin, manager, office_staff, and cashier to access POS features"""
    if current_user.get("role") not in ("admin", "manager", "office_staff", "cashier"):
        raise HTTPException(status_code=403, detail="POS access required")
    return current_user
