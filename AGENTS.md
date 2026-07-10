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
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Database | PostgreSQL (local) |
| Cache | Redis (local) — token blacklist, rate limit |
| Auth | JWT access_token (15ph) + refresh_token (7 ngày) — httpOnly cookies |
| Password | bcryptjs (salt rounds = 10) |
| Export | ExcelJS |
| Runtime | Node.js 20+ |

## Architecture

```
D:\WebLab\NewWay\
├── be/       # NestJS backend (port 4000)
├── fe/       # Next.js frontend (port 3000)
├── AGENTS.md
└── README.md
```

## Backend Module Map

| Module | Controller Route Prefix | Guards |
|---|---|---|
| `auth/` | `/api/auth` | Public (login, refresh), JWT (logout, me) |
| `users/` | `/api/admin/users` | JWT + Roles('tonghop','admin','supper_admin') |
| `shipping-lines/` | `/api/shipping-lines` (user), `/api/admin/shipping-lines` (admin) | JWT / JWT+Roles |
| `routes/` | `/api/admin/routes` | JWT + Roles('tonghop','admin','supper_admin') |
| `submissions/` | `/api/submissions` (user), `/api/admin/submissions` (admin) | JWT / JWT+Roles |

## Database Schema

### `users`

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| username | VARCHAR(100) | UNIQUE, NOT NULL |
| passwordHash | VARCHAR(255) | NOT NULL |
| fullName | VARCHAR(255) | NOT NULL |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'laixe' |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

Role enum: `laixe` | `tonghop` | `admin` | `supper_admin`

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
| `tonghop` | Xem tất cả submissions (có filter), export Excel |
| `admin` | Như tonghop + CRUD user (trừ supper_admin), CRUD shipping-lines & routes |
| `supper_admin` | Toàn quyền (bao gồm CRUD admin & supper_admin) |

### Auth Flow

1. **Login**: `POST /api/auth/login` → validate username + password (bcrypt.compare)
2. **Issue**: access_token (JWT, sub = userId, 15 phút) + refresh_token (JWT, sub = userId, 7 ngày)
3. **Store**: refresh_token hash trong Redis, key = `refresh_token:{userId}`
4. **Cookies**: Set-Cookie với httpOnly, Secure, SameSite=Strict
   - `access_token`: Path=/api, Max-Age=900
   - `refresh_token`: Path=/api/auth/refresh, Max-Age=604800
5. **Refresh**: `POST /api/auth/refresh` → verify refresh_token → check Redis whitelist → rotation (clear old, issue new pair) → set cookies
6. **Logout**: `POST /api/auth/logout` → blacklist access_token (Redis, TTL = thời gian còn lại) → remove refresh_token khỏi Redis → clear cookies
7. **Auth Guard**: JwtAuthGuard đọc access_token từ cookie `access_token` (hoặc Authorization header fallback)

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

### Excel Export

- Endpoint: `GET /api/admin/export` (có filter params)
- 2 sheets:
  1. **"Sản lượng xe New Way"** — dữ liệu submissions với các cột: STT, Tài khoản, Lái xe NW, Kế hoạch, Tuyến đường, Hàng 20, Hàng 40, Vỏ 20, Vỏ 40, Vỏ 20FR, Vỏ 40FR, Vệ sinh lại, TIP, Số lần sửa, Lần sửa cuối, Ngày tạo
  2. **"Lịch sử chỉnh sửa"** — các cột: STT, ID bản ghi, Người sửa, Nội dung thay đổi, Thời gian sửa
- Header fill: màu `#1E3A5F`, chữ trắng, border `#CCCCCC`
- Định dạng ngày: locale `vi-VN`
- File name: `SanLuongXeNewWay_YYYY-MM-DD.xlsx`

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Đăng nhập, set httpOnly cookies |
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
| GET | `/api/admin/routes` | tonghop+ | Danh sách tuyến đường |
| POST | `/api/admin/routes` | tonghop+ | Tạo tuyến đường |
| DELETE | `/api/admin/routes/:id` | tonghop+ | Xóa tuyến đường |
| GET | `/api/admin/submissions` | tonghop+ | Tất cả submissions (filter) |
| PUT | `/api/admin/submissions/:id` | tonghop+ | Sửa bất kỳ submission |
| DELETE | `/api/admin/submissions/:id` | tonghop+ | Xóa submission |
| GET | `/api/admin/export` | tonghop+ | Export Excel |

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
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=<random-64-characters>
JWT_REFRESH_SECRET=<random-64-characters>
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_SUPPER_PASSWORD=supper123
SEED_SHIPPING_LINES=true
```

### Frontend (`fe/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Notes for AI

1. **Không thay đổi business rules** (roles, permissions, edit history logic) mà không hỏi user
2. **Luôn giữ httpOnly cookies** cho token — không chuyển sang localStorage
3. **Validation tiếng Việt** — error message trả về bằng tiếng Việt
4. **Excel export format** giữ nguyên font, màu, border như đã định nghĩa
5. **Edit history tracking** — bắt buộc mỗi lần sửa phải ghi history với JSON diff
6. **Responsive** — giao diện phải hoạt động tốt trên mobile (lái xe dùng điện thoại)
