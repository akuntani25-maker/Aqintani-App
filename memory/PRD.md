# UD. AQIN TANI - Product Requirements Document

## Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian "UD. AQIN TANI" dengan fitur POS, manajemen inventori multi-gudang, B2B distribution management, dan portal kanvaser.

## Architecture
- **Backend**: FastAPI + MongoDB (motor async driver) + JWT Auth
- **Frontend**: React + Tailwind CSS + Shadcn UI + lucide-react + recharts
- **Database**: MongoDB
- **Auth**: JWT with role-based access (admin, cashier, canvasser)

## Credentials
- Admin: admin@aqintani.com / admin123
- Canvasser: kanvaser1@aqintani.com / canvasser123

## Completed Features

### Phase 1 - Core POS (DONE)
- Admin dashboard with sales stats, charts
- Product CRUD with categories, suppliers
- Transaction/POS system (deducts from Gudang Toko)
- Daily/monthly reports
- User management (admin, cashier roles)
- Receipt printing (print-preview for thermal paper)

### Phase 2 - UI/UX Redesign (DONE)
- Modern teal/cyan design theme, store name "UD. AQIN TANI"
- Admin profile management, responsive sidebar navigation

### Phase 3 - B2B Features (DONE)
- Partner Stores (Kios Mitra) CRUD with credit/debt tracking
- Partner Orders with cart, canvasser assignment, warehouse selection
- Canvasser CRUD + login creation + portal
- Purchases from suppliers with debt tracking
- Analytics (30-day chart, fast/slow moving products, category pie chart)
- Setoran kios mitra + supplier payment history

### Phase 4 - Multi-Warehouse & Pricing (DONE - Mar 2, 2026)
- **3 Warehouses**: Gudang Utama (dus), Gudang Toko (satuan), Gudang Lainnya (dus)
- **Stock per warehouse**: Each product tracked separately in each warehouse
- **Transfer stok antar gudang**: With automatic conversion (dus↔satuan via items_per_box)
- **Product model enhanced**: items_per_box, box_price, cost_price per dus
- **POS uses Gudang Toko stock only**: Deducts satuan from Gudang Toko
- **Partner Orders select warehouse**: Admin picks which warehouse to fulfill from
- **Harga khusus mitra**: Custom per-product pricing per partner store
- **Supplier purchase details**: Per-supplier purchase history + price comparison
- **Transfer history**: Full audit trail of all stock movements

## Key API Endpoints
- Auth: POST /api/auth/login
- Products: CRUD /api/products
- Warehouses: GET /api/warehouses
- Warehouse Stock: GET/PUT /api/warehouse-stock
- Stock Transfers: GET/POST /api/stock-transfers
- Partner Prices: GET/PUT/DELETE /api/partner-prices
- Partner Orders: CRUD /api/partner-orders (with warehouse_id)
- Purchases: CRUD /api/purchases, POST /api/purchases/{id}/pay
- Analytics: GET /api/analytics/summary, /api/analytics/products
- Supplier Details: GET /api/suppliers/{id}/purchases, /api/products/{id}/price-comparison
- Payments: POST /api/partner-stores/{id}/pay, GET /api/partner-stores/{id}/payments

## Remaining Tasks

### P1
- [ ] Google Maps integration for partner kiosk locations (needs API key)
- [ ] Advanced product filters on Products page (low stock, by category/supplier)

### P2
- [ ] Mobile-responsive improvements for canvasser portal

### Backlog
- [ ] Refactor backend server.py into modules
