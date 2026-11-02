# Aqin Tani v2 — catatan perubahan

Branch `aqintani-v2` dibuat dari `conflict_080426_1428` (versi yang sedang online, 30 Okt 2026).
Branch lain tidak diubah. Jalankan versi ini sebagai aplikasi terpisah dengan database sendiri
supaya web yang sedang berjalan tidak terganggu.

## Bug yang diperbaiki

| Masalah | Penyebab | Perbaikan |
| --- | --- | --- |
| `GET /api/products/low-stock` selalu error 500 | `response_model` ketat gagal bila ada produk dengan stok desimal / field kosong (data impor) | Dihitung di `metrics.low_stock_products()`, tanpa validasi ketat; ada `?count_only=true` untuk badge menu |
| Kartu "Margin" di Kasir sama dengan total penjualan | Mencari `cost_price` di baris transaksi, padahal tidak pernah disimpan | Biaya = `cost_price / items_per_box` dari produk; transaksi baru menyimpan `cost_price_unit` saat terjual |
| Analytics menampilkan Rp 0 dan "RpNaN" | Backend mengirim `monthly_sales` dll., halaman membaca `total_revenue`, `daily_trend`, `top_products` | Endpoint ditulis ulang: 30 hari terakhir, POS + kios, laba kotor; field lama tetap dikirim |
| Laba/Rugi menghitung HPP barang dari Gudang Utama per satuan | Qty dalam dus dikalikan biaya per satuan | Qty dari gudang "dus" dikonversi ke satuan; pesanan batal tidak dihitung; barang "beli dari luar" pakai biaya belinya |
| Dashboard 7 hari: 7 query terpisah, tanggal tidak ikut tutup buku 20:00 | — | 1 query, tanggal mengikuti hari bisnis |

Aturan perhitungan biaya sekarang ada di satu tempat: `backend/metrics.py`.

## Keamanan

- Tidak ada lagi kunci JWT bawaan (`your-secret-key-change-this-in-production`). **Wajib isi `SECRET_KEY` di `.env`**;
  tanpa itu dipakai kunci acak dan semua orang harus login ulang setiap server restart.
- Admin awal di database kosong tidak lagi `admin123`: pakai `ADMIN_EMAIL` / `ADMIN_PASSWORD` dari `.env`,
  atau password acak yang dicetak sekali di log.
- Kasir tidak lagi melihat HPP di kartu produk POS (hanya admin, manager, karyawan kantor).

## Kecepatan

- Halaman dimuat per kebutuhan (code splitting): JavaScript awal turun dari ±2,4 MB menjadi 554 KB (179 KB setelah gzip).
- Respons API dikompres gzip: daftar pesanan kios 67 KB → 7 KB.
- Badge stok menipis cek tiap 5 menit (bukan tiap 1 menit), hanya saat tab terlihat, dan berhenti bila gagal 3x.

## Tampilan HP

- Navigasi bawah (Beranda, Barang, Kasir, Pesanan, Menu) di layar < 1024 px.
- Kasir: keranjang jadi panel dari bawah dengan bilah total; kotak gambar kosong dihapus; tombol jadi ikon.
- Tabel bisa digeser di dalam kartunya dengan kolom pertama tetap terlihat; halaman tidak lagi bergeser ke samping.
- Angka besar di kartu tidak terpotong lagi ("Rp 2.471.9…").

## Menjalankan

```
# backend/.env
MONGO_URL=...
DB_NAME=aqintani_v2          # database terpisah dari versi lama
SECRET_KEY=<string acak panjang>
ADMIN_EMAIL=admin@aqintani.com
ADMIN_PASSWORD=<password kuat>
CORS_ORIGINS=https://<domain-v2>

# frontend/.env
REACT_APP_BACKEND_URL=https://<domain-v2>
```

Diuji 30–31 Okt 2026 dengan database uji (40 barang, 59 transaksi, 69 pesanan): 19 halaman admin + Kasir
dibuka di 1366 px dan 390 px tanpa error JS, tanpa respons API 4xx/5xx, tanpa geser samping.
