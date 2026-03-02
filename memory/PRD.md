# UD. AQIN TANI - Product Requirements Document

## Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian "UD. AQIN TANI" dengan fitur POS, manajemen inventori multi-gudang, B2B distribution, dan portal kanvaser.

## Architecture
- **Backend**: FastAPI + MongoDB (motor async driver) + JWT Auth
- **Frontend**: React + Tailwind CSS + Shadcn UI + lucide-react + recharts

## Credentials
- Admin: admin@aqintani.com / admin123
- Canvasser: kanvaser1@aqintani.com / canvasser123

## Completed Features
- Full POS with receipt printing for thermal paper
- Product CRUD with multi-warehouse stock (Utama/dus, Toko/satuan, Lainnya/dus)
- Integrated stock transfer per produk with auto conversion dus↔satuan
- Product filters: kategori, supplier, gudang, stok rendah
- Categories, Suppliers CRUD
- Partner Stores (Kios Mitra) with debt tracking + setoran
- Partner Orders with warehouse selection + custom partner pricing
- Canvasser portal (login, view orders, update status, record payment)
- Purchases from suppliers with debt tracking
- Analytics dashboard (sales chart, fast/slow moving, category breakdown)
- Admin profile management, receipt printing

## Remaining Tasks
### P1
- [ ] Google Maps for partner kiosk locations
- [ ] Advanced analytics (export to Excel/PDF)

### Backlog
- [ ] Refactor backend server.py into modules
- [ ] Mobile-responsive canvasser portal
