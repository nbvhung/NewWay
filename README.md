# 🚛 Hệ thống Xác nhận Sản lượng Xe New Way

Hệ thống nhập liệu sản lượng container/xe cho công ty logistics **New Way**.
Cho phép lái xe nhập số liệu hàng ngày, người tổng hợp xem lọc xuất Excel,
admin quản lý user và danh mục.

## Công nghệ sử dụng

| Layer | Technology |
|---|---|
| **Backend** | NestJS (Express) + TypeORM |
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS |
| **Database** | PostgreSQL 15+ |
| **Cache** | Redis 7+ |
| **Auth** | JWT access_token + refresh_token (httpOnly cookies) |
| **Auth Strategy** | Passport JWT |
| **Password** | bcryptjs |
| **Export** | ExcelJS |

## Yêu cầu hệ thống

- Node.js 20+
- npm 9+
- PostgreSQL 15+
- Redis 7+

## Cài đặt & Chạy

### 1. Clone & cài dependencies

```bash
# Backend
cd be
npm install

# Frontend
cd ../fe
npm install
```

### 2. Cấu hình môi trường

**Backend** — `be/.env`:

```env
PORT=4000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=newway
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=<64-ký-tự-ngẫu-nhiên>
JWT_REFRESH_SECRET=<64-ký-tự-ngẫu-nhiên>
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_SUPPER_PASSWORD=supper123
SEED_SHIPPING_LINES=true
```

**Frontend** — `fe/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 3. Tạo database

```sql
CREATE DATABASE newway;
```

### 4. Chạy dev

```bash
# Terminal 1: Backend (port 4000)
cd be && npm run start:dev

# Terminal 2: Frontend (port 3000)
cd fe && npm run dev
```

### 5. Truy cập

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **Tài khoản mặc định**: `admin` / `admin123`
- **Supper admin**: `supperadmin` / `supper123`

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
│   └── .env.local
│
├── AGENTS.md                     # Hướng dẫn AI
└── README.md
```

## Database Schema

### `users`

| Column | Type | Mô tả |
|---|---|---|
| id | SERIAL PK | ID |
| username | VARCHAR(100) UNIQUE | Tên đăng nhập |
| passwordHash | VARCHAR(255) | Mật khẩu (bcrypt hash) |
| fullName | VARCHAR(255) | Họ tên (dùng cho driverName) |
| role | VARCHAR(20) | `laixe`, `tonghop`, `admin`, `supper_admin` |
| createdAt | TIMESTAMP | Ngày tạo |

### `shipping_lines`

| Column | Type | Mô tả |
|---|---|---|
| id | SERIAL PK | ID |
| name | VARCHAR(255) UNIQUE | Tên hãng tàu (vd: COSCO, MAERSK) |
| createdAt | TIMESTAMP | Ngày tạo |

### `routes`

| Column | Type | Mô tả |
|---|---|---|
| id | SERIAL PK | ID |
| shippingLineId | INTEGER FK | Thuộc hãng tàu nào |
| name | VARCHAR(255) | Tên tuyến đường |
| createdAt | TIMESTAMP | Ngày tạo |

UNIQUE(shippingLineId, name)

### `submissions`

| Column | Type | Mô tả |
|---|---|---|
| id | SERIAL PK | ID |
| userId | INTEGER FK | Người nhập |
| shippingLine | VARCHAR(255) | Kế hoạch (hãng tàu) |
| route | VARCHAR(255) | Tuyến đường |
| driverName | VARCHAR(255) | Lái xe NW (tự động) |
| hang20 | VARCHAR(50) | Hàng 20 |
| hang40 | VARCHAR(50) | Hàng 40 |
| vo20 | VARCHAR(50) | Vỏ 20 |
| vo40 | VARCHAR(50) | Vỏ 40 |
| vo20fr | VARCHAR(50) | Vỏ 20FR |
| vo40fr | VARCHAR(50) | Vỏ 40FR |
| veSinhLai | VARCHAR(255) | Vệ sinh lại |
| tip | VARCHAR(255) | TIP |
| editCount | INTEGER | Số lần đã sửa |
| lastEditedAt | TIMESTAMP | Lần sửa cuối |
| createdAt | TIMESTAMP | Ngày tạo |
| updatedAt | TIMESTAMP | Ngày cập nhật |

### `edit_history`

| Column | Type | Mô tả |
|---|---|---|
| id | SERIAL PK | ID |
| submissionId | INTEGER FK | Bản ghi bị sửa |
| editedById | INTEGER FK | Người sửa |
| editedByName | VARCHAR(255) | Tên người sửa |
| changes | TEXT | JSON: `{ field: { old, new } }` |
| editedAt | TIMESTAMP | Thời gian sửa |

## API Documentation

### Auth

#### `POST /api/auth/login`

Đăng nhập. Set httpOnly cookies.

**Request:**
```json
{ "username": "admin", "password": "admin123" }
```

**Response (200):**
```json
{
  "user": { "id": 1, "username": "admin", "fullName": "Quản trị viên", "role": "admin" }
}
```

**Cookies set:**
- `access_token` (httpOnly, Path=/api, Max-Age=900)
- `refresh_token` (httpOnly, Path=/api/auth/refresh, Max-Age=604800)

#### `POST /api/auth/refresh`

Refresh token rotation. Cần refresh_token trong cookie.

**Response (200):**
```json
{
  "user": { "id": 1, "username": "admin", "fullName": "Quản trị viên", "role": "admin" }
}
```

#### `POST /api/auth/logout`

Đăng xuất. Cần JWT.

**Response (200):** `{ "message": "Đã đăng xuất" }`

