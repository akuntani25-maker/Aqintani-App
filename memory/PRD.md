# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Build a responsive web application for a pharmacy and agriculture store named "UD. AQIN TANI" with Admin and Cashier roles, B2B features, multi-warehouse inventory, purchasing & debt management, partner kiosk management, and analytics.

## Tech Stack
- **Backend**: FastAPI, Motor (async MongoDB), JWT, Pydantic
- **Frontend**: React, Tailwind CSS, Shadcn/UI, lucide-react, recharts, sonner
- **Database**: MongoDB

## Architecture
```
/app/
  backend/server.py       # Monolithic FastAPI (all models + endpoints)
  frontend/src/
    pages/Products.js     # Central product/inventory hub
    pages/Purchases.js    # Supplier purchases
    pages/CanvasserDashboard.js
    components/AdminLayout.js
```

## Credentials
- Admin: admin@aqintani.com / admin123

## What's Been Implemented

### Core Features (DONE)
- Admin dashboard with sales chart
- Product CRUD with categories, suppliers, barcode
- Multi-warehouse inventory (Gudang Utama/Toko/Lainnya)
- Stock transfers between warehouses with unit conversion
- Transaction/POS system
- Receipt printing (thermal printer compatible)
- User management (Admin, Kasir, Canvasser roles)

### B2B Features (DONE)
- Canvasser portal (login, dashboard, order management, notifications)
- Partner kiosk management (Kios Mitra)
- Partner store orders (Pesanan Kios)

### Purchasing & Debt (DONE - Feb 2026)
- Auto-create purchase when adding new product with initial stock
- **Bayar di Muka (Partial Payment)**: When creating product, admin can specify upfront payment amount. Remaining balance tracked as debt. Purchase status shows "Tempo" for outstanding debt.
- Purchases page to view all supplier purchase records

### Analytics & Reports (DONE - Basic)
- Analytics page with basic charts
- Laporan (Reports) page

## Prioritized Backlog

### P1 - Next Up
- **Supplier Debt Management Page**: Dedicated page to view all outstanding balances per supplier and record payments against them

### P2 - Future
- **Enhanced Analytics**: More detailed charts, filters, date ranges, export options
- **Server.py Refactoring**: Split monolith into routers/models for maintainability

## Key DB Schema
- **products**: name, barcode, category_id, supplier_id, stock, price, cost_price, box_price, items_per_box, min_stock_alert
- **purchases**: supplier_id, supplier_name, items[], total, paid, remaining, warehouse_id, notes, date
- **warehouse_stock**: product_id, warehouse_id, stock (in respective units)
- **stock_transfers**: product_id, from_warehouse_id, to_warehouse_id, quantity, notes

## Key API Endpoints
- POST /api/products - Create product (with initial_paid for auto-purchase)
- POST /api/stock-transfers - Transfer stock between warehouses
- GET /api/warehouse-stock - Aggregated stock data
- GET /api/purchases - List all purchases
- POST /api/purchases - Manual purchase creation
