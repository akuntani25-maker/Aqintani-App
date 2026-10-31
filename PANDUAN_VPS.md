# Panduan memasang Aqin Tani di VPS (Biznet Gio)

Aplikasi berjalan sepenuhnya di VPS Anda: database, server, dan tampilan. Tidak ada biaya
tambahan selain VPS yang sudah Anda bayar. Web lama di Emergent **tidak disentuh**; matikan
langganan Emergent hanya setelah versi VPS sudah Anda pakai dan cocok.

Kebutuhan: VPS Ubuntu 22.04/24.04, RAM minimal 2 GB (spesifikasi Anda: 2 GB RAM, 1 vCPU, 60 GB, Ubuntu 24.04 — cukup).

---

## Langkah 1 — Buka port 80 dan 443 di panel Biznet Gio

Di panel Biznet Gio, buka pengaturan firewall/security group VPS, lalu pastikan port berikut
boleh diakses dari mana saja: **22** (SSH), **80** (HTTP), **443** (HTTPS).

## Langkah 2 — (Disarankan) siapkan subdomain

Supaya web lama tetap jalan selama masa coba, pakai subdomain baru, misalnya
`toko.aqintani.online`. Di tempat Anda membeli domain, tambahkan DNS record:

| Tipe | Nama | Nilai |
| --- | --- | --- |
| A | toko | *IP publik VPS Anda* |

Tunggu 5–30 menit sampai aktif. Tanpa domain pun aplikasi bisa dicoba lewat `http://IP-VPS`,
tetapi tanpa HTTPS (password terkirim tanpa enkripsi), jadi pakai cara itu hanya untuk mencoba.

## Langkah 3 — Pasang aplikasi (satu perintah)

Masuk ke VPS lewat SSH (atau konsol web Biznet Gio), lalu jalankan:

```bash
curl -fsSL https://raw.githubusercontent.com/akuntani25-maker/Aqintani-App/aqintani-vps/deploy/install.sh | sudo bash
```

Anda akan ditanya:
- **Domain**: ketik subdomain dari langkah 2, atau kosongkan.
- **Email admin pertama**: tekan Enter untuk `admin@aqintani.com`.

Proses pertama ±5–10 menit. Di akhir akan tampil alamat aplikasi dan **password admin
pertama — catat**. HTTPS dipasang otomatis bila memakai domain.

## Langkah 4 — Pindahkan data dari Emergent

```bash
sudo /opt/aqintani/deploy/migrate-from-emergent.sh
```

- Tempel `MONGO_URL` dari pengaturan Emergent saat diminta (tulisan tidak tampil, itu normal).
- Ketik `PINDAHKAN` untuk konfirmasi.
- Semua data pindah: barang, stok, transaksi, pesanan kios, hutang, piutang, log, **akun dan
  password karyawan**. Foto produk diunduh dari web lama.
- Data di Emergent hanya dibaca, tidak diubah.
- Setelah selesai, login dengan akun lama Anda. Akun admin pertama dari langkah 3 tidak dipakai
  lagi karena tergantikan data lama.

Bila skrip berkata database Emergent tidak bisa diakses dari luar (alamatnya `localhost`),
berhenti di situ dan kabari Claude; data akan dipindah dengan cara lain.

Skrip ini boleh dijalankan ulang (misalnya sesaat sebelum pindah total) untuk mengambil data terbaru.

## Langkah 5 — Ganti password (penting)

Repo GitHub aplikasi ini **publik**, dan beberapa file lama di dalamnya mencantumkan password
akun (`admin123`, `kasir123`, `123456`). Setelah data pindah, ganti password semua akun:
masing-masing login lalu buka menu **Profil → Ubah Password**.

## Langkah 6 — Pindah total dari Emergent

Setelah beberapa hari dipakai dan cocok:
1. Jalankan lagi langkah 4 untuk mengambil data terakhir dari Emergent.
2. Ubah DNS domain utama (`aqintani.online`) agar menunjuk ke IP VPS, lalu jalankan
   `sudo nano /opt/aqintani/deploy/.env`, ganti `SITE_ADDRESS` dan `CORS_ORIGINS` ke domain
   utama, simpan, dan jalankan `sudo /opt/aqintani/deploy/update.sh`.
3. Hentikan langganan Emergent.

---

## Pemakaian sehari-hari

| Keperluan | Perintah |
| --- | --- |
| Backup manual | `sudo /opt/aqintani/deploy/backup.sh` |
| Lihat daftar backup | `ls -lh /opt/aqintani/deploy/backups` |
| Pulihkan dari backup | `sudo /opt/aqintani/deploy/restore.sh backups/db-TANGGAL.archive.gz backups/foto-TANGGAL.tgz` |
| Perbarui aplikasi | `sudo /opt/aqintani/deploy/update.sh` |
| Cek status | `cd /opt/aqintani/deploy && sudo docker compose ps` |
| Lihat log server | `cd /opt/aqintani/deploy && sudo docker compose logs --tail 100 backend` |
| Restart semua | `cd /opt/aqintani/deploy && sudo docker compose restart` |

**Backup otomatis** berjalan setiap hari jam 02:30 (waktu server) dan disimpan 14 hari di
`/opt/aqintani/deploy/backups`. Backup itu ada di VPS yang sama, jadi **seminggu sekali unduh
salinannya ke komputer Anda** (misalnya dengan WinSCP atau FileZilla, folder di atas). Bila VPS
rusak total, salinan inilah yang menyelamatkan data.

**Pembaruan keamanan Ubuntu**: sebulan sekali jalankan
`sudo apt update && sudo apt upgrade -y && sudo reboot`. Aplikasi menyala lagi otomatis setelah reboot.

## Susunan teknis

- `deploy/docker-compose.yml`: tiga layanan — `mongo` (database, cache dibatasi 256 MB agar muat
  di RAM 2 GB), `backend` (FastAPI), `web` (Caddy: tampilan + HTTPS otomatis + meneruskan `/api`).
- Data tersimpan di volume Docker `aqintani_mongo-data` dan `aqintani_uploads` (foto produk).
- Pengaturan rahasia di `deploy/.env` (dibuat oleh install.sh, tidak masuk Git).
- CPU tanpa AVX otomatis memakai MongoDB 4.4.

## Bila ada masalah

- **Halaman tidak terbuka**: cek port 80/443 di panel Biznet Gio, lalu `sudo docker compose ps`.
- **HTTPS gagal**: pastikan DNS domain sudah menunjuk ke IP VPS (`ping toko.aqintani.online`),
  lalu `sudo docker compose restart web`.
- **Build kehabisan memori**: install.sh sudah menambah swap 2 GB; jalankan ulang install.sh.
