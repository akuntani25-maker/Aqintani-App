# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian bernama "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh (barang, supplier, gudang, laporan, pengguna, piutang pribadi)
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor (Office Staff)**: Akses dashboard, barang, supplier, laporan
- **Kasir (Cashier)**: POS, hutang petani, profil
- **Kanvaser (Canvasser)**: Dashboard kanvaser dan profil

## Core Requirements
1. Multi-role authentication (Admin, Manager, Karyawan Kantor, Kasir, Kanvaser)
2. Product/Barang management dengan kategori dan supplier
3. Multi-warehouse inventory (Gudang Utama/Toko/Lainnya)
4. POS system dengan daily summary, HPP display, stock transfer (search-based), link ke rincian transaksi & hutang petani
5. Partner store (Kios Mitra) management dengan pesanan dan hutang
6. Supplier debt management dengan pembayaran bertahap
7. AI-powered stock forecasting (OpenAI GPT-4o via Emergent LLM Key)
8. Comprehensive reporting (PDF, CSV, daily, monthly, best sellers)
9. Audit trail untuk semua operasi kritis
10. Vehicle/Armada management (merged with Canvasser page)
11. Data import (CSV/Excel) untuk semua entitas
12. Thermal printer receipt support
13. **Piutang Pribadi** - Manajemen pinjaman uang/barang ke individu
14. **Hutang Petani** - Sistem bon/kredit petani dengan limit, dikelola dari POS
15. **Rincian Transaksi Harian** - Halaman detail transaksi per hari

## Tech Stack
- **Backend**: FastAPI, Motor (MongoDB), Pydantic, JWT, emergentintegrations
- **Frontend**: React, React Router, Tailwind CSS, Shadcn/UI, recharts, jspdf, papaparse
- **Database**: MongoDB
- **AI**: OpenAI GPT-4o via Emergent LLM Key

## Architecture (Post-Refactoring)
```
/app/backend/
├── server.py           # Slim entry point (~100 lines)
├── database.py         # MongoDB connection
├── auth.py             # Auth utilities, JWT, RBAC permissions
├── models.py           # All Pydantic models
├── services.py         # Shared business logic (audit, stock calc)
├── routers/
│   ├── auth_routes.py       # Auth, users, roles, settings
│   ├── product_routes.py    # Products, categories
│   ├── supplier_routes.py   # Suppliers, purchases, debts, payments
│   ├── transaction_routes.py # Transactions, POS, returns, daily-transactions
│   ├── partner_routes.py    # Partner stores, orders, pricing
│   ├── canvasser_routes.py  # Canvassers
│   ├── warehouse_routes.py  # Warehouses, stock, adjustments, transfers
│   ├── report_routes.py     # Dashboard, reports, analytics, forecast
│   ├── admin_routes.py      # Vehicles, audit log, data import
│   └── loan_farmer_routes.py # Personal loans, farmers, farmer debts
└── .env

/app/frontend/src/pages/
├── PersonalLoans.js     # NEW: Piutang pribadi management
├── FarmerDebts.js       # NEW: Hutang petani management
├── DailyTransactions.js # NEW: Transaction detail page
├── POS.js               # UPDATED: +Rincian, +Hutang Petani buttons, search transfer
├── Dashboard.js         # UPDATED: Asset formula includes loans/farmer debts
└── ... (existing pages)
```

## Key DB Collections
- `users`, `categories`, `suppliers`, `products`
- `warehouses`, `warehouse_stock`, `stock_adjustments`, `stock_transfers`
- `transactions`, `purchases`, `payment_history`
- `partner_stores`, `partner_orders`, `partner_prices`
- `canvassers`, `vehicles`, `returns`
- `audit_log`, `store_settings`
- `personal_loans`, `loan_payments` (NEW)
- `farmers`, `farmer_transactions`, `farmer_payments` (NEW)

## What's Been Implemented (Complete)
- Full RBAC system (5 roles)
- Dashboard with all metrics (Nilai Aset Bersih includes piutang + hutang petani)
- POS with daily summary, HPP, stock transfer (search-based)
- AI stock forecasting (Prediksi tab in Analytics)
- "Produk" → "Barang" terminology change across UI
- Invoice number & due date on purchases
- Dashboard metrics exclude import data
- Vehicle management merged with Canvasser page
- Audit trail system
- PDF/CSV report export
- Data import system
- Major Refactoring: server.py split to modular architecture
- Personal Loans (Piutang Pribadi) page with CRUD + payments
- Farmer Debts (Hutang Petani) page with limit, accessible from POS
- Daily Transaction Details page with full product tables
- POS header: Rincian + Hutang Petani buttons
- Stock Transfer: search-based product selection

## Credentials
- Admin: admin@aqintani.com / admin123
- Canvasser: canvasser@aqintani.com / 123456
