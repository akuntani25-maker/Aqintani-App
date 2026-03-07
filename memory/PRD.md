# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian bernama "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh (produk/barang, supplier, gudang, laporan, pengguna)
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor (Office Staff)**: Akses dashboard, produk, supplier, laporan
- **Kasir (Cashier)**: POS dan profil
- **Kanvaser (Canvasser)**: Dashboard kanvaser dan profil

## Core Requirements
1. Multi-role authentication (Admin, Manager, Karyawan Kantor, Kasir, Kanvaser)
2. Product/Barang management dengan kategori dan supplier
3. Multi-warehouse inventory (Gudang Utama/Toko/Lainnya)
4. POS system dengan daily summary, HPP display, stock transfer
5. Partner store (Kios Mitra) management dengan pesanan dan hutang
6. Supplier debt management dengan pembayaran bertahap
7. AI-powered stock forecasting (OpenAI GPT-4o via Emergent LLM Key)
8. Comprehensive reporting (PDF, CSV, daily, monthly, best sellers)
9. Audit trail untuk semua operasi kritis
10. Vehicle/Armada management (merged with Canvasser page)
11. Data import (CSV/Excel) untuk semua entitas
12. Thermal printer receipt support

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
│   ├── transaction_routes.py # Transactions, POS, returns
│   ├── partner_routes.py    # Partner stores, orders, pricing
│   ├── canvasser_routes.py  # Canvassers
│   ├── warehouse_routes.py  # Warehouses, stock, adjustments, transfers
│   ├── report_routes.py     # Dashboard, reports, analytics, forecast
│   └── admin_routes.py      # Vehicles, audit log, data import
└── .env

/app/frontend/src/
├── App.js
├── components/AdminLayout.js
├── pages/
│   ├── AdminDashboard.js, Analytics.js, AuditLog.js
│   ├── Canvassers.js, ImportData.js, Login.js
│   ├── PartnerOrders.js, PartnerStores.js, POS.js
│   ├── Products.js, Profile.js, Purchases.js
│   ├── Reports.js, SupplierDebts.js, Users.js
│   └── WarehouseManagement.js
└── utils/ThermalPrinter.js
```

## Key DB Collections
- `users`, `categories`, `suppliers`, `products`
- `warehouses`, `warehouse_stock`, `stock_adjustments`, `stock_transfers`
- `transactions`, `purchases`, `payment_history`
- `partner_stores`, `partner_orders`, `partner_prices`
- `canvassers`, `vehicles`, `returns`
- `audit_log`, `store_settings`

## What's Been Implemented (Complete)
- Full RBAC system (5 roles)
- Dashboard with all metrics (Nilai Aset Bersih, stock in/out, warehouse chart)
- POS with daily summary, HPP, stock transfer
- AI stock forecasting (Prediksi tab in Analytics)
- "Produk" → "Barang" terminology change across UI
- Invoice number & due date on purchases
- Dashboard metrics exclude import data
- Vehicle management merged with Canvasser page
- Audit trail system
- PDF/CSV report export (fixed)
- Data import system
- **Major Refactoring**: server.py split from 2900+ lines to modular architecture

## Credentials
- Admin: admin@aqintani.com / admin123
- Canvasser: canvasser@aqintani.com / 123456
