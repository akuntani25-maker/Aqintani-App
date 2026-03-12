from fastapi import FastAPI, APIRouter
from fastapi.responses import PlainTextResponse
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import uuid
from datetime import datetime, timezone

from database import db
from auth import hash_password
from services import ensure_warehouse_stock, recalculate_product_stock

from routers import (
    auth_routes,
    product_routes,
    supplier_routes,
    transaction_routes,
    partner_routes,
    canvasser_routes,
    warehouse_routes,
    report_routes,
    admin_routes,
    loan_farmer_routes,
    shift_routes,
)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Include all routers
api_router.include_router(auth_routes.router)
api_router.include_router(product_routes.router)
api_router.include_router(supplier_routes.router)
api_router.include_router(transaction_routes.router)
api_router.include_router(partner_routes.router)
api_router.include_router(canvasser_routes.router)
api_router.include_router(warehouse_routes.router)
api_router.include_router(report_routes.router)
api_router.include_router(admin_routes.router)
api_router.include_router(loan_farmer_routes.router)
api_router.include_router(shift_routes.router)

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

    # Seed warehouses
    wh_count = await db.warehouses.count_documents({})
    if wh_count == 0:
        await db.warehouses.insert_many([
            {"id": "gudang_utama", "name": "Gudang Utama", "unit": "dus", "sort_order": 1},
            {"id": "gudang_toko", "name": "Gudang Toko", "unit": "satuan", "sort_order": 2},
            {"id": "gudang_lainnya", "name": "Gudang Lainnya", "unit": "dus", "sort_order": 3},
        ])
        logger.info("Default warehouses created")

    # Migrate existing products
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    product_ids = set()
    for p in products:
        product_ids.add(p["id"])
        await ensure_warehouse_stock(p["id"])
        all_wh_stock = await db.warehouse_stock.find({"product_id": p["id"]}, {"_id": 0}).to_list(10)
        total_wh = sum(s.get("stock", 0) for s in all_wh_stock)
        if total_wh == 0 and p.get("stock", 0) > 0:
            await db.warehouse_stock.update_one(
                {"product_id": p["id"], "warehouse_id": "gudang_toko"},
                {"$set": {"stock": p["stock"]}}
            )
        if "items_per_box" not in p:
            await db.products.update_one({"id": p["id"]}, {"$set": {"items_per_box": 1, "box_price": 0}})
        await recalculate_product_stock(p["id"])

    # Clean orphaned warehouse_stock entries
    all_wh_stocks = await db.warehouse_stock.find({}, {"_id": 0}).to_list(100000)
    for s in all_wh_stocks:
        if s.get("product_id") not in product_ids:
            await db.warehouse_stock.delete_many({"product_id": s["product_id"]})


@app.on_event("shutdown")
async def shutdown_db_client():
    pass



# Serve print_server.py for download
PRINT_SERVER_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "print_server.py")

@app.get("/api/download/print-server")
async def download_print_server():
    if os.path.exists(PRINT_SERVER_PATH):
        with open(PRINT_SERVER_PATH, "r") as f:
            content = f.read()
        return PlainTextResponse(
            content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=print_server.py"}
        )
    return PlainTextResponse("File not found", status_code=404)
