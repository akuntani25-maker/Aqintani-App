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
47. Terjual Semua - Tombol di dialog settlement kanvaser untuk auto-isi semua qty terjual
48. Filter Retur di Struk - Struk kios mitra hanya tampilkan item yang terjual (settled_items), item retur dikeluarkan
49. Filter Retur di Laporan - Laporan partner sales detail, best sellers, dan laba/rugi menggunakan qty settled untuk pesanan yang sudah diselesaikan
50. MongoDB Indexing - Index komprehensif pada 15+ koleksi untuk optimasi performa query (transactions, products, partner_orders, purchases, warehouse_stock, users, dll)
51. Koreksi Hutang Supplier - Fitur edit/koreksi manual sisa hutang supplier dengan audit trail
52. Koreksi Hutang Petani - Fitur edit/koreksi manual sisa hutang petani dengan audit trail
53. Fix Piutang Kios Mitra - Pembayaran lebih dari total piutang sekarang bisa minus (kelebihan bayar)
54. Stok Mobil Box - Halaman baru untuk kelola barang kondisional di kendaraan (muat, jual ke kios, retur ke gudang)
55. Integrasi Aset Mobil - Nilai stok mobil box ditambahkan ke perhitungan Nilai Aset Bersih di dashboard
56. Alur Pesanan Kondisional - Pesanan kondisional di halaman Pesanan Kios Mitra sekarang langsung masuk ke Stok Mobil Box (pilih mobil, bukan kios mitra)
57. Oper Pesanan - Fitur transfer pesanan dari satu kios ke kios lain, dengan edit harga jual manual dan pilih pembayaran cash/bon
58. Settlement Retur ke Stok Box - Sisa barang dari penyelesaian pesanan kanvaser kini masuk ke stok mobil box (bukan langsung gudang)
59. Edit Harga Stok Mobil - Tombol edit harga jual per item di halaman Stok Mobil Box
60. Retur Pilih Gudang - Retur dari stok mobil box kini bisa pilih gudang tujuan (Utama/Toko)
61. Oper ke Pesanan Existing - Transfer/oper pesanan otomatis merge ke pesanan aktif kios tujuan (tidak buat baru)
62. Edit Harga di Modal Jual - Harga jual bisa diedit langsung di form penjualan stok mobil box
63. Konversi Unit Stok Box - Loading dari gudang dus otomatis dikonversi ke pcs di vehicle stock
64. Simplifikasi Supplier Debt - Pembayaran hutang supplier disederhanakan, retur per-item dihilangkan
65. Bulk Add Product - Form "Tambah Barang dari Supplier" untuk input banyak barang sekaligus dari satu supplier, dengan integrasi hutang supplier (bayar di muka, invoice, jatuh tempo) dan search supplier
66. Retur ke Mobil Box - Modal retur di Pesanan Kios Mitra kini bisa pilih tujuan: Gudang atau Mobil Box
67. Oper Pesanan Merge Fix - Fix query oper pesanan agar handle kedua ejaan "cancelled"/"canceled"
68. Info Pertanian Lombok - Tab baru di Analytics: cuaca real-time 4 wilayah Lombok (Open-Meteo API), berita pertanian real dari Google News RSS + scraping portal berita NTB (LombokPost, insidelombok, ntbprov.go.id, ANTARA, dll), aktivitas pertanian terkini berdasarkan data berita, kondisi pasar komoditas, rekomendasi tanaman, kebutuhan pupuk/obat, waspada hama/penyakit (AI GPT-4o menganalisis data cuaca + berita real). Menggantikan tab Prediksi Stok AI.
69. Redesign Halaman Hutang Supplier - Tabel detail pembelian per-item (tanggal, nama barang, qty dus+satuan, harga pokok, total, jatuh tempo per tanggal). Search nama barang + filter tanggal. Import riwayat pembelian dari CSV (hutang saja, tanpa stok).
70. Redesign Detail Kios Mitra - Tabel detail pesanan per-item (tanggal, no order, nama barang terjual, qty dus, qty satuan, harga jual, total, setoran). Subtotal per tanggal + Grand Total. Search nama barang + filter tanggal. Import riwayat pesanan dari CSV (menambah piutang). Backend: GET /partner-stores/{id}/order-items, POST /partner-stores/{id}/import-orders-csv.
71. Sorting & Pagination Hutang Supplier - Data pembelian di detail supplier disortir berdasarkan tanggal terbaru. Ditambahkan pagination per grup tanggal (10 grup per halaman) untuk data yang banyak.
72. Pagination & Sorting Detail Kios Mitra - Data pesanan di detail kios mitra disortir tanggal terbaru + pagination per grup tanggal (10 per halaman).
73. Import Riwayat Bayar Supplier - Fitur import CSV riwayat pembayaran di tab Riwayat Bayar supplier. Mengurangi hutang secara FIFO (dari pembelian terlama). Format: Tanggal, Jumlah, Catatan.
74. Import Riwayat Setoran Kios Mitra - Fitur import CSV riwayat setoran di section Riwayat Setoran detail kios mitra. Mengurangi piutang. Format: Tanggal, Jumlah, Catatan. Section selalu ditampilkan + total setoran.
75. Support XLSX Import - Semua fitur import (pembelian supplier, pembayaran supplier, pesanan kios mitra, setoran kios mitra) sekarang mendukung format CSV dan XLSX. Menggunakan library SheetJS (xlsx). Parser terpusat di `utils/fileParser.js` dengan handle tanggal Excel numeric.
76. Cetak Faktur Dot Matrix (Epson LX-310) - Tombol "Cetak Faktur" di halaman struk kios mitra. Format INVOICE untuk kertas NCR 3-ply (22x14cm) dengan layout: INVOICE+nama toko (2 kolom header), kepada/alamat kios, no invoice/tanggal, kode sales, tabel item (No/Nama/Jml CTN/Quantity/Harga/Jumlah), terbilang (angka ke kata Indonesia), catatan+ringkasan keuangan (2 kolom: Sub Total/Bon/Total Tagihan). Continuous form printing (33 baris/halaman, tanpa FF). Max 10 item/halaman. Cash invoice tanpa sisa hutang.
77. Fix Retur ke Gudang saat Settlement - Bug: retur dari settlement selalu masuk vehicle_stock meskipun user pilih retur ke gudang. Fix: tambah field `return_to` di SettlementRequest ("vehicle" atau "warehouse"). Jika "warehouse": retur masuk ke gudang asal (gudang_toko=satuan, gudang_utama=dus) + recalculate_product_stock dipanggil. UI: radio button "Stok Mobil Box" / "Gudang" di dialog settlement canvasser.

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: karyawan@aqintani.com / karyawan123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: sahidin@aqintani.com / 123456

