# Panduan Konfigurasi Printer Thermal POS 58 RPP02N

## Fitur yang Telah Diimplementasikan

✅ **Koneksi USB dan Bluetooth**
- Support WebUSB API untuk koneksi USB
- Support Web Bluetooth API untuk koneksi wireless
- Auto-detect printer thermal POS 58 RPP02N

✅ **Auto Print**
- Cetak struk otomatis setelah transaksi berhasil
- Bisa diaktifkan/nonaktifkan di halaman Settings
- Fallback ke print browser jika printer tidak terhubung

✅ **Format ESC/POS**
- Format struk thermal 58mm (32 karakter per baris)
- Support bold, alignment (left/center/right), ukuran font
- Auto paper cut setelah cetak

✅ **Test Print**
- Tombol test print untuk memastikan koneksi
- Test print dengan nama toko dan konfirmasi koneksi

---

## Cara Menggunakan

### 1. Persiapan Printer
**Untuk USB:**
- Nyalakan printer
- Hubungkan kabel USB ke komputer
- Pastikan driver printer sudah terinstall

**Untuk Bluetooth:**
- Nyalakan printer
- Aktifkan mode pairing Bluetooth di printer
- Aktifkan Bluetooth di komputer/laptop

### 2. Konfigurasi di Aplikasi

1. Login sebagai Admin
2. Buka menu **"Printer"** di sidebar
3. Pilih metode koneksi:
   - **USB**: Klik tombol "Hubungkan via USB"
   - **Bluetooth**: Klik tombol "Hubungkan via Bluetooth"
4. Browser akan menampilkan dialog pemilihan printer
5. Pilih printer "RPP02N" atau "POS-58"
6. Klik "Connect" atau "Pair"

### 3. Test Print

1. Setelah terhubung, klik tombol **"Test Print"**
2. Printer akan mencetak struk test berisi:
   - "TEST PRINT"
   - "UD. AQIN TANI"
   - "Printer terhubung dengan baik"

### 4. Aktifkan Auto Print

1. Di halaman Printer Settings
2. Aktifkan toggle **"Cetak Otomatis Setelah Transaksi"**
3. Struk akan otomatis dicetak setelah transaksi berhasil

### 5. Transaksi dengan Auto Print

1. Buka halaman **POS** (untuk kasir)
2. Tambahkan produk ke keranjang
3. Klik **Checkout**
4. Pilih metode pembayaran
5. Masukkan jumlah bayar
6. Klik **Bayar**
7. ✅ Struk otomatis dicetak ke printer thermal!

---

## Format Struk yang Dicetak

```
         UD. AQIN TANI
   Toko Obat & Alat Pertanian

28/02/2026 17:30:15
No: TRX20260228173015
Kasir: Nama Kasir
--------------------------------
Paracetamol 500mg
2 x Rp 5.000           Rp 10.000

Obat Batuk Herbal
1 x Rp 25.000          Rp 25.000
--------------------------------
Subtotal:              Rp 35.000
TOTAL:                 Rp 35.000
Bayar (cash):          Rp 50.000
Kembali:               Rp 15.000

   Terima kasih atas kunjungan Anda!
        Barang yang sudah dibeli
     tidak dapat ditukar/dikembalikan



[Auto Cut]
```

---

## Browser yang Didukung

✅ **Chrome** (versi 89+)
✅ **Edge** (versi 89+)
❌ Firefox (belum support WebUSB & Web Bluetooth)
❌ Safari (belum support WebUSB & Web Bluetooth)

---

## Troubleshooting

### Printer tidak terdeteksi (USB)
1. Pastikan printer sudah ON
2. Coba cabut dan colok ulang kabel USB
3. Restart browser
4. Pastikan driver printer sudah terinstall
5. Cek di Device Manager apakah printer terdeteksi

### Printer tidak terdeteksi (Bluetooth)
1. Pastikan Bluetooth printer dalam mode pairing
2. Pastikan Bluetooth komputer sudah aktif
3. Coba unpair dan pair ulang
4. Restart browser
5. Jarak printer maksimal 10 meter

### Struk tidak keluar
1. Cek apakah printer terhubung (icon hijau di Settings)
2. Cek kertas printer sudah terpasang dengan benar
3. Coba test print dulu
4. Pastikan auto print sudah diaktifkan
5. Cek console browser untuk error message

### Print lambat (Bluetooth)
- Normal, karena Bluetooth mengirim data dalam chunk kecil
- Biasanya 3-5 detik untuk cetak full struk
- USB lebih cepat (~1-2 detik)

### Karakterset aneh
- Browser modern sudah support UTF-8
- Jika ada masalah, gunakan Chrome versi terbaru

---

## Spesifikasi Teknis

**Printer**: POS 58 RPP02N
**Lebar Kertas**: 58mm (32 karakter per baris)
**Format**: ESC/POS commands
**Koneksi**: USB 2.0 / Bluetooth 4.0+
**Kecepatan**: 90mm/s
**Auto Cutter**: Ya

---

## Kode Implementasi

File-file yang terlibat:
- `/app/frontend/src/utils/ThermalPrinter.js` - Utility printer thermal
- `/app/frontend/src/pages/Settings.js` - Halaman konfigurasi
- `/app/frontend/src/pages/POS.js` - Integrasi di POS system

ESC/POS Commands yang digunakan:
- `0x1B 0x40` - Initialize printer
- `0x1B 0x61 0x01` - Align center
- `0x1D 0x21 0x11` - Double size
- `0x1B 0x45 0x01` - Bold ON
- `0x1D 0x56 0x00` - Cut paper

---

## Tips & Best Practices

1. **Selalu test print** setelah menghubungkan printer
2. **Gunakan USB** untuk koneksi lebih stabil dan cepat
3. **Gunakan Bluetooth** jika butuh mobility
4. **Aktifkan auto print** untuk efisiensi kasir
5. **Siapkan backup kertas** printer thermal
6. **Restart browser** jika ada masalah koneksi
7. **Update browser** ke versi terbaru untuk compatibility

---

## Support

Untuk bantuan lebih lanjut:
- Cek console browser (F12) untuk error detail
- Baca manual printer RPP02N
- Pastikan firmware printer up to date
