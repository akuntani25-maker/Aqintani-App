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
- **Filter-aware summary cards**: Total Pembelian, Sisa Hutang, Sudah Dibayar now dynamically update based on supplier filter selection

### Partner Orders / Pesanan Kios (FIXED & ENHANCED - Mar 2026)
- **Per-item warehouse selection**: Each order item can be sourced from different warehouses (Gudang Utama, Gudang Toko, Gudang Lainnya)
- **Correct pricing by warehouse unit**: Items from "dus" warehouses use box_price, items from "satuan" warehouses use unit price
- **Real-time price adaptation**: Changing item warehouse in cart automatically recalculates price and total
- **Stock validation per warehouse**: Shows available stock and warns when insufficient
- **Today's Summary Cards**: Pesanan hari ini, total produk dipesan, total penjualan, uang diterima
- **Per-Warehouse Breakdown**: Shows how many items distributed from each warehouse today
- **Partner Order Receipt (Struk)**: Print-ready receipt with order details, previous outstanding balance (sisa bon), and accumulated total debt. Auto-navigates to receipt after order creation.

### Analytics & Reports (ENHANCED - Mar 2026)
- Analytics page with basic charts
- Laporan (Reports) page with two detailed report tabs:
  - **Penjualan POS**: Rincian per produk — tanggal, produk, qty, HPP/unit, jual/unit, total jual, total HPP, margin
  - **Penjualan Kios Mitra**: Rincian per produk — tanggal, produk, kios mitra, qty (satuan), HPP/unit, jual/unit, total jual, total HPP, margin
- Summary cards: Total Penjualan, Total HPP, Total Margin, Margin %
- Date range filter and CSV export
- Footer row with totals per table

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
