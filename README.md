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
│   │   └── submissions/          # Submissions CRUD + Export
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
