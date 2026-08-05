# ☁️ Hướng dẫn setup VPS AZDIGI — dành cho người quản lý hệ thống

> Tài liệu dành cho **người quản lý hệ thống** thao tác trên VPS AZDIGI.
> Member tại công ty sẽ làm phần server DB theo file `GUIDE-MEMBER-CONGTY.md`.

---

## 1. Nhiệm vụ của bạn

Setup VPS AZDIGI chạy **toàn bộ ứng dụng**:
- Nginx (cổng 80/443, SSL)
- Frontend Next.js (cổng 3000)
- Backend NestJS API (cổng 4000)
- Redis (mật mã refresh token, rate limit)
- WireGuard client (tunnel tới database server công ty)

Database **KHÔNG** nằm trên VPS — nó nằm ở server công ty.

## 2. Chuẩn bị

| Mục | Yêu cầu |
|---|---|
| VPS AZDIGI | Gói rẻ nhất (1–2GB RAM) là đủ, Ubuntu 22.04/24.04 |
| Tên miền | VD `newwaycongty.com` (chưa trỏ DNS gì, chỉ cần sở hữu) |
| Tool SSH | PuTTY (Windows) hoặc Terminal (Mac/Linux) |
| File deploy | Trong repo: `deploy/setup-vps.sh`, `deploy/docker-compose.yml`, `deploy/nginx.conf`, `deploy/.env.production` |

## 3. Bước 1 — Reinstall VPS với Ubuntu

1. Vào panel AZDIGI → chọn VPS → **Reinstall**.
2. Chọn **Ubuntu 22.04 LTS** (hoặc 24.04).
3. Xác nhận → chờ vài phút.
4. Ghi lại: **IP** (VD `1.2.3.4`) + **password root** AZDIGI gửi qua email.

## 4. Bước 2 — Đăng nhập SSH

```bash
ssh root@1.2.3.4
```
Windows dùng PuTTY: nhập IP → Open → login `root` + password.

## 5. Bước 3 — Chạy script setup VPS

Script cài: Docker, firewall (chỉ mở 80/443/51820), SSL Let's Encrypt, WireGuard client, monitor.

```bash
sudo su
cd ~
# copy file setup-vps.sh lên VPS (qua SCP/winSCP hoặc paste trực tiếp)
chmod +x setup-vps.sh
bash setup-vps.sh <domain-cua-ban.com>
```

Script chạy xong in ra **CLIENT_PUB** (public key WireGuard của VPS).

## 6. Bước 4 — Trao đổi public key với server công ty

1. **Gửi** `CLIENT_PUB` cho member ở công ty.
2. **Nhận** `SERVER_PUB` từ member → dán vào `/etc/wireguard/wg0.conf` của VPS:
   ```bash
   nano /etc/wireguard/wg0.conf
   # thay PublicKey = <SERVER_PUB_KEY> bằng SERVER_PUB nhận được
   systemctl restart wg-quick@wg0
   ```
3. Kiểm tra tunnel:
   ```bash
   ping 10.8.0.2
   ```

## 7. Bước 5 — Điền biến môi trường

```bash
cd /opt/newway
nano .env
```

Điền theo mẫu `deploy/.env.production`, trong đó:

| Biến | Lấy từ |
|---|---|
| `DATABASE_PASSWORD` | Password `newway_app` — member giao trực tiếp qua điện thoại |
| `DATABASE_HOST` | `10.8.0.2` (đã đúng) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -hex 64` (chạy 2 lần) |
| `CORS_ORIGIN` / `NEXT_PUBLIC_API_URL` | `https://domain-cua-ban.com` |
| `DEFAULT_ADMIN_PASSWORD` / `DEFAULT_SUPPER_PASSWORD` | Tự đặt mật khẩu admin mạnh |
| `OPENAI_API_KEY` | Bỏ trống nếu chưa dùng STT Zalo |

## 8. Bước 6 — Deploy ứng dụng

```bash
cd /opt/newway
# copy file: docker-compose.yml, nginx.conf (sửa <domain> trong nginx.conf)
docker compose up -d
docker compose logs -f   # theo dõi log, Ctrl+C để thoát
```

Nếu frontend/backend chưa có image, lệnh trên sẽ **build từ source** — cần có code trong `/opt/newway/fe` và `/opt/newway/be` (copy từ repo).

## 9. Bước 7 — Trỏ DNS

1. Vào nhà đăng ký tên miền → DNS Management.
2. Thêm 2 bản ghi **A**:
   - `@` → IP VPS (VD `1.2.3.4`)
   - `www` → IP VPS
3. Chờ 5–30 phút DNS lan tỏa.

> Nếu dùng domain mua từ AZDIGI: vào panel → Domain → chọn domain → thêm bản ghi DNS A.

## 10. Bước 8 — Kiểm thử

- [ ] Mở `https://domain-cua-ban.com` → thấy trang đăng nhập
- [ ] Đăng nhập bằng account admin → vào được dashboard
- [ ] Export thử 1 Excel
- [ ] Mobile app cấu hình `EXPO_PUBLIC_API_URL=https://domain-cua-ban.com/api` → build lại → test login
- [ ] SSH VPS chạy `ping 10.8.0.2` → OK (DB kết nối được)

## 11. Vận hành

### Nâng cấp VPS
Panel AZDIGI → chọn VPS → **Upgrade** → chọn gói to hơn → xác nhận. Vài phút xong, dữ liệu giữ nguyên.

### Monitor Telegram
Điền `TELEGRAM_BOT` + `TELEGRAM_CHAT` vào `/opt/newway/monitor.sh` → alert tự gửi khi app/tunnel xuống.

### Deploy code mới
```bash
cd /opt/newway
git pull            # hoặc copy code mới vào
docker compose up -d --build
```

### Kiểm tra log khi lỗi
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Restore database (khi server công ty hỏng)
Làm theo `deploy/restore-guide.md`, cần GPG passphrase (member giữ).

## 12. Checklist bảo mật

- [ ] Firewall chỉ mở 80/443/51820 (script đã làm)
- [ ] Đổi password root mặc định của AZDIGI
- [ ] JWT secrets ngẫu nhiên, không dùng lại giá trị mẫu
- [ ] Mật khẩu admin/supper mạnh, khác mật khẩu dev
- [ ] Database không expose internet (chỉ qua tunnel WireGuard)

---

*Phiên bản: 1.0 — dành cho người quản lý hệ thống*
