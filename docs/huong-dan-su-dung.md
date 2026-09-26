# 📘 Hướng dẫn sử dụng — Hệ thống Xác nhận Sản lượng Xe New Way

> Phiên bản: 2.0 — Cập nhật: 26/09/2026
>
> 🕘 **Bản 2.0 đã sửa lại theo hệ thống thực tế đang chạy.** Bản 1.0 (07/2026) ghi sai địa chỉ web,
> thiếu nhiều màn hình admin, và mô tả sai vài trường nhập liệu (đặc biệt là **TIP**).
> Chi tiết thay đổi ở cuối tài liệu.

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Đăng nhập & Đăng xuất](#2-đăng-nhập--đăng-xuất)
3. [Nhập liệu sản lượng (dành cho tài xế)](#3-nhập-liệu-sản-lượng-dành-cho-tài-xế)
4. [Xem và sửa dữ liệu của tôi](#4-xem-và-sửa-dữ-liệu-của-tôi)
5. [Tổng quan vai trò & quyền hạn](#5-tổng-quan-vai-trò--quyền-hạn)
6. [Admin Dashboard](#6-admin-dashboard)
   - [6.1. Danh sách các màn hình](#61-danh-sách-các-màn-hình-trong-admin)
   - [6.2. Tất cả dữ liệu / Thống kê](#62-tất-cả-dữ-liệu--thống-kê)
   - [6.3. Kế hoạch](#63-kế-hoạch)
   - [6.4. Mã Số Container](#64-mã-số-container)
   - [6.5. Tuyến đường](#65-tuyến-đường)
   - [6.6. Khách hàng](#66-khách-hàng)
   - [6.7. Lương Tháng](#67-lương-tháng)
   - [6.8. Quản lý tài khoản](#68-quản-lý-tài-khoản)
   - [6.9. Tài Chính](#69-tài-chính)
   - [6.10. Lịch sử chat Zalo](#610-lịch-sử-chat-zalo)
7. [Xuất Excel](#7-xuất-excel)
8. [Các lỗi thường gặp](#8-các-lỗi-thường-gặp)

---

## 1. Giới thiệu

**Hệ thống Xác nhận Sản lượng Xe New Way** là công cụ giúp:

- **Lái xe** nhập số liệu container/xe hàng ngày (hàng 20/40, vỏ 20/40, vỏ FR, vệ sinh lại, kéo về, TIP)
- **Người vận hành (OPS)** nhập hộ, import mã container, ghi nhận container cho lái xe, gửi tin Zalo
- **Nhân sự / Kế toán (HR)** duyệt đơn giá, quản lý tuyến đường, tính & thanh toán lương
- **Quản trị (Admin)** quản lý tài khoản, kế hoạch, khách hàng, chi phí, xem tổng quan doanh thu

Hệ thống chạy trên nền web — chỉ cần điện thoại/laptop có trình duyệt và internet, không cần cài đặt ứng dụng.
Ngoài ra còn có **app điện thoại** (bản cài sẵn) cho lái xe, dùng chung tài khoản với web.

---

## 2. Đăng nhập & Đăng xuất

### 2.1. Đăng nhập

1. Mở trình duyệt (Chrome, Safari, Cốc Cốc,...)
2. Vào địa chỉ web: **`https://newwaytraco.com`**
3. Màn hình hiện ra form đăng nhập:

```
┌─────────────────────────┐
│        NEW WAY          │
│  Tên đăng nhập          │
│  ┌─────────────────┐   │
│  │ laixe01         │   │
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
>
> ⚠ Nhập sai quá nhiều lần, tài khoản **bị tạm khoá 15 phút**. Chờ hết 15 phút rồi thử lại.

### 2.2. Đăng xuất

- Nhấn vào **nút Đăng xuất** ở góc phải trên cùng
- Hoặc đóng trình duyệt. Phiên đăng nhập **tự động gia hạn** khi đang dùng (mã truy cập 15 phút,
  tự làm mới bằng mã refresh 7 ngày) — không phải đăng nhập lại giữa chừng.

---

## 3. Nhập liệu sản lượng (dành cho tài xế)

Vào màn hình **BÁO SẢN LƯỢNG**. Form gồm **3 phần theo thứ tự**:

### Phần 1 — Chọn kế hoạch

- Danh sách kế hoạch hiện ra dạng nút bấm, mỗi dòng là `Hãng tàu / Số chuyến / Tuyến / Ngày`
- Nhấn vào 1 dòng để chọn. Kế hoạch có thể có nhãn:
  - **`+15%`** — tàu tăng cường (hệ số × 1.15)
  - **`x3`** — tàu dịp lễ, tết (hệ số × 3)
- Chọn xong, kế hoạch được khoá lại và hiện thành 1 ô vàng để bạn yên tâm không chọn nhầm

### Phần 2 — Lái Xe NW

- Hệ thống **tự hiện tên tài khoản đang đăng nhập**. Toàn bộ số liệu sẽ được ghi vào tài khoản này.
- Nếu tên hiện ra **không đúng là bạn** → đăng xuất, đăng nhập lại đúng tài khoản của mình.

### Phần 3 — Nhập Sản Lượng Đã Chạy

Ô nhập được chia thành **4 khối màu**:

**🟩 Khối xanh — container tiêu chuẩn**

| Trường | Ý nghĩa | Ví dụ |
|---|---|---|
| **Hàng 20'** | Số container hàng loại 20 feet | 5 |
| **Hàng 40'** | Số container hàng loại 40 feet | 3 |
| **Vỏ 20'** | Số vỏ container 20 feet rỗng | 2 |
| **Vỏ 40'** | Số vỏ container 40 feet rỗng | 1 |

**🟥 Khối đỏ — container FR (flat rack)**

| Trường | Ý nghĩa | Ví dụ |
|---|---|---|
| **Vỏ 20FR** | Số **bó** vỏ 20 feet FR (1 bó = 4 cái) | 2 |
| **Vỏ 40FR** | Số **bó** vỏ 40 feet FR (1 bó = 4 cái) | 1 |

**🟨 Khối vàng — dịch vụ chuyến**

| Trường | Ý nghĩa | Ví dụ |
|---|---|---|
| **Vệ sinh lại (chuyến)** | Số chuyến vệ sinh lại container | 1 |
| **Kéo về (chuyến)** | Số chuyến kéo container về | 0 |

**⬜ Khối TIP**

| Trường | Ý nghĩa | Ví dụ |
|---|---|---|
| **TIP (×1.000đ)** | Số **tiền** TIP, tính theo **nghìn đồng** | 200 = 200.000₫ |

> ⚠️ **Lưu ý quan trọng về TIP:** đây là ô **tiền**, không phải số lượng.
> Nhập `200` nghĩa là **200.000₫**. Bản hướng dẫn cũ ghi "số lượng TIP" là **sai**.

**Bước cuối:** nhấn **✅ GỬI XÁC NHẬN**
- Thành công → hiện thông báo xanh, form tự làm trống để nhập tiếp
- Có nút **Xem dữ liệu của tôi** để sang màn hình danh sách bản ghi

> 💡 **Mẹo:** trường nào bằng 0 thì để trống hoặc nhập 0 — không cần nhập hết.

> 🔒 **Nếu thấy dòng đỏ "Hệ thống đang tạm khóa nhập liệu":** admin đang khoá nhập liệu toàn hệ thống
> (thường là lúc chốt sổ). Lúc này form web **không gửi được** — phải nhập qua **Zalo bot**, và liên hệ
> **HƯNG – 082 558 7779** nếu cần sửa.

### Cách tính lương khoán (để bạn tự kiểm tra)

```
Số container quy đổi = Hàng 20 + Hàng 40 + Vỏ 40
                     + làm tròn lên(Vỏ 20 ÷ 2)
                     + làm tròn lên(Vỏ 20FR ÷ 8)
                     + làm tròn lên(Vỏ 40FR ÷ 4)

Tiền chuyến = Đơn giá tuyến × Số container quy đổi × Hệ số
            + Số chuyến vệ sinh lại × 40.000đ × Hệ số
            + Số chuyến kéo về × Đơn giá tuyến × Hệ số
```

- **Hệ số:** tàu thường `× 1`, tàu tăng cường `× 1.15`, tàu lễ tết `× 3`
- **TIP** được **cộng thêm riêng** (không nhân hệ số), và chỉ hiện trong bảng lương tháng
- Lương tháng = tiền chuyến + lương cứng + chuyên cần + các phụ cấp + TIP − chi hộ − BHXH − khấu trừ tạm ứng

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
- **◀ ▶** — chuyển tháng để xem dữ liệu cũ
- **🔄 Làm mới** — tải lại dữ liệu
- **💰 Lương** — tổng tiền chuyến từ đầu tháng hiện tại

### 4.2. Sửa bản ghi

1. Nhấn nút **✏️ Sửa** ở hàng tương ứng
2. Cửa sổ pop-up hiện ra cho phép sửa các trường
3. Sửa xong nhấn **💾 Lưu thay đổi**
4. Mỗi lần sửa được ghi lại trong **lịch sử chỉnh sửa** (admin mới xem được)

> ⚠ Chỉ được sửa bản ghi của chính mình.
>
> ⚠ Sửa nhiều lần vẫn được, mỗi lần đều có ghi lại (ai sửa, sửa gì, cũ → mới, lúc nào).

---

## 5. Tổng quan vai trò & quyền hạn

Hệ thống có **5 vai trò**. Quyền thực tế có thể được **tuỳ chỉnh riêng cho từng tài khoản** —
bảng dưới đây là mức **mặc định** khi tạo tài khoản theo vai trò.

| Quyền | Lái xe | OPS (Vận hành) | HR (Nhân sự/Lương) | Admin | Supper Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Nhập sản lượng (form của mình) | ✅ | — | — | ✅ | ✅ |
| Sửa bản ghi của mình | ✅ | — | — | ✅ | ✅ |
| Nhập/sửa **hộ** cho lái xe khác | ❌ | ✅ | — | ✅ | ✅ |
| Xem **tất cả** dữ liệu | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Xoá** 1 bản ghi | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Xoá toàn bộ** dữ liệu | ❌ | ❌ | ❌ | ❌ | ✅ |
| Xem kế hoạch | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo / sửa kế hoạch | ❌ | ✅ | ❌ | ✅ | ✅ |
| Hoàn thành kế hoạch | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Duyệt đơn giá** kế hoạch | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Xoá** kế hoạch | ❌ | ❌ | ❌ | ✅ | ✅ |
| Container: xem / import / thêm-xoá / phân loại | ❌ | ✅ | ❌ | ✅ | ✅ |
| Container: **ghi nhận cho lái xe** | ❌ | ❌ | ❌ | ✅ | ✅ |
| Khách hàng: xem | ❌ | ✅ | ✅ | ✅ | ✅ |
| Khách hàng: quản lý / đơn giá / phụ phí | ❌ | ❌ | ✅ | ✅ | ✅ |
| Khách hàng: hồ sơ thanh toán | ❌ | ✅ | ✅ | ✅ | ✅ |
| Khách hàng: xem lịch sử thay đổi | ❌ | ❌ | ❌ | ✅ | ✅ |
| Tuyến đường: xem | ❌ | ✅ | ✅ | ✅ | ✅ |
| Tuyến đường: quản lý (đơn giá) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Lương: xem / sửa / thanh toán / xuất | ❌ | ❌ | ✅ | ✅ | ✅ |
| Xuất Excel dữ liệu | ❌ | ✅ | ✅ | ✅ | ✅ |
| Xem cột lương trong dữ liệu | ❌ | ❌ | ✅ | ✅ | ✅ |
| Tổng quan doanh thu & **Tài Chính** | ❌ | ❌ | ❌ | ✅ | ✅ |
| Tài khoản: xem / tạo / sửa / xoá | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Khoá nhập liệu** toàn hệ thống | ❌ | ✅ | ❌ | ✅ | ✅ |
| Zalo: xem chat / gửi tin / hẹn giờ | ❌ | ✅ | ❌ | ✅ | ✅ |

**Ghi chú quan trọng:**

- **Admin không thể xoá/sửa tài khoản Supper Admin**, và **không ai tự xoá được chính mình**.
- Chỉ **Supper Admin** có quyền **Xoá toàn bộ dữ liệu** (thao tác nguy hiểm).
- **OPS** khi mở màn hình dữ liệu sẽ thấy tên là **"Thống kê"**; **HR** thấy là **"Lương chuyến"** —
  cùng một màn hình, tên gọi khác nhau tuỳ vai trò.
- Muốn xem/cấp quyền chi tiết cho 1 tài khoản: **Admin → Tài khoản → ✏️** → mục phân quyền.

---

## 6. Admin Dashboard

Vào **Admin** (⚙️) để mở bảng điều khiển quản trị. Menu bên trái chia thành 5 nhóm:
**Tổng Quan · Vận hành · Khách hàng & Doanh thu · Nhân sự & Lương · Hệ thống**.

### 6.1. Danh sách các màn hình trong Admin

| Nhóm | Màn hình | Quyền cần có |
|---|---|---|
| 📊 Tổng Quan | **Tổng Quan** | `dashboard.view` |
| 📊 Tổng Quan | **Tài Chính** | `dashboard.view` |
| 🚛 Vận hành | **Tất cả dữ liệu** (OPS: *Thống kê*; HR: *Lương chuyến*) | `entry.view_all` |
| 🚛 Vận hành | **Kế hoạch** | `plan.view` |
| 🚛 Vận hành | **Kế hoạch theo tháng** | `entry.view_all` |
| 🚛 Vận hành | **Đã hoàn thành** | `plan.view` |
| 🚛 Vận hành | **Mã Số Container** | `container.view` |
| 🚛 Vận hành | **Lịch sử chat** | `zalo.chat` |
| 💼 Khách hàng & Doanh thu | **Khách hàng** | `customer.view` |
| 🧑‍💼 Nhân sự & Lương | **Tuyến đường** | `route.view` |
| 🧑‍💼 Nhân sự & Lương | **Lương Tháng** | `salary.view` |
| ⚙️ Hệ thống | **Tài khoản** | `user.view` |

> Màn hình nào tài khoản không có quyền sẽ **không hiện** trong menu.

### 6.2. Tất cả dữ liệu / Thống kê

Hiển thị tất cả bản ghi của mọi tài xế, lọc theo:

| Bộ lọc | Mô tả |
|---|---|
| **Tài khoản** | Chọn 1 tài xế cụ thể |
| **Kế hoạch** | Chọn 1 hãng tàu |
| **Từ ngày → Đến ngày** | Lọc theo thời gian |

Chức năng:
- **Xem tất cả** bản ghi kèm tên tài xế
- **✏️ Sửa** — sửa bất kỳ bản ghi nào (ghi lịch sử)
- **🗑️ Xoá** — xoá bản ghi (cần mật khẩu xoá)
- **📥 Xuất Excel** — tải file Excel tổng hợp

> 🔒 **Mọi thao tác XOÁ đều phải nhập mật khẩu `348`** (trên web và trên app). Bấm nút xoá sẽ hiện
> popup xác nhận — nhập mật khẩu rồi bấm **Xoá**; bấm **Huỷ** để dừng. Sai mật khẩu thì báo lỗi
> ngay trong popup, nhập lại hoặc huỷ. Mật khẩu không được ghi nhớ — mỗi lần xoá đều phải nhập lại,
> kể cả tài khoản supper_admin. Mục đích là tránh xoá nhầm.
>
> ⚠️ **Xoá container cũng sẽ tự động trừ lại sản lượng đã cộng cho lái xe** — không cần sửa tay.
> Nhưng nếu kế hoạch **đã hoàn thành (đã khoá)**, hệ thống sẽ **chặn lại** và yêu cầu mở khoá kế hoạch trước.

### 6.3. Kế hoạch

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

**Các tab khác cùng nhóm Vận hành:**
- **Kế hoạch theo tháng** — xem tổng hợp kế hoạch theo từng tháng
- **Đã hoàn thành** — danh sách kế hoạch đã kết thúc; xem lại, revert (mở lại), hoặc xoá

### 6.4. Mã Số Container

Quản lý danh sách mã container theo kế hoạch.

| Chức năng | Mô tả |
|---|---|
| **📥 Import Excel** | Nhập danh sách container từ file Excel (có file mẫu để tải) |
| **➕ Thêm mã lẻ** | Thêm 1 mã container thủ công |
| **🗂️ Phân loại** | Phân loại container phát sinh (OPS) |
| **👤 Ghi nhận** | Ghi nhận 1 container cho 1 lái xe (claim) |
| **🗑️ Xoá** | Xoá container — **tự động trừ sản lượng đã cộng cho lái xe** (cần mật khẩu `348`) |

> ⚠️ Nếu container đã được ghi nhận cho lái xe mà bạn xoá, sản lượng của lái xe đó **giảm tương ứng**.
> Đây là hành vi đúng — tránh trường hợp container bị xoá nhưng lương vẫn còn.

### 6.5. Tuyến đường

Danh sách các tuyến đường + đơn giá (cột **Tiền**).

**Thêm tuyến đường:**
1. Nhập **Tên tuyến** (vd: "Nội bộ", "Sài Gòn - Cái Mép")
2. Nhập **Đơn giá** (vd: 500000 cho 500.000₫)
3. Nhấn **➕ Thêm tuyến đường**

**Sửa/Xoá:** ✏️ 🗑️

> 💡 Đơn giá được dùng để tính lương cho tài xế dựa trên container quy đổi.

### 6.6. Khách hàng

Quản lý khách hàng và doanh thu: danh sách khách hàng, gán kế hoạch cho khách, **đơn giá theo
tháng/khoảng ngày**, **phụ phí** (cố định hoặc phần trăm), **hồ sơ thanh toán** (upload/tải hồ sơ,
xuất hồ sơ), và **lịch sử thay đổi** (audit log).

### 6.7. Lương Tháng

Bảng lương từng tháng cho toàn bộ lái xe. Bao gồm: lương khoán (tiền chuyến), lương cứng, chuyên cần,
các phụ cấp (xa nhà, chờ bốc, xe cũ, gửi xe HPH2), **TIP**, các khoản cộng/trừ, chi hộ, BHXH,
khấu trừ tạm ứng; đánh dấu **đã thanh toán**, và **xuất Excel bảng thanh toán lương**.

> 💡 Mục **Lương Tháng** chỉ tính cho tài khoản có vai trò **lái xe**.

### 6.8. Quản lý tài khoản

Danh sách tài khoản người dùng — hiển thị avatar, họ tên, vai trò.

**Thêm tài khoản mới:**
1. Điền các trường: Tên đăng nhập, Họ tên, Mật khẩu, Biển số xe, Số điện thoại
2. Chọn vai trò phù hợp
3. Nhấn **Thêm tài khoản**

**Sửa/Xoá:**
- ✏️ — sửa họ tên, vai trò, đặt lại mật khẩu, **tuỳ chỉnh từng quyền**
- 🗑️ — xoá tài khoản (cần mật khẩu xoá `348`)

> ⚠ Admin không thể xoá/sửa supper_admin.
>
> ⚠ Không thể xoá chính mình.

### 6.9. Tài Chính

Xem **doanh thu / lợi nhuận** và quản lý **các khoản chi phí** (thêm, sửa, xoá — xoá cần mật khẩu `348`).
Có thể tách chi phí theo **bên A / bên B** (theo xe), và nhập **vốn đầu tư**.

> ⚠️ Mục này **chỉ Admin và Supper Admin** mới thấy.

### 6.10. Lịch sử chat Zalo

Xem lại toàn bộ hội thoại giữa bot Zalo và lái xe: ai nhắn, nội dung, thời gian, container đã ghi nhận.
Dùng để đối chiếu khi lái xe báo "đã nhắn mà chưa thấy ghi".

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

**Sheet riêng cho từng tàu (OPS):** Hiển thị chi tiết gộp theo tài xế, có tổng cộng.

**Sheet "Container - Người chạy" (OPS):** Ghi lại từng container đã import trong kế hoạch — số container,
loại, kế hoạch, **ai là người chạy/ghi nhận** container đó và thời gian ghi nhận. Container nào chưa có
người chạy sẽ để trống cột "Người chạy" (để biết còn sót container chưa được tổng hợp).

**Bảng lương tháng:** xuất riêng ở màn hình **Lương Tháng** (quyền `salary.export`).

---

## 8. Các lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| **"Tên đăng nhập hoặc mật khẩu không đúng"** | Sai tài khoản/mật khẩu | Kiểm tra lại, nhờ admin cấp lại mật khẩu |
| **"Tài khoản bị tạm khóa do nhập sai quá nhiều lần"** | Nhập sai nhiều lần | Chờ 15 phút rồi thử lại |
| **"Vui lòng chọn kế hoạch"** | Chưa chọn kế hoạch | Chọn 1 kế hoạch trong danh sách |
| **"Hệ thống đang tạm khóa nhập liệu"** | Admin đang khoá nhập liệu | Nhập qua Zalo, hoặc liên hệ HƯNG: 082 558 7779 |
| **"Sai mật khẩu xoá"** | Nhập sai mật khẩu xoá | Nhập lại **`348`** trong popup xác nhận |
| **Xoá container báo "phải mở khoá kế hoạch trước"** | Kế hoạch đã hoàn thành | Vào **Đã hoàn thành** → revert (mở lại) kế hoạch rồi xoá |
| **"Lỗi server nội bộ"** | Hệ thống đang gặp vấn đề | Chờ 1-2 phút, tải lại trang; nếu vẫn lỗi thì gọi hỗ trợ |
| **Không vào được web** | Mất internet | Kiểm tra wifi/4G |
| **Web load chậm** | Đường truyền chậm hoặc server khởi động lại | Đợi 5-10 giây, tải lại |
| **Không thấy nút "Admin"** | Tài khoản không có quyền | Liên hệ admin để cấp quyền |
| **Quên mật khẩu** | — | Liên hệ admin để đặt lại |
| **Xoá trên app không được (báo lỗi)** | App bản cũ chưa có mật khẩu xoá | Cập nhật app mới, hoặc xoá tạm trên web |

---

## Liên hệ hỗ trợ

Nếu gặp sự cố không xử lý được, hãy liên hệ:

- **Hỗ trợ kỹ thuật:** 0399706485
- **Hỗ trợ nhập liệu (HƯNG):** 082 558 7779
- **Người quản trị:** _______________________
- **Email:** _______________________

---

## Phụ lục — Bản 2.0 đã sửa những gì so với bản 1.0?

| # | Bản 1.0 ghi | Thực tế (đã sửa) |
|---|---|---|
| 1 | Địa chỉ web `https://newway.congty.vn` | **`https://newwaytraco.com`** |
| 2 | Ô **TIP** = "Số lượng TIP (trailer interchange)" | **TIP là số TIỀN, đơn vị nghìn đồng** (`TIP (×1.000đ)`) |
| 3 | Vỏ FR ghi "Vỏ 20FR / Vỏ 40FR" | Form ghi rõ **"Vỏ 20FR (1 bó = 4 cái)"** — nhập theo **bó** |
| 4 | Chỉ mô tả 4 màn hình admin | Có **12 màn hình** admin, chia **5 nhóm** (xem mục 6.1) |
| 5 | Bảng vai trò có "Tổng hợp", "HR" | Vai trò thật: **lái xe / OPS / HR / Admin / Supper Admin**, và quyền **tuỳ chỉnh được theo từng tài khoản** |
| 6 | Không nhắc khoá nhập liệu | Có **khoá nhập liệu toàn hệ thống** (nhập qua Zalo khi bị khoá) |
| 7 | Công thức lương thiếu VSL / Kéo về / TIP | Đã bổ sung đầy đủ (mục 3) |
| 8 | Không nhắc mật khẩu xoá | **Mọi thao tác xoá cần mật khẩu `348`** |
| 9 | Không nhắc xoá container trừ sản lượng | **Xoá container tự trừ sản lượng lái xe** (chặn nếu kế hoạch đã khoá) |

---

*Tài liệu hướng dẫn sử dụng — Hệ thống Xác nhận Sản lượng Xe New Way*
*Dành cho tài xế, người vận hành, nhân sự/kế toán, quản trị viên*
*Phiên bản 2.0 — 26/09/2026*
