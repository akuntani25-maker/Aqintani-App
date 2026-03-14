# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor**: Dashboard, barang, kategori, supplier, hutang, kios mitra, laporan, analitik, armada, POS
- **Kasir**: POS (transaksi, shift, transfer stok, retur/tukar, hutang petani), profil
- **Kanvaser**: Dashboard kanvaser, cetak struk pesanan, profil

## Printing Architecture
- **Cetak Struk (PC)** - Local Print Server (ESC/POS raw via localhost:9100) → Fallback: browser print
- **Cetak Bluetooth** - Web Bluetooth API. Untuk mobile/tablet.
- **Local Print Server** - `print_server.py` (Flask + pywin32). Auto-start via Windows Startup folder (VBS + pythonw.exe).

## What's Been Implemented (Complete)
1. Full RBAC (5 roles, correct permissions)
2. Browser-based thermal printing + Bluetooth ESC/POS
3. Canvasser receipt printing
4. Dynamic items_per_box (decimal)
5. PDF/CSV with dynamic store settings header
6. Fixed warehouse value calculation
7. Notifikasi Stok Menipis - Dashboard detail + sidebar badge
8. Riwayat Perubahan Harga - Auto-logged per product
9. Laporan Laba/Rugi - Revenue vs COGS + daily breakdown + chart + Export PDF/CSV
10. Multi-user POS Shift Management
11. Local Print Server - Flask + pywin32, auto-start via Windows Startup folder
12. Penomoran Berkelanjutan - Rincian transaksi POS harian
13. PDF Portrait + Total di Akhir - semua laporan
14. Label Fix - "Hutang ke Supplier" (bukan "Supplier Berhutang")
15. **Form Barang 2 Mode** - "Barang Baru" dan "Restok Barang" dengan autocomplete search (nama, stok, supplier)
16. **Harga Pokok Supplier** - Field terpisah untuk harga asli supplier (untuk hutang) dan HPP toko (untuk margin)
17. **Dashboard Layout** - Nilai Aset Bersih di paling atas
18. **Dashboard Enhancement** - Barang Keluar detail (POS + Mitra), Bon Kios Mitra per Armada
19. **Dashboard Chart Fix** - Grafik penjualan 7 hari terakhir diperbaiki (key "sales")
20. **Kios Mitra Filter** - Total kios & piutang per vehicle saat filter aktif
21. **Rekapan No + Qty** - Kolom No dan total qty di semua tabel laporan

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: karyawan@aqintani.com / karyawan123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: canvasser@gmail.com / 123456

## Test Reports
- iteration_26: Batch 1 (14/14 backend + all UI passed)
- iteration_25: Print server + 4 changes (17/17 passed)

## Upcoming Tasks (Batch 2)
1. **Pesanan Kios - Harga Satuan Universal**: Harga diset per satuan, kalkulasi otomatis harga dus
2. **Pesanan Kios - Opsi Kondisional**: Barang pegangan kanvaser ditawarkan langsung
3. **Pesanan Kios - Partial Return**: Kios beli sebagian, sisa kembali ke stok (satuan→gudang toko, utuh dus→gudang utama). Kanvaser pilih item yang laku.

## Key Files
- `/app/frontend/src/pages/Products.js` - Two-mode form, autocomplete, supplier_cost_price
- `/app/frontend/src/pages/Dashboard.js` - Enhanced layout & stats
- `/app/frontend/src/pages/PartnerStores.js` - Vehicle filter totals
- `/app/frontend/src/pages/Reports.js` - No column, total qty
- `/app/backend/routers/product_routes.py` - Search autocomplete, restock flow
- `/app/backend/routers/report_routes.py` - Enhanced dashboard stats
- `/app/backend/models.py` - supplier_cost_price field
