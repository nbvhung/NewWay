#!/usr/bin/env bash
# =============================================================
# verify-zalo.sh — Kiểm tra Zalo Bot đang hoạt động trên VPS
# Chạy trên VPS sau khi deploy: bash /opt/newway/deploy/verify-zalo.sh
# =============================================================

set -e

# Đọc domain từ biến môi trường hoặc file .env
if [ -f /opt/newway/.env ]; then
  source /opt/newway/.env
elif [ -f /opt/newway/deploy/.env ]; then
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
  echo "   VD: bash verify-zalo.sh newwaytraco.com"
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

# 2. Kiểm tra ZALO_POLLING trong .env (production dùng polling, KHÔNG webhook)
echo ""
echo "2️⃣  Kiểm tra cơ chế nhận tin (phải là long-polling)..."
if [ -f /opt/newway/.env ]; then
  POLLING=$(grep '^ZALO_POLLING=' /opt/newway/.env | cut -d= -f2-)
  if [ "$POLLING" = "true" ]; then
    echo "   ✅ ZALO_POLLING=true — đang dùng long-polling (getUpdates) ✅"
  else
    echo "   ❌ ZALO_POLLING=$POLLING — phải là true! Zalo KHÔNG gửi webhook tới domain duckdns."
  fi
else
  echo "   ℹ️  Không tìm thấy /opt/newway/.env (chạy script này trên VPS)"
fi

# 3. Kiểm tra polling đã giành leadership chưa
echo ""
echo "3️⃣  Kiểm tra log polling (leader election)..."
if command -v docker &> /dev/null; then
  if docker logs --tail=40 newway-backend-1 2>&1 | grep -q "Đã giành leadership"; then
    echo "   ✅ Poller đã giành leadership, đang long-polling ✅"
  else
    echo "   ⚠️  Chưa thấy 'Đã giành leadership'. Chờ 10-30s rồi chạy lại."
    echo "      Nếu log có 'Zalo polling chưa được bật' → sửa ZALO_POLLING=true rồi docker compose up -d backend"
  fi
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
echo "📌 Lưu ý:"
echo "   → Production dùng long-polling (ZALO_POLLING=true), KHÔNG cần set webhook trên bot.zaloplatforms.com"
echo "   → Nếu đổi nội dung file audio 'buồn ngủ': đổi TÊN file (vd buon-ngu-v3.aac) + route + ZALO_BUON_NGU_AUDIO_URL để tránh cache"
echo ""
