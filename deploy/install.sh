#!/usr/bin/env bash
# =====================================================================
# Pasang Aqin Tani di VPS Ubuntu (22.04 / 24.04), sekali jalan.
#
#   curl -fsSL https://raw.githubusercontent.com/akuntani25-maker/Aqintani-App/aqintani-vps/deploy/install.sh | sudo bash
#
# Yang dilakukan:
#   1. menambah swap 2 GB (supaya build tidak kehabisan memori di VPS 2 GB)
#   2. memasang Docker
#   3. mengunduh kode ke /opt/aqintani
#   4. membuat pengaturan (.env): domain, kunci rahasia, akun admin pertama
#   5. menjalankan database + server + tampilan (HTTPS otomatis bila ada domain)
#   6. memasang backup harian otomatis (jam 02:30, disimpan 14 hari)
# Aman dijalankan ulang: pengaturan dan data yang sudah ada tidak ditimpa.
# =====================================================================
set -euo pipefail

REPO="https://github.com/akuntani25-maker/Aqintani-App.git"
BRANCH="${AQINTANI_BRANCH:-aqintani-vps}"
DIR="/opt/aqintani"
ENV_FILE="$DIR/deploy/.env"

say()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
ask()  { local prompt="$1" def="${2:-}" ans; read -r -p "$prompt" ans </dev/tty || true; echo "${ans:-$def}"; }

[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo (sebagai root)."; exit 1; }
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || warn "Skrip ini diuji untuk Ubuntu; sistem Anda: ${PRETTY_NAME:-tidak dikenal}"

# ---------- 1. swap ----------
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  say "Menambah swap 2 GB"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -q vm.swappiness=10; echo 'vm.swappiness=10' > /etc/sysctl.d/99-aqintani.conf
fi

# ---------- 2. Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  say "Memasang Docker"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl git >/dev/null
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null 2>&1 || { apt-get update -qq; apt-get install -y -qq git >/dev/null; }
systemctl enable --now docker >/dev/null 2>&1 || true

# ---------- 3. kode ----------
if [ -d "$DIR/.git" ]; then
  say "Memperbarui kode di $DIR"
  git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" reset -q --hard "origin/$BRANCH"
else
  say "Mengunduh kode ke $DIR"
  git clone -q --branch "$BRANCH" --depth 1 "$REPO" "$DIR"
fi
mkdir -p "$DIR/deploy/backups"
chmod +x "$DIR"/deploy/*.sh

# ---------- 4. pengaturan ----------
if [ ! -f "$ENV_FILE" ]; then
  say "Pengaturan awal"
  echo "Kalau sudah punya domain/subdomain yang diarahkan (A record) ke IP VPS ini,"
  echo "ketik di sini (contoh: toko.aqintani.online). Kosongkan bila belum punya."
  DOMAIN="$(ask 'Domain: ' '')"
  ADMIN_EMAIL="$(ask 'Email admin pertama [admin@aqintani.com]: ' 'admin@aqintani.com')"
  ADMIN_PASSWORD="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 14)"
  SECRET_KEY="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48)"
  if grep -qw avx /proc/cpuinfo; then MONGO_IMAGE="mongo:7.0"; else MONGO_IMAGE="mongo:4.4"; warn "CPU tanpa AVX: memakai MongoDB 4.4"; fi
  if [ -n "$DOMAIN" ]; then SITE_ADDRESS="$DOMAIN"; ORIGIN="https://$DOMAIN"; else SITE_ADDRESS=":80"; ORIGIN="*"; fi
  umask 077
  cat > "$ENV_FILE" <<EOF
# Pengaturan Aqin Tani — RAHASIA, jangan dibagikan.
SITE_ADDRESS=$SITE_ADDRESS
MONGO_IMAGE=$MONGO_IMAGE
DB_NAME=aqintani
SECRET_KEY=$SECRET_KEY
CORS_ORIGINS=$ORIGIN
# Hanya dipakai saat database masih kosong (sebelum data lama dipindah)
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
  NEW_ADMIN=1
fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

# ---------- firewall ----------
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

# ---------- 5. jalankan ----------
say "Membangun dan menjalankan aplikasi (pertama kali bisa 5–10 menit)"
cd "$DIR/deploy"
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true

# ---------- 6. backup harian ----------
cat > /etc/cron.d/aqintani-backup <<EOF
# Backup database + foto produk Aqin Tani setiap hari jam 02:30 (waktu server)
30 2 * * * root $DIR/deploy/backup.sh >> /var/log/aqintani-backup.log 2>&1
EOF

say "Menunggu server siap"
for _ in $(seq 1 60); do
  if docker compose exec -T backend python -c "import urllib.request;urllib.request.urlopen('http://localhost:8001/api/health')" >/dev/null 2>&1; then OK=1; break; fi
  sleep 3
done
[ "${OK:-}" = 1 ] || warn "Server belum menjawab. Cek dengan: cd $DIR/deploy && docker compose logs backend"

IP="$(curl -fsS -4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
URL="http://$IP"; [ "$SITE_ADDRESS" != ":80" ] && URL="https://$SITE_ADDRESS"
echo
echo "=============================================================="
echo " Aqin Tani berjalan di: $URL"
if [ "${NEW_ADMIN:-}" = 1 ]; then
  echo " Login admin pertama  : $ADMIN_EMAIL"
  echo " Password             : $ADMIN_PASSWORD"
  echo " (catat sekarang, lalu ganti di menu Profil setelah login)"
fi
echo
echo " Pindah data dari Emergent : sudo $DIR/deploy/migrate-from-emergent.sh"
echo " Backup manual             : sudo $DIR/deploy/backup.sh"
echo " Perbarui aplikasi         : sudo $DIR/deploy/update.sh"
echo "=============================================================="
