# ☁️ HƯỚNG DẪN TỪNG BƯỚC — Setup VPS AZDIGI (103.221.223.230)

> Dành cho **người quản lý hệ thống / kỹ thuật**. Làm từ **Bước 1** đến hết, theo đúng thứ tự.
> **VPS này chạy TOÀN BỘ hệ thống: web + API + Redis + DATABASE.**
> Không còn database ở server công ty — xem mục *"Thay đổi kiến trúc"* bên dưới.

> 🕘 **Cập nhật 26/09/2026 (bản 3.0).** Bản 2.0 còn hướng dẫn dựng **WireGuard** để nối tới database
> đặt ở **server công ty**. Cách đó **không còn dùng nữa** — database nay là **container `postgres`
> chạy ngay trên VPS**. Toàn bộ phần WireGuard đã bị bỏ khỏi tài liệu này.
> Domain thật đang dùng: **`https://newwaytraco.com`** (bản cũ ghi `newway.congty.vn`).

---

## THAY ĐỔI KIẾN TRÚC (đọc trước khi làm)

| | Trước (bản 2.0) | **Hiện nay (bản 3.0)** |
|---|---|---|
| Database ở đâu | Server công ty (máy ảo VirtualBox), IP `10.8.0.2` | **Container `newway-postgres-1` trên VPS** |
| Kết nối DB | Qua tunnel **WireGuard** | Qua **mạng nội bộ Docker** (`postgres:5432`) |
| Tài khoản DB | `newway_app` | **`postgres`** |
| Số container | 3 (backend, frontend, redis) | **4** (backend, frontend, redis, **postgres**) |
| Domain | `newway.congty.vn` | **`newwaytraco.com`** |
| Backup | Trên server công ty, mã hoá GPG | **Trên VPS**: `/opt/backups/` (xem mục Backup) |

> ⚠️ Tài liệu `deploy/GUIDE-MEMBER-CONGTY.md` (dựng server công ty) **đã hết hiệu lực** — không làm theo nữa.

---

## TÓM TẮT

| Bước | Nội dung | Kiểm tra xong khi |
|---|---|---|
| 1 | Đổi mật khẩu root (bảo mật) | "password updated successfully" |
| 2 | Kiểm tra hệ điều hành | Ubuntu 22.04/24.04 |
| 3 | Cập nhật hệ thống | Không báo lỗi |
| 4 | Cài Git + Docker | `docker --version` chạy được |
| 5 | Clone code dự án | Có `be/`, `fe/`, `deploy/` |
| 6 | Điền `.env` | File đầy đủ thông tin |
| 7 | Cài Nginx + SSL + Firewall | `nginx -t` OK |
| 8 | Tạo `docker-compose.yml` (4 service) + chạy | 4 container "Up" |
| 9 | Trỏ DNS + kiểm thử | Vào được `https://newwaytraco.com` |
| 10 | Bật backup tự động | Cron chạy, có file `.dump` |
| 11 | Cấu hình Zalo Bot | Bot trả lời được tài xế |

---

## BƯỚC 1 — Đăng nhập lần đầu + ĐỔI MẬT KHẨU (LÀM NGAY)

> Mật khẩu đã hiển thị trong email + trong cuộc trò chuyện này → **phải đổi ngay** để tránh bị chiếm quyền.

**1.1. Mở SSH từ máy Windows của bạn:**
- Nhấn `Windows + R` → gõ `cmd` → Enter.
- Gõ lệnh:
  ```cmd
  ssh root@103.221.223.230
  ```
- Khi hỏi "Are you sure you want to continue connecting (yes/no)?" → gõ `yes` → Enter.
- Nhập mật khẩu (dán từ email) → Enter.
- Khi thấy `root@newwayaidept:~#` → ✅ đã vào VPS.

**1.2. Đổi mật khẩu root:**
```bash
passwd
```
- Nhập mật khẩu cũ → nhập **mật khẩu mới** (dài, phức tạp) 2 lần.
- **✅ Xong khi:** Báo `passwd: password updated successfully`.

> 🔒 Ghi mật khẩu mới ra giấy. KHÔNG đăng lên chat/email.

---

## BƯỚC 2 — Kiểm tra hệ điều hành

```bash
cat /etc/os-release
```
- Kỳ vọng: `Ubuntu 22.04` hoặc `24.04`.
- Nếu là bản khác (CentOS/Alma), báo lại — script cần điều chỉnh.

