#!/usr/bin/env bash
set -euo pipefail

# =============================================================
# setup-db.sh — 1-command setup for company DB server
# Chạy với quyền root trên máy chủ của khách hàng
# =============================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[ "$EUID" -eq 0 ] || err "Phải chạy với quyền root (sudo su)"

# ---------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------
apt update -y
apt install -y postgresql postgresql-contrib wireguard ufw curl gpg

# ---------------------------------------------------------
# 2. Firewall — chỉ mở 51820 (WireGuard)
# ---------------------------------------------------------
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 51820/udp
ufw --force enable
info "Firewall configured — only port 51820 open"

# ---------------------------------------------------------
# 3. PostgreSQL setup
# ---------------------------------------------------------
DB_PASS="$(openssl rand -base64 48 | tr -d /=+ | head -c 64)"

# Chỉ listen localhost
sed -i "s/^listen_addresses = .*/listen_addresses = 'localhost'/" /etc/postgresql/*/main/postgresql.conf

# Bật SSL
sed -i "s/^ssl = .*/ssl = on/" /etc/postgresql/*/main/postgresql.conf
sed -i "s/^ssl_cert_file = .*/ssl_cert_file = '\/etc\/ssl\/certs\/ssl-cert-snakeoil.pem'/" /etc/postgresql/*/main/postgresql.conf 2>/dev/null || true
sed -i "s/^ssl_key_file = .*/ssl_key_file = '\/etc\/ssl\/private\/ssl-cert-snakeoil.key'/" /etc/postgresql/*/main/postgresql.conf 2>/dev/null || true

systemctl restart postgresql

# Tạo database + user
su - postgres -c "psql -c \"CREATE DATABASE newway;\"" 2>/dev/null || info "Database 'newway' already exists"
su - postgres -c "psql -c \"CREATE USER newway_app WITH PASSWORD '$DB_PASS';\"" 2>/dev/null || info "User 'newway_app' already exists"
su - postgres -c "psql -c \"GRANT CONNECT ON DATABASE newway TO newway_app;\"" 2>/dev/null
su - postgres -c "psql -d newway -c \"GRANT USAGE ON SCHEMA public TO newway_app;\"" 2>/dev/null
su - postgres -c "psql -d newway -c \"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO newway_app;\"" 2>/dev/null

# User riêng cho migration
MIGRATE_PASS="$(openssl rand -base64 48 | tr -d /=+ | head -c 64)"
su - postgres -c "psql -c \"CREATE USER newway_migrate WITH PASSWORD '$MIGRATE_PASS';\"" 2>/dev/null || info "User 'newway_migrate' already exists"
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE newway TO newway_migrate;\"" 2>/dev/null

info "Database & users created"
echo "  App user:     newway_app / $DB_PASS"
echo "  Migrate user: newway_migrate / $MIGRATE_PASS"

# ---------------------------------------------------------
# 4. WireGuard SERVER — DB server đứng làm peer
# ---------------------------------------------------------
WG_DIR="/etc/wireguard"
SERVER_PRIV="$(wg genkey)"
SERVER_PUB="$(echo "$SERVER_PRIV" | wg pubkey)"

cat > "$WG_DIR/wg0.conf" <<WGEOF
[Interface]
Address = 10.8.0.2/24
PrivateKey = $SERVER_PRIV
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT

[Peer]
PublicKey = <CLIENT_PUB_KEY>   # ← TODO: thay bằng public key từ VPS
AllowedIPs = 10.8.0.1/32
WGEOF

chmod 600 "$WG_DIR/wg0.conf"
systemctl enable --now wg-quick@wg0 2>/dev/null || true
info "WireGuard server created at $WG_DIR/wg0.conf"
echo ""
echo -e "${YELLOW}⚠ Gửi public key này cho VPS:${NC}"
echo "$SERVER_PUB"

# ---------------------------------------------------------
# 5. Backup script (mã hoá GPG)
# ---------------------------------------------------------
GPG_PASS="$(openssl rand -base64 24)"

mkdir -p /backups
cat > /usr/local/bin/backup-newway.sh <<BACKUP
#!/usr/bin/env bash
set -euo pipefail
TIMESTAMP=\$(date +%Y%m%d_%H%M)
BACKUP_DIR="/backups"
DB_NAME="newway"
GPG_PASS="$GPG_PASS"

# Dump + mã hoá
pg_dump -U newway_app "\$DB_NAME" | gzip | \
  gpg --symmetric --cipher-algo AES256 --batch --passphrase "\$GPG_PASS" \
  -o "\$BACKUP_DIR/newway_\$TIMESTAMP.sql.gz.gpg"

# Xoá backup cũ hơn 30 ngày
find "\$BACKUP_DIR" -name "newway_*.sql.gz.gpg" -mtime +30 -delete

echo "Backup complete: newway_\$TIMESTAMP.sql.gz.gpg"
BACKUP

chmod +x /usr/local/bin/backup-newway.sh
echo "0 2 * * * root /usr/local/bin/backup-newway.sh" > /etc/cron.d/newway-backup

info "Backup script installed — chạy hàng ngày lúc 2:00 sáng"
echo "  GPG passphrase: $GPG_PASS  (lưu lại, cần để restore)"
echo "  Backup dir:     /backups"

# ---------------------------------------------------------
# 6. Summary
# ---------------------------------------------------------
echo ""
echo "============================================"
echo "  ✅ DB Server setup complete!"
echo "============================================"
echo ""
echo "  PostgreSQL:   localhost:5432"
echo "  App user:     newway_app"
echo "  App pass:     $DB_PASS"
echo "  Migrate user: newway_migrate"
echo "  Migrate pass: $MIGRATE_PASS"
echo "  Backups:      /backups/ (daily, encrypted)"
echo "  WireGuard:    /etc/wireguard/wg0.conf"
echo ""
echo "  📋 Bước tiếp theo:"
echo "  1. Gửi PUBLIC KEY này cho người cài VPS:"
echo "     $SERVER_PUB"
echo "  2. Nhận PUBLIC KEY từ VPS và cập nhật vào wg0.conf"
echo "  3. Restart WireGuard: systemctl restart wg-quick@wg0"
echo "  4. Kiểm tra: ping 10.8.0.1"
echo ""
echo "  ⚠ LƯU Ý QUAN TRỌNG — lưu lại các mật khẩu trên!"
echo "============================================"
