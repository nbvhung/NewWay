# AGENTS.md — Hệ thống Xác nhận Sản lượng Xe New Way

Hướng dẫn này dành cho AI Agent (Claude Code) khi làm việc với codebase.
Đọc kỹ trước khi thực hiện bất kỳ thay đổi nào.

## Project Overview

Hệ thống nhập liệu sản lượng container/xe cho công ty logistics **New Way**.
Cho phép lái xe nhập số liệu hàng ngày (hàng 20/40, vỏ 20/40, vệ sinh lại, TIP…),
người tổng hợp xem lọc xuất Excel, admin quản lý user và danh mục.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS (Express) + TypeORM |
| Frontend Web | Next.js 16 (App Router) + Tailwind CSS |
| Mobile App | React Native (Expo) + Expo Router |
| Database | PostgreSQL (local) |
| Cache | Redis (local) — token blacklist, rate limit |
| Auth | JWT access_token (15ph) + refresh_token (7 ngày) |
| | Web: httpOnly cookies |
| | Mobile: Bearer token (expo-secure-store) |
| HTTP Client | Axios (cả web và mobile — pattern thống nhất) |
| Password | bcryptjs (salt rounds = 10) |
| Export | ExcelJS |
| Runtime | Node.js 20+ |

## Architecture

```
D:\WebLab\NewWay\
├── be/         # NestJS backend (port 4000)
├── fe/         # Next.js frontend (port 3000)
├── app/        # React Native (Expo) mobile app
├── deploy/     # Production deployment scripts & docs
├── AGENTS.md
└── README.md
```

### Production architecture

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
    └── WireGuard tunnel ─── Server công ty (PostgreSQL, không expose internet)
