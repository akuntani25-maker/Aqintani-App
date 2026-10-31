from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
import os

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
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
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
