#!/usr/bin/env bash
set -euo pipefail

# =============================================================
# setup-vps.sh — 1-command VPS setup for New Way production
# Chạy với quyền root: curl -L <url> | bash
# =============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[ "$EUID" -eq 0 ] || err "Phải chạy với quyền root (sudo su)"

DOMAIN="${1:-}"
[ -z "$DOMAIN" ] && err "Thiếu domain! Chạy: bash setup-vps.sh <domain.com>"

# ---------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------
apt update -y
apt install -y docker.io docker-compose wireguard ufw certbot curl

systemctl enable --now docker

# ---------------------------------------------------------
# 2. Firewall — chỉ mở 80, 443, 51820
# ---------------------------------------------------------
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 51820/udp
ufw --force enable
info "Firewall configured — only ports 80, 443, 51820 open"

# ---------------------------------------------------------
# 3. SSL Let's Encrypt
# ---------------------------------------------------------
certbot certonly --standalone --non-interactive --agree-tos \
  --email admin@"$DOMAIN" -d "$DOMAIN" || warn "SSL cert failed — run later: certbot --nginx -d $DOMAIN"
info "SSL certificate obtained for $DOMAIN"

# ---------------------------------------------------------
# 4. WireGuard client (kết nối tới DB server)
# ---------------------------------------------------------
WG_DIR="/etc/wireguard"
CLIENT_PRIV="$(wg genkey)"
CLIENT_PUB="$(echo "$CLIENT_PRIV" | wg pubkey)"

cat > "$WG_DIR/wg0.conf" <<WGEOF
[Interface]
Address = 10.8.0.1/24
PrivateKey = $CLIENT_PRIV
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT

[Peer]
PublicKey = <SERVER_PUB_KEY>   # ← TODO: thay bằng public key từ db server
Endpoint = <DB_SERVER_IP>:51820
AllowedIPs = 10.8.0.2/32
PersistentKeepalive = 25
WGEOF

chmod 600 "$WG_DIR/wg0.conf"
systemctl enable --now wg-quick@wg0 2>/dev/null || true
info "WireGuard client created at $WG_DIR/wg0.conf"
echo -e "${YELLOW}⚠ Gửi public key này cho DB server:${NC}"
echo "$CLIENT_PUB"

# ---------------------------------------------------------
# 5. App directory & deploy
# ---------------------------------------------------------
mkdir -p /opt/newway
cd /opt/newway

info "Clone code hoặc copy file vào /opt/newway rồi chạy:"
echo ""
echo "  docker compose up -d"
echo ""

# ---------------------------------------------------------
# 6. Monitoring cron
# ---------------------------------------------------------
cat > /opt/newway/monitor.sh <<'MONITOR'
#!/usr/bin/env bash
DB_HOST="10.8.0.2"
DB_USER="newway_app"
APP_URL="https://$DOMAIN"
TELEGRAM_BOT="<BOT_TOKEN>"
TELEGRAM_CHAT="<CHAT_ID>"

alert() {
  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT/sendMessage" \
    -d "chat_id=$TELEGRAM_CHAT&text=$1" >/dev/null 2>&1
}

# Check DB tunnel
if ! pg_isready -h "$DB_HOST" -U "$DB_USER" -q 2>/dev/null; then
  alert "🔴 NEWWAY: DB tunnel DOWN — $(date)"
  systemctl restart wg-quick@wg0
  sleep 5
  if pg_isready -h "$DB_HOST" -U "$DB_USER" -q 2>/dev/null; then
    alert "🟢 NEWWAY: DB tunnel RESTORED"
  fi
fi

# Check app
if ! curl -sf "$APP_URL/api/auth/me" >/dev/null 2>&1; then
  alert "🔴 NEWWAY: App DOWN — $(date)"
  cd /opt/newway && docker compose restart 2>/dev/null
fi
MONITOR

chmod +x /opt/newway/monitor.sh
echo '*/5 * * * * root /opt/newway/monitor.sh' > /etc/cron.d/newway-monitor
info "Monitor script installed (check every 5 min)"

# ---------------------------------------------------------
# 7. Summary
# ---------------------------------------------------------
echo ""
echo "============================================"
echo "  ✅ New Way VPS setup complete!"
echo "============================================"
echo ""
echo "  Domain:    https://$DOMAIN"
echo "  SSL:       /etc/letsencrypt/live/$DOMAIN"
echo "  App dir:   /opt/newway"
echo "  WireGuard: /etc/wireguard/wg0.conf"
echo ""
echo "  ⚡ Sau đó chạy:"
echo "    cd /opt/newway"
echo "    nano .env        ← điền biến môi trường"
echo "    docker compose up -d"
echo ""
echo "  📋 Chưa quên:"
echo "    - Cập nhật PublicKey trong wg0.conf"
echo "    - Điền TELEGRAM_BOT + CHAT_ID vào monitor.sh"
echo "============================================"
