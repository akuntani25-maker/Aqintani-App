# UD. AQIN TANI - Product Requirements Document

## Original Problem Statement
Aplikasi web responsif untuk toko farmasi dan pertanian bernama "UD. AQIN TANI" dengan sistem manajemen bisnis lengkap.

## User Personas
- **Admin**: Manajemen penuh
- **Manager**: Seperti admin tanpa manajemen pengguna
- **Karyawan Kantor**: Dashboard, barang, kategori, supplier, hutang, kios mitra, laporan, analitik, armada, POS
- **Kasir**: POS (transaksi, shift, transfer stok, retur/tukar, hutang petani), profil
- **Kanvaser**: Dashboard kanvaser, cetak struk pesanan, profil

## RBAC Permission Model
- `require_admin` → admin only
- `require_admin_or_manager` → admin + manager
- `require_admin_panel_access` → admin + manager + office_staff
- `require_pos_access` → admin + manager + office_staff + cashier
- `get_current_user` → any authenticated user

## Printing Architecture
- **Cetak Struk (PC)** - Prioritas: Local Print Server (ESC/POS raw via localhost:9100) → Fallback: browser `window.print()` dengan CSS thermal 58mm
- **Cetak Bluetooth** - ESC/POS raw commands via Web Bluetooth API. Untuk mobile/tablet.
- **Local Print Server** - `print_server.py` (Flask + pywin32) berjalan di PC user. Mendukung Windows Service (auto-start). Download via `/api/download/print-server`.

## What's Been Implemented (Complete)
1. Full RBAC (5 roles, correct permissions)
2. Browser-based thermal printing (58mm CSS) + Bluetooth ESC/POS
3. Canvasser receipt printing
4. Dynamic items_per_box (decimal)
5. PDF/CSV with dynamic store settings header
6. Fixed warehouse value calculation
7. Notifikasi Stok Menipis - Dashboard detail + sidebar badge
8. Riwayat Perubahan Harga - Auto-logged, viewable per product
9. Laporan Laba/Rugi - Revenue vs COGS + daily breakdown + chart + Export PDF/CSV
10. Multi-user POS Shift Management
11. Local Print Server Solution - Flask + pywin32. Auto-start via Windows Startup folder (VBS script + pythonw.exe, tanpa perlu admin, tanpa console window). User cukup `python print_server.py install` sekali.
12. **Penomoran Berkelanjutan** - Rincian transaksi harian POS dengan nomor urut item yang berlanjut antar transaksi
13. **PDF Portrait + Total di Akhir** - Export PDF laporan diubah ke portrait, total hanya muncul di halaman terakhir
14. **Label Fix** - "Supplier Berhutang" diubah jadi "Hutang ke Supplier"

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: karyawan@aqintani.com / karyawan123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: canvasser@gmail.com / 123456

## Test Reports
- iteration_25: 4 user changes (17/17 backend + all UI passed)
- iteration_24: 4 new features (21/21 backend + all UI passed)
- iteration_23: RBAC fixes (36+ passed)

## Key Files
- `/app/print_server.py` - Local print server with Windows Service support
- `/app/PRINT_SERVER_GUIDE.md` - Setup guide in Indonesian
- `/app/frontend/src/pages/DailyTransactions.js` - Running number logic
- `/app/frontend/src/pages/Reports.js` - PDF export portrait + showFoot lastPage
- `/app/frontend/src/pages/SupplierDebt.js` - Label "Hutang ke Supplier"
