#!/usr/bin/env bash
# Ambil versi terbaru dari GitHub lalu bangun ulang. Data tidak tersentuh; backup dibuat dulu.
set -euo pipefail
cd "$(dirname "$0")"
./backup.sh || echo "Peringatan: backup gagal, lanjut update."
BRANCH="$(git -C .. rev-parse --abbrev-ref HEAD)"
git -C .. fetch -q origin "$BRANCH"
git -C .. reset -q --hard "origin/$BRANCH"
chmod +x ./*.sh
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true
echo "Update selesai: $(git -C .. log -1 --format='%h %s')"
