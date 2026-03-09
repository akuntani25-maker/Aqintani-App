# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian bernama "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh (barang, supplier, gudang, laporan, pengguna, piutang pribadi)
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor (Office Staff)**: Akses dashboard, barang, supplier, laporan
- **Kasir (Cashier)**: POS, hutang petani, retur/tukar barang, profil
- **Kanvaser (Canvasser)**: Dashboard kanvaser dan profil

## Core Requirements
1. Multi-role authentication (Admin, Manager, Karyawan Kantor, Kasir, Kanvaser)
2. Product/Barang management dengan kategori dan supplier
3. Multi-warehouse inventory (Gudang Utama/Toko/Lainnya)
4. POS system dengan daily summary, HPP, stock transfer (search-based), retur/tukar barang
5. Partner store (Kios Mitra) management
6. Supplier debt management
7. AI-powered stock forecasting (OpenAI GPT-4o)
8. Comprehensive reporting (PDF/CSV)
9. Audit trail
10. Vehicle/Armada management
11. Data import (CSV/Excel)
12. Thermal printer receipt support
13. Piutang Pribadi (personal loans)
14. Hutang Petani (farmer debts with limits)
15. Rincian Transaksi Harian
16. Retur/Tukar Barang di POS (2-day limit)

## Architecture
```
/app/backend/
├── server.py, database.py, auth.py, models.py, services.py
├── routers/ (auth, product, supplier, transaction, partner, canvasser,
│             warehouse, report, admin, loan_farmer)

/app/frontend/src/pages/
├── POS.js (retur/tukar, transfer search, farmer/rincian buttons)
├── PersonalLoans.js, FarmerDebts.js, DailyTransactions.js
├── ReceiptPreview.js (2-day return policy note)
├── Reports.js (PDF header: store name + description + contact)
├── Dashboard.js (asset = inventory + partner + piutang + farmer - supplier)
├── Login.js (admin/manager/office_staff → /admin/dashboard)
└── ... (existing pages)
```

## Key DB Collections
users, categories, suppliers, products, warehouses, warehouse_stock,
stock_adjustments, stock_transfers, transactions, purchases, payment_history,
partner_stores, partner_orders, partner_prices, canvassers, vehicles, returns,
audit_log, store_settings, personal_loans, loan_payments, farmers,
farmer_transactions, farmer_payments, pos_returns

## What's Been Implemented (Complete)
- Full RBAC system (5 roles) with correct login redirects
- Dashboard with all metrics including piutang + hutang petani
- POS: daily summary, HPP, search-based transfer, retur/tukar (2-day limit)
- AI stock forecasting (Prediksi tab)
- "Produk" → "Barang" terminology
- Piutang Pribadi, Hutang Petani pages
- Rincian Transaksi Harian page
- Receipt with return policy note
- PDF header with store info
- Refactored backend (modular router architecture)
- All testing passed (iterations 18-21)

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: kantor@aqintani.com / kantor123
- Canvasser: canvasser@aqintani.com / 123456