```

## Backend Module Map

| Module | Controller Route Prefix | Guards |
|---|---|---|
| `auth/` | `/api/auth` | Public (login, refresh), JWT (logout, me) |
| `users/` | `/api/admin/users` | JWT + Roles('tonghop','admin','supper_admin') |
| `shipping-lines/` | `/api/shipping-lines` (user), `/api/admin/shipping-lines` (admin) | JWT / JWT+Roles |
| `routes/` | `/api/admin/routes` | JWT + Roles('ops','hr','admin','supper_admin') |
| `submissions/` | `/api/submissions` (user), `/api/admin/submissions` (admin) | JWT / JWT+Roles |
| `container-import/` | `/api/admin/container-import` | JWT + Roles('admin','supper_admin') |
| `zalo-bot/` | `/api/zalo/webhook` | Public (verify `X-Bot-Api-Secret-Token`) |

## Database Schema

### `users`

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| username | VARCHAR(100) | UNIQUE, NOT NULL |
| passwordHash | VARCHAR(255) | NOT NULL |
| fullName | VARCHAR(255) | NOT NULL |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'laixe' |
| zaloId | VARCHAR(100) | NULLABLE (liên kết Zalo Bot) |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

Role enum: `laixe` | `tonghop` | `hr` | `admin` | `supper_admin`

### `container_imports`

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| containerCode | VARCHAR(20) | NOT NULL, INDEX `idx_container_imports_code` |
| type | VARCHAR(20) | NOT NULL (H20/H40/V20/V40/V20FR/V40FR/VSL/TIP) |
| shippingLineId | INTEGER | FK → shipping_lines.id (plan) |
| importedById | INTEGER | FK → users.id (người import) |
| submissionId | INTEGER | FK → submissions.id, NULLABLE (đã ghi nhận chưa) |
| bundleId | VARCHAR(50) | NULLABLE, INDEX `idx_container_imports_bundle` (bundle_id, shipping_line_id) |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### `shipping_lines`

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| name | VARCHAR(255) | UNIQUE, NOT NULL |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### `routes`

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| shippingLineId | INTEGER | FK → shipping_lines.id, ON DELETE CASCADE |
| name | VARCHAR(255) | NOT NULL |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

UNIQUE(shippingLineId, name)

### `submissions`

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| userId | INTEGER | FK → users.id, NOT NULL |
| shippingLine | VARCHAR(255) | NOT NULL |
| route | VARCHAR(255) | DEFAULT '' |
| driverName | VARCHAR(255) | NOT NULL |
| hang20 | VARCHAR(50) | DEFAULT '' |
| hang40 | VARCHAR(50) | DEFAULT '' |
| vo20 | VARCHAR(50) | DEFAULT '' |
| vo40 | VARCHAR(50) | DEFAULT '' |
| vo20fr | VARCHAR(50) | DEFAULT '' |
| vo40fr | VARCHAR(50) | DEFAULT '' |
| veSinhLai | VARCHAR(255) | DEFAULT '' |
| tip | VARCHAR(255) | DEFAULT '' |
| editCount | INTEGER | DEFAULT 0 |
| lastEditedAt | TIMESTAMP | NULLABLE |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updatedAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### `edit_history`

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| submissionId | INTEGER | FK → submissions.id, NOT NULL |
| editedById | INTEGER | FK → users.id, NOT NULL |
| editedByName | VARCHAR(255) | NOT NULL |
| changes | TEXT | NOT NULL (JSON string) |
| editedAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

## Business Rules

### Roles & Permissions

| Role | Permissions |
|---|---|
| `laixe` | Tạo submission, xem/sửa submission của mình, xem danh sách shipping lines + routes |
| `tonghop` | Xem tất cả submissions (có filter), export Excel (không có cột Lương) |
| `hr` | Như tonghop + quản lý routes (CRUD), export Excel có cột Lương, xem users (chỉ laixe/tonghop/hr), tạo/sửa/xoá laixe |
| `admin` | Như tonghop + CRUD user (trừ supper_admin), CRUD shipping-lines & routes, export Excel có cột Lương |
| `supper_admin` | Toàn quyền (bao gồm CRUD admin & supper_admin), export Excel có cột Lương |

### Auth Flow

1. **Login**: `POST /api/auth/login` → validate username + password (bcrypt.compare)
2. **Issue**: access_token (JWT, sub = userId, 15 phút) + refresh_token (JWT, sub = userId, 7 ngày)
3. **Store**: refresh_token hash trong Redis, key = `refresh_token:{userId}`
4. **Cookies**: Set-Cookie với httpOnly, Secure, SameSite=Lax
   - `access_token`: Path=/, Max-Age=900
   - `refresh_token`: Path=/, Max-Age=604800
5. **Mobile Login**: `POST /api/auth/mobile-login` → giống login nhưng trả `{ accessToken, refreshToken, user }` trong JSON body (cho mobile app)
6. **Mobile Refresh**: `POST /api/auth/mobile-refresh` → body `{ refreshToken }` → verify → rotation → trả JSON token
7. **Refresh**: `POST /api/auth/refresh` → verify refresh_token → check Redis whitelist → rotation (clear old, issue new pair) → set cookies
8. **Logout**: `POST /api/auth/logout` → blacklist access_token (Redis, TTL = thời gian còn lại) → remove refresh_token khỏi Redis → clear cookies
9. **Auth Guard**: JwtAuthGuard đọc access_token từ cookie `access_token` (hoặc Authorization header fallback)

### Submission Validation

- `shippingLine` bắt buộc (không được rỗng)
- `driverName` tự động lấy từ `fullName` của user (readonly trên form)
- Các trường số liệu mặc định `''` nếu không nhập, không ép kiểu số
- Mỗi lần sửa: `editCount + 1`, ghi `edit_history` với `changes` = JSON diff
- Chỉ user sở hữu hoặc admin/tonghop mới được sửa submission
- Khi sửa, so sánh từng field, chỉ ghi nhận field thực sự thay đổi (so sánh string)

### Edit History

- `changes` lưu dạng JSON object: `{ fieldName: { old: "value", new: "value" } }`
- Field labels hiển thị (dùng khi parse changes):
  - shippingLine → "Kế hoạch", route → "Tuyến đường"
  - hang20 → "Hàng 20", hang40 → "Hàng 40"
  - vo20 → "Vỏ 20", vo40 → "Vỏ 40"
  - vo20fr → "Vỏ 20FR", vo40fr → "Vỏ 40FR"
  - veSinhLai → "Vệ sinh lại", tip → "TIP"
- Hiển thị trên modal sửa dạng: `"Kế hoạch": "cũ" → "mới"`

### Zalo Bot

- **Webhook**: `POST /api/zalo/webhook` — verify header `X-Bot-Api-Secret-Token` (timing-safe compare, khớp `ZALO_WEBHOOK_SECRET`). Event types xử lý: `message.text.received`, `message.voice.received`.
- **Gửi tin**: `POST https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/sendMessage` body `{ chat_id, text }`.
- **Voice**: webhook chỉ gửi `voice_url` → backend tải file (Authorization Bearer, fallback `access_token` query) → STT (OpenAI Whisper qua `OPENAI_API_KEY`, bắt buộc key) → lọc số.
- **Session**: Redis key `zalo_session:{zaloUserId}`, TTL 3600. Lưu `userId`, `planId`, `planName`, `pendingCandidates`, `pendingDigits`, `pendingPlanOptions`.
- **Lệnh bot**: `/help`, `/link <username> <password>` (liên kết qua bcrypt.compare + set `users.zalo_id`), `/doi-plan`, `/logout` (xóa session + set `users.zalo_id` = null). **Không có lệnh `/xong`** — ghi nhận real-time từng container.
- **Hội thoại**: liên kết → chọn kế hoạch (match tên, hỗ trợ chọn số khi trùng) → gửi 7 số cuối / đọc số → tìm `RIGHT(container_code, 7)` trong plan:
  - 0 kết quả → "không nằm trong kế hoạch"
  - 1 kết quả → upsert submission + `claim` (set `container_imports.submission_id`)
  - >1 kết quả → liệt kê 1️⃣/2️⃣, tài xế nhắn số thứ tự hoặc mã đầy đủ
- **Upsert submission**: tìm `submissions` theo `userId + shippingLineId`. Chưa có → tạo mới với field loại = `1`. Có → cộng `+1`, `editCount + 1`, `lastEditedAt`, ghi `edit_history` (`editedById` = lái xe, `editedByName` = fullName).
- **Map loại → field**: H20→`hang20`, H40→`hang40`, V20→`vo20`, V40→`vo40`, V20FR→`vo20fr`, V40FR→`vo40fr`, VSL→`veSinhLai`, TIP→`tip`.
- **Chặn ghi**: kế hoạch `completed` chặn import file lẫn ghi nhận qua bot; container đã có `submissionId` → báo "đã ghi nhận trước đó".
- **Text parser** (`zalo-bot/text-parser.ts`): đọc số Việt (không/một/hai...chín), số nguyên theo cấp (nghìn/triệu), bỏ từ nhiễu (ờ, à, ơ...), trích chuỗi 7 số.
- **Liên kết Zalo**: cả `/link` trên bot VÀ admin nhập `zalo_id` trong tab Users (CreateUserDto/UpdateUserDto có `zaloId` optional).

### Excel Export

- Endpoint: `GET /api/admin/export` (có filter params)
- 2 sheets (cộng thêm theo role):
  1. **"Sản lượng xe New Way"** — dữ liệu submissions với các cột: STT, Tài khoản, Lái xe NW, Kế hoạch, Tuyến đường, Hàng 20, Hàng 40, Vỏ 20, Vỏ 40, Vỏ 20FR, Vỏ 40FR, Vệ sinh lại, TIP, Số lần sửa, Lần sửa cuối, Ngày tạo
  2. **"Lịch sử chỉnh sửa"** — các cột: STT, ID bản ghi, Người sửa, Nội dung thay đổi, Thời gian sửa
  3. **"Container - Người chạy"** (chỉ role `ops`, filter `done=true` + `shippingLineId`) — ghi lại từng container đã import trong kế hoạch: STT, Số container, Loại, Kế hoạch, Người chạy (tài xế ghi nhận qua bot/submission, rỗng nếu chưa ghi nhận), Thời gian ghi nhận (submission.lastEditedAt/updatedAt). Nguồn: `container_imports` join `submissions`/`users` qua `submission_id`.
- Header fill: màu `#1E3A5F`, chữ trắng, border `#CCCCCC`
- Định dạng ngày: locale `vi-VN`
- File name: `SanLuongXeNewWay_YYYY-MM-DD.xlsx`

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Đăng nhập, set httpOnly cookies |
| POST | `/api/auth/mobile-login` | Public | Đăng nhập, trả JSON token (mobile) |
| POST | `/api/auth/mobile-refresh` | Public | Refresh token, body `{ refreshToken }` (mobile) |
| POST | `/api/auth/refresh` | Public (cookie) | Refresh token rotation |
| POST | `/api/auth/logout` | JWT | Logout, blacklist token, clear cookies |
| GET | `/api/auth/me` | JWT | Thông tin user hiện tại |

