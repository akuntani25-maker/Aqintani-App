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

### POS Enhancements (DONE - Mar 2026)
- **Manual Price Override**: Kasir can edit sell price per item in cart before checkout

### Partner Orders / Pesanan Kios (FIXED & ENHANCED - Mar 2026)
- **Manual Price Override**: Admin can edit sell price per item in partner order cart
- **Per-item warehouse selection**: Each order item can be sourced from different warehouses
- **Correct pricing by warehouse unit**: Items from "dus" warehouses use box_price, "satuan" warehouses use unit price
- **Real-time price adaptation**: Changing warehouse recalculates price; manual override also supported
- **Stock validation per warehouse**: Shows available stock and warns when insufficient
- **Today's Summary Cards**: Orders today, total products, total revenue, money received
- **Per-Warehouse Breakdown**: Items distributed from each warehouse today
- **Partner Order Receipt (Struk)**: Print-ready receipt with previous debt + accumulated total
- **Return/Retur Feature**: Mark orders with returns — per-item return qty + reason, stock restored to chosen warehouse, partner debt reduced, RETUR badge on orders

### Analytics & Reports (ENHANCED - Mar 2026)
- Analytics page with basic charts
- Laporan (Reports) page with two detailed report tabs:
  - **Penjualan POS**: Rincian per produk — tanggal, produk, qty, HPP/unit, jual/unit, total jual, total HPP, margin
  - **Penjualan Kios Mitra**: Rincian per produk — tanggal, produk, kios mitra, qty (satuan), HPP/unit, jual/unit, total jual, total HPP, margin
  - **Produk Terlaris**: Ranking produk berdasarkan revenue — gabungan POS + Mitra, qty breakdown, revenue breakdown, HPP, margin, progress bar visual
- Summary cards: Total Penjualan, Total HPP, Total Margin, Margin %
- Date range filter and CSV export
- Footer row with totals per table

### Thermal Printer & Receipt Optimization (DONE - Mar 2026)
- **Bluetooth Connectivity Fix**: Added 10 BLE printer profiles (including common Chinese thermal printers like Xprinter, ZJ, Gprinter), GATT retry logic (3 attempts), 300ms stabilization delay, larger data chunk sizes (200/100 bytes) with automatic fallback to smaller chunks on failure
- **Receipt Print CSS**: Changed from A4 page size to explicit `80mm x 200mm` for thermal printers
- **Font Size Fix**: Increased all print font sizes from 7-9px to 10-16px with proper hierarchy (store name 16px, regular text 11px, totals 13px, notes 10px). Added `-webkit-text-size-adjust: 100%` to prevent tablet browsers from shrinking fonts
- **Consistent Output Across Devices**: All print CSS uses fixed pixel sizes and explicit page dimensions, eliminating browser-dependent rendering differences between PC and tablet. Colors forced to black for thermal readability
- **Compact Receipt Layout**: Both POS (ReceiptPreview.js) and Partner Order (PartnerOrderReceipt.js) receipts use semantic CSS classes (`.receipt-store-name`, `.thermal-items`, `.no-print`) instead of Tailwind print: utilities for reliable cross-device printing

### Supplier Debt Management (DONE - Mar 2026)
- **Halaman Hutang Supplier**: Menggantikan halaman Pembelian. Layout konsisten dengan halaman lain (Card, Table, Dialog shadcn)
- **Summary Cards**: Total Hutang, Supplier Berhutang, Dibayar Bulan Ini, Jatuh Tempo (>30 hari)
- **Detail per Supplier**: Panel expandable dengan tab Pembelian dan Riwayat Pembayaran
- **Catat Pembayaran**: Dialog modal dengan auto-distribusi ke pembelian paling lama, quick-fill 25%/50%/Lunasi
- **Filter & Search**: Cari supplier, filter Semua/Ada Hutang/Jatuh Tempo/Lunas
- **Export CSV & Notifikasi Jatuh Tempo**: Download CSV, alert card hutang >30 hari
- **Auto-purchase**: Produk baru otomatis membuat record pembelian ke supplier terkait
- **Responsive**: Optimal di desktop, tablet, dan mobile

## Prioritized Backlog

### P1 - Next Up

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
