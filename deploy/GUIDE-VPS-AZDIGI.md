# ☁️ HƯỚNG DẪN TỪNG BƯỚC — Setup VPS AZDIGI (103.221.223.230)

> Dành cho **người quản lý hệ thống**. Làm từ **Bước 1** đến hết, theo đúng thứ tự.
> VPS này chạy toàn bộ ứng dụng (web + API + Redis). Database nằm ở server công ty.

---

## TÓM TẮT

| Bước | Nội dung | Kiểm tra xong khi |
|---|---|---|
| 1 | Đổi mật khẩu root (bảo mật) | "password updated successfully" |
| 2 | Kiểm tra hệ điều hành | Ubuntu 22.04/24.04 |
| 3 | Cập nhật hệ thống | Không báo lỗi |
| 4 | Cài Git + Docker | `docker --version` chạy được |
| 5 | Chạy script setup VPS | "VPS setup complete!" |
| 6 | Trao đổi key WireGuard | `ping 10.8.0.2` OK |
| 7 | Điền `.env` | File đầy đủ thông tin |
| 8 | Copy code + deploy | Ứng dụng chạy |
| 9 | Trỏ domain + kiểm thử | Vào được web |

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
- Nếu là bản khác (CentOS/Alma), báo tôi — script cần điều chỉnh.

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

## BƯỚC 6 — Cài WireGuard client

```bash
apt install -y wireguard
```

Tạo key riêng cho VPS (ghi lại `CLIENT_PUB`):
```bash
cd /etc/wireguard
umask 077
wg genkey | tee wg0.key | wg pubkey > wg0.pub
cat wg0.pub
```
- **CLIENT_PUB** (dạng `abc123...`) → **gửi cho member ở công ty.**

Tạo file cấu hình:
```bash
nano /etc/wireguard/wg0.conf
```
Dán nội dung (thay `<SERVER_PUB>` bằng public key member gửi lại):
```ini
[Interface]
Address = 10.8.0.1/24
PrivateKey = <dán-nội-dung-file-wg0.key>
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT

[Peer]
PublicKey = <SERVER_PUB>            # từ member công ty
Endpoint = <IP-server-cong-ty>:51820
AllowedIPs = 10.8.0.2/32
PersistentKeepalive = 25
```
Lưu: `Ctrl+O` → Enter → `Ctrl+X`.

Khởi động + tự chạy khi boot:
```bash
systemctl enable --now wg-quick@wg0
```

**✅ Xong khi:** `systemctl status wg-quick@wg0` hiện "active". Và khi cả 2 bên xong key: `ping 10.8.0.2` có phản hồi.

---

## BƯỚC 7 — Chuẩn bị biến môi trường

```bash
cd /opt/newway/deploy
cp .env.production /opt/newway/.env
nano /opt/newway/.env
```
Điền các giá trị (bấm `Ctrl+O`, Enter, `Ctrl+X` để lưu):

