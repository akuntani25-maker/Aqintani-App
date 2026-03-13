# Panduan Setup Print Server - UD. AQIN TANI

## Apa Ini?
Program kecil yang berjalan di PC Anda agar tombol **"Cetak Struk"** di aplikasi POS bisa mencetak langsung ke printer thermal USB dengan **kualitas terbaik** (menggunakan font bawaan printer).

## Cara Kerja
```
Aplikasi POS  -->  Print Server (di PC)  -->  Printer USB
  (browser)       (localhost:9100)          (ESC/POS raw)
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
- Download file `print_server.py` dari link di halaman struk aplikasi
- Simpan di folder yang mudah diakses, misalnya `C:\PrintServer\print_server.py`

### 4. Pastikan Printer USB Terhubung
- Colok kabel USB printer thermal ke PC
- Pastikan printer muncul di **Settings > Printers & Scanners**

---

## Cara Menjalankan

### Opsi A: Jalankan Manual (sekali pakai)
```
cd C:\PrintServer
python print_server.py
```

### Opsi B: Install sebagai Windows Service (REKOMENDASI)
Dengan cara ini, print server **otomatis jalan saat Windows start** tanpa perlu setup ulang.

Buka **Command Prompt sebagai Administrator** (klik kanan > Run as administrator):

```
cd C:\PrintServer

:: Install service (cukup sekali)
python print_server.py install

:: Jalankan service
python print_server.py start
```

Selesai! Print server sekarang **otomatis berjalan** setiap kali Windows dinyalakan.

#### Perintah Service Lainnya:
```
python print_server.py stop       :: Hentikan service
python print_server.py restart    :: Restart service
python print_server.py remove     :: Hapus service dari Windows
```

---

## Verifikasi
Buka browser, ketik: `http://localhost:9100/status`

Jika muncul `{"status": "ok", "printer": "..."}`, print server sudah aktif.

Di halaman struk aplikasi:
- Banner hijau: **"Print Server terdeteksi"** = sudah siap cetak
- Banner kuning: **"Print Server tidak aktif"** = belum jalan

---

## Troubleshooting

### "Printer : TIDAK TERDETEKSI"
- Cek kabel USB printer
- Pastikan printer menyala
- Pastikan driver printer terinstall (cek di Settings > Printers)

### Service gagal install
- Pastikan Command Prompt dibuka **sebagai Administrator**
- Pastikan `pywin32` terinstall: `pip install pywin32`
- Jalankan `python -m win32serviceutil` untuk verifikasi

### Print Server tidak aktif (di aplikasi)
- Cek apakah service berjalan: buka `services.msc`, cari "UD. AQIN TANI - Print Server"
- Atau jalankan manual: `python print_server.py`

---

## Tips
- **Gunakan Opsi B (Windows Service)** agar tidak perlu menjalankan manual setiap kali
- Print server ini **100% lokal** - tidak ada data yang dikirim ke internet
- Jika print server tidak aktif, tombol "Cetak Struk" otomatis menggunakan **browser print** sebagai fallback