## Test Reports
- Manual verification (28 Mar 2026): Terjual Semua + Receipt/Report filter (screenshot + curl)
- iteration_28: Batch 6 fixes (10/10 backend + 3/3 UI passed)
- iteration_27: Batch 2 - settlement, kondisional, harga satuan (13/13 passed)
- iteration_26: Batch 1 - form 2 mode, dashboard, reports (14/14 passed)
- iteration_25: Print server + minor changes (17/17 passed)

## Upcoming Tasks (P1)
1. Halaman baru untuk kelola "barang retur" dari canvasser
2. Fitur di halaman laporan admin untuk melihat & kelola retur tersebut

## Future Tasks (P2)
1. Rekap harian stok mobil box (muat, terjual, retur per hari per mobil)

## Key Files
- `/app/print_server.py` - Local print server with auto-start (thermal + dot matrix)
- `/app/frontend/src/utils/ThermalPrinter.js` - ESC/POS thermal printer utility
- `/app/frontend/src/utils/DotMatrixPrinter.js` - ESC/P dot matrix printer utility (Epson LX-310)
- `/app/frontend/src/utils/fileParser.js` - Shared CSV/XLSX parser utility
- `/app/frontend/src/pages/POS.js` - POS with editable qty, shift, retur/tukar
- `/app/frontend/src/pages/PartnerOrders.js` - Partner orders with editable qty, harga satuan
- `/app/frontend/src/pages/PartnerOrderReceipt.js` - Receipt page: thermal + bluetooth + dot matrix faktur
- `/app/frontend/src/pages/CanvasserDashboard.js` - Settlement with return_to option (vehicle/warehouse)
- `/app/frontend/src/pages/CanvasserDashboard.js` - Settlement, rekap, sisa bon
- `/app/frontend/src/pages/Reports.js` - All reports + Rekap Kanvaser tab
- `/app/frontend/src/pages/PartnerStoreDetail.js` - Detail kios mitra: tabel pesanan per-item, search/filter, import CSV
- `/app/frontend/src/pages/SupplierDebt.js` - Detail hutang supplier per-item, search/filter, import CSV
- `/app/backend/routers/partner_routes.py` - Settle, order items, CSV import, transfer
- `/app/backend/routers/report_routes.py` - Dashboard stats, canvasser recap
- `/app/backend/routers/canvasser_routes.py` - My recap, enriched my-orders
- `/app/backend/models.py` - supplier_cost_price, order_type, is_settled