### User (lái xe)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/shipping-lines` | JWT | Danh sách hãng tàu kèm tuyến đường |
| POST | `/api/submissions` | JWT | Tạo bản ghi mới |
| GET | `/api/submissions/my` | JWT | Bản ghi của tôi (kèm history) |
| PUT | `/api/submissions/:id` | JWT | Sửa bản ghi của mình |

### Admin (tonghop+)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/admin/users` | tonghop+ | Danh sách users |
| POST | `/api/admin/users` | tonghop+ | Tạo user mới |
| PUT | `/api/admin/users/:id` | tonghop+ | Cập nhật user |
| DELETE | `/api/admin/users/:id` | tonghop+ | Xóa user |
| GET | `/api/admin/shipping-lines` | tonghop+ | Danh sách hãng tàu |
| POST | `/api/admin/shipping-lines` | tonghop+ | Tạo hãng tàu mới |
| DELETE | `/api/admin/shipping-lines/:id` | tonghop+ | Xóa hãng tàu |
| GET | `/api/admin/routes` | hr+ | Danh sách tuyến đường |
| POST | `/api/admin/routes` | hr+ | Tạo tuyến đường |
| PUT | `/api/admin/routes/:id` | hr+ | Cập nhật tuyến đường |
| DELETE | `/api/admin/routes/:id` | hr+ | Xóa tuyến đường |
| GET | `/api/admin/submissions` | tonghop+ | Tất cả submissions (filter) |
| PUT | `/api/admin/submissions/:id` | tonghop+ | Sửa bất kỳ submission |
| DELETE | `/api/admin/submissions/:id` | tonghop+ | Xóa submission |
| GET | `/api/admin/export` | tonghop+ | Export Excel (cột Lương chỉ hiển thị với hr/admin/supper_admin) |
| POST | `/api/admin/container-import` | admin+ | Import container từ file (multipart `file` + `planId`) |
| GET | `/api/admin/container-import` | admin+ | Danh sách container đã import (`?planId=`) |
| DELETE | `/api/admin/container-import/plan/:planId` | admin+ | Xóa toàn bộ container của kế hoạch |
| DELETE | `/api/admin/container-import/:id` | admin+ | Xóa một container |

