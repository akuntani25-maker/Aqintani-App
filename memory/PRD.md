# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian bernama "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh (barang, supplier, gudang, laporan, pengguna, piutang pribadi, import data)
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor (Office Staff)**: Dashboard, barang, kategori, supplier, hutang supplier, kios mitra, laporan, analitik, armada, POS
- **Kasir (Cashier)**: POS (transaksi, transfer stok, retur/tukar, hutang petani), profil
- **Kanvaser (Canvasser)**: Dashboard kanvaser, cetak struk pesanan, profil

## Core Requirements
1. Multi-role authentication (5 roles) with RBAC
2. Product/Barang management with categories and suppliers
3. Multi-warehouse inventory (Gudang Utama/Toko/Lainnya)
4. POS system with daily summary, HPP, stock transfer, retur/tukar barang
5. Partner store (Kios Mitra) management
6. Supplier debt management
7. AI-powered stock forecasting (OpenAI GPT-4o)
8. Comprehensive reporting (PDF/CSV with store settings header)
9. Audit trail
10. Vehicle/Armada management
11. Data import (CSV/Excel)
12. Thermal printer receipt support (USB ESC/POS + Bluetooth)
13. Piutang Pribadi (personal loans)
14. Hutang Petani (farmer debts with limits)
15. Rincian Transaksi Harian
16. Retur/Tukar Barang di POS (2-day limit)
17. Cetak struk pada halaman Kanvaser
18. Dynamic items_per_box (decimal support for dus)

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

## RBAC Permission Model
- `require_admin` → admin only (user mgmt, import, clear data)
- `require_admin_or_manager` → admin + manager (vehicles, audit log)
- `require_admin_panel_access` → admin + manager + office_staff (products, categories, suppliers, debts, reports, analytics, partner stores)
- `require_pos_access` → admin + manager + office_staff + cashier (stock transfers, returns)
- `get_current_user` → any authenticated user (read products, POS transactions, farmer debts)

## What's Been Implemented (Complete)
- Full RBAC system with correct permissions per role
- USB ESC/POS thermal printing (replacing broken window.print())
- Canvasser receipt printing feature
- Dynamic items_per_box (float/decimal)
- PDF/CSV export with dynamic store settings (phone, address)
- All previous features (POS, retur/tukar, piutang, hutang petani, forecasting, etc.)

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: kantor@aqintani.com / kantor123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: sahidin@aqintani.com / 123456

## Test Reports
- iteration_22.json: Receipt printing (12/12 passed)
- iteration_23.json: RBAC + decimal items_per_box (36+ passed)
