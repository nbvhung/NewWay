# 📘 Hướng dẫn sử dụng — Hệ thống Xác nhận Sản lượng Xe New Way

> Phiên bản: 1.0 — Cập nhật: 07/2026

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Đăng nhập & Đăng xuất](#2-đăng-nhập--đăng-xuất)
3. [Nhập liệu sản lượng (dành cho tài xế)](#3-nhập-liệu-sản-lượng-dành-cho-tài-xế)
4. [Xem và sửa dữ liệu của tôi](#4-xem-và-sửa-dữ-liệu-của-tôi)
5. [Tổng quan vai trò & quyền hạn](#5-tổng-quan-vai-trò--quyền-hạn)
6. [Admin Dashboard](#6-admin-dashboard)
   - [6.1. Tất cả dữ liệu](#61-tất-cả-dữ-liệu)
   - [6.2. Quản lý tài khoản](#62-quản-lý-tài-khoản)
   - [6.3. Quản lý kế hoạch](#63-quản-lý-kế-hoạch)
   - [6.4. Quản lý tuyến đường](#64-quản-lý-tuyến-đường)
7. [Xuất Excel](#7-xuất-excel)
8. [Các lỗi thường gặp](#8-các-lỗi-thường-gặp)

---

## 1. Giới thiệu

**Hệ thống Xác nhận Sản lượng Xe New Way** là công cụ giúp:

- **Lái xe** nhập số liệu container/xe hàng ngày (hàng 20/40, vỏ 20/40, vệ sinh lại, TIP, kéo về)
- **Người tổng hợp** xem, lọc, xuất Excel tổng hợp
- **Admin** quản lý tài khoản, kế hoạch (hãng tàu), tuyến đường

Hệ thống chạy trên nền web — chỉ cần điện thoại/laptop có trình duyệt và internet, không cần cài đặt ứng dụng.

---

## 2. Đăng nhập & Đăng xuất

### 2.1. Đăng nhập

1. Mở trình duyệt (Chrome, Safari, Cốc Cốc,...)
2. Vào địa chỉ web: `https://newway.congty.vn` (tuỳ theo domain)
3. Màn hình hiện ra form đăng nhập:

```
┌─────────────────────────┐
│  Tên đăng nhập          │
│  ┌─────────────────┐   │
│  │ driver01        │   │
│  └─────────────────┘   │
│  Mật khẩu               │
│  ┌─────────────────┐   │
│  │ ••••••••        │   │
│  └─────────────────┘   │
│                         │
│  [🔐 Đăng nhập]         │
└─────────────────────────┘
```

4. Nhập **tên đăng nhập** và **mật khẩu** được cấp
5. Nhấn **Đăng nhập**

> ⚠ Nếu quên mật khẩu — liên hệ admin để được cấp lại.

### 2.2. Đăng xuất

- Nhấn vào **nút Đăng xuất** ở góc phải trên cùng
- Hoặc đơn giản là đóng trình duyệt (tự động đăng xuất sau 15 phút không hoạt động)

---

## 3. Nhập liệu sản lượng (dành cho tài xế)

Sau khi đăng nhập, màn hình chính hiện ra 3 chức năng:

```
┌────────────────────────────────────┐
│  📝 Nhập liệu  📊 Dữ liệu của tôi  │  ⚙️ Admin (nếu có quyền)
│                                     │
│  ┌───────────────────────────────┐  │
│  │  📝 Nhập liệu sản lượng       │  │
│  │                               │  │
│  │  Chọn kế hoạch:               │  │
│  │  ○ COSCO / CH01 / TU1 / 15/07 │  │
│  │  ● MAERSK / CH02 / TU2 / 15/07│  │  ← chọn 1
│  │  ○ MSC    / CH03 / TU3 / 15/07│  │
│  │                               │  │
│  │  Hàng 20:  [5  ]  Hàng 40: [3 ]│  │
│  │  Vỏ 20:    [2  ]  Vỏ 40:   [1 ]│  │
│  │  Vỏ 20FR:  [0  ]  Vỏ 40FR: [0 ]│  │
│  │  Vệ sinh lại: [0]              │  │
│  │  TIP:         [0]              │  │
│  │  Kéo về:      [0]              │  │
│  │                               │  │
│  │  [📤 Gửi xác nhận]            │  │
│  └───────────────────────────────┘  │
└────────────────────────────────────┘
```

### Các bước nhập liệu:

**Bước 1:** Chọn **Kế hoạch** (hãng tàu + số chuyến + tuyến + ngày)
- Nhấn vào 1 lựa chọn trong danh sách
- Kế hoạch có thể có nhãn:
  - **+15%** — tàu tăng cường
  - **x3** — tàu dịp lễ, tết (hệ số nhân 3)

**Bước 2:** Nhập số liệu (chỉ nhập số, không nhập chữ)
| Trường | Ý nghĩa | Ví dụ |
|---|---|---|
| Hàng 20 | Số container hàng loại 20 feet | 5 |
| Hàng 40 | Số container hàng loại 40 feet | 3 |
| Vỏ 20 | Số vỏ container 20 feet rỗng | 2 |
| Vỏ 40 | Số vỏ container 40 feet rỗng | 1 |
| Vỏ 20FR | Số vỏ 20 feet FR (flat rack) | 0 |
| Vỏ 40FR | Số vỏ 40 feet FR (flat rack) | 0 |
| Vệ sinh lại | Số lượng vệ sinh lại container | 1 |
| TIP | Số lượng TIP (trailer interchange) | 0 |
| Kéo về | Số lượng container kéo về | 0 |

**Bước 3:** Nhấn **Gửi xác nhận**
- Nếu thành công → hiện thông báo xanh "Đã gửi xác nhận thành công!"
- Form tự động làm trống để nhập tiếp

> 💡 **Mẹo:** Nhập nhanh bằng cách chỉ nhập các số khác 0, trường nào bằng 0 thì bỏ trống hoặc để 0.

---

## 4. Xem và sửa dữ liệu của tôi

### 4.1. Xem danh sách bản ghi

Vào **Dữ liệu của tôi** → xem tất cả bản ghi đã nhập (filter theo tháng/năm).

```
┌────────────────────────────────────────────┐
│  📊 Dữ liệu của tôi           [+ Nhập liệu]│
│                                             │
│  📋 10 tổng     ✏️ 2 sửa     📅 3 hôm nay  │
│                                             │
│  Tháng 7/2026  ◀ ▶  [🔄 Làm mới]           │
│                                             │
│  #  Ngày     Kế hoạch  H20 H40 VSL ... Sửa  │
│  1  14/07    COSCO/..   5   3   1  ...  ✏️  │
│  2  13/07    MAERSK/..  2   2   0  ...  ✏️  │
│  3  12/07    MSC/..     3   1   0  ...  ✏️  │
│                                             │
│  💰 Từ đầu tháng này, bạn đã cày được:      │
│         5.230.000 ₫                          │
│         🎉 Thật là tuyệt vời !!!            │
└────────────────────────────────────────────┘
```

**Các chức năng:**
- **◀ ▶**  — chuyển tháng để xem dữ liệu cũ
- **🔄 Làm mới** — reload dữ liệu
- **💰 Lương** — hiển thị tổng lương tháng hiện tại (nếu có quyền xem)

### 4.2. Sửa bản ghi

1. Nhấn nút **✏️ Sửa** ở hàng tương ứng
2. Một cửa sổ pop-up hiện ra cho phép sửa các trường
3. Sửa xong nhấn **💾 Lưu thay đổi**
4. Mỗi lần sửa được ghi lại trong **lịch sử chỉnh sửa** (admin/supper_admin mới xem được)

> ⚠ Chỉ được sửa bản ghi của chính mình.
>
> ⚠ Sửa nhiều lần vẫn được, mỗi lần đều có ghi lại.

### 4.3. Thống kê lương

Cuối trang hiển thị tổng lương từ đầu tháng, tổng số bản ghi.
Công thức tính lương dựa trên:
- Số lượng container * đơn giá tuyến đường
- Container quy đổi: vỏ 20 = 0.5 container, vỏ 20FR = 1/8 container, vỏ 40FR = 1/4 container
- Hệ số: tàu thường × 1, tàu tăng cường × 1.15, tàu lễ tết × 3

---

## 5. Tổng quan vai trò & quyền hạn

| Vai trò | Nhập liệu | Xem dữ liệu | Export Excel | Quản lý user | Quản lý kế hoạch | Quản lý tuyến đường |
|---|---|---|---|---|---|---|
| **Lái xe** | ✅ | ✅ (của mình) | ❌ | ❌ | ❌ | ❌ |
| **Tổng hợp** | ✅ | ✅ (tất cả) | ✅ (không lương) | ❌ | ❌ | ❌ |
| **HR** | ✅ | ✅ (tất cả) | ✅ (có lương) | ✅ (chỉ lái xe) | ❌ | ✅ |
| **Admin** | ✅ | ✅ (tất cả) | ✅ (có lương) | ✅ (trừ supper_admin) | ✅ | ✅ |
| **Supper Admin** | ✅ | ✅ (tất cả) | ✅ (có lương) | ✅ (toàn quyền) | ✅ | ✅ |

---

## 6. Admin Dashboard

Vào **Admin** (⚙️) để mở bảng điều khiển quản trị.

### 6.1. Tất cả dữ liệu

Hiển thị tất cả bản ghi của mọi tài xế, có thể lọc theo:

| Bộ lọc | Mô tả |
|---|---|
| **Tài khoản** | Chọn 1 tài xế cụ thể |
| **Kế hoạch** | Chọn 1 hãng tàu |
| **Từ ngày → Đến ngày** | Lọc theo thời gian |

Chức năng:
- **Xem tất cả** bản ghi + tên tài xế
- **✏️ Sửa** — sửa bất kỳ bản ghi nào (ghi lịch sử)
- **🗑️ Xoá** — xoá bản ghi (admin/supper_admin)
- **📥 Xuất Excel** — tải file Excel tổng hợp

### 6.2. Quản lý tài khoản

Danh sách tài khoản người dùng — hiển thị avatar, họ tên, vai trò.

**Thêm tài khoản mới:**
1. Điền các trường: Tên đăng nhập, Họ tên, Mật khẩu, Biển số xe, Số điện thoại
2. Chọn vai trò phù hợp
3. Nhấn **Thêm tài khoản**

**Sửa/Xoá:**
- ✏️ — sửa họ tên, vai trò, đặt lại mật khẩu
- 🗑️ — xoá tài khoản (cần xác nhận)

> ⚠ Admin không thể xoá/sửa supper_admin.
>
> ⚠ Không thể xoá chính mình.

### 6.3. Quản lý kế hoạch

Danh sách các kế hoạch (hãng tàu + số chuyến + tuyến + ngày).

**Thêm kế hoạch mới:**
1. Nhập **Tên kế hoạch/Tên Tàu** (bắt buộc)
2. Số chuyến, Tuyến đường, Ngày
3. Chọn loại tàu:
   - ☐ Tàu Tăng Cường (+15%)
   - ☐ Tàu Lễ, Tết (x3)
4. Nhấn **Thêm kế hoạch**
5. Màn hình xác nhận hiện ra — nhập **Vendor khác** (nếu có) và **Tên người nhập** (bắt buộc)
6. Chọn: **📊 Tổng sản lượng** (chuyển đến form nhập liệu) hoặc **✅ Xong**

### 6.4. Quản lý tuyến đường

Danh sách các tuyến đường + đơn giá (cột **Tiền**).

**Thêm tuyến đường:**
1. Nhập **Tên tuyến** (vd: "Nội bộ", "Sài Gòn - Cái Mép")
2. Nhập **Đơn giá** (vd: 500000 cho 500.000₫)
3. Nhấn **➕ Thêm tuyến đường**

**Sửa/Xoá:** ✏️ 🗑️

> 💡 Đơn giá được dùng để tính lương cho tài xế dựa trên container quy đổi.

---

## 7. Xuất Excel

### Cách xuất:

Vào **Admin → Tất cả dữ liệu** → Nhấn **📥 Xuất Excel**

### Các sheet trong file:

**Sheet 1 — Sản lượng xe New Way:**
| STT | Tài khoản | Lái xe NW | Kế hoạch | Tuyến đường | Hàng 20 | Hàng 40 | ... | Lương (nếu có quyền) |
|---|---|---|---|---|---|---|---|---|

**Sheet 2 — Lịch sử chỉnh sửa:** (admin/supper_admin)
- Ghi lại ai sửa, sửa field nào, cũ → mới, lúc nào

**Sheet riêng cho từng tàu (ops role):** Hiển thị chi tiết gộp theo tài xế, có tổng cộng.

---

## 8. Các lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| **"Tên đăng nhập hoặc mật khẩu không đúng"** | Sai tài khoản/mật khẩu | Kiểm tra lại, nhờ admin cấp lại mật khẩu |
| **"Vui lòng chọn kế hoạch"** | Chưa chọn kế hoạch | Chọn 1 kế hoạch trong danh sách |
| **"Lỗi server nội bộ"** | Hệ thống đang gặp vấn đề | Chờ 1-2 phút, tải lại trang |
| **Không vào được web** | Mất internet | Kiểm tra wifi/4G |
| **Web load chậm** | Đường truyền chậm hoặc server khởi động lại | Đợi 5-10 giây, tải lại |
| **Không thấy nút "Admin"** | Tài khoản không có quyền admin | Liên hệ admin để cấp quyền |
| **Quên mật khẩu** | — | Liên hệ admin để đặt lại |

---

## Liên hệ hỗ trợ

Nếu gặp sự cố không xử lý được, hãy liên hệ:

- **Người quản trị:** _______________________
- **Số điện thoại:** _______________________
- **Email:** _______________________

---

*Tài liệu hướng dẫn sử dụng — Hệ thống Xác nhận Sản lượng Xe New Way*
*Dành cho tài xế, người tổng hợp, quản trị viên*
