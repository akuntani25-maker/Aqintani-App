# Panduan Setup Print Server - UD. AQIN TANI

## Apa Ini?
Program kecil yang berjalan di PC Anda agar tombol **"Cetak Struk"** di aplikasi POS bisa mencetak langsung ke printer thermal USB dengan **kualitas terbaik** (menggunakan font bawaan printer).

## Cara Kerja
```
Aplikasi POS  →  Print Server (di PC)  →  Printer USB
   (browser)      (localhost:9100)        (ESC/POS raw)
```

---

## Langkah Setup (Windows)

### 1. Install Python
- Download dari https://www.python.org/downloads/
- Saat install, **centang** "Add Python to PATH"
- Klik "Install Now"

### 2. Install Library yang Dibutuhkan
Buka **Command Prompt** (tekan `Win+R`, ketik `cmd`, Enter), lalu ketik:

```
pip install flask flask-cors pywin32
```

### 3. Download File print_server.py
- Download file `print_server.py` dari aplikasi
- Simpan di folder yang mudah diakses, misalnya `C:\PrintServer\print_server.py`

### 4. Pastikan Printer USB Terhubung
- Colok kabel USB printer thermal ke PC
- Pastikan printer muncul di **Settings > Printers & Scanners**
- Jika belum muncul, install driver printer terlebih dahulu

### 5. Jalankan Print Server
Buka Command Prompt, lalu:

```
cd C:\PrintServer
python print_server.py
```

Jika berhasil, akan muncul:
```
==================================================
  UD. AQIN TANI - Local Print Server
==================================================
  OS      : Windows
  Port    : 9100
  Printer : [Nama printer Anda]
==================================================
  Server siap di http://localhost:9100
  Tekan Ctrl+C untuk menghentikan
==================================================
```

### 6. Test Cetak
Buka browser, lalu buka aplikasi POS. Di halaman struk:
- Akan muncul pesan hijau: **"Print Server terdeteksi"**
- Klik **"Cetak Struk"** → struk langsung tercetak dengan kualitas tinggi!

---

## Troubleshooting

### "Printer : TIDAK TERDETEKSI"
- Cek kabel USB printer
- Pastikan printer menyala
- Pastikan driver printer terinstall (cek di Settings > Printers)

### "Print Server tidak aktif" (di aplikasi)
- Pastikan `print_server.py` sedang berjalan di Command Prompt
- Jangan tutup jendela Command Prompt saat menggunakan POS

### Ingin ganti printer?
Buka browser, ketik:
```
http://localhost:9100/printers
```
Akan muncul daftar printer. Untuk memilih printer tertentu:
```
http://localhost:9100/set-printer
```
POST dengan body: `{"name": "Nama Printer Anda"}`

### Test Print (tanpa aplikasi)
Buka browser, ketik:
```
http://localhost:9100/test
```
Lalu klik atau gunakan Postman untuk POST ke URL tersebut.

---

## Tips
- **Jangan tutup** jendela Command Prompt selama menggunakan POS
- Untuk **auto-start**, buat shortcut `print_server.py` di folder Startup Windows
- Jika print server tidak aktif, tombol "Cetak Struk" otomatis menggunakan **browser print** sebagai fallback
- Print server ini **100% lokal** - tidak ada data yang dikirim ke internet
