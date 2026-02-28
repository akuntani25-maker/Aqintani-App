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

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
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