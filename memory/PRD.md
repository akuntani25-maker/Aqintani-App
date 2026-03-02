# UD. AQIN TANI - Product Requirements Document

## Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian "UD. AQIN TANI" dengan fitur POS, manajemen inventori multi-gudang (dus/satuan), B2B distribution, dan portal kanvaser.

## Architecture
- **Backend**: FastAPI + MongoDB (motor async driver) + JWT Auth
- **Frontend**: React + Tailwind CSS + Shadcn UI + lucide-react + recharts
- **Database**: MongoDB
- **Auth**: JWT with role-based access (admin, cashier, canvasser)

## Credentials
- Admin: admin@aqintani.com / admin123
- Canvasser: kanvaser1@aqintani.com / canvasser123

## Completed Features

### Phase 1-3 - Core POS, UI, B2B (DONE)
- Full POS, dashboard, product/category/supplier CRUD, receipt printing
- Partner stores, partner orders, canvasser portal, purchases, analytics
- Setoran kios mitra & supplier payment tracking

### Phase 4 - Multi-Warehouse & Pricing (DONE)
- 3 Warehouses: Gudang Utama (dus), Gudang Toko (satuan), Gudang Lainnya (dus)
- Stock transfer with automatic dus↔satuan conversion
- Partner-specific custom pricing per product
- POS uses Gudang Toko stock only

### Phase 4.1 - Product Form Enhancement (DONE - Mar 2, 2026)
- **Stok input dalam DUS** (bukan satuan) saat tambah produk
- **Pilihan gudang tujuan** saat tambah produk (Utama/Toko/Lainnya)
- **Info konversi otomatis**: "X dus x Y satuan/dus = Z satuan masuk ke [gudang]"
- **Harga 3-tier**: Harga Beli/Dus, Harga Jual Satuan, Harga Jual per Dus
- Backend konversi otomatis: jika gudang satuan → simpan total satuan, jika gudang dus → simpan jumlah dus

## Remaining Tasks

### P1
- [ ] Google Maps integration for partner kiosk locations (needs API key)
- [ ] Advanced product filters on Products page

### P2
- [ ] Mobile-responsive improvements for canvasser portal

### Backlog
- [ ] Refactor backend server.py into modules
