#!/usr/bin/env bash
# =============================================================
# verify-zalo.sh — Kiểm tra Zalo Bot đang hoạt động trên VPS
# Chạy trên VPS sau khi deploy: bash /opt/newway/deploy/verify-zalo.sh
# =============================================================

set -e

# Đọc domain từ biến môi trường hoặc file .env
if [ -f /opt/newway/deploy/.env ]; then
  source /opt/newway/deploy/.env
fi

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  # Thử tìm domain từ CORS_ORIGIN
  DOMAIN="${CORS_ORIGIN#https://}"
  DOMAIN="${DOMAIN#http://}"
fi

if [ -z "$DOMAIN" ]; then
  echo "❌ Thiếu domain. Dùng: bash verify-zalo.sh <domain>"
  echo "   VD: bash verify-zalo.sh newway.congty.vn"
  exit 1
fi

echo ""
echo "🔍 Kiểm tra Zalo Bot trên: https://$DOMAIN"
echo "============================================="

# 1. Kiểm tra health endpoint bot
echo ""
echo "1️⃣  Kiểm tra bot health..."
HEALTH=$(curl -sf "https://$DOMAIN/api/zalo" 2>&1) && {
  echo "   ✅ Response: $HEALTH"
  if echo "$HEALTH" | grep -q '"botConfigured":true'; then
    echo "   ✅ ZALO_BOT_TOKEN đã được cấu hình"
  else
    echo "   ❌ ZALO_BOT_TOKEN chưa điền! Kiểm tra file .env"
  fi
} || {
  echo "   ❌ Không gọi được endpoint /api/zalo — backend chưa chạy?"
}

# 2. Kiểm tra webhook GET (Zalo Platform dùng để verify)
echo ""
echo "2️⃣  Kiểm tra webhook GET endpoint..."
WEBHOOK=$(curl -sf "https://$DOMAIN/api/zalo/webhook" 2>&1) && {
  echo "   ✅ Response: $WEBHOOK"
  if echo "$WEBHOOK" | grep -q '"status":"ok"'; then
    echo "   ✅ Webhook endpoint sẵn sàng nhận verify từ Zalo Platform"
  fi
} || {
  echo "   ❌ Không gọi được endpoint /api/zalo/webhook"
}

# 3. Kiểm tra webhook POST với secret sai (phải trả 401)
echo ""
echo "3️⃣  Kiểm tra webhook POST bảo mật (secret sai → phải 401)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://$DOMAIN/api/zalo/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Bot-Api-Secret-Token: wrong_secret_test" \
  -d '{"test":true}')
if [ "$STATUS" = "401" ]; then
  echo "   ✅ Trả về 401 — bảo mật OK"
elif [ "$STATUS" = "200" ] && [ -z "$ZALO_WEBHOOK_SECRET" ]; then
  echo "   ⚠️  Trả về 200 vì ZALO_WEBHOOK_SECRET chưa điền (bỏ qua verify)"
  echo "      → Nên điền ZALO_WEBHOOK_SECRET vào .env để bảo mật"
else
  echo "   ℹ️  HTTP $STATUS (nếu ZALO_WEBHOOK_SECRET trống thì 200 là bình thường)"
fi

# 4. Kiểm tra containers docker
echo ""
echo "4️⃣  Trạng thái Docker containers..."
if command -v docker &> /dev/null; then
  docker compose -f /opt/newway/deploy/docker-compose.yml ps 2>/dev/null \
    | grep -E "NAME|backend|frontend|redis|nginx" || docker ps --format "table {{.Names}}\t{{.Status}}"
else
  echo "   ℹ️  Docker không tìm thấy (chạy script này trên VPS)"
fi

echo ""
echo "============================================="
echo "✅ Kiểm tra xong."
echo ""
echo "📌 Bước tiếp theo:"
echo "   → Vào bot.zaloplatforms.com"
echo "   → Đổi webhook URL thành: https://$DOMAIN/api/zalo/webhook"
echo "   → Điền X-Bot-Api-Secret-Token = ZALO_WEBHOOK_SECRET trong .env"
echo ""
