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
- **Direct ESC/POS Bluetooth Printing**: New "Cetak via Bluetooth" button on both PartnerOrderReceipt.js and ReceiptPreview.js. Sends raw ESC/POS commands directly to the printer via Web Bluetooth API, bypassing browser rendering entirely. Uses the printer's built-in font for fast, crisp output.
- **Printer Support**: Optimized for 58mm thermal printers (D58UBT-S / RPP02N). Supports 32 characters per line. Auto-discovers BLE print characteristics with 10+ known profiles.
- **Singleton Printer Instance**: `thermalPrinter` singleton exported from ThermalPrinter.js — Bluetooth connection persists across page navigations within the SPA session.
- **Two Print Methods**: `printReceipt(transaction, storeSettings)` for POS receipts, `printPartnerOrderReceipt(order, storeSettings)` for partner kiosk receipts. Both build complete ESC/POS command buffers with proper initialization, alignment, bold, double-size, and paper cut commands.
- **Bluetooth Connectivity**: Added 10 BLE printer profiles (including common Chinese thermal printers like Xprinter, ZJ, Gprinter), GATT retry logic (3 attempts), 300ms stabilization delay, larger data chunk sizes (200/100 bytes) with automatic fallback to smaller chunks on failure.
- **Legacy Browser Print**: "Print Struk" button retained as fallback for browser-based iframe printing.

### Supplier Debt Management (DONE - Mar 2026)
- **Halaman Hutang Supplier**: Menggantikan halaman Pembelian. Layout konsisten dengan halaman lain (Card, Table, Dialog shadcn)
- **Summary Cards**: Total Hutang, Supplier Berhutang, Dibayar Bulan Ini, Jatuh Tempo (>30 hari)
- **Detail per Supplier**: Panel expandable dengan tab Pembelian dan Riwayat Pembayaran
- **Catat Pembayaran**: Dialog modal dengan auto-distribusi ke pembelian paling lama, quick-fill 25%/50%/Lunasi
- **Filter & Search**: Cari supplier, filter Semua/Ada Hutang/Jatuh Tempo/Lunas
- **Export CSV & Notifikasi Jatuh Tempo**: Download CSV, alert card hutang >30 hari
- **Auto-purchase**: Produk baru otomatis membuat record pembelian ke supplier terkait
- **Responsive**: Optimal di desktop, tablet, dan mobile

### Dashboard Enhancement (DONE - Mar 2026)
- **3 Card Finansial Baru**: Nilai Barang Gudang (stok × HPP/satuan), Total Bon Supplier Belum Bayar, Total Bon Kios Mitra Belum Bayar.
- **Notifikasi Jatuh Tempo**: Daftar pembelian yang jatuh tempo di bulan berjalan ditampilkan di dashboard.
- **Kalender Jatuh Tempo**: Kalender navigable (bisa ke bulan lain) yang menandai tanggal-tanggal jatuh tempo hutang. Klik tanggal untuk melihat detail.
- **API**: `GET /api/dashboard/stats` (enhanced), `GET /api/dashboard/due-calendar?year=&month=`

### Tempo Hutang Supplier per Pembelian (DONE - Mar 2026)
- **Set Jatuh Tempo Manual**: Kolom "Jatuh Tempo" baru di tabel pembelian di halaman Hutang Supplier. Admin bisa set tanggal jatuh tempo per pembelian via date picker.
- **API**: `PUT /api/purchases/{id}/due-date?due_date=YYYY-MM-DD`

### HPP per Satuan di Produk (DONE - Mar 2026)
- Kolom baru "HPP/Satuan" di tabel produk. Menghitung cost_price / items_per_box untuk menampilkan harga pokok per satuan.

### Pencarian Produk untuk Canvasser (DONE - Mar 2026)
- **Fitur Cari Produk**: Section baru di dashboard Canvasser. Cari produk dengan debounce, tampilkan nama, stok total, stok per gudang, harga jual, dan harga per dus.
- **API**: `GET /api/canvassers/product-search?q=`

### Bulk Data Import (DONE - Mar 2026)
- **Halaman Import Data**: Admin page (`/admin/import-data`) for importing CSV/XLSX files directly into the database, **bypassing all business logic** (no auto-purchase, no stock deduction, no debt recalculation).
- **9 Import Types**: Gudang, Kategori, Supplier, Produk, Stok per Gudang, Pembelian Supplier, Pembayaran Hutang, Kios Mitra, Pesanan Kios Mitra — displayed in correct dependency order.
- **Smart Validation**: Name-based matching for foreign keys (e.g., category/supplier names mapped to IDs). Duplicate detection by name. Missing references reported as errors.
- **Grouped Imports**: Purchases and Partner Orders support multi-row grouping by `no_pembelian`/`no_pesanan` for multi-item records.
- **Template Download**: CSV templates with correct column headers for each type.
- **Clear Collection**: "Hapus Semua" button to wipe and re-import any collection.
- **API Endpoints**: `GET /api/import/types`, `GET /api/import/counts`, `GET /api/import/template/{type}`, `POST /api/import/{type}`, `DELETE /api/import/clear/{type}`

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
