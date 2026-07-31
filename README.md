# 🚛 Hệ thống Xác nhận Sản lượng Xe New Way

Hệ thống nhập liệu sản lượng container/xe cho công ty logistics **New Way**.
Cho phép lái xe nhập số liệu hàng ngày, người tổng hợp xem lọc xuất Excel,
admin quản lý user và danh mục.

## Công nghệ sử dụng

| Layer | Technology |
|---|---|
| **Backend** | NestJS (Express) + TypeORM |
| **Frontend Web** | Next.js 16 (App Router) + Tailwind CSS |
| **Mobile App** | React Native (Expo) + Expo Router |
| **Database** | PostgreSQL 15+ |
| **Cache** | Redis 7+ |
| **Auth** | JWT access_token + refresh_token (Web: httpOnly cookies / Mobile: Bearer token) |
| **HTTP Client** | Axios (thống nhất web & mobile) |
| **Password** | bcryptjs |
| **Export** | ExcelJS |
| **Zalo Bot** | Zalo Bot API (webhook) + OpenAI Whisper STT (voice-to-text) |

## Yêu cầu hệ thống (phát triển)

- Node.js 20+
- npm 9+
- PostgreSQL 15+
- Redis 7+
- Expo Go (trên điện thoại) — để test mobile app

## Cài đặt & Chạy (phát triển)

### 1. Clone & cài dependencies

```bash
# Backend
cd be
npm install

# Frontend
cd ../fe
npm install

# Mobile
cd ../app
npm install
```

### 2. Cấu hình môi trường

**Backend** — `be/.env` (xem `be/.env.example`):

```env
PORT=4000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=newway
DB_SSL=false
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=<random-64-chars>
JWT_REFRESH_SECRET=<random-64-chars>
CORS_ORIGIN=http://localhost:3000
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_SUPPER_PASSWORD=supper123

# Zalo Bot
ZALO_BOT_TOKEN=<bot token từ bot.zaloplatforms.com>
ZALO_WEBHOOK_SECRET=<chuỗi bí mật tự đặt 8-256 ký tự>
# STT giọng nói → chữ (OpenAI Whisper), điền key sau khi thanh toán xong
# OPENAI_API_KEY=sk-...
```

**Frontend** — `fe/.env.local`:

```env
BACKEND_URL=http://localhost:4000
```

**Mobile** — `app/.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.x:4000/api
```

### 3. Chạy dev

```bash
# Terminal 1: Backend (port 4000)
cd be && npm run start:dev

# Terminal 2: Frontend (port 3000)
cd fe && npm run dev

# Terminal 3: Mobile (quét QR bằng Expo Go)
cd app && npx expo start
```

### 4. Truy cập

- **Frontend Web**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **Mobile App**: Quét QR từ terminal Expo bằng Expo Go
- **Tài khoản mặc định**: `admin` / `admin123`

## Zalo Bot — nhập liệu qua Zalo

Lái xe báo số container bằng tin nhắn thoại hoặc text trên Zalo, bot tự tìm
container trong kế hoạch (admin đã import) và ghi nhận real-time vào phần mềm.

### Flow sử dụng

1. **Liên kết tài khoản**: tài xế gửi `/link <tên đăng nhập> <mật khẩu>` cho bot
   (hoặc admin nhập Zalo ID thủ công trong tab Users).
2. **Chọn kế hoạch**: gửi tên kế hoạch, vd `HUN TRÙNG / HUNTRUNG-DINHVU / 30-07-2026`.
3. **Báo container**: nhắn **7 số cuối mã container** (vd `6823203`) hoặc **đọc to** số đó.
   - Trùng 7 số cuối → bot liệt kê các lựa chọn (1️⃣/2️⃣), tài xế nhắn số thứ tự.
   - Container không nằm trong kế hoạch → bot báo "không nằm trong kế hoạch".
   - Kế hoạch đã hoàn thành → bot chặn ghi nhận.
4. **Ghi nhận real-time**: số liệu cập nhật ngay vào bản ghi (submission) trên `/my-data`
   và Excel, không cần lệnh `/xong`.

Lệnh hỗ trợ: `/help` (hướng dẫn), `/link <user> <pass>` (liên kết), `/doi-plan` (đổi kế hoạch).

### Import container từ file

Admin vào tab **Kế hoạch** → bấm nút 📥 cạnh kế hoạch → tải lên file `.xlsx`
hoặc `.txt`, mỗi dòng: `mã container [TAB] loại`.

```
BMOU6823203	H20
CKLU4114651	H40
CKLU5112463	V20
TGBU5113411	H20
```

