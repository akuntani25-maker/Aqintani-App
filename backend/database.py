from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def create_indexes():
    """Create database indexes for optimal query performance."""
    try:
        # transactions: heavy queries by date, id, status
        await db.transactions.create_index("id", unique=True)
        await db.transactions.create_index("date")
        await db.transactions.create_index([("date", 1), ("status", 1)])
        await db.transactions.create_index("created_at")

        # products: lookups by id, barcode, name search, category
        await db.products.create_index("id", unique=True)
        await db.products.create_index("barcode", sparse=True)
        await db.products.create_index("category_id")
        await db.products.create_index("supplier_id")
        await db.products.create_index("name")
        await db.products.create_index([("stock", 1), ("min_stock_alert", 1)])

        # partner_orders: filtered by date, canvasser, store, status
        await db.partner_orders.create_index("id", unique=True)
        await db.partner_orders.create_index("date")
        await db.partner_orders.create_index("partner_store_id")
        await db.partner_orders.create_index("canvasser_id")
        await db.partner_orders.create_index([("date", 1), ("canvasser_id", 1)])
        await db.partner_orders.create_index("created_at")

        # partner_stores: lookups by id, vehicle
        await db.partner_stores.create_index("id", unique=True)
        await db.partner_stores.create_index("vehicle_id")

        # warehouse_stock: compound key for product+warehouse
        await db.warehouse_stock.create_index(
            [("product_id", 1), ("warehouse_id", 1)], unique=True
        )

        # purchases: date range queries, unpaid tracking
        await db.purchases.create_index("id", unique=True)
        await db.purchases.create_index("date")
        await db.purchases.create_index("supplier_id")
        await db.purchases.create_index("remaining")
        await db.purchases.create_index([("due_date", 1), ("remaining", 1)])

        # users
        await db.users.create_index("id", unique=True)
        await db.users.create_index("email", unique=True)

        # warehouses, suppliers, categories, vehicles - lookup by id
        await db.warehouses.create_index("id", unique=True)
        await db.suppliers.create_index("id", unique=True)
        await db.categories.create_index("id", unique=True)
        await db.vehicles.create_index("id", unique=True)

        # canvassers
        await db.canvassers.create_index("id", unique=True)
        await db.canvassers.create_index("user_id")

        # farmers & farmer_transactions
        await db.farmers.create_index("id", unique=True)
        await db.farmer_transactions.create_index("date")
        await db.farmer_transactions.create_index("farmer_id")

        # personal_loans
        await db.personal_loans.create_index("id", unique=True)
        await db.personal_loans.create_index("remaining")

        # shifts
        await db.shifts.create_index("id", unique=True)
        await db.shifts.create_index("user_id")
        await db.shifts.create_index("date")

        # history & logs
        await db.price_history.create_index("product_id")
        await db.payment_history.create_index("partner_store_id")
        await db.audit_log.create_index("created_at")
        await db.returns.create_index("created_at")
        await db.returns.create_index("transaction_id")

        # vehicle_stock
        await db.vehicle_stock.create_index("id", unique=True)
        await db.vehicle_stock.create_index("vehicle_id")
        await db.vehicle_stock.create_index([("vehicle_id", 1), ("remaining_qty", 1)])

        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (non-fatal): {e}")
