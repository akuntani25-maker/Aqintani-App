#!/usr/bin/env bash
# Backup database + foto produk ke /opt/aqintani/deploy/backups (disimpan 14 hari).
# Untuk memulihkan: sudo /opt/aqintani/deploy/restore.sh <file-db.archive.gz>
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
TS="$(date +%Y%m%d-%H%M)"
mkdir -p backups

docker compose exec -T mongo mongodump --db "${DB_NAME:-aqintani}" --archive --gzip > "backups/db-$TS.archive.gz"
docker run --rm -v aqintani_uploads:/u:ro -v "$PWD/backups":/b alpine tar czf "/b/foto-$TS.tgz" -C /u .

# hapus backup lebih dari 14 hari
find backups -type f \( -name 'db-*.archive.gz' -o -name 'foto-*.tgz' \) -mtime +14 -delete

SIZE="$(du -sh "backups/db-$TS.archive.gz" | cut -f1)"
echo "$(date '+%F %T') backup selesai: db-$TS.archive.gz ($SIZE), foto-$TS.tgz"
