# UD. AQIN TANI - Product Requirements Document

## Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian "UD. AQIN TANI" dengan fitur POS, manajemen inventori, B2B distribution management, dan portal kanvaser.

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
- Transaction/POS system
- Daily/monthly reports
- User management (admin, cashier roles)
- Receipt printing (print-preview for thermal paper)

### Phase 2 - UI/UX Redesign (DONE)
- Modern teal/cyan design theme
- Store name: "UD. AQIN TANI"
- Admin profile management (change name/email/password)
- Responsive layout with sidebar navigation

### Phase 3 - B2B Features (DONE)
- Partner Stores (Kios Mitra) CRUD with credit tracking
- Partner Orders system with cart, canvasser assignment
- Canvasser CRUD with vehicle info
- Canvasser login creation (Key/Login button)
- Canvasser portal: view orders, update status (pending/delivered/cancelled), record payments
- Remaining balance (sisa bon) tracking per partner store

### Phase 4 - New Features (Feb 28, 2026) (DONE)
- **Purchases page**: Full CRUD for purchases from suppliers, payment tracking, debt management
- **Analytics page**: 30-day sales chart, fast/slow moving products, category distribution pie chart, monthly summary
- **Canvasser Dashboard Enhancement**: Search orders by kios/order number, filter by status, notification badges (pending count, total remaining debt)
- **Setoran Kios Mitra**: Record payments from partner stores, payment history per store
- **Setoran Supplier**: Record payments to suppliers per purchase, debt tracking

### Bug Fixes (Feb 28, 2026)
- Fixed: Key/Login icon not visible on canvasser table
- Fixed: "AgriPharma POS" renamed to "Aqin Tani" across app
- Fixed: bcrypt compatibility issue (downgraded to 4.0.1)
- Fixed: Admin login credentials

## Key API Endpoints
- POST /api/auth/login - Login
- CRUD /api/products, /api/categories, /api/suppliers
- CRUD /api/partner-stores, /api/partner-orders
- CRUD /api/canvassers
- POST /api/purchases, /api/purchases/{id}/pay, DELETE /api/purchases/{id}
- GET /api/analytics/summary, /api/analytics/products
- POST /api/partner-stores/{id}/pay - Record kios payment
- GET /api/partner-stores/{id}/payments - Kios payment history
- GET /api/suppliers/{id}/payments, /api/suppliers/{id}/debt
- GET /api/canvassers/notifications
- GET /api/canvassers/my-orders

## Remaining Tasks

### P1
- [ ] Google Maps integration for partner kiosk locations (needs API key)
- [ ] Advanced product filters (low stock, fast/slow moving, by category/supplier) on Products page

### P2
- [ ] Mobile-responsive improvements for canvasser portal

### Backlog
- [ ] Refactor backend server.py into modules (routes, models)
