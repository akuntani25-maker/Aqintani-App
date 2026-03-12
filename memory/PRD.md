# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian bernama "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh (barang, supplier, gudang, laporan, pengguna, piutang, import, shift history)
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor (Office Staff)**: Dashboard, barang, kategori, supplier, hutang supplier, kios mitra, laporan, analitik, armada, POS
- **Kasir (Cashier)**: POS (transaksi, shift management, transfer stok, retur/tukar, hutang petani), profil
- **Kanvaser (Canvasser)**: Dashboard kanvaser, cetak struk pesanan, profil

## RBAC Permission Model
- `require_admin` → admin only (user mgmt, import, clear data)
- `require_admin_or_manager` → admin + manager
- `require_admin_panel_access` → admin + manager + office_staff
- `require_pos_access` → admin + manager + office_staff + cashier
- `get_current_user` → any authenticated user

## Architecture
```
/app/backend/
├── server.py, database.py, auth.py, models.py, services.py
├── routers/ (auth, product, supplier, transaction, partner, canvasser,
│             warehouse, report, admin, loan_farmer, shift)

/app/frontend/src/
├── pages/ (POS, Products, Reports, Dashboard, etc.)
├── utils/ThermalPrinter.js
└── components/ (AdminLayout, ui/)
```

## Key DB Collections
users, categories, suppliers, products, warehouses, warehouse_stock,
stock_adjustments, stock_transfers, transactions, purchases, payment_history,
partner_stores, partner_orders, partner_prices, canvassers, vehicles, returns,
audit_log, store_settings, personal_loans, loan_payments, farmers,
farmer_transactions, farmer_payments, pos_returns,
price_history, shifts

## What's Been Implemented (Complete)
1. Full RBAC (5 roles, correct permissions)
2. USB ESC/POS thermal printing + Canvasser receipt printing
3. Dynamic items_per_box (decimal)
4. PDF/CSV with dynamic store settings header
5. Fixed warehouse value calculation (gudang utama/toko/lainnya)
6. Notifikasi Stok Menipis - Dashboard detail + sidebar badge
7. Riwayat Perubahan Harga - Auto-logged, viewable per product
8. Laporan Laba/Rugi - Revenue vs actual COGS + daily breakdown + chart + **Export PDF & CSV**
9. Multi-user POS Shift Management - Open/close with balance tracking

## Test Reports
- iteration_22: Receipt printing (12/12 passed)
- iteration_23: RBAC fixes (36+ passed)
- iteration_24: 4 new features (21/21 backend + all UI passed)

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: kantor@aqintani.com / kantor123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: sahidin@aqintani.com / 123456
