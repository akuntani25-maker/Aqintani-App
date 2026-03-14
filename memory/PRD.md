# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor**: Dashboard, barang, kategori, supplier, hutang, kios mitra, laporan, analitik, armada, POS
- **Kasir**: POS (transaksi, shift, transfer stok, retur/tukar, hutang petani), profil
- **Kanvaser**: Dashboard kanvaser, cetak struk, settlement pesanan, profil

## Printing Architecture
- **Cetak Struk (PC)** - Local Print Server (ESC/POS raw via localhost:9100) → Fallback: browser print
- **Cetak Bluetooth** - Web Bluetooth API. Untuk mobile/tablet.
- **Local Print Server** - `print_server.py`. Auto-start via Windows Startup folder (VBS + pythonw.exe).

## What's Been Implemented (Complete)
1. Full RBAC (5 roles, correct permissions)
2. Browser-based thermal printing + Bluetooth ESC/POS
3. Local Print Server (auto-start Windows Service via Startup folder)
4. Dynamic items_per_box (decimal)
5. PDF/CSV with dynamic store settings header, Portrait orientation, total di akhir
6. Warehouse value calculation (correct cost_price + items_per_box)
7. Notifikasi Stok Menipis - Dashboard + sidebar badge
8. Riwayat Perubahan Harga - per product
9. Laporan Laba/Rugi - PDF/CSV export
10. Multi-user POS Shift Management
11. Penomoran Berkelanjutan di rincian transaksi harian POS
12. Kolom No + Total Qty di semua tabel laporan
13. **Form Barang 2 Mode** - "Barang Baru" & "Restok Barang" (autocomplete search)
14. **Harga Pokok Supplier** - Terpisah dari HPP Toko (untuk hutang supplier)
15. **Dashboard** - Aset Bersih di atas, breakdown Bon Mitra per armada di card, Barang Keluar (POS+Mitra)
16. **Grafik Penjualan** - Fixed (key `sales`)
17. **Kios Mitra Filter** - Total kios & piutang per vehicle
18. **Label** - "Hutang ke Supplier" (bukan "Supplier Berhutang")
19. **Harga Satuan Universal** - Pesanan kios selalu pakai harga satuan, kalkulasi otomatis per dus
20. **Pesanan Kondisional** - Tipe pesanan baru: barang pegangan kanvaser
21. **Settlement / Partial Return** - Kanvaser pilih qty laku, sisa kembali: satuan→gudang toko, utuh dus→gudang utama

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: karyawan@aqintani.com / karyawan123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: canvasser@gmail.com / 123456 (atau sahidin@aqintani.com / 123456)

## Test Reports
- iteration_27: Batch 2 (13/13 backend + all UI passed)
- iteration_26: Batch 1 (14/14 backend + all UI passed)
- iteration_25: Print server + 4 changes (17/17 passed)

## Key Files
- `/app/frontend/src/pages/Products.js` - Two-mode form, autocomplete, supplier_cost_price
- `/app/frontend/src/pages/Dashboard.js` - Enhanced layout, per-vehicle debt in aset card
- `/app/frontend/src/pages/PartnerOrders.js` - Harga satuan universal, order_type, badges
- `/app/frontend/src/pages/CanvasserDashboard.js` - Settlement (partial return) dialog
- `/app/backend/routers/partner_routes.py` - Settle endpoint, order_type
- `/app/backend/routers/report_routes.py` - Enhanced dashboard stats
- `/app/backend/models.py` - supplier_cost_price, order_type, is_settled
