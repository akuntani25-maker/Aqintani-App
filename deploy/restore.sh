#!/usr/bin/env bash
# Memulihkan database dari file backup. Data sekarang akan DIGANTI isi backup.
#   sudo /opt/aqintani/deploy/restore.sh backups/db-20261101-0230.archive.gz [backups/foto-20261101-0230.tgz]
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
DB_FILE="${1:-}"; FOTO_FILE="${2:-}"
[ -f "$DB_FILE" ] || { echo "Pakai: $0 <file-db.archive.gz> [file-foto.tgz]"; ls -1t backups 2>/dev/null | head; exit 1; }

read -r -p "Data sekarang akan diganti isi $DB_FILE. Ketik PULIHKAN untuk lanjut: " ok </dev/tty
[ "$ok" = "PULIHKAN" ] || { echo "Dibatalkan."; exit 1; }

./backup.sh || true   # simpan kondisi sekarang dulu, untuk berjaga-jaga
docker compose exec -T mongo mongorestore --drop --gzip --archive --nsInclude "${DB_NAME:-aqintani}.*" < "$DB_FILE"
if [ -n "$FOTO_FILE" ] && [ -f "$FOTO_FILE" ]; then
  docker run --rm -v aqintani_uploads:/u -v "$PWD":/b alpine sh -c "tar xzf /b/$FOTO_FILE -C /u"
fi
docker compose restart backend
echo "Pemulihan selesai."