**✅ Xong khi:** Thấy `NAME="Ubuntu"`.

---

## BƯỚC 3 — Cập nhật hệ thống

```bash
apt update -y && apt upgrade -y
```
- Chờ vài phút. Nếu hỏi, bấm **Y** / Enter.
- **✅ Xong khi:** Trở về dấu `#` không lỗi.

---

## BƯỚC 4 — Cài Git + Docker

```bash
apt install -y git
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version
```
- **✅ Xong khi:** `docker --version` in ra số phiên bản (VD `Docker version 27.x`).

---

## BƯỚC 5 — Clone code dự án lên VPS

```bash
cd /opt
git clone https://github.com/nbvhung/NewWay.git newway
cd newway
git checkout main
```
> Nếu repo **private**, nhập username + Personal Access Token (không nhập mật khẩu GitHub thật) khi được hỏi.

**✅ Xong khi:** Trong `/opt/newway` có các thư mục `be/`, `fe/`, `deploy/`.

---

## BƯỚC 6 — Chuẩn bị biến môi trường

```bash
cp /opt/newway/deploy/.env.production /opt/newway/.env
nano /opt/newway/.env
```

Điền các giá trị (bấm `Ctrl+O`, Enter, `Ctrl+X` để lưu):

| Biến | Giá trị |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_HOST` | **`postgres`** ← tên service trong docker-compose, KHÔNG phải IP |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | **`postgres`** |
| `DATABASE_PASSWORD` | **giống `POSTGRES_PASSWORD` trong `docker-compose.yml`** |
| `DATABASE_NAME` | `newway` |
| `DB_SSL` | `false` (kết nối nội bộ docker, không cần SSL) |
| `REDIS_HOST` | `redis` |
| `REDIS_PORT` | `6379` |
| `JWT_ACCESS_SECRET` | Chạy: `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | Chạy lần nữa: `openssl rand -hex 64` |
| `CORS_ORIGIN` | **`https://newwaytraco.com`** |
| `DEFAULT_ADMIN_PASSWORD` | Tự đặt mật khẩu admin mạnh |
| `DEFAULT_SUPPER_PASSWORD` | Tự đặt mật khẩu supper_admin mạnh |
| `SEED_SHIPPING_LINES` | `false` |
| `ZALO_BOT_TOKEN` | Vào [bot.zaloplatforms.com](https://bot.zaloplatforms.com) → chọn bot → copy token |
| `ZALO_BOT_TOKEN_2` / `_3` | Token bot thứ 2/3 (nếu chia tải rate limit) |
| `ZALO_WEBHOOK_SECRET` | Chuỗi bí mật tự đặt (VD: `newway_zalo_2026_xyz`) |
| `ZALO_POLLING` | Xem ghi chú bên dưới |
| `ZALO_BUON_NGU_AUDIO_URL` | `https://newwaytraco.com/api/zalo/audio/buon-ngu-v2.aac` |
| `ZALO_WEBHOOK_URL` / `_2` / `_3` | URL webhook đăng ký với Zalo (khi dùng webhook) |
| `ZALO_OPS_FALLBACK_ZALO_ID` | Zalo ID nhận thông báo dự phòng (OPS) |
| `ZALO_ADMIN_NOTIFY_ZALO_ID` | Zalo ID admin nhận thông báo |
| `ZALO_ADMIN_NOTIFY_BOT_INDEX` | Bot nào gửi thông báo admin (`0`/`1`/`2`) |

> ⚠️ **Về `ZALO_POLLING`:** có 2 chế độ nhận tin.
> - `ZALO_POLLING=true` → backend **tự hỏi Zalo liên tục** (`getUpdates`), không cần webhook.
> - `ZALO_POLLING=false` → dùng **webhook** (Zalo chủ động gọi vào `https://newwaytraco.com/api/...`).
>
> **Trạng thái production hiện tại: `ZALO_POLLING=false` (đang dùng webhook) và bot đang chạy tốt**
> (`setWebhook` thành công cho các bot, log có sự kiện webhook thật).
> Nếu một ngày webhook không tới nữa (Zalo hay lỗi `webhook.err.proxy`), đổi sang `true` rồi
> `docker compose up -d --build backend` là chạy lại được — **không cần sửa gì khác**.

---

## BƯỚC 7 — Cài Nginx + SSL + Firewall

```bash
apt install -y nginx certbot python3-certbot-nginx ufw
```

Firewall — chỉ mở web + SSH (**KHÔNG mở 5432** — database chỉ nằm trong mạng docker nội bộ):
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable
```

SSL (cần domain đã trỏ về IP VPS):
```bash
certbot --nginx -d newwaytraco.com -d www.newwaytraco.com --non-interactive --agree-tos -m admin@newwaytraco.com
```
> Chứng chỉ Let's Encrypt **tự động gia hạn** qua `certbot.timer`. Kiểm tra: `systemctl list-timers | grep certbot`.

Cấu hình Nginx — dùng file `deploy/nginx.conf`, sửa domain cho đúng:
```bash
cp /opt/newway/deploy/nginx.conf /etc/nginx/sites-available/newway
nano /etc/nginx/sites-available/newway   # sửa domain trong 2 dòng ssl_certificate
ln -s /etc/nginx/sites-available/newway /etc/nginx/sites-enabled/newway
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```
- **✅ Xong khi:** `nginx -t` báo `test is successful`.

---

## BƯỚC 8 — Tạo docker-compose.yml và chạy ứng dụng

```bash
cd /opt/newway
cat > docker-compose.yml <<'EOF'
version: "3.9"
services:
  backend:
    build: ./be
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:4000:4000"
    depends_on:
      - redis
      - postgres
    networks: [newway]

  frontend:
    build: ./fe
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - BACKEND_URL=http://backend:4000
      - NEXT_PUBLIC_API_URL=https://newwaytraco.com/api
    ports:
      - "127.0.0.1:3000:3000"
    depends_on: [backend]
    networks: [newway]

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    restart: unless-stopped
    networks: [newway]

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: newway
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: <MAT_KHAU_DB_MANH>   # PHẢI giống DATABASE_PASSWORD trong .env
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [newway]

volumes:
  pgdata:

networks:
  newway:
    driver: bridge
EOF
docker compose up -d --build
```

- **✅ Xong khi:** `docker compose ps` hiện **4 container "Up"**:
  `newway-backend-1`, `newway-frontend-1`, `newway-postgres-1`, `newway-redis-1`.

> ⚠️ **`POSTGRES_PASSWORD` phải khớp `DATABASE_PASSWORD` trong `.env`.** Lệch nhau → backend không
> kết nối được DB → web báo "Lỗi server nội bộ".
>
> ⚠️ **Không bao giờ chạy `docker compose down -v`** — cờ `-v` sẽ **xoá volume `pgdata` = mất sạch database**.
>
> ⚠️ Không thêm `ports: - "5432:5432"` cho postgres — database **không được lộ ra internet**.

---

## BƯỚC 9 — Trỏ DNS + kiểm thử

1. Vào nhà đăng ký domain → thêm **A record**: `@` và `www` → `103.221.223.230`.
2. Chờ 5–30 phút → mở `https://newwaytraco.com`:
   - Thấy **trang đăng nhập NEW WAY** → 🎉 web OK.
   - Mobile app: đổi `EXPO_PUBLIC_API_URL` thành `https://newwaytraco.com/api` → build lại APK.

**Kiểm tra từng thành phần:**
```bash
docker compose ps                      # 4 container Up
curl -I https://newwaytraco.com        # 200
curl -s https://newwaytraco.com/api/auth/me   # API phản hồi (401 nếu chưa đăng nhập = OK)
docker compose logs --tail=30 backend  # phải thấy "Nest application successfully started"
```

> ✅ **Kiểm tra nhanh database có dữ liệu không:**
> ```bash
> docker exec -i newway-postgres-1 psql -U postgres -d newway -c "SELECT count(*) FROM users;"
> ```

---

## BƯỚC 10 — Bật backup tự động

Backup là phần **quan trọng nhất** — vì database nằm cùng VPS với web, VPS hỏng là mất cả hai.

Tạo thư mục + script:
```bash
mkdir -p /opt/backups/incr
cat > /opt/backups/backup.sh <<'EOF'
#!/bin/bash
set -e
STAMP=$(date +%Y%m%d_%H%M%S)
docker exec newway-postgres-1 pg_dump -U postgres -d newway \
  --no-owner --no-privileges --format=custom > /opt/backups/newway_$STAMP.dump
find /opt/backups -name "newway_*.dump" -mtime +7 -delete      # giữ 7 ngày
echo "BACKUP_OK $STAMP" >> /opt/backups/backup.log
EOF

cat > /opt/backups/backup_30m.sh <<'EOF'
#!/bin/bash
set -u
STAMP=$(date +%Y%m%d_%H%M%S)
LOGF=/opt/backups/backup30m.log
INCDIR=/opt/backups/incr
SIGFILE=/opt/backups/.last_sig
mkdir -p "$INCDIR"
log() { echo "$(date '+%F %T') $1" >> "$LOGF"; }

# Chữ ký dữ liệu: chỉ backup khi có thay đổi
SIG=$(docker exec newway-postgres-1 psql -U postgres -d newway -tAc "
SELECT
  (SELECT count(*) FROM users) ||'|'||
  (SELECT count(*) FROM shipping_lines) ||'|'||
  (SELECT count(*) FROM routes) ||'|'||
  (SELECT count(*) FROM submissions) ||'|'||
  (SELECT coalesce(max(updated_at)::text,'null') FROM submissions) ||'|'||
  (SELECT coalesce(max(id),0) FROM edit_history) ||'|'||
  (SELECT coalesce(max(id),0) FROM container_imports) ||'|'||
  (SELECT coalesce(max(id),0) FROM zalo_messages);" 2>>"$LOGF")

if [ -z "$SIG" ]; then log "ERROR: cannot read DB signature"; exit 1; fi

LAST=""
[ -f "$SIGFILE" ] && LAST=$(cat "$SIGFILE")

BCK=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/api/zalo 2>/dev/null || echo 000)
FRT=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo 000)

if [ "$SIG" = "$LAST" ]; then log "NO_CHANGE backend=$BCK frontend=$FRT"; exit 0; fi

FILE="$INCDIR/newway_$STAMP.dump"
if docker exec newway-postgres-1 pg_dump -U postgres -d newway \
     --no-owner --no-privileges --format=custom > "$FILE" 2>>"$LOGF"; then
  echo "$SIG" > "$SIGFILE"
  log "BACKUP_OK $FILE size=$(du -h "$FILE" | cut -f1) backend=$BCK frontend=$FRT"
  ls -t "$INCDIR"/newway_*.dump 2>/dev/null | tail -n +97 | xargs -r rm -f   # giữ 96 file
else
  rm -f "$FILE"
  log "BACKUP_FAIL backend=$BCK frontend=$FRT"
fi
EOF

chmod +x /opt/backups/backup.sh /opt/backups/backup_30m.sh
```

Thêm vào crontab (`crontab -e`):
```cron
0 2 * * * /opt/backups/backup.sh >> /opt/backups/backup.log 2>&1
*/30 * * * * /opt/backups/backup_30m.sh >> /opt/backups/backup30m_cron.log 2>&1
```

**✅ Xong khi:** `ls -lh /opt/backups/incr/ | tail` thấy file `.dump` mới.

**Xem log backup:**
```bash
tail -20 /opt/backups/backup.log        # backup ngày
tail -20 /opt/backups/backup30m.log     # backup 30 phút (script tự ghi)
```

> 💡 Ngoài ra máy tính của quản lý còn **tự tải backup về** `D:\NWW\backups\` (giữ 60 ngày) —
> dùng script `backup_sync.py`. Đây là **lớp backup thứ 3**, phòng khi cả VPS bị mất.
>
> 📖 Quy trình khôi phục: xem `deploy/restore-guide.md`.

---

## BƯỚC 11 — Cấu hình Zalo Bot

**11.1. Verify bot đang chạy:**
```bash
bash /opt/newway/deploy/verify-zalo.sh newwaytraco.com
```
Kết quả kỳ vọng:
- `botConfigured: true` → `ZALO_BOT_TOKEN` đã load

**11.2. Xem log bot:**
```bash
docker logs --tail=50 newway-backend-1 2>&1 | grep -iE "zalo|webhook|polling"
```
- Nếu dùng webhook (`ZALO_POLLING=false`): phải thấy `setWebhook` thành công.
- Nếu dùng polling (`ZALO_POLLING=true`): phải thấy `Đã giành leadership, bắt đầu long-polling`.

**11.3. Test cuối:**
- Tài xế mở Zalo → nhắn tin vào bot
- Gửi SĐT đã đăng ký → bot phản hồi liên kết
- Gửi 7 số cuối container → bot ghi nhận
- Gửi "buồn" hoặc "ngủ" → bot gửi file nhạc ~2 phút
- Web admin → tab **Lịch sử chat** → thấy cuộc hội thoại ✅

**✅ Xong khi:** Bot phản hồi được tin nhắn từ tài xế.

---

## VẬN HÀNH

### Deploy code mới (QUAN TRỌNG — có bước migration)

> ⚠️ Production **KHÔNG có migration runner tự động** (`synchronize` chỉ bật ở môi trường dev).
> Nếu bản code mới có thay đổi cấu trúc database, phải **chạy file `.sql` bằng tay TRƯỚC khi build lại**.

**Quy trình đầy đủ:**

```bash
cd /opt/newway

# 1. Kéo code mới
git pull

# 2. Xem có file migration mới không
git log --name-only --oneline -1 | grep '\.sql$'

# 3. Nếu có → chạy TỪNG file, theo đúng thứ tự (thay tên file cho đúng)
docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 \
  < deploy/migrate-add-xxx.sql

# 4. Build lại + khởi động
docker compose up -d --build

# 5. Kiểm tra
docker compose ps
docker compose logs --tail=30 backend
```

### Deploy nhanh (khuyến nghị) — `deploy/deploy.sh`

Script tự động kéo GitHub + **chỉ build service đã đổi** và cảnh báo migration mới:

```bash
cd /opt/newway
bash deploy/deploy.sh
```

- Chỉ đổi `fe/` → chỉ build frontend; chỉ đổi `be/` → chỉ build backend (nhanh ~một nửa so với build cả 2).
- Chỉ đổi tài liệu / `.sql` (không đụng `be/` `fe/`) → **không build lại** (vài giây).
- Có file `deploy/migrate-*.sql` mới → script in sẵn lệnh chạy tay; chạy các lệnh đó **trước** rồi chạy lại script.
- Muốn build lại ép buộc: `docker compose up -d --build backend` (hoặc `frontend`).

**Ví dụ thực tế (deploy 26/09/2026)** — phải chạy 3 file SQL trước khi build:
```bash
docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < deploy/migrate-add-finance-vehicle-ben.sql
docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < deploy/migrate-add-container-audit-log.sql
docker exec -i newway-postgres-1 psql -U postgres -d newway -v ON_ERROR_STOP=1 < be/scripts/fix-orphan-container-claims.sql
docker compose up -d --build
```

> 💡 Các file `.sql` trong `deploy/` được viết theo kiểu **idempotent** (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
> → chạy lại nhiều lần cũng an toàn, không làm hỏng dữ liệu.

> ⚠️ **Đừng tin phần chú thích đầu các file `.sql`.** Nhiều file ghi `psql -U newway_app` — **sai**,
> trên VPS chỉ có role **`postgres`**.

### Xem log lỗi
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### Vào database bằng tay (chỉ để tra cứu)
```bash
docker exec -it newway-postgres-1 psql -U postgres -d newway
```
```sql
\dt                          -- danh sách bảng
SELECT count(*) FROM users;
\q                           -- thoát
```

### Kiểm tra dung lượng
```bash
df -h                              # ổ đĩa VPS
du -sh /opt/backups                # dung lượng backup
docker system df                   # dung lượng docker
```

### Nâng cấp gói VPS
Panel AZDIGI → chọn VPS → **Upgrade** → chọn gói lớn hơn → vài phút xong, dữ liệu giữ nguyên.

> ⚠️ **Không tạo VPS mới rồi xoá VPS cũ** — VPS mới không có dữ liệu, sẽ mất sạch.

---

## CHECKLIST BẢO MẬT

- [ ] Đổi mật khẩu root (Bước 1) ✅
- [ ] Firewall chỉ mở 80/443/22 — **không mở 5432**
- [ ] JWT secrets ngẫu nhiên (`openssl rand -hex 64`)
- [ ] Mật khẩu admin/supper mạnh
- [ ] `POSTGRES_PASSWORD` mạnh, **khớp** `DATABASE_PASSWORD`
- [ ] Database **không** expose internet (chỉ trong mạng docker `newway`)
- [ ] Backup cron đang chạy + đã thử khôi phục 1 lần
- [ ] Certbot timer đang bật (SSL tự gia hạn)
- [ ] Nhớ ngày hết hạn **domain** `newwaytraco.com` — gia hạn trước 2 tuần

---

*Phiên bản: 3.0 — VPS AZDIGI 103.221.223.230 · domain `newwaytraco.com` (26/09/2026)*
*(Bản 2.0 — 08/2026 — đã lỗi thời: còn hướng dẫn WireGuard + database ở server công ty.)*
