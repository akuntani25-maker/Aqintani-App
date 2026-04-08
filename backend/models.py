from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any


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
    warehouse_id: Optional[str] = "gudang_utama"
    price: float
    cost_price: float
    supplier_cost_price: Optional[float] = 0
    box_price: Optional[float] = 0
    items_per_box: float = 1
    initial_paid: Optional[float] = 0
    expiry_date: Optional[str] = ""
    batch_number: Optional[str] = ""
    description: Optional[str] = ""
    image: Optional[str] = ""
    min_stock_alert: int = 10
    invoice_number: Optional[str] = ""
    due_date: Optional[str] = ""
    is_restock: Optional[bool] = False
    existing_product_id: Optional[str] = ""


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
    supplier_cost_price: float = 0
    box_price: float = 0
    items_per_box: float = 1
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
    warehouse_id: Optional[str] = ""
    sell_unit: Optional[str] = ""


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


class PurchaseCreate(BaseModel):
    supplier_id: str
    items: List[Dict[str, Any]]
    total: float
    paid: float = 0
    notes: Optional[str] = ""
    warehouse_id: Optional[str] = "gudang_utama"


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
    vehicle_id: Optional[str] = ""


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
    vehicle_id: Optional[str] = ""
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
    order_type: Optional[str] = "regular"  # "regular" or "conditional"


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
    has_return: Optional[bool] = False
    order_type: Optional[str] = "regular"
    is_settled: Optional[bool] = False


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


class VehicleCreate(BaseModel):
    name: str
    plate_number: str
    area_route: Optional[str] = ""
    driver_name: Optional[str] = ""
    canvasser_id: Optional[str] = ""


class Vehicle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    plate_number: str
    area_route: Optional[str] = ""
    driver_name: Optional[str] = ""
    canvasser_id: Optional[str] = ""
    created_at: str


class StockAdjustmentCreate(BaseModel):
    product_id: str
    warehouse_id: str
    new_stock: int
    reason: str = ""


class StockTransferCreate(BaseModel):
    product_id: str
    from_warehouse_id: str
    to_warehouse_id: str
    quantity: float
    notes: Optional[str] = ""


class ReturnCreate(BaseModel):
    source_type: str
    source_id: str
    items: List[dict]
    notes: str = ""
    warehouse_id: str = "gudang_toko"
    vehicle_id: Optional[str] = ""