Loại hợp lệ: `H20, H40, V20, V40, V20FR, V40FR, VSL, TIP`.
Container đã import hiển thị trong modal, admin có thể xóa từng cái hoặc xóa hết.
Kế hoạch `completed` sẽ chặn import và chặn ghi nhận qua bot.

### Cấu hình webhook

- Endpoint: `POST /api/zalo/webhook`
- Verify header: `X-Bot-Api-Secret-Token` (khớp `ZALO_WEBHOOK_SECRET`)
- Đăng ký webhook (cần URL public — vd dùng ngrok khi dev):

```bash
curl -X POST "https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<public-url>/api/zalo/webhook","secret_token":"<ZALO_WEBHOOK_SECRET>"}'
```

### Voice-to-text (STT)

- Webhook chỉ gửi `voice_url`, backend tải file rồi gọi STT.
- Dùng **OpenAI Whisper** (cần `OPENAI_API_KEY`). Chưa có key → bot báo nhắn text thay thế.
- Kết quả STT được lọc: đọc số Việt ("sáu tám hai ba..." → `6823203`),
  bỏ từ nhiễu ("ờ", "à", "ơ"...), hỗ trợ đọc số nguyên ("sáu triệu tám trăm...").

## Triển khai sản xuất (Production)

Xem thư mục `deploy/`:

| File | Mô tả |
|---|---|
| `setup-vps.sh` | Script 1 lệnh cài VPS (Docker, Nginx, SSL, monitoring) |
| `setup-db.sh` | Script 1 lệnh cài database server (PostgreSQL, WireGuard, backup) |
| `docker-compose.yml` | Docker compose cho VPS |
| `nginx.conf` | Reverse proxy + SSL |
| `.env.production` | Template biến môi trường production |
| `HANDBOOK.md` | Tài liệu bàn giao cho khách hàng (không IT) |
| `restore-guide.md` | Hướng dẫn khôi phục dữ liệu từ backup |

### Kiến trúc production

```
Internet (tài xế) ─── Mobile App (Expo APK)
    │
    ▼
VPS (Hetzner $6/th)
├── Nginx (80→443, SSL Let's Encrypt)
├── Frontend (Next.js, :3000)
├── Backend API (NestJS, :4000)  ← Mobile gọi thẳng API
└── Redis (:6379)
    │
    └── WireGuard tunnel ─── Server công ty
                                └── PostgreSQL (:5432, không expose internet)
```

### Bảo mật

- Database **cách ly hoàn toàn** khỏi internet — chỉ kết nối qua WireGuard
- User DB quyền tối thiểu (`newway_app`: SELECT/INSERT/UPDATE/DELETE)
- Password mã hoá bcrypt (salt rounds = 10)
- JWT 15 phút, refresh token rotation
- Rate limiting (100 requests/phút)
- Helmet (security headers: CSP, HSTS, X-Frame-Options...)
- CORS exact match (Set.has)
- Tự động tắt TypeORM synchronize khi `NODE_ENV=production`
- Backup database hàng ngày, mã hoá GPG

## Cấu trúc thư mục

```
D:\WebLab\NewWay\
├── be/                           # NestJS Backend
│   ├── src/
│   │   ├── main.ts               # Entry point
│   │   ├── app.module.ts         # Root module
│   │   ├── common/               # Guards, Decorators, Filters
│   │   ├── database/entities/    # TypeORM entities
│   │   ├── redis/                # Redis module & service
│   │   ├── auth/                 # Authentication module
│   │   ├── users/                # Users CRUD
│   │   ├── shipping-lines/       # Hãng tàu CRUD
│   │   ├── routes/               # Tuyến đường CRUD
│   │   ├── submissions/          # Submissions CRUD + Export
│   │   ├── container-import/     # Import container từ file (admin)
│   │   └── zalo-bot/             # Zalo Bot webhook, STT, hội thoại
│   ├── Dockerfile
│   └── .env
│
├── fe/                           # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/            # Trang đăng nhập
│   │   │   └── (dashboard)/      # Các trang đã xác thực
│   │   ├── components/           # UI components
│   │   ├── lib/                  # API client, utils
│   │   ├── hooks/                # React hooks
│   │   ├── providers/            # Auth provider
│   │   └── types/                # TypeScript types
│   ├── Dockerfile
│   └── .env.local
│
├── app/                          # React Native (Expo) Mobile App
│   ├── app/                      # Expo Router screens
│   ├── src/                      # API client, store, utils, types
│   ├── app.json
│   └── package.json
│
├── deploy/                       # Production deployment
│   ├── docker-compose.yml
│   ├── nginx.conf
│   ├── .env.production
│   ├── setup-vps.sh
│   ├── setup-db.sh
│   ├── HANDBOOK.md
│   └── restore-guide.md
│
├── AGENTS.md
└── README.md
```