| Biến | Lấy từ |
|---|---|
| `DATABASE_PASSWORD` | Member công ty gọi điện báo (`newway_app` pass) |
| `JWT_ACCESS_SECRET` | Chạy: `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | Chạy lần nữa: `openssl rand -hex 64` |
| `CORS_ORIGIN` | `https://<domain>` |
| `NEXT_PUBLIC_API_URL` | `https://<domain>/api` |
| `DEFAULT_ADMIN_PASSWORD` | Tự đặt mật khẩu admin mạnh |
| `DEFAULT_SUPPER_PASSWORD` | Tự đặt mật khẩu supper_admin mạnh |
| `ZALO_BOT_TOKEN` | Vào [bot.zaloplatforms.com](https://bot.zaloplatforms.com) → chọn bot → copy token |
| `ZALO_WEBHOOK_SECRET` | Chuỗi bí mật tự đặt (VD: `newway_zalo_2026_xyz`) |

> ⚠️ Cần **tên miền** cho các dòng `https://<domain>`. Nếu chưa có domain, chặn lại báo tôi — không thể chạy HTTPS nếu thiếu domain.

---

## BƯỚC 8 — Cài Nginx + SSL + Firewall

```bash
apt install -y nginx certbot python3-certbot-nginx ufw
```

Firewall — chỉ mở web + SSH:
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable
```

SSL (cần domain đã trỏ về IP VPS):
```bash
certbot --nginx -d <domain> -d www.<domain> --non-interactive --agree-tos -m admin@<domain>
```

Cấu hình Nginx — dùng file `deploy/nginx.conf`, sửa `<domain>` cho đúng, đặt vào:
```bash
cp /opt/newway/deploy/nginx.conf /etc/nginx/sites-available/newway
nano /etc/nginx/sites-available/newway   # sửa <domain> trong 2 dòng ssl_certificate
ln -s /etc/nginx/sites-available/newway /etc/nginx/sites-enabled/newway
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```
- **✅ Xong khi:** `nginx -t` báo `test is successful`.

---

## BƯỚC 9 — Build và chạy ứng dụng

```bash
cd /opt/newway
cat > docker-compose.yml <<'EOF'
version: "3.9"
services:
  backend:
    build: ./be
    restart: unless-stopped
    env_file: .env
    networks: [newway]
  frontend:
    build: ./fe
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - BACKEND_URL=http://backend:4000
      - NEXT_PUBLIC_API_URL=https://<domain>/api
    depends_on: [backend]
    networks: [newway]
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    restart: unless-stopped
    networks: [newway]
networks:
  newway:
    driver: bridge
EOF
docker compose up -d --build
```
> Thay `<domain>` trong `NEXT_PUBLIC_API_URL`.

- **✅ Xong khi:** `docker compose ps` hiện 3 container "Up".

---

## BƯỚC 10 — Trỏ DNS + kiểm thử

1. Vào nhà đăng ký domain → thêm **A record**: `@` và `www` → `103.221.223.230`.
2. Chờ 5–30 phút → mở `https://<domain>`:
   - Thấy **trang đăng nhập** → 🎉 web OK.
   - Mobile app: đổi `EXPO_PUBLIC_API_URL` thành `https://<domain>/api` → build lại.

**Kiểm tra từng thành phần:**
```bash
docker compose ps                     # 3 container Up
systemctl status wg-quick@wg0         # tunnel active
ping 10.8.0.2                          # vào được DB
curl https://<domain>/api/auth/me     # API phản hồi
```

---

## BƯỚC 11 — Cấu hình Zalo Bot Webhook

> Thực hiện **sau khi Bước 9 và 10 xong** (web đã chạy với domain HTTPS).

**11.1. Verify bot đang chạy:**
```bash
bash /opt/newway/deploy/verify-zalo.sh <domain>
# VD: bash /opt/newway/deploy/verify-zalo.sh newway.congty.vn
```
Kết quả kỳ vọng:
- `botConfigured: true` → ZALO_BOT_TOKEN đã load
- Webhook GET trả `{"status":"ok"}`

**11.2. Đăng ký webhook trên Zalo Platform:**
1. Vào **[bot.zaloplatforms.com](https://bot.zaloplatforms.com)** → chọn Bot
2. Vào **Cài đặt → Webhook**
3. Điền:
   - **Webhook URL**: `https://<domain>/api/zalo/webhook`
   - **Secret Token**: giá trị `ZALO_WEBHOOK_SECRET` trong `.env`
4. Bấm **Verify/Lưu** → Zalo sẽ gọi `GET /api/zalo/webhook` → trả `{"status":"ok"}` → ✅ xác minh thành công

**11.3. Test cuối:**
- Tài xế mở Zalo → nhắn tin vào bot
- Gửi SĐT đã đăng ký → bot phản hồi liên kết
- Gửi 7 số cuối container → bot ghi nhận
- Web admin → tab **Lịch sử chat** → thấy cuộc hội thoại ✅

**✅ Xong khi:** Bot phản hồi được tin nhắn từ tài xế.

---

## VẬN HÀNH

### Deploy code mới
```bash
cd /opt/newway && git pull && docker compose up -d --build
```

### Xem log lỗi
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Nâng cấp gói VPS
Panel AZDIGI → chọn VPS → **Upgrade** → chọn gói lớn hơn → vài phút xong, dữ liệu giữ nguyên.

---

## CHECKLIST BẢO MẬT

- [ ] Đổi mật khẩu root (Bước 1) ✅
- [ ] Firewall chỉ mở 80/443/22
- [ ] JWT secrets ngẫu nhiên
- [ ] Mật khẩu admin/supper mạnh
- [ ] Database không expose internet (chỉ qua WireGuard)

---

*Phiên bản: 2.0 — VPS AZDIGI 103.221.223.230 (08/2026)*
