#!/usr/bin/env bash
# Pindahkan data dari aplikasi lama lewat web-nya (login admin), bila database
# Emergent tidak bisa diakses langsung.
#   sudo /opt/aqintani/deploy/migrate-via-web.sh
# Data di VPS akan diganti salinan dari aplikasi lama (backup VPS dibuat dulu).
set -euo pipefail
cd "$(dirname "$0")"

read -r -p "Data di VPS akan diganti salinan dari aplikasi lama. Ketik PINDAHKAN untuk lanjut: " ok </dev/tty
[ "$ok" = "PINDAHKAN" ] || { echo "Dibatalkan."; exit 1; }

echo "Backup data VPS saat ini..."
./backup.sh || true

docker compose cp migrate_from_web.py backend:/tmp/migrate_from_web.py >/dev/null
docker compose exec -it backend python /tmp/migrate_from_web.py </dev/tty
docker compose restart backend >/dev/null
echo "Server dimuat ulang. Silakan buka aplikasi dan login."
