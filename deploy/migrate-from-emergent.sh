#!/usr/bin/env bash
# =====================================================================
# Pindahkan SEMUA data dari aplikasi lama (Emergent) ke VPS ini.
#   sudo /opt/aqintani/deploy/migrate-from-emergent.sh
#
# - Anda akan diminta menempelkan MONGO_URL dari pengaturan Emergent.
#   Alamat itu hanya dipakai di VPS ini dan tidak disimpan ke mana pun.
# - Data lama di Emergent hanya DIBACA, tidak diubah sama sekali.
# - Data yang sudah ada di VPS akan diganti salinan dari Emergent
#   (backup VPS dibuat dulu secara otomatis).
# - Akun & password karyawan ikut pindah; semua orang cukup login ulang.
# - Foto produk diunduh dari web lama.
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
TARGET_DB="${DB_NAME:-aqintani}"
# alat salin (mongosh/mongodump) selalu dari image 7.0; hanya server mongod yang butuh CPU AVX
MONGO_IMG="mongo:7.0"
NET="aqintani_default"

echo "Tempel MONGO_URL dari Emergent (diawali mongodb:// atau mongodb+srv://)."
echo "Tulisan tidak akan tampil saat ditempel. Tekan Enter setelahnya."
read -r -s -p "MONGO_URL: " OLD_URL </dev/tty; echo
[ -n "$OLD_URL" ] || { echo "MONGO_URL kosong, dibatalkan."; exit 1; }
case "$OLD_URL" in
  *localhost*|*127.0.0.1*)
    echo
    echo "MONGO_URL ini menunjuk ke 'localhost', artinya database Emergent hanya bisa"
    echo "diakses dari dalam server Emergent sendiri, tidak dari VPS ini."
    echo "Hentikan di sini dan kabari Claude: data akan dipindah lewat cara lain"
    echo "(ekspor dari dalam aplikasi lama)."
    exit 2 ;;
esac
OLD_SITE="$(read -r -p 'Alamat web lama untuk mengunduh foto [https://aqintani.online]: ' s </dev/tty; echo "${s:-https://aqintani.online}")"

mongo_old() { docker run --rm -i "$MONGO_IMG" "$@"; }

echo "Menghubungi database lama..."
FIND_DB='const dbs=db.adminCommand({listDatabases:1,nameOnly:true}).databases.map(d=>d.name).filter(n=>!["admin","local","config"].includes(n));
let best=null,n=-1; for (const name of dbs){const c=db.getSiblingDB(name).getCollection("products").countDocuments({}); if(c>n){n=c;best=name;}} print(best+" "+n);'
if ! RES="$(mongo_old mongosh "$OLD_URL" --quiet --eval "$FIND_DB" 2>/tmp/aqin-mig.err)"; then
  # coba nama database dari URL bila tidak boleh melihat daftar database
  DB_IN_URL="$(echo "$OLD_URL" | sed -E 's#^mongodb(\+srv)?://[^/]+/([^?]*).*#\2#')"
  if [ -n "$DB_IN_URL" ] && [ "$DB_IN_URL" != "$OLD_URL" ]; then RES="$DB_IN_URL ?"; else
    echo "Gagal terhubung ke database lama:"; tail -3 /tmp/aqin-mig.err
    echo "Kemungkinan database Emergent tidak bisa diakses dari luar. Kabari Claude untuk cara lain."
    exit 1
  fi
fi
SRC_DB="$(echo "$RES" | tail -1 | awk '{print $1}')"; SRC_N="$(echo "$RES" | tail -1 | awk '{print $2}')"
[ -n "$SRC_DB" ] && [ "$SRC_DB" != "null" ] || { echo "Database berisi data produk tidak ditemukan."; exit 1; }
echo "Ditemukan database lama: $SRC_DB ($SRC_N barang)"

read -r -p "Data di VPS akan diganti salinan dari Emergent. Ketik PINDAHKAN untuk lanjut: " ok </dev/tty
[ "$ok" = "PINDAHKAN" ] || { echo "Dibatalkan."; exit 1; }

echo "Backup data VPS saat ini..."
./backup.sh || true

echo "Menyalin database (beberapa menit, tergantung ukuran data)..."
docker run --rm "$MONGO_IMG" mongodump --uri "$OLD_URL" --db "$SRC_DB" --archive --gzip \
  | docker run --rm -i --network "$NET" "$MONGO_IMG" mongorestore --uri "mongodb://mongo:27017" --drop --gzip --archive \
      --nsFrom "$SRC_DB.*" --nsTo "$TARGET_DB.*"

echo "Mengunduh foto produk dari $OLD_SITE ..."
docker compose exec -T -e OLD_SITE="$OLD_SITE" backend python - <<'PY'
import os, pathlib, requests
from pymongo import MongoClient
db = MongoClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "aqintani")]
base = os.environ["OLD_SITE"].rstrip("/")
root = pathlib.Path(os.environ.get("UPLOAD_DIR", "/data/uploads")) / "aqintani" / "products"
root.mkdir(parents=True, exist_ok=True)
ok = fail = 0
for p in db.products.find({"image_url": {"$regex": "^/api/products/image-file/"}}, {"image_url": 1}):
    name = p["image_url"].rsplit("/", 1)[-1]
    dest = root / name
    if dest.exists():
        ok += 1; continue
    try:
        r = requests.get(base + p["image_url"], timeout=30)
        r.raise_for_status()
        dest.write_bytes(r.content); ok += 1
    except Exception as e:
        fail += 1; print("  gagal:", name, e)
print(f"Foto: {ok} berhasil, {fail} gagal")
PY

docker compose restart backend >/dev/null
COUNTS="$(docker compose exec -T mongo sh -c "mongosh --quiet $TARGET_DB --eval 'print(\"barang \"+db.products.countDocuments({})+\", transaksi \"+db.transactions.countDocuments({})+\", pesanan kios \"+db.partner_orders.countDocuments({})+\", pengguna \"+db.users.countDocuments({}))' 2>/dev/null || mongo --quiet $TARGET_DB --eval 'print(\"barang \"+db.products.count()+\", pengguna \"+db.users.count())'")"
echo
echo "Selesai. Isi database VPS sekarang: $COUNTS"
echo "Login memakai akun dan password yang sama seperti di aplikasi lama."
echo "PENTING: ganti password akun yang tercatat di repo GitHub publik (admin, kasir, kanvaser)."
