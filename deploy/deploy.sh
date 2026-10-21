#!/usr/bin/env bash
# ============================================================
#  Deploy nhanh lên VPS: kéo code từ GitHub + CHỈ build service đã đổi.
#
#  Dùng:
#    cd /opt/newway
#    bash deploy/deploy.sh
#
#  Lợi ích so với `docker compose up -d --build` (build cả 2):
#    - Chỉ build backend HOẶC frontend nếu chỉ 1 bên đổi → nhanh ~một nửa.
#    - Nếu chỉ đổi tài liệu/SQL (không đổi be/fe) → KHÔNG build lại (vài giây).
#    - Cảnh báo file migration mới cần chạy tay trước khi build.
# ============================================================
set -euo pipefail
cd /opt/newway

BEFORE="$(git rev-parse HEAD)"
echo "→ git fetch + reset về origin/main"
git fetch --quiet origin main
git reset --hard --quiet origin/main
AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "✓ Không có commit mới (đang ở ${AFTER:0:8})."
  CHANGED=""
else
  echo "✓ Cập nhật ${BEFORE:0:8} → ${AFTER:0:8}"
  CHANGED="$(git diff --name-only "$BEFORE" "$AFTER")"
fi

# ── Cảnh báo migration mới (phải chạy TAY trước khi build) ──
NEW_SQL="$(printf '%s\n' "$CHANGED" | grep -E '^deploy/migrate-.*\.sql$' || true)"
if [ -n "$NEW_SQL" ]; then
  echo ""
  echo "⚠ CÓ FILE MIGRATION MỚI — chạy TAY trước khi build:"
  printf '%s\n' "$NEW_SQL" | sed 's#^#    docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < #'
  echo ""
fi

# ── Chỉ build service có thay đổi ──
SERVICES=""
if printf '%s\n' "$CHANGED" | grep -q '^be/'; then SERVICES="$SERVICES backend"; fi
if printf '%s\n' "$CHANGED" | grep -q '^fe/'; then SERVICES="$SERVICES frontend"; fi

if [ -z "${SERVICES// /}" ]; then
  echo "✓ Không có thay đổi be/fe → không cần build."
else
  echo "→ Build:${SERVICES}"
  # BuildKit: tận dụng cache layer (npm ci đã cache nếu package.json không đổi).
  DOCKER_BUILDKIT=1 docker compose up -d --build $SERVICES
fi

echo ""
docker compose ps
echo ""
echo "Xong. Log backend: docker compose logs --tail=30 backend"

# Don build cache cu hon 7 ngay (khong dung container/image/volume dang dung)
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
