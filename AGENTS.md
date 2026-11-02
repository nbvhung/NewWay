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
VPS AZDIGI (103.221.223.230) — https://newwaytraco.com
├── Nginx (80→443, SSL Let's Encrypt, tự gia hạn)
├── Frontend (Next.js, :3000)
├── Backend API (NestJS, :4000)  ← Mobile gọi thẳng API
├── Redis (:6379)
└── PostgreSQL 15 (:5432)  ← container newway-postgres-1, CHỈ trong mạng docker
```

> ⚠️ **Cập nhật 26/09/2026:** database nay nằm **trên VPS** (container `newway-postgres-1`),
> user `postgres`. **Không còn WireGuard**, không còn DB ở server công ty.
> Backup: 30 phút/lần (khi có thay đổi) vào `/opt/backups/incr/` + 02:00 hàng ngày vào
> `/opt/backups/`. Chi tiết: `deploy/HANDBOOK.md` mục 4–5, `deploy/GUIDE-VPS-AZDIGI.md`.
>
> ⚠️ **Production KHÔNG có migration runner** (`synchronize: !isProd`). Thay đổi schema phải chạy
> file `.sql` bằng tay trên VPS trước khi `docker compose up -d --build`.

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

### Owner-scoped data (giới hạn theo xe làm chủ)

Một tài khoản admin có thể được gán `users.visible_driver_ids` (mảng id lái xe) — nghĩa là
họ là **chủ xe** của các xe đó. Khi đó, họ **chỉ xem được dữ liệu liên quan tới xe của mình**:

- `resolveVisibleDriverIds(user)` trả về `null` (= xem tất cả) khi không có giới hạn, hoặc mảng id khi bị giới hạn.
- **Kế hoạch `all_drivers = true` (phân công cho tất cả) LUÔN hiện cho mọi admin**, vì nó bao
  gồm cả xe của họ — không phụ thuộc việc đã có sản lượng hay chưa.
- **Dashboard doanh thu** (`DashboardService.getOverview`): giữ kế hoạch `all_drivers` hoặc kế
  hoạch có `driver_ids` chứa xe họ; **số liệu** (container, doanh thu, khách hàng, biểu đồ ngày)
  chỉ tính phần của đúng xe họ. Container **chưa gán xe** (submission_id = NULL) KHÔNG được tính
  cho tài khoản bị giới hạn.
- **Khách hàng** (`CustomersService`): `findAll`, `getStats`, `getPlans`, `getAllCompletedPlans`
  trả về khách hàng có ≥1 kế hoạch `all_drivers` hoặc có xe của họ tham gia.
- Tài khoản KHÔNG bị giới hạn (admin thường / supper_admin / hr...) vẫn xem tất cả như trước.

### Tài chính (Finance) — quyền hạn & bảo mật

Bảng `finance_entries` (unique month+year+userId) lưu chi phí + vốn đầu tư theo tháng cho từng admin.

- **Chi phí** (`sua_chua`, `nhien_lieu`, `cp_khac`): xem/sửa cần **mật khẩu** `348`, kiểm tra ở backend
  qua header `x-cost-password` (hoặc query `pw`). Nếu không có mật khẩu, API trả về 0 cho các trường chi phí.
  Endpoint: `GET/PUT /api/admin/finance`, `GET /api/admin/finance/history`, `POST /api/admin/finance/verify-password`.
- **Lịch sử chỉnh sửa**: bảng `finance_audit_logs` ghi mỗi lần đổi chi phí **hoặc vốn đầu tư** (ai, khi nào, old→new).
  Xem qua `GET /api/admin/finance/history` (yêu cầu mật khẩu).
- **Vốn đầu tư** (`von_xe`, `von_mooc`, `von_khac`): `supper_admin` ghi không cần mật khẩu;
  `admin` ghi được **nếu đã nhập mật khẩu** `348` (giống chi phí). Kiểm tra ở `FinanceService.upsert`
  qua cờ `investUnlocked` do controller truyền xuống.
- **Ô lọc admin**: `GET /api/admin/finance/admins` (chỉ supper_admin) → cho phép supper_admin nhập/xem
  thay cho admin khác qua param `targetUserId`.
- `DashboardService.getOverview` vẫn đọc finance trực tiếp theo userId (không cần mật khẩu) cho phần tổng quan.

### Khoá nguồn vốn (Vốn đầu tư) — chỉ MR BACH / VHUN9 khoá–mở

Ở tab **Quản lý XE** (Chi tiết xe, cùng dòng tiêu đề **"💸 Chi phí & Vốn đầu tư"**) có nút
**🔒 Khoá nguồn vốn**. Khi bật, **không ai** (kể cả supper_admin)
được thêm/sửa/xoá các khoản **Vốn đầu tư** (`vonXe`, `vonMooc`, `vonKhac`) — ở cả tab Quản lý XE,
Chi tiết xe lẫn tab Tài chính. Chi phí (`suaChua/nhienLieu/cpKhac`) **không** bị ảnh hưởng.

- Trạng thái lưu ở Redis (`settings:capital_lock`), quản lý bởi `SettingsService.isCapitalLocked/setCapitalLocked`.
- **Chỉ 2 tài khoản** trong `be/src/common/security/capital-lock.ts`
  (`CAPITAL_LOCK_ALLOWED_USERNAMES = ['mrbach', 'bach', 'superadmin']`, không phân biệt hoa/thường)
  được khoá/mở. Trên production: MR BACH = username `MRBACH`, VHUN9 = `superadmin`.
- Xác thực bằng **chính mật khẩu đăng nhập** của người thao tác (`bcrypt.compare` với `users.password_hash`).
- Endpoint (cần `vehicle.view`): `GET /api/admin/vehicles/capital-lock` (trạng thái + `canLock`),
  `POST /api/admin/vehicles/capital-lock` body `{ locked, password }`.
- Chặn ghi ở `FinanceService.assertInvestUnlocked()` cho `addCostItem`, `addCostItemsBulk`,
  `updateCostItem`, `deleteCostItem` (nhóm vốn) và `upsert` (khi `touchesInvestment`).
- FE: nút + popup nhập mật khẩu ở `VehiclesTab`; `FinanceTab` ẩn nút thêm/sửa nhóm vốn khi khoá.
- Test: `be/src/finance/finance-capital-lock.spec.ts` (10 ca).

### Xoá dữ liệu = BẮT BUỘC nhập mật khẩu `348` (chống xoá nhầm)

**Mọi** request `DELETE` của API đều phải kèm mật khẩu thao tác, gửi qua header
`x-cost-password` (hoặc query `?pw=`). Không có mật khẩu → `403 ForbiddenException`.

- Nguồn duy nhất của mật khẩu: `be/src/common/security/action-password.ts` (`ACTION_PASSWORD`).
  Đổi mật khẩu chỉ sửa 1 chỗ này (`FinanceService` cũng dùng lại hằng số đó).
- Guard: `be/src/common/guards/delete-password.guard.ts`, đăng ký **toàn cục** bằng `APP_GUARD`
  trong `AppModule` → tự động áp cho endpoint xoá thêm sau này, không thể quên.
  Chỉ chặn method `DELETE`; GET/POST/PUT/PATCH đi thẳng.
- **Không miễn trừ ai** — kể cả `supper_admin`. Mục đích là tránh xoá nhầm, không phải phân quyền.
- Guard toàn cục chạy **trước** `JwtAuthGuard` (controller-level), nên DELETE thiếu mật khẩu trả 403
  kể cả khi chưa đăng nhập (không lộ dữ liệu, chấp nhận được).
- Test: `be/src/common/guards/delete-password.guard.spec.ts` (12 case, gồm cả test khẳng định guard
  vẫn được đăng ký trong `AppModule`).
- **FE web** (`fe/src/lib/delete-guard.tsx`): `confirmDelete({ message, action })` → mở popup
  `<DeleteGuardHost />` (gắn 1 lần ở `fe/src/app/(dashboard)/admin/layout.tsx`) hỏi mật khẩu, tự gắn
  header qua `setActionPassword` trong `axios-instance.ts` rồi xoá ngay sau khi xong (không nhớ mật
  khẩu cho cả phiên). Trả về kết quả action, hoặc `undefined` nếu huỷ/lỗi → luôn có
  `if (res === undefined) return;`.
- **App mobile** (`app/src/components/DeleteGuard.tsx`): cùng API `confirmDelete` (trả `true/false`),
  host gắn ở `app/app/_layout.tsx`, header gắn trong `app/src/api/axios-instance.ts`.
- Luồng "Xoá tất cả dữ liệu nhập liệu" trước đây gate bằng mật khẩu `091281` kiểm tra ở FE/app
  (không có backend kiểm tra) — **đã bỏ**, dùng chung popup `348` và được backend kiểm tra thật.

### Tách bên New Way A / New Way B + gắn chi phí vào xe

Mỗi bên có **sổ chi phí riêng**; xe quyết định khoản chi thuộc bên nào.

- `users.ben` (`'A' | 'B' | NULL`) = bên của **tài khoản chủ vốn**. Xe thừa hưởng bên từ
  chủ vốn sở hữu nó qua `users.visible_driver_ids`; xe không thuộc chủ vốn nào → mặc định `'A'`.
  Hiện tại: `user 6 (Mr Bach) = A`, `user 30 (NwB/Boss) = B` (sở hữu xe `15H 10090` / lái xe `Dũng`).
- `finance_cost_items.vehicle_user_id` = xe mà khoản chi thuộc về (id lái xe đại diện xe).
  `NULL` = chi phí chung, không gắn xe.
- **Chọn nhiều xe cho 1 khoản chi** → mỗi xe 1 dòng, mỗi dòng 1 số tiền riêng
  (`POST /api/admin/finance/cost-items/bulk`, body `{ category, itemDate, name, note, vehicles:[{vehicleUserId, amount}] }`).
- **Tách biệt hoàn toàn**: `GET /api/admin/finance/vehicles` chỉ trả xe **thuộc bên đang xem**, và
  `addCostItemsBulk` ném `BadRequestException` nếu chọn xe của bên khác → không nhập xe bên B vào sổ bên A.
- Chỉ `supper_admin` xem/nhập được cả 2 bên (qua `targetUserId`); admin và tài khoản chủ vốn chỉ thấy bên mình.
- `GET /api/admin/finance` trả thêm `ben`, `benLabel` ("Bên A"), `ownerName` để FE hiện nhãn bên.
- Migration: `deploy/migrate-add-finance-vehicle-ben.sql` (idempotent, chạy tay trên VPS).

### Lịch sử bổ nhiệm lái xe theo NGÀY HIỆU LỰC (xe chịu lương cứng theo THÁNG)

Bảng `driver_vehicle_assignments` ghi mỗi lần lái xe nhận/ rời xe, để **lương cứng + các khoản cố
định bám đúng XE CỦA TỪNG THÁNG** (không phải xe hiện tại). Nhờ vậy đổi xe giữa tháng không kéo
lương tháng cũ sang xe mới.

- Cột: `driver_id`, `vehicle_id` (NULL = kết thúc bổ nhiệm), `effective_date` (ngày hiệu lực),
  `salary_from` (ngày 1 của tháng bắt đầu tính lương), `note`, `created_by_user_id`, `applied_at`.
  UNIQUE `(driver_id, effective_date)` — nhiều lần đổi trong 1 tháng vẫn giữ lịch sử.
- Quy tắc `salary_from`: hiệu lực **ngày 1 → đúng tháng đó**; hiệu lực **giữa tháng → tháng sau**
  (`salaryFromForEffectiveDate` trong `be/src/assignments/assignments.service.ts`).
- Xe chịu lương của tháng = bản ghi có `salary_from` **lớn nhất nhưng ≤ ngày đầu tháng**
  (`AssignmentsService.getMonthVehicleInfo`). Không có bản ghi ≤ tháng đó → fallback
  `users.home_vehicle_id` như cũ.
- Áp dụng ở: dashboard (chi phí cố định theo xe/tháng) `assignmentsService` trong
  `DashboardService.getOverview`; bảng lương `SalaryService.getRecords`; export lương tháng
  `SubmissionsService.exportSalaryMonthExcel`; chi tiết xe (`GET /api/admin/vehicles/:id` trả
  `assignments` = lịch sử bổ nhiệm kèm `endDate`/`pending`/`current`).
- `users.home_vehicle_id` vẫn là xe **hiện tại** (xe đang lái). Đặt lịch **tương lai** được: bản ghi
  có `applied_at = NULL`, timer 5 phút (`syncDueAssignments`) + lúc khởi động sẽ tự áp khi tới ngày.
- Khi đổi xe, các submission chưa có `actual_vehicle_id` được chốt về **xe cũ** trước khi đổi —
  doanh thu lịch sử không nhảy sang xe mới.
- FE: modal **👥 Phân công lái xe** (`VehiclesTab`) có ô **Ngày hiệu lực**; chi tiết xe hiện khối
  **Lịch sử bổ nhiệm lái xe** (from → to, nhãn "Lương cứng từ T?/YYYY", "Chờ hiệu lực"/"Đang lái").
- Ghi lịch sử tự động khi: phân công ở tab Xe (`PUT /api/admin/vehicles/:id/drivers` có
  `effectiveDate`), tạo/sửa user có `homeVehicleId` (hiệu lực hôm nay).
- Migration: `deploy/migrate-add-driver-vehicle-assignments.sql` (idempotent, chạy tay trên VPS
  TRƯỚC khi build). Đã backfill lái xe hiện tại từ 01/01/2026; Dũng (`0963370168`) giữ
  `15H 10090` đến 31/10/2026 và sang `15H 40566` từ 01/11/2026.

### BHXH phần NGƯỜI LAO ĐỘNG: theo % HOẶC theo SỐ TIỀN

Mỗi tháng, mỗi lái xe có thể đóng BHXH NLĐ theo 1 trong 2 cách (chọn ở tab **Lương tháng**):

- **Theo %** (`percent`) — tỷ lệ % × lương cứng, mặc định `10,5` (giữ nguyên hành vi cũ).
- **Theo số tiền** (`amount`) — số tiền cố định (VNĐ), không phụ thuộc lương cứng.

Thứ tự ưu tiên: cài đặt RIÊNG của lái xe trong tháng (`salary_records.bhxh_mode` /
`bhxh_amount`) → cài đặt CHUNG (`salary_settings.bhxh_nld_mode` / `bhxh_nld_amount`) →
mặc định `percent` + `salary_settings.bhxh_nld`. `NULL` = dùng mức chung.

- Helper dùng chung: `be/src/salary/bhxh.ts` (`computeBhxh`, `bhxhLabel`).
- Áp dụng ở: bảng lương `SalaryService.getRecords`, tổng thu nhập dự kiến
  `SubmissionsService`, Excel lương tháng + Excel tổng hợp lương (nhãn cột BHXH NLĐ).
- FE: tab Lương tháng có nút chọn **Theo % / Theo số tiền** ở mục cài đặt chung và ở từng
  lái xe (thêm lựa chọn **Dùng mức chung**).
- Migration: `deploy/migrate-add-bhxh-mode.sql` (idempotent, chạy tay trên VPS TRƯỚC khi build).

### Xoá container = trừ sản lượng của lái xe (link 2 chiều)

Xoá container ở tab **Mã số container** (`ContainerCodesTab`) nay **trừ luôn sản lượng** của lái xe
đã ghi nhận nó — trước đây chỉ mất dòng container, còn `submissions.vo40…` vẫn nguyên nên lái xe
bị giữ sản lượng ảo.

- Trừ **đúng ô mà container đã cộng**, theo từng dòng `container_claims` (mỗi dòng = 1 lần cộng):
  `CLAIM` / `CLAMP` / `KD2` / `REGO` / `CLASSIFY` → ô theo **loại container** (`TYPE_FIELD_MAP`);
  `VSL` → luôn `veSinhLai`; `KV` → luôn `keoVe`. Xem `CLAIM_FIELD_OVERRIDE` trong
  `be/src/container-import/container-import.service.ts`.
- Nút **"Xoá toàn bộ container của kế hoạch"** cũng trừ sản lượng, như xoá từng cont.
- Container thuộc kế hoạch **đã hoàn thành** → **chặn** (`BadRequestException`); phải bỏ trạng thái
  "hoàn thành" trước, vì đó là số liệu đã chốt bảng kê / lương.
- Không bao giờ trừ xuống dưới 0. Mỗi lần trừ ghi 1 dòng `edit_history`
  (`{"vo40":{"old":"12","new":"11"}}`, `editedById` = người xoá) và +1 `edit_count`.
- Trừ sản lượng + xoá `container_claims` + xoá container nằm trong **1 transaction** (không có
  trạng thái nửa vời, không để lại claim mồ côi). Audit ghi vào `container_audit_logs`
  (`claim_count` / `claim_types` của lúc TRƯỚC khi xoá).
- Hàm `assertNoClaims` cũ (chặn xoá khi có claim) **đã bỏ**.
- ⚠️ Vì thế "xoá hết rồi import lại" nay **mất** phần sản lượng đã ghi nhận — xem mục "replace import"
  còn treo trong `AGENTS.md`/skill.
- Test: `be/src/container-import/container-import-reversal.spec.ts` (11 ca).
  Kiểm chứng trên dump thật: `be/scripts/verify-delete-reversal.mjs [planId]`.

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

- **Cơ chế nhận tin CHÍNH: WEBHOOK** — production đặt `ZALO_POLLING=false` (hoặc không bật) và trỏ webhook Zalo tới `https://newwaytraco.com/api/zalo/webhook` (bot 1/2/3 dùng `/webhook`, `/webhook2`, `/webhook3`). Zalo verify thành công (`webhook.ok`). Đây là cơ chế đang dùng chính.
- **Long-polling (`ZALO_POLLING=true`) là DỰ PHÒNG** — chỉ bật khi webhook có sự cố. `zalo-polling.service.ts` giành leader qua Redis lock (`zalo:poller:lock`, TTL 120s), **xóa webhook 1 lần** rồi gọi `getUpdates(20)` lặp vô hạn, dedup bằng `message_id` (Redis SET NX, TTL 48h). Lỗi `Request timeout` (408) của getUpdates là HÀNH VI BÌNH THƯỜNG khi không có tin mới, không phải lỗi. Lưu ý: webhook và getUpdates **loại trừ lẫn nhau** — bật polling sẽ tự xóa webhook; tắt polling phải set lại webhook.
- **Webhook endpoint**: `POST /api/zalo/webhook` — verify header `X-Bot-Api-Secret-Token` (timing-safe compare, khớp `ZALO_WEBHOOK_SECRET`), hoạt động khi `ZALO_POLLING != true`. Event types xử lý: `message.text.received`, `message.voice.received`.
- **Audio "buồn ngủ"**: khi tin nhắn chứa từ `buồn`/`ngủ` (regex `\b(buon|ngu)\b` sau normalize bỏ dấu), bot gửi file `public/audio/buon-ngu-v2.aac` (~2 phút) qua `sendVoice` với `ZALO_BUON_NGU_AUDIO_URL`. **Lưu ý cache**: Zalo cache file theo URL — nếu đổi nội dung file audio, phải ĐỔI TÊN file (vd `buon-ngu-v2.aac` → `buon-ngu-v3.aac`) và cập nhật cả route trong `zalo-bot.controller.ts` + `ZALO_BUON_NGU_AUDIO_URL` trong `.env`, nếu không Zalo vẫn gửi bản cũ đã cache.
- **Gửi tin**: `POST https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/sendMessage` body `{ chat_id, text }`.
- **Voice**: webhook chỉ gửi `voice_url` → backend tải file (Authorization Bearer, fallback `access_token` query) → STT (OpenAI Whisper qua `OPENAI_API_KEY`, bắt buộc key) → lọc số.
- **Session**: Redis key `zalo_session:{zaloUserId}`, TTL 3600. Lưu `userId`, `planId`, `planName`, `pendingCandidates`, `pendingDigits`, `pendingPlanOptions`.
- **Lệnh bot**: `/help`, `/link <username> <password>` (liên kết qua bcrypt.compare + set `users.zalo_id`), `/doi-plan`, `/logout` (xóa session + set `users.zalo_id` = null), nhắn `TIP <số>` để ghi TIP (vd `TIP 3` → chọn kế hoạch → cộng vào field `tip`). **Không có lệnh `/xong`** — ghi nhận real-time từng container.
- **Hội thoại**: liên kết → chọn kế hoạch (match tên, hỗ trợ chọn số khi trùng) → gửi 1–7 số cuối / đọc số → tìm `RIGHT(container_code, N)` (N = số chữ số đã nhập) trong plan:
  - 0 kết quả → "không nằm trong kế hoạch"
  - 1 kết quả → upsert submission + `claim` (set `container_imports.submission_id`)
  - >1 kết quả → liệt kê 1️⃣/2️⃣, tài xế nhắn số thứ tự hoặc mã đầy đủ (KHÔNG tự điền khi trùng)
- **Trùng đã ghi trước đó**: container đã có `submissionId` hiển thị tên lái xe đã chạy (`đã được chạy bởi {Lái xe}`) rồi mới show menu chọn (Vệ sinh lại / Kéo Về / Vẫn đi / Đọc nhầm).
- **Upsert submission**: tìm `submissions` theo `userId + shippingLineId`. Chưa có → tạo mới với field loại = `1`. Có → cộng `+1`, `editCount + 1`, `lastEditedAt`, ghi `edit_history` (`editedById` = lái xe, `editedByName` = fullName).
- **Map loại → field**: H20→`hang20`, H40→`hang40`, V20→`vo20`, V40→`vo40`, V20FR→`vo20fr`, V40FR→`vo40fr`, VSL→`veSinhLai`, TIP→`tip`.
- **Chặn ghi**: kế hoạch `completed` chặn import file lẫn ghi nhận qua bot; container đã có `submissionId` → báo "đã ghi nhận trước đó".
- **Container phát sinh**: lái xe đọc mã không có trong kế hoạch → bot hỏi "1) Vẫn đi / 2) Đọc nhầm" → chọn kế hoạch → lái xe chỉ cần đọc **4 chữ cái đầu (prefix)** của container (vd `BEAU`, số 7 cuối đã nhập trước đó) — bot ghép thành mã đầy đủ → **hỏi loại container (H20/H40/V20/V40/V20FR/V40FR)** → ghi nhận loại vào `container_imports.type` (không phải `PHATSINH`) nhưng vẫn `phatSinh=true`, chưa cộng sản lượng. OPS confirm trên web (`classifyPhatSinh`) mới cộng sản lượng + gán `submissionId`.
- **Text parser** (`zalo-bot/text-parser.ts`): đọc số Việt (không/một/hai...chín), số nguyên theo cấp (nghìn/triệu), bỏ từ nhiễu (ờ, à, ơ...), trích **1–7 số cuối** (nhập bao nhiêu lọc bấy nhiêu). SĐT 10 số bị loại.
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

### Đơn giá khách hàng & cách tính KẸP

- Bảng `customer_prices`: đơn giá theo khách + tháng + khoảng ngày (`from_day`→`to_day`) + tuyến (`route_name`, rỗng = mọi tuyến) + loại container.
- Loại đơn giá hợp lệ (`PRICE_CONTAINER_TYPES`): `H20, H40, V20, V40, V20FR, V40FR, KV20, KV20FR, VSL, TIP`.
  - `KV20` / `KV20FR` = đơn giá cho **CẢ CẶP KẸP** (UI hiển thị "Kẹp V20" / "Kẹp V20FR").
- Quy tắc tính kẹp khi xuất file thanh toán (`exportPaymentDossier`):
  1. Nhận diện cặp kẹp giống bảng lương: claim `CLAMP` = container bị kẹp, container chính là container được ghi nhận ngay trước đó trong **cùng `submission`**. Bỏ qua container thuộc bó FR.
  2. Chỉ "tính kẹp" khi: 2 container **cùng loại**, loại đó map được sang giá kẹp (`V20 → KV20`, `V20FR → KV20FR`), **và** khách có nhập đơn giá kẹp cho ngày + tuyến của container chính.
  3. Khi tính kẹp: cả cặp = **1 lần giá kẹp** (không phải 2 lần giá lẻ). Sheet `Empty`/`Laden`: 2 dòng liền nhau — dòng container chính mang giá kẹp, dòng bị kẹp để trống và **merge ô ĐƠN GIÁ**. Sheet `QTSL`/`QT`: gộp 1 dòng nhãn "Kẹp V20"/"Kẹp V20FR", số cont = 1, đơn giá = giá kẹp.
  4. Không đủ điều kiện (khác loại / loại không có giá kẹp / khách không nhập giá kẹp) → **tính đơn lẻ** như bình thường.
  5. H40/V40/V40FR/VSL/TIP không có loại giá kẹp → luôn tính đơn lẻ.

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
| POST | `/api/zalo/webhook` | Public (verify `X-Bot-Api-Secret-Token`) | Nhận event từ Zalo Bot (chỉ khi KHÔNG dùng polling) |
| GET | `/api/zalo` | Public | Health check bot (configured/STT) |
| GET | `/api/zalo/audio/buon-ngu-v2.aac` | Public | File audio "buồn ngủ" (~2 phút) |

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
ZALO_POLLING=true               # PRODUCTION BẮT BUỘC bật polling (getUpdates), KHÔNG dùng webhook
ZALO_WEBHOOK_SECRET=<chuỗi bí mật tự đặt, dùng verify webhook (chỉ khi fallback webhook)>
ZALO_BUON_NGU_AUDIO_URL=https://<domain>/api/zalo/audio/buon-ngu-v2.aac
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
13. **Zalo Bot** — PRODUCTION dùng **WEBHOOK** là chính (`ZALO_POLLING=false`); long-polling (`ZALO_POLLING=true`) chỉ là **dự phòng** khi webhook sự cố (bật polling sẽ tự xóa webhook — nhớ set lại webhook khi tắt). Khi đổi nội dung file audio "buồn ngủ" phải đổi tên file + route + `ZALO_BUON_NGU_AUDIO_URL` để tránh cache. Không thêm lệnh `/xong`; ghi nhận real-time. Kế hoạch `completed` chặn import + ghi. Container trùng 7 số cuối → luôn cho chọn 1/2, không ghi nhận mặc định. STT phải qua bước lọc số (text-parser) vì voice-to-text hay sai/nhiễu.
14. **Container import** — chỉ hỗ trợ file Excel (.xlsx/.xls), định dạng **1 cột = 1 loại container**: dòng 1 là tiêu đề loại (H20, H40, V20, V40, V20FR, V40FR...), mã container gõ vào đúng cột loại của nó. Loại map qua `normalizeType`. File txt/csv KHÔNG được hỗ trợ nữa.
15. **Bó container** — file xlsx nhóm nhiều container thành "Bó" bằng **cột Bó** đặt ngay phải cột loại: header chứa chữ "Bó" (vd `(Bó 20FR)`), ở ô đầu vùng gõ `Bó` rồi merge xuống đúng số dòng các container muốn gộp (vd merge `F2:F5` → 4 container V20FR ở `E2:E5` là 1 bó). Khi import, container cùng loại trong vùng merge được gán chung `bundle_id` (`Bó 1`, `Bó 2`, ...). Lái xe đọc **1 mã bất kỳ** trong bó → bot ghi nhận **cả bó** cho lái xe đó: cộng số lượng = số container trong bó vào field loại (VD bó 4 V20FR → `vo20fr` +4), claim toàn bộ container trong bó về 1 submission. Bó đã có container được ghi (submissionId) → báo "đã được ghi nhận trước đó" (giống cơ chế trùng lặp). Không có trường hợp bó hỗn hợp nhiều loại.
