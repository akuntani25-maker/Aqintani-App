from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-this-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

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

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "cashier"
    canvasser_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    canvasser_id: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    token: str
    user: User

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: str
    created_at: str

class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""

class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    contact_person: str
    phone: str
    email: str
    address: str
    created_at: str

class ProductCreate(BaseModel):
    name: str
    barcode: Optional[str] = ""
    category_id: Optional[str] = ""
    supplier_id: Optional[str] = ""
    stock: int = 0
    price: float
    cost_price: float
    box_price: Optional[float] = 0
    items_per_box: int = 1
    expiry_date: Optional[str] = ""
    batch_number: Optional[str] = ""
    description: Optional[str] = ""
    image: Optional[str] = ""
    min_stock_alert: int = 10

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    barcode: str
    category_id: str
    supplier_id: str
    stock: int
    price: float
    cost_price: float
    box_price: float = 0
    items_per_box: int = 1
    expiry_date: str
    batch_number: str
    description: str
    image: str
    min_stock_alert: int
    created_at: str
    updated_at: str

class TransactionItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    price: float
    subtotal: float

class TransactionCreate(BaseModel):
    items: List[TransactionItem]
    subtotal: float
    tax: float = 0
    discount: float = 0
    total: float
    payment_method: str
    payment_amount: float
    change: float

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    transaction_number: str
    cashier_id: str
    cashier_name: str
    items: List[TransactionItem]
    subtotal: float
    tax: float
    discount: float
    total: float
    payment_method: str
    payment_amount: float
    change: float
    created_at: str
    date: str

@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate, admin: dict = Depends(require_admin)):
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

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user["id"]})
    user.pop("password")
    return {"token": token, "user": user}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class StoreSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    store_name: str
    address: str
    phone: str
    email: str
    logo_url: Optional[str] = ""

class PurchaseCreate(BaseModel):
    supplier_id: str
    items: List[Dict[str, Any]]
    total: float
    paid: float = 0
    notes: Optional[str] = ""

class Purchase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    supplier_id: str
    supplier_name: str
    items: List[Dict[str, Any]]
    total: float
    paid: float
    remaining: float
    notes: str
    created_at: str
    date: str

class PartnerStoreCreate(BaseModel):
    name: str
    owner_name: str
    phone: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    credit_limit: float = 0

class PartnerStore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    owner_name: str
    phone: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    credit_limit: float
    current_debt: float
    created_at: str

class PartnerOrderCreate(BaseModel):
    partner_store_id: str
    items: List[TransactionItem]
    subtotal: float
    discount: float = 0
    total: float
    paid: float = 0
    delivery_date: Optional[str] = ""
    canvasser_id: Optional[str] = ""
    warehouse_id: Optional[str] = ""

class PartnerOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    order_number: str
    partner_store_id: str
    partner_store_name: str
    items: List[TransactionItem]
    subtotal: float
    discount: float
    total: float
    paid: float
    remaining: float
    delivery_date: str
    canvasser_id: str
    canvasser_name: str
    status: str
    created_at: str
    date: str

class CanvasserCreate(BaseModel):
    name: str
    phone: str
    vehicle_number: str
    vehicle_type: str = "Mobil Box"

class Canvasser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    phone: str
    vehicle_number: str
    vehicle_type: str
    is_active: bool
    created_at: str

@api_router.put("/auth/profile", response_model=User)
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
        
        update_fields["password"] = hash_password(profile_data.new_password)
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.users.find_one_and_update(
        {"id": current_user["id"]},
        {"$set": update_fields},
        return_document=True,
        projection={"_id": 0, "password": 0}
    )
    
    return result

@api_router.get("/categories", response_model=List[Category])
async def get_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return categories

@api_router.post("/categories", response_model=Category)
async def create_category(data: CategoryCreate, admin: dict = Depends(require_admin)):
    category_doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.categories.insert_one(category_doc)
    return category_doc

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, data: CategoryCreate, admin: dict = Depends(require_admin)):
    result = await db.categories.find_one_and_update(
        {"id": category_id},
        {"$set": {"name": data.name, "description": data.description}},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    return result

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, admin: dict = Depends(require_admin)):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

