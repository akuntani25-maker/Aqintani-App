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
- **Cetak Struk (Browser Print)** - `window.print()` via new window with optimized thermal CSS (@page size:58mm, Courier New monospace, 48mm printable width). Works with any printer installed on the OS.
- **Cetak Bluetooth** - ESC/POS raw commands via Web Bluetooth API. For mobile/tablet.
- USB option removed (WebUSB incompatible with most PC setups)

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

## Credentials
- Admin: admin@aqintani.com / admin123
- Office Staff: kantor@aqintani.com / kantor123
- Cashier: kasir@aqintani.com / kasir123
- Canvasser: sahidin@aqintani.com / 123456

## Test Reports
- iteration_22: Receipt printing (12/12 passed)
- iteration_23: RBAC fixes (36+ passed)
- iteration_24: 4 new features (21/21 backend + all UI passed)
