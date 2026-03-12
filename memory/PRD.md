# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian bernama "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh (barang, supplier, gudang, laporan, pengguna, piutang pribadi, import data)
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor (Office Staff)**: Dashboard, barang, kategori, supplier, hutang supplier, kios mitra, laporan, analitik, armada, POS
- **Kasir (Cashier)**: POS (transaksi, transfer stok, retur/tukar, hutang petani), profil
- **Kanvaser (Canvasser)**: Dashboard kanvaser, cetak struk pesanan, profil

## RBAC Permission Model
- `require_admin` → admin only (user mgmt, import, clear data)
- `require_admin_or_manager` → admin + manager (vehicles, audit log)
- `require_admin_panel_access` → admin + manager + office_staff (products, categories, suppliers, debts, reports, analytics, partner stores)
- `require_pos_access` → admin + manager + office_staff + cashier (stock transfers, returns)
- `get_current_user` → any authenticated user (read products, POS, farmer debts)

## Architecture
```
/app/backend/
├── server.py, database.py, auth.py, models.py, services.py
├── routers/ (auth, product, supplier, transaction, partner, canvasser,
│             warehouse, report, admin, loan_farmer)

/app/frontend/src/
├── pages/ (POS, Products, Reports, FarmerDebts, PersonalLoans, etc.)
├── utils/ThermalPrinter.js (ESC/POS for USB & Bluetooth)
└── components/ui/ (shadcn)
```

## Warehouse Value Calculation Logic
- **Gudang Utama/Lainnya (unit=dus)**: value = stock_in_boxes × cost_price_per_box
- **Gudang Toko (unit=satuan)**: value = stock_in_units × (cost_price / items_per_box)
- **Category breakdown**: uses product.stock (satuan) × (cost_price / items_per_box)

## What's Been Implemented (Complete)
- Full RBAC system with correct permissions per role (fixed admin-only bug)
- USB ESC/POS thermal printing (replacing broken window.print())
- Canvasser receipt printing feature
- Dynamic items_per_box (float/decimal)
- PDF/CSV export with dynamic store settings (phone, address)
- Fixed warehouse value calculation (gudang utama now calculates correctly for dus)
- Fixed analytics category breakdown calculation
- All previous features (POS, retur/tukar, piutang, hutang petani, forecasting, etc.)

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: kantor@aqintani.com / kantor123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: sahidin@aqintani.com / 123456

## Test Reports
- iteration_22.json: Receipt printing (12/12 passed)
- iteration_23.json: RBAC + decimal items_per_box (36+ passed)