@api_router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(current_user: dict = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return suppliers

@api_router.post("/suppliers", response_model=Supplier)
async def create_supplier(data: SupplierCreate, admin: dict = Depends(require_admin)):
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

@api_router.put("/suppliers/{supplier_id}", response_model=Supplier)
async def update_supplier(supplier_id: str, data: SupplierCreate, admin: dict = Depends(require_admin)):
    result = await db.suppliers.find_one_and_update(
        {"id": supplier_id},
        {"$set": data.model_dump()},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return result

@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, admin: dict = Depends(require_admin)):
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deleted"}

@api_router.get("/products", response_model=List[Product])
async def get_products(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
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
    
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return products

@api_router.get("/products/barcode/{barcode}", response_model=Product)
async def get_product_by_barcode(barcode: str, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"barcode": barcode}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.get("/products/low-stock", response_model=List[Product])
async def get_low_stock_products(current_user: dict = Depends(get_current_user)):
    products = await db.products.find(
        {"$expr": {"$lte": ["$stock", "$min_stock_alert"]}},
        {"_id": 0}
    ).to_list(1000)
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.post("/products", response_model=Product)
async def create_product(data: ProductCreate, admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    product_doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    await db.products.insert_one(product_doc)
    return product_doc

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, data: ProductCreate, admin: dict = Depends(require_admin)):
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": update_data},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    return result

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(require_admin)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(data: TransactionCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    transaction_number = f"TRX{now.strftime('%Y%m%d%H%M%S')}"
    
    for item in data.items:
        product = await db.products.find_one({"id": item.product_id})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_name} not found")
        if product["stock"] < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {item.product_name}")
        
        await db.products.update_one(
            {"id": item.product_id},
            {"$inc": {"stock": -item.quantity}}
        )
    
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "transaction_number": transaction_number,
        "cashier_id": current_user["id"],
        "cashier_name": current_user["name"],
        "items": [item.model_dump() for item in data.items],
        "subtotal": data.subtotal,
        "tax": data.tax,
        "discount": data.discount,
        "total": data.total,
        "payment_method": data.payment_method,
        "payment_amount": data.payment_amount,
        "change": data.change,
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d")
    }
    
    await db.transactions.insert_one(transaction_doc)
    return transaction_doc

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return transactions

@api_router.get("/transactions/{transaction_id}", response_model=Transaction)
async def get_transaction(transaction_id: str, current_user: dict = Depends(get_current_user)):
    transaction = await db.transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@api_router.get("/reports/daily")
async def get_daily_report(date: str, admin: dict = Depends(require_admin)):
    transactions = await db.transactions.find({"date": date}, {"_id": 0}).to_list(1000)
    
    total_sales = sum(t["total"] for t in transactions)
    total_transactions = len(transactions)
    
    payment_methods = {}
    for t in transactions:
        method = t["payment_method"]
        payment_methods[method] = payment_methods.get(method, 0) + t["total"]
    
    return {
        "date": date,
        "total_sales": total_sales,
        "total_transactions": total_transactions,
        "payment_methods": payment_methods,
        "transactions": transactions
    }

@api_router.get("/reports/monthly")
async def get_monthly_report(year: int, month: int, admin: dict = Depends(require_admin)):
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year+1}-01-01"
    else:
        end_date = f"{year}-{month+1:02d}-01"
    
    transactions = await db.transactions.find(
        {"date": {"$gte": start_date, "$lt": end_date}},
        {"_id": 0}
    ).to_list(10000)
    
    total_sales = sum(t["total"] for t in transactions)
    total_transactions = len(transactions)
    
    daily_sales = {}
    for t in transactions:
        date = t["date"]
        daily_sales[date] = daily_sales.get(date, 0) + t["total"]
    
    return {
        "year": year,
        "month": month,
        "total_sales": total_sales,
        "total_transactions": total_transactions,
        "daily_sales": daily_sales
    }

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(admin: dict = Depends(require_admin)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    today_transactions = await db.transactions.find({"date": today}, {"_id": 0}).to_list(1000)
    today_sales = sum(t["total"] for t in today_transactions)
    
    total_products = await db.products.count_documents({})
    low_stock_count = await db.products.count_documents(
        {"$expr": {"$lte": ["$stock", "$min_stock_alert"]}}
    )
    
    last_7_days = []
    for i in range(6, -1, -1):
        date = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        trans = await db.transactions.find({"date": date}, {"_id": 0}).to_list(1000)
        daily_total = sum(t["total"] for t in trans)
        last_7_days.append({"date": date, "sales": daily_total})
    
    return {
        "today_sales": today_sales,
        "today_transactions": len(today_transactions),
        "total_products": total_products,
        "low_stock_count": low_stock_count,
        "last_7_days": last_7_days
    }

@api_router.get("/users", response_model=List[User])
async def get_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("name", 1).to_list(1000)
    return users

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# ============= STORE SETTINGS =============
@api_router.get("/store-settings")
async def get_store_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.store_settings.find_one({}, {"_id": 0})
    if not settings:
        # Return default settings
        return {
            "store_name": "UD. AQIN TANI",
            "address": "Jl. Contoh No. 123, Kota Anda",
            "phone": "(021) 1234-5678",
            "email": "info@aqintani.com",
            "logo_url": ""
        }
    return settings

@api_router.put("/store-settings")
async def update_store_settings(settings: StoreSettings, admin: dict = Depends(require_admin)):
    settings_doc = settings.model_dump()
    await db.store_settings.delete_many({})
    await db.store_settings.insert_one(settings_doc)
    return settings_doc

# ============= PURCHASES (from Suppliers) =============
@api_router.get("/purchases")
async def get_purchases(
    supplier_id: Optional[str] = None,
    admin: dict = Depends(require_admin)
):
    query = {}
    if supplier_id:
        query["supplier_id"] = supplier_id
    purchases = await db.purchases.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return purchases

@api_router.post("/purchases", response_model=Purchase)
async def create_purchase(data: PurchaseCreate, admin: dict = Depends(require_admin)):
    supplier = await db.suppliers.find_one({"id": data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    now = datetime.now(timezone.utc)
    purchase_doc = {
        "id": str(uuid.uuid4()),
        "supplier_id": data.supplier_id,
        "supplier_name": supplier["name"],
        "items": data.items,
        "total": data.total,
        "paid": data.paid,
        "remaining": data.total - data.paid,
        "notes": data.notes,
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d")
    }
    
    await db.purchases.insert_one(purchase_doc)
    return purchase_doc

@api_router.post("/purchases/{purchase_id}/pay")
async def pay_purchase(purchase_id: str, amount: float, admin: dict = Depends(require_admin)):
    purchase = await db.purchases.find_one({"id": purchase_id})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    new_paid = purchase["paid"] + amount
    new_remaining = purchase["total"] - new_paid
    
    result = await db.purchases.find_one_and_update(
        {"id": purchase_id},
        {"$set": {"paid": new_paid, "remaining": new_remaining}},
        return_document=True,
        projection={"_id": 0}
    )
    
    # Record payment history
    await db.payment_history.insert_one({
        "id": str(uuid.uuid4()),
        "type": "supplier",
        "reference_id": purchase_id,
        "supplier_id": purchase.get("supplier_id", ""),
        "supplier_name": purchase.get("supplier_name", ""),
        "amount": amount,
        "notes": f"Pembayaran pembelian {purchase.get('id', '')}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    })
    
    return result

@api_router.delete("/purchases/{purchase_id}")
async def delete_purchase(purchase_id: str, admin: dict = Depends(require_admin)):
    result = await db.purchases.delete_one({"id": purchase_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return {"message": "Purchase deleted"}

# ============= PAYMENT HISTORY =============
@api_router.get("/payment-history")
async def get_payment_history(
    type: Optional[str] = None,
    reference_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if type:
        query["type"] = type
    if reference_id:
        query["reference_id"] = reference_id
    history = await db.payment_history.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return history

@api_router.post("/partner-stores/{store_id}/pay")
async def pay_partner_store(store_id: str, amount: float, notes: str = "", admin: dict = Depends(require_admin)):
    store = await db.partner_stores.find_one({"id": store_id})
    if not store:
        raise HTTPException(status_code=404, detail="Partner store not found")
    
    new_debt = max(0, store.get("current_debt", 0) - amount)
    await db.partner_stores.update_one(
        {"id": store_id},
        {"$set": {"current_debt": new_debt}}
    )
    
    payment_doc = {
        "id": str(uuid.uuid4()),
        "type": "partner_store",
        "reference_id": store_id,
        "partner_store_name": store["name"],
        "amount": amount,
        "notes": notes or f"Setoran dari {store['name']}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    await db.payment_history.insert_one(payment_doc)
    
    return {"message": "Payment recorded", "new_debt": new_debt, "payment": {k: v for k, v in payment_doc.items() if k != "_id"}}

@api_router.get("/partner-stores/{store_id}/payments")
async def get_partner_store_payments(store_id: str, current_user: dict = Depends(get_current_user)):
    payments = await db.payment_history.find(
        {"type": "partner_store", "reference_id": store_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return payments

@api_router.get("/suppliers/{supplier_id}/payments")
async def get_supplier_payments(supplier_id: str, current_user: dict = Depends(get_current_user)):
    payments = await db.payment_history.find(
        {"type": "supplier", "supplier_id": supplier_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return payments

# ============= SUPPLIER DEBT SUMMARY =============
@api_router.get("/suppliers/{supplier_id}/debt")
async def get_supplier_debt(supplier_id: str, admin: dict = Depends(require_admin)):
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

# ============= PARTNER STORES (Kios Mitra) =============
@api_router.get("/partner-stores", response_model=List[PartnerStore])
async def get_partner_stores(current_user: dict = Depends(get_current_user)):
    stores = await db.partner_stores.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return stores

@api_router.post("/partner-stores", response_model=PartnerStore)
async def create_partner_store(data: PartnerStoreCreate, admin: dict = Depends(require_admin)):
    store_doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "current_debt": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.partner_stores.insert_one(store_doc)
    return store_doc

@api_router.put("/partner-stores/{store_id}", response_model=PartnerStore)
async def update_partner_store(store_id: str, data: PartnerStoreCreate, admin: dict = Depends(require_admin)):
    result = await db.partner_stores.find_one_and_update(
        {"id": store_id},
        {"$set": data.model_dump()},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Partner store not found")
    return result

@api_router.delete("/partner-stores/{store_id}")
async def delete_partner_store(store_id: str, admin: dict = Depends(require_admin)):
    result = await db.partner_stores.delete_one({"id": store_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Partner store not found")
    return {"message": "Partner store deleted"}

# ============= PARTNER ORDERS =============
@api_router.get("/partner-orders", response_model=List[PartnerOrder])
async def get_partner_orders(
    partner_store_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if partner_store_id:
        query["partner_store_id"] = partner_store_id
    orders = await db.partner_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders

@api_router.post("/partner-orders", response_model=PartnerOrder)
async def create_partner_order(data: PartnerOrderCreate, current_user: dict = Depends(get_current_user)):
    partner_store = await db.partner_stores.find_one({"id": data.partner_store_id}, {"_id": 0})
    if not partner_store:
        raise HTTPException(status_code=404, detail="Partner store not found")
    
    canvasser_name = ""
    if data.canvasser_id:
        canvasser = await db.canvassers.find_one({"id": data.canvasser_id}, {"_id": 0})
        if canvasser:
            canvasser_name = canvasser["name"]
    
    now = datetime.now(timezone.utc)
    order_number = f"PO{now.strftime('%Y%m%d%H%M%S')}"
    
    order_doc = {
        "id": str(uuid.uuid4()),
        "order_number": order_number,
        "partner_store_id": data.partner_store_id,
        "partner_store_name": partner_store["name"],
        "items": [item.model_dump() for item in data.items],
        "subtotal": data.subtotal,
        "discount": data.discount,
        "total": data.total,
        "paid": data.paid,
        "remaining": data.total - data.paid,
        "delivery_date": data.delivery_date or now.strftime("%Y-%m-%d"),
        "canvasser_id": data.canvasser_id or "",
        "canvasser_name": canvasser_name,
        "status": "pending",
        "created_at": now.isoformat(),
        "date": now.strftime("%Y-%m-%d")
    }
    
    await db.partner_orders.insert_one(order_doc)
    
    # Update partner store debt
    new_debt = partner_store.get("current_debt", 0) + order_doc["remaining"]
    await db.partner_stores.update_one(
        {"id": data.partner_store_id},
        {"$set": {"current_debt": new_debt}}
    )
    
    return order_doc

@api_router.put("/partner-orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, current_user: dict = Depends(get_current_user)):
    result = await db.partner_orders.find_one_and_update(
        {"id": order_id},
        {"$set": {"status": status}},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    return result

@api_router.post("/partner-orders/{order_id}/pay")
async def pay_partner_order(order_id: str, amount: float, current_user: dict = Depends(get_current_user)):
    order = await db.partner_orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    new_paid = order["paid"] + amount
    new_remaining = order["total"] - new_paid
    
    result = await db.partner_orders.find_one_and_update(
        {"id": order_id},
        {"$set": {"paid": new_paid, "remaining": new_remaining}},
        return_document=True,
        projection={"_id": 0}
    )
    
    # Update partner store debt
    partner_store = await db.partner_stores.find_one({"id": order["partner_store_id"]})
    if partner_store:
        new_debt = max(0, partner_store.get("current_debt", 0) - amount)
        await db.partner_stores.update_one(
            {"id": order["partner_store_id"]},
            {"$set": {"current_debt": new_debt}}
        )
    
    return result

# ============= CANVASSERS =============
@api_router.get("/canvassers", response_model=List[Canvasser])
async def get_canvassers(current_user: dict = Depends(get_current_user)):
    canvassers = await db.canvassers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return canvassers

@api_router.get("/canvassers/my-orders", response_model=List[PartnerOrder])
async def get_my_orders(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "canvasser":
        raise HTTPException(status_code=403, detail="Canvasser access only")
    
    canvasser_id = current_user.get("canvasser_id")
    if not canvasser_id:
        raise HTTPException(status_code=400, detail="Canvasser ID not found")
    
    orders = await db.partner_orders.find(
        {"canvasser_id": canvasser_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return orders

@api_router.get("/canvassers/notifications")
async def get_canvasser_notifications(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "canvasser":
        raise HTTPException(status_code=403, detail="Canvasser access only")
    
    canvasser_id = current_user.get("canvasser_id")
    if not canvasser_id:
        return {"new_orders": 0, "pending_orders": 0, "total_remaining": 0}
    
    pending = await db.partner_orders.count_documents({"canvasser_id": canvasser_id, "status": "pending"})
    
    orders = await db.partner_orders.find(
        {"canvasser_id": canvasser_id},
        {"_id": 0, "remaining": 1}
    ).to_list(1000)
    total_remaining = sum(o.get("remaining", 0) for o in orders)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    new_today = await db.partner_orders.count_documents({"canvasser_id": canvasser_id, "date": today})
    
    return {"new_orders": new_today, "pending_orders": pending, "total_remaining": total_remaining}

@api_router.post("/canvassers", response_model=Canvasser)
async def create_canvasser(data: CanvasserCreate, admin: dict = Depends(require_admin)):
    canvasser_doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.canvassers.insert_one(canvasser_doc)
    return canvasser_doc

@api_router.put("/canvassers/{canvasser_id}", response_model=Canvasser)
async def update_canvasser(canvasser_id: str, data: CanvasserCreate, admin: dict = Depends(require_admin)):
    result = await db.canvassers.find_one_and_update(
        {"id": canvasser_id},
        {"$set": data.model_dump()},
        return_document=True,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Canvasser not found")
    return result

@api_router.delete("/canvassers/{canvasser_id}")
async def delete_canvasser(canvasser_id: str, admin: dict = Depends(require_admin)):
    result = await db.canvassers.delete_one({"id": canvasser_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Canvasser not found")
    return {"message": "Canvasser deleted"}

# ============= PRODUCT ANALYTICS =============
@api_router.get("/analytics/products")
async def get_product_analytics(admin: dict = Depends(require_admin)):
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    
    transactions = await db.transactions.find(
        {"date": {"$gte": thirty_days_ago}},
        {"_id": 0, "items": 1}
    ).to_list(10000)
    
    product_sales = {}
    for trans in transactions:
        for item in trans.get("items", []):
            pid = item.get("product_id")
            if pid:
                if pid not in product_sales:
                    product_sales[pid] = {"id": pid, "name": item.get("product_name"), "quantity": 0, "revenue": 0}
                product_sales[pid]["quantity"] += item.get("quantity", 0)
                product_sales[pid]["revenue"] += item.get("subtotal", 0)
    
    fast_moving = sorted(product_sales.values(), key=lambda x: x["quantity"], reverse=True)[:10]
    slow_moving = sorted(product_sales.values(), key=lambda x: x["quantity"])[:10]
    
    return {
        "fast_moving": fast_moving,
        "slow_moving": slow_moving
    }

@api_router.get("/analytics/summary")
async def get_analytics_summary(admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    this_month_start = now.strftime("%Y-%m-01")
    thirty_days_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # Monthly sales
    month_transactions = await db.transactions.find(
        {"date": {"$gte": this_month_start}}, {"_id": 0}
    ).to_list(10000)
    monthly_sales = sum(t["total"] for t in month_transactions)
    monthly_cost = sum(
        sum(item.get("price", 0) * item.get("quantity", 0) * 0.7 for item in t.get("items", []))
        for t in month_transactions
    )
    
    # Monthly purchases (from suppliers)
    month_purchases = await db.purchases.find(
        {"date": {"$gte": this_month_start}}, {"_id": 0}
    ).to_list(10000)
    monthly_purchases_total = sum(p.get("total", 0) for p in month_purchases)
    monthly_purchases_unpaid = sum(p.get("remaining", 0) for p in month_purchases)
    
    # Partner store stats
    all_partner_orders = await db.partner_orders.find({}, {"_id": 0}).to_list(10000)
    total_partner_sales = sum(o.get("total", 0) for o in all_partner_orders)
    total_partner_unpaid = sum(o.get("remaining", 0) for o in all_partner_orders)
    
    # Daily sales for chart (last 30 days)
    daily_sales = {}
    for i in range(29, -1, -1):
        date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_sales[date] = {"sales": 0, "transactions": 0}
    
    all_30_transactions = await db.transactions.find(
        {"date": {"$gte": thirty_days_ago}}, {"_id": 0}
    ).to_list(10000)
    for t in all_30_transactions:
        d = t.get("date", "")
        if d in daily_sales:
            daily_sales[d]["sales"] += t.get("total", 0)
            daily_sales[d]["transactions"] += 1
    
    chart_data = [{"date": k, **v} for k, v in daily_sales.items()]
    
    # Category breakdown
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    cat_map = {c["id"]: c["name"] for c in categories}
    
    category_stock = {}
    for p in products:
        cat_name = cat_map.get(p.get("category_id", ""), "Tanpa Kategori")
        if cat_name not in category_stock:
            category_stock[cat_name] = {"name": cat_name, "count": 0, "stock_value": 0}
        category_stock[cat_name]["count"] += 1
        category_stock[cat_name]["stock_value"] += p.get("stock", 0) * p.get("cost_price", 0)
    
    return {
        "monthly_sales": monthly_sales,
        "monthly_transactions": len(month_transactions),
        "monthly_purchases": monthly_purchases_total,
        "monthly_purchases_unpaid": monthly_purchases_unpaid,
        "total_partner_sales": total_partner_sales,
        "total_partner_unpaid": total_partner_unpaid,
        "estimated_margin": monthly_sales - monthly_cost,
        "chart_data": chart_data,
        "category_breakdown": list(category_stock.values())
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db():
    admin_exists = await db.users.find_one({"role": "admin"})
    if not admin_exists:
        default_admin = {
            "id": str(uuid.uuid4()),
            "email": "admin@aqintani.com",
            "password": hash_password("admin123"),
            "name": "Administrator",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(default_admin)
        logger.info("Default admin created: admin@aqintani.com / admin123")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()