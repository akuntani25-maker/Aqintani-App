# UD. AQIN TANI - Product Requirements Document

## Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian "UD. AQIN TANI" dengan fitur POS, manajemen inventori, B2B distribution management, dan portal kanvaser.

## Architecture
- **Backend**: FastAPI + MongoDB (motor async driver) + JWT Auth
- **Frontend**: React + Tailwind CSS + Shadcn UI + lucide-react icons
- **Database**: MongoDB
- **Auth**: JWT with role-based access (admin, cashier, canvasser)

## Credentials
- Admin: admin@aqintani.com / admin123
- Canvasser: ahmadrifai@aqintani.com / canvasser123

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

### Phase 3 - B2B Features (PARTIALLY DONE)
- Partner Stores (Kios Mitra) CRUD with credit tracking
- Partner Orders system with cart, canvasser assignment
- Canvasser CRUD with vehicle info
- Canvasser login creation (Key/Login button)
- Canvasser portal: view orders, update status (pending/delivered/cancelled), record payments
- Remaining balance (sisa bon) tracking per partner store
- Product analytics (fast/slow moving)
- Store settings management

### Bug Fixes (Feb 28, 2026)
- Fixed: Key/Login icon not visible on canvasser table (changed to outline variant with text)
- Fixed: "AgriPharma POS" renamed to "Aqin Tani" across app
- Fixed: bcrypt compatibility issue (downgraded to 4.0.1 for passlib)
- Fixed: Admin login credentials (reset to admin@aqintani.com / admin123)

## Remaining Tasks

### P1 - B2B Expansion
- [ ] Purchases page (currently placeholder "Coming soon") - track purchases from suppliers
- [ ] Advanced product filters (low stock, fast/slow moving, by category/supplier)
- [ ] Google Maps integration for partner kiosk locations (needs API key)
- [ ] Partner Store Detail page enhancements

### P2 - Enhancements
- [ ] Purchase history & outstanding payment tracking to suppliers
- [ ] Analytics page (currently placeholder)

### Backlog
- [ ] Refactor backend server.py into modules (routes, models)
- [ ] Mobile-responsive improvements for canvasser portal