### Zalo Bot

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/zalo/webhook` | Public (verify `X-Bot-Api-Secret-Token`) | Nhận event từ Zalo Bot |
| GET | `/api/zalo` | Public | Health check bot (configured/STT) |

## Frontend Pages

| Route | Page | Roles |
|---|---|---|
| `/login` | LoginForm (username + password) | Public |
| `/dashboard/form` | EntryForm | laixe+ |
| `/dashboard/my-data` | MyDataTable + EditModal | laixe+ |
| `/dashboard/admin` | AdminDashboard (4 tabs) | tonghop+ |

## Code Conventions

### Naming

- **Files**: kebab-case (`auth.service.ts`, `shipping-lines.controller.ts`)
- **Entities**: PascalCase, singular (`User`, `ShippingLine`, `EditHistory`)
- **DTOs**: PascalCase + suffix (`CreateUserDto`, `UpdateSubmissionDto`)
- **Interfaces**: PascalCase + `Interface` suffix
- **Decorators**: PascalCase (`@CurrentUser()`, `@Roles('admin')`)

### Structure per module

```
module-name/
├── module-name.module.ts
├── module-name.controller.ts
├── module-name.service.ts
├── dto/
│   ├── create-xxx.dto.ts
│   └── update-xxx.dto.ts
└── (interfaces/ nếu cần)
```

### TypeORM

- Entities use `@Entity('table_name')` với snake_case table name
- Columns dùng `@Column({ name: 'snake_case' })` mapping
- Relations: `@ManyToOne(() => User)`, `@JoinColumn({ name: 'user_id' })`
- Timestamps: `@CreateDateColumn()`, `@UpdateDateColumn()`

### Validation

- DTOs dùng `class-validator` decorators
- Global `ValidationPipe` với `{ whitelist: true, forbidNonWhitelisted: true }`
- Custom error message bằng tiếng Việt

### Response Format

- List: `{ data: [...] }`
- Single: `{ data: { ... } }`
- Delete/Message: `{ message: "..." }`
- Error: NestJS default `{ statusCode, message, error }`

## Common Commands

```bash
# Backend
cd be && npm run start:dev        # NestJS watch mode (port 4000)

