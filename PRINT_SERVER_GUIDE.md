# Panduan Setup Print Server - UD. AQIN TANI

## Apa Ini?
Program kecil yang berjalan di PC Anda agar tombol **"Cetak Struk"** di aplikasi POS bisa mencetak langsung ke printer thermal USB dengan **kualitas terbaik** (menggunakan font bawaan printer).

---

## Langkah Setup (Windows)

### 1. Install Python (jika belum)
- Download dari https://www.python.org/downloads/
- Saat install, **centang** "Add Python to PATH"

### 2. Install Library
Buka **Command Prompt** (`Win+R` > ketik `cmd` > Enter):

```
pip install flask flask-cors pywin32
```

### 3. Download `print_server.py`
Download dari link di halaman struk aplikasi, simpan misalnya di:
```
C:\PrintServer\print_server.py
```

### 4. Pastikan Printer USB Terhubung
Printer harus muncul di **Settings > Printers & Scanners**

---

## Auto-Start (Otomatis Jalan saat PC Nyala)

Buka Command Prompt, lalu:

```
cd C:\PrintServer
python print_server.py install
```

**Selesai!** Print server akan **otomatis berjalan** setiap kali Windows dinyalakan, tanpa perlu buka Command Prompt lagi. Server berjalan tersembunyi di background (tanpa jendela console).

### Perintah lainnya:
```
python print_server.py remove    Hapus auto-start
python print_server.py status    Cek apakah auto-start aktif
python print_server.py           Jalankan manual (untuk testing)
```

---

## Cara Kerjanya
Perintah `install` membuat file kecil di folder **Windows Startup** (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`). File ini otomatis dijalankan Windows setiap kali user login. Tidak perlu hak Administrator.

---

## Verifikasi
Buka browser: `http://localhost:9100/status`

Jika muncul `{"status": "ok", "printer": "..."}` = sudah aktif.

Di halaman struk aplikasi:
- Banner **hijau**: Print Server terdeteksi
- Banner **kuning**: Print Server belum aktif

---

## Troubleshooting

### Print server tidak jalan otomatis setelah install
1. Cek apakah file ada: buka folder `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`
2. Harus ada file `AqinTaniPrintServer.vbs`
3. Coba double-click file tersebut untuk test

### Printer tidak terdeteksi
- Cek kabel USB dan pastikan printer menyala
- Pastikan driver printer terinstall (Settings > Printers)

### Ingin ganti printer default
Buka browser: `http://localhost:9100/printers` untuk lihat daftar printer.

---

## Tips
- Gunakan `python print_server.py install` agar tidak perlu setup ulang
- Print server 100% lokal - tidak ada data ke internet
- Jika server tidak aktif, "Cetak Struk" otomatis pakai browser print sebagai fallback
