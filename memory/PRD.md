# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor**: Dashboard, barang, kategori, supplier, hutang, kios mitra, laporan, analitik, armada, POS
- **Kasir**: POS (transaksi, shift, transfer stok, retur/tukar, hutang petani), profil
- **Kanvaser**: Dashboard kanvaser, cetak struk, settlement pesanan, rekap harian, profil

## Printing Architecture
- **Cetak Struk (PC)** - Local Print Server (ESC/POS raw via localhost:9100) -> Fallback: browser print
- **Cetak Bluetooth** - Web Bluetooth API. Untuk mobile/tablet.
- **Local Print Server** - `print_server.py`. Auto-start via Windows Startup folder (VBS + pythonw.exe).

## What's Been Implemented (Complete) - 28 Features
1. Full RBAC (5 roles, correct permissions)
2. Browser-based thermal printing + Bluetooth ESC/POS
3. Local Print Server (auto-start Windows Startup folder)
4. Dynamic items_per_box (decimal)
5. PDF/CSV with dynamic store settings header, Portrait, total di akhir
6. Warehouse value calculation (correct cost_price + items_per_box)
7. Notifikasi Stok Menipis - Dashboard + sidebar badge
8. Riwayat Perubahan Harga - per product
9. Laporan Laba/Rugi - PDF/CSV export
10. Multi-user POS Shift Management
11. Penomoran Berkelanjutan di rincian transaksi harian POS
12. Kolom No + Total Qty di semua tabel laporan
13. Form Barang 2 Mode - "Barang Baru" & "Restok Barang" (autocomplete search)
14. Harga Pokok Supplier - Terpisah dari HPP Toko (untuk hutang supplier)
15. Dashboard - Aset Bersih di atas, breakdown Bon Mitra per armada, Barang Keluar (POS+Mitra)
16. Grafik Penjualan - Fixed (key `sales`)
17. Kios Mitra Filter - Total kios & piutang per vehicle
18. Label - "Hutang ke Supplier"
19. Harga Satuan Universal - Pesanan kios selalu pakai harga satuan, kalkulasi otomatis per dus
20. Pesanan Kondisional - Tipe pesanan baru: barang pegangan kanvaser
21. Settlement / Partial Return - Kanvaser pilih qty laku, sisa kembali: satuan->gudang toko, utuh dus->gudang utama
22. Rekap Harian Kanvaser - Admin (tab Rekap Kanvaser di Reports) + Kanvaser (Rekap Hari Ini di dashboard)
23. POS Cart - Editable quantity input (direct typing)
24. Partner Orders Cart - Editable quantity input (direct typing)
25. Reports - Exclude zero-quantity transactions from all reports
26. VBScript Auto-Start - Fixed path escaping for Windows Startup
27. Canvasser Dashboard - Store debt history (Sisa Bon) shown per order card
28. Canvasser Settlement Form - Correct max limit based on items_per_box and warehouse_unit
29. Partner Orders - Search autocomplete untuk memilih kios mitra (dengan info hutang)
30. POS - Timezone WITA (UTC+8) dengan business day reset jam 20:00
31. Rincian Transaksi - Urutan ascending (terbaru di bawah)
32. Rincian Transaksi - Tombol Salin ke clipboard (format spreadsheet)
33. Edit Transaksi - Koreksi harga jual tanpa perlu retur
34. Gambar Produk - Upload gambar di halaman Produk, tampil di POS
35. Modal Lock - Dialog tidak bisa ditutup klik area luar, hanya via Batal/X
36. Fix Barang Keluar Dashboard - Timezone WITA + fallback cost_price||price
37. Audit Log Transfer Stok - Catat siapa, gudang mana, halaman apa (Admin/POS)
38. Edit Piutang Kios Mitra - Pembayaran (kurangi hutang) dan Koreksi Manual (set nilai baru)
39. Fix Barang Keluar Dashboard - Kalkulasi pakai harga pokok toko (cost_price/items_per_box) dari produk
40. Dark Mode - Toggle di topbar admin + POS, tersimpan di localStorage
41. Password Visibility - Icon mata di halaman login untuk show/hide password
42. Security - Hapus kredensial demo dari frontend code
43. Format Struk Kios Mitra - Hapus subtotal, grand total, telpon. Urutan: Total Pesanan → Bon Sebelumnya → Total Bon → Dibayar → Sisa Hutang
44. Cancel Order Auto Retur - Stok dikembalikan ke gudang asal, hutang kios dikurangi, item external di-skip
45. Tambah Item ke Pesanan - 3 sumber: Gudang Utama, Gudang Toko, Beli dari Luar (external expense dicatat, dipotong dari hasil penjualan)
46. Fix Margin Rekap Kios Mitra - Kalkulasi total_sell untuk dus pakai subtotal/price*qty*ipb, tidak minus lagi

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: karyawan@aqintani.com / karyawan123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: sahidin@aqintani.com / 123456

## Test Reports
- iteration_28: Batch 6 fixes (10/10 backend + 3/3 UI passed)
- iteration_27: Batch 2 - settlement, kondisional, harga satuan (13/13 passed)
- iteration_26: Batch 1 - form 2 mode, dashboard, reports (14/14 passed)
- iteration_25: Print server + minor changes (17/17 passed)

## Upcoming Tasks (P1)
1. Halaman baru untuk kelola "barang retur" dari canvasser
2. Fitur di halaman laporan admin untuk melihat & kelola retur tersebut

## Key Files
- `/app/print_server.py` - Local print server with auto-start
- `/app/frontend/src/pages/POS.js` - POS with editable qty, shift, retur/tukar
- `/app/frontend/src/pages/PartnerOrders.js` - Partner orders with editable qty, harga satuan
- `/app/frontend/src/pages/CanvasserDashboard.js` - Settlement, rekap, sisa bon
- `/app/frontend/src/pages/Reports.js` - All reports + Rekap Kanvaser tab
- `/app/backend/routers/partner_routes.py` - Settle endpoint, order_type
- `/app/backend/routers/report_routes.py` - Dashboard stats, canvasser recap
- `/app/backend/routers/canvasser_routes.py` - My recap, enriched my-orders
- `/app/backend/models.py` - supplier_cost_price, order_type, is_settled