# Frontend
cd fe && npm run dev              # Next.js dev (port 3000)

# Mobile
cd app && npx expo start          # Expo dev (quét QR bằng Expo Go)

# Database
# TypeORM sync: entities sync tự động (synchronize: true trong dev)
# Migration: npx typeorm migration:create -n MigrationName
```

## Environment Variables

### Backend (`be/.env`)

```env
PORT=4000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=newway
DB_SSL=false                       # Bật SSL cho PostgreSQL production
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=<random-64-characters>
JWT_REFRESH_SECRET=<random-64-characters>
CORS_ORIGIN=http://localhost:3000  # Frontend URL (cho CORS)
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_SUPPER_PASSWORD=supper123
SEED_SHIPPING_LINES=true

# Zalo Bot
ZALO_BOT_TOKEN=<bot token từ bot.zaloplatforms.com>
ZALO_WEBHOOK_SECRET=<chuỗi bí mật tự đặt, dùng verify webhook>
# STT giọng nói → chữ (OpenAI Whisper), điền key sau khi thanh toán xong
# OPENAI_API_KEY=sk-...
```

### Frontend (`fe/.env.local`)

```env
BACKEND_URL=http://localhost:4000
```

### Mobile (`app/.env`)

```env
EXPO_PUBLIC_API_URL=http://192.168.1.x:4000/api  # IP máy local, mobile cùng WiFi
```

## Notes for AI

1. **Không thay đổi business rules** (roles, permissions, edit history logic) mà không hỏi user
2. **Luôn giữ httpOnly cookies** cho token web — không chuyển sang localStorage
3. **Validation tiếng Việt** — error message trả về bằng tiếng Việt
4. **Excel export format** giữ nguyên font, màu, border như đã định nghĩa
5. **Edit history tracking** — bắt buộc mỗi lần sửa phải ghi history với JSON diff
6. **Responsive** — giao diện phải hoạt động tốt trên mobile (lái xe dùng điện thoại)
7. **Proxy rewrite** — Next.js rewrite proxy `/api/*` → backend, đảm bảo cookie same-origin (fix Safari/iOS)
8. **Security** — Helmet, rate limiting (100/min), CORS exact match, `synchronize: false` ở production (tự động theo `NODE_ENV`)
9. **DB isolation** — PostgreSQL chạy trên server công ty, kết nối qua WireGuard tunnel, không expose internet
10. **Deployment** — xem `deploy/` cho Docker + setup script 1 lệnh
11. **Axios pattern** — cả web (`fe`) và mobile (`app`) dùng axios với cùng pattern: mỗi module API là 1 object export các hàm gọi instance axios. Web dùng cookie auth, mobile dùng Bearer token.
12. **Mobile auth** — mobile app không dùng httpOnly cookies. Dùng `POST /api/auth/mobile-login` nhận token JSON, lưu expo-secure-store, gửi Bearer token qua interceptor.
13. **Zalo Bot** — không thêm lệnh `/xong`; ghi nhận real-time. Kế hoạch `completed` chặn import + ghi. Container trùng 7 số cuối → luôn cho chọn 1/2, không ghi nhận mặc định. STT phải qua bước lọc số (text-parser) vì voice-to-text hay sai/nhiễu.
14. **Container import** — file định dạng `mã[TAB]loại` (xlsx hoặc txt), loại map qua `normalizeType`, chỉ admin/supper_admin.
15. **Bó container** — file xlsx có thể nhóm nhiều container thành "Bó" bằng ô merge ở **cột C** (giá trị `Bó`, ví dụ merge `C5:C8`). Khi import, container trong vùng merge cùng cột C sẽ được gán chung `bundle_id` (`Bó 1`, `Bó 2`, ...). Lái xe đọc **1 mã bất kỳ** trong bó → bot ghi nhận **cả bó** cho lái xe đó: cộng số lượng = số container trong bó vào field loại (VD bó 4 V20FR → `vo20fr` +4), claim toàn bộ container trong bó về 1 submission. Bó đã có container được ghi (submissionId) → báo "đã được ghi nhận trước đó" (giống cơ chế trùng lặp). Không có trường hợp bó hỗn hợp nhiều loại.