#### `GET /api/auth/me`

Thông tin user hiện tại.

**Response (200):**
```json
{
  "user": { "id": 1, "username": "admin", "fullName": "Quản trị viên", "role": "admin" }
}
```

### User Endpoints

#### `GET /api/shipping-lines`

Danh sách hãng tàu kèm tuyến đường.

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "COSCO",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "routes": [{ "id": 1, "name": "TU1" }]
    }
  ]
}
```

#### `POST /api/submissions`

Tạo bản ghi mới.

**Request:**
```json
{
  "shippingLine": "COSCO",
  "route": "TU1",
  "hang20": "5",
  "hang40": "3",
  "vo20": "2",
  "vo40": "1",
  "vo20fr": "0",
  "vo40fr": "0",
  "veSinhLai": "",
  "tip": "TIP123"
}
```

**Response (201):**
```json
{ "data": { "id": 1, ... } }
```

#### `GET /api/submissions/my`

Bản ghi của tôi (kèm edit history).

**Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "shippingLine": "COSCO",
      "editCount": 1,
      "history": [
        {
          "id": 1,
          "editedByName": "Quản trị viên",
          "changes": "{\"hang20\":{\"old\":\"4\",\"new\":\"5\"}}",
          "editedAt": "..."
        }
      ]
    }
  ]
}
```

#### `PUT /api/submissions/:id`

Sửa bản ghi của mình.

**Request:**
```json
{
  "hang20": "10",
  "hang40": "5"
}
```

**Response (200):** Submission updated + history

### Admin Endpoints

#### `GET /api/admin/users`

Danh sách users (phân quyền theo role).

#### `POST /api/admin/users`

Tạo user mới.

**Request:**
```json
{
  "username": "driver01",
  "password": "123456",
  "fullName": "Nguyễn Văn A",
  "role": "laixe"
}
```

#### `PUT /api/admin/users/:id`

Cập nhật user.

**Request:**
```json
{
  "fullName": "Nguyễn Văn B",
  "role": "tonghop",
  "password": "newpass123"
}
```

#### `DELETE /api/admin/users/:id`

Xóa user. Không thể xóa chính mình.

#### `GET /api/admin/shipping-lines`

Danh sách hãng tàu (admin).

#### `POST /api/admin/shipping-lines`

Tạo hãng tàu mới.

**Request:**
```json
{
  "name": "NEW_SHIPPING_LINE",
  "routes": ["TU1", "TU2", "TU3"]
}
```

#### `DELETE /api/admin/shipping-lines/:id`

Xóa hãng tàu (kèm routes liên quan).

#### `GET /api/admin/routes`

Danh sách tuyến đường (kèm tên hãng tàu).

#### `POST /api/admin/routes`

Tạo tuyến đường mới.

**Request:** `{ "name": "TU10" }`

#### `DELETE /api/admin/routes/:id`

Xóa tuyến đường.

#### `GET /api/admin/submissions`

Tất cả submissions. Có filter:

| Param | Type | Mô tả |
|---|---|---|
| user_id | number | Lọc theo user |
| shippingLine | string | Lọc theo hãng tàu |
| from_date | string (YYYY-MM-DD) | Từ ngày |
| to_date | string (YYYY-MM-DD) | Đến ngày |

#### `PUT /api/admin/submissions/:id`

Sửa bất kỳ submission (ghi edit history).

#### `DELETE /api/admin/submissions/:id`

Xóa submission + edit history liên quan.

#### `GET /api/admin/export`

Export Excel. Cùng filter params như GET /api/admin/submissions.

## Hướng dẫn sử dụng

### Lái xe

1. Đăng nhập bằng tài khoản được cấp
2. Vào **Nhập liệu** → chọn Kế hoạch (hãng tàu) → nhập số liệu → Gửi
3. Vào **Dữ liệu của tôi** → xem lại bản ghi → Sửa nếu cần

### Người tổng hợp / Admin

1. Vào **Admin Dashboard**
2. Tab **Tất cả dữ liệu**: xem tất cả bản ghi, lọc theo user/thời gian, sửa/xóa
3. Tab **Quản lý tài khoản**: thêm/sửa/xóa user
4. Tab **Quản lý kế hoạch**: thêm/xóa hãng tàu + tuyến đường
5. Nút **Xuất Excel**: tải file sản lượng

## Biến môi trường

### Backend (`be/.env`)

| Biến | Mặc định | Mô tả |
|---|---|---|
| PORT | 4000 | Cổng backend |
| DATABASE_HOST | localhost | PostgreSQL host |
| DATABASE_PORT | 5432 | PostgreSQL port |
| DATABASE_USER | postgres | PostgreSQL user |
| DATABASE_PASSWORD | postgres | PostgreSQL password |
| DATABASE_NAME | newway | Database name |
| REDIS_HOST | localhost | Redis host |
| REDIS_PORT | 6379 | Redis port |
| JWT_ACCESS_SECRET | - | Secret cho access token (64 ký tự) |
| JWT_REFRESH_SECRET | - | Secret cho refresh token (64 ký tự) |
| DEFAULT_ADMIN_PASSWORD | admin123 | Tạo admin mặc định (DB trống) |
| DEFAULT_SUPPER_PASSWORD | supper123 | Tạo supper_admin mặc định |
| SEED_SHIPPING_LINES | true | Seed dữ liệu hãng tàu mẫu |

### Frontend (`fe/.env.local`)

| Biến | Mặc định | Mô tả |
|---|---|---|
| NEXT_PUBLIC_API_URL | http://localhost:4000/api | Backend API URL |

## License

Nội bộ — New Way Logistics
