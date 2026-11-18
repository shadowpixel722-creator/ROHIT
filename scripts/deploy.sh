#!/bin/sh
# Deploy to the Google Cloud test server, building on THIS machine so the live site isn't slowed down.
#   sh scripts/deploy.sh
# Steps: build here → back up the live database → upload source + built app (no .env, no databases,
# no backups) → check the upload's checksum → the server swaps it in only if everything succeeds.
set -e
cd "$(dirname "$0")/.."
VM=notebooks-test
ZONE=asia-south1-a
CONF=class-notebooks
PKG="${TMPDIR:-/tmp}/class-notebooks-app.tgz"
ssh_vm() { gcloud compute ssh "$VM" --zone="$ZONE" --configuration="$CONF" --command="$1"; }

echo "1/5 Building the app here"
npx prisma generate >/dev/null
npx next build >/dev/null
test -f .next/BUILD_ID

echo "2/5 Backing up the live database"
ssh_vm 'B=/var/lib/class-notebooks/prod.db.bak-$(date -u +%Y%m%d-%H%M%S); sudo -u notebooks sqlite3 /var/lib/class-notebooks/prod.db ".backup $B" && sudo -u notebooks sqlite3 "$B" "PRAGMA integrity_check;" && echo "backup: $B"'

echo "3/5 Packaging (source + built app; never .env, databases or backups)"
COPYFILE_DISABLE=1 tar czf "$PKG" \
  --exclude='*.db' --exclude='*.db.*' --exclude='*.db-journal' --exclude='*.bak*' \
  --exclude='.next/cache' --exclude='.next/trace' \
  package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs next-env.d.ts \
  prisma src public scripts .next
if tar tzf "$PKG" | grep -qiE '(^|/)\.env|\.db($|[.-])|\.bak'; then echo "Refusing: the package contains a secret or database file"; exit 1; fi
LOCAL_SUM=$(shasum -a 256 "$PKG" | cut -c1-64)

echo "4/5 Uploading and checking it arrived intact"
gcloud compute scp "$PKG" "$VM:/tmp/app.tgz" --zone="$ZONE" --configuration="$CONF" >/dev/null
REMOTE_SUM=$(ssh_vm 'sha256sum /tmp/app.tgz | cut -c1-64' | tail -1)
[ "$LOCAL_SUM" = "$REMOTE_SUM" ] || { echo "Checksum mismatch: upload damaged, not deploying"; exit 1; }

echo "5/5 Swapping in the new version on the server"
ssh_vm 'sudo /usr/local/bin/class-notebooks-deploy-prebuilt 2>&1 | tail -3'
rm -f "$PKG"
curl -s -o /dev/null -m 30 -w "Live site: HTTP %{http_code}\n" https://35-200-236-181.sslip.io/login
