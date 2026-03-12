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
- **Local Print Server** - `print_server.py` (Flask + pywin32) berjalan di PC user, menerima raw ESC/POS data dan kirim ke printer USB. Download tersedia via `/api/download/print-server`.
- USB WebUSB option dihapus (tidak kompatibel dengan sebagian besar setup PC)

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
11. **Local Print Server Solution** - `print_server.py` created with Flask + pywin32 for high-quality USB thermal printing. Frontend auto-detects server, with browser print fallback. Download link available in receipt page.

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: karyawan@aqintani.com / karyawan123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: canvasser@gmail.com / 123456

## Test Reports
- iteration_22: Receipt printing (12/12 passed)
- iteration_23: RBAC fixes (36+ passed)
- iteration_24: 4 new features (21/21 backend + all UI passed)

## Key Files
- `/app/print_server.py` - Local print server script (user runs on PC)
- `/app/PRINT_SERVER_GUIDE.md` - Setup guide in Indonesian
- `/app/frontend/src/utils/ThermalPrinter.js` - ESC/POS utility + server communication
- `/app/frontend/src/pages/ReceiptPreview.js` - POS receipt with print server integration
- `/app/frontend/src/pages/PartnerOrderReceipt.js` - Partner order receipt with print server integration
- `/app/backend/server.py` - Added `/api/download/print-server` endpoint
