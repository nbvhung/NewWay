# KẾ HOẠCH: Khách hàng + Hồ sơ thanh toán + Redesign Web/Mobile

> Lưu để không mất khi reset máy. Repo đã push lên GitHub → an toàn.
> Ngày lập: 2026-09-03

## A. Quản lý Khách hàng
- Khách hàng = **chủ hàng / doanh nghiệp vận chuyển** (entity mới, khác hãng tàu/shipping_lines)
- Bảng `customers`: name, phone, email, address, contact_name, status (`active`/`inactive`), note, created_at, updated_at
- Gắn `shipping_lines.customer_id` (FK → customers.id, nullable) — mỗi kế hoạch (tàu) thuộc 1 khách hàng
- CRUD `/api/admin/customers` — guard `Roles('ops','hr','admin','supper_admin')`
- Chặn xóa khách hàng đang có kế hoạch (báo lỗi) — chỉ inactive
- Thống kê theo khách hàng: lọc theo tháng (số kế hoạch, số chuyến, số container)
- Web: tab "Khách hàng" trong admin dashboard (ops/hr/admin/supper_admin) + dropdown chọn khách hàng khi tạo/sửa kế hoạch trong ShippingLinesTab
- Mobile: tab "Khách hàng" tương tự trong admin

## B. Bộ hồ sơ thanh toán (theo khách hàng + tháng)
- Bảng `payment_dossiers`: id, customer_id, month, year, invoice_file (đường dẫn file hoá đơn), created_at, updated_at
- **Hoá đơn GTGT**: kế toán **upload file** (PDF/ảnh) lên web, gắn vào khách hàng + tháng — hệ thống KHÔNG tự tạo hoá đơn
- Xuất **Excel .xlsx** gồm 2 sheet:
  - **Sheet "Đề nghị thanh toán"**: thông tin Công ty New Way (tên, địa chỉ, MST, ngân hàng) + khách hàng + tháng + số chuyến/số container tổng + **ô thành tiền ĐỂ TRỐNG** (kế toán nhập tay theo hợp đồng — vì hệ thống hiện chỉ tính lương lái xe, chưa có đơn giá khách hàng) + khung ký tên (Người lập / Giám đốc)
  - **Sheet "Bảng kê"**: mỗi dòng 1 container: mã cont (`container_code`) · loại cont (`type`) · ngày tàu (`shipping_lines.ngay`) · tuyến đường (`route_name`) · biển số xe (`users.so_xe` qua container_claims → submission → user)
- Endpoints:
  - `POST /api/admin/customers/:id/dossier/upload` — upload hoá đơn
  - `GET /api/admin/customers/:id/payment-dossier?month=&year=` — xuất Excel
  - `GET /api/admin/customers/:id/dossier/invoice` — tải hoá đơn
- Web/Mobile: tab Khách hàng → chọn tháng → **Xuất hồ sơ** / **Upload hoá đơn** / **Tải hoá đơn**
- **Giới hạn dữ liệu**: bảng kê chỉ gồm container **CÓ MÃ** (import Excel / ghi qua Zalo bot). Container lái xe nhập tay số lượng (không có mã) sẽ KHÔNG có dòng trong bảng kê.

## C. Redesign Web & Mobile (thiết kế mới, tách biệt với thiết kế cũ)
- Bố cục mới: đang chọn giữa
  - (1) **Sidebar trái** phân nhóm theo vai trò (khuyến nghị)
  - (2) Dashboard trang chủ dạng thẻ theo vai trò
  - (3) Giữ top-navbar, thiết kế lại thành dropdown nhóm
- Nhóm menu đề xuất:
  - **Vận hành (ops):** Thống kê · Kế hoạch · Container · Lịch sử chat
  - **Khách hàng & Doanh thu:** Khách hàng · Hồ sơ thanh toán
  - **Nhân sự & Lương (hr):** Tuyến đường · Lương tháng · Lương chuyến
  - **Hệ thống (admin):** Người dùng
- Hệ màu mới (tách biệt hẳn với xanh `#1a56db` cũ — đề xuất navy/teal + trung tính), SVG icon thay emoji, typography rõ ràng, component dùng chung thống nhất web + mobile
- Mobile: bottom-nav nhóm theo vai trò, thêm màn hình Khách hàng + Hồ sơ

## D. Migration + Deploy
- Migration: tạo bảng `customers`, thêm cột `shipping_lines.customer_id`, tạo bảng `payment_dossiers`
- Chạy migration production (SQL) → push GitHub → deploy VPS (backend + frontend) → mobile build APK mới
- Thứ tự triển khai: **A (Khách hàng) → B (Hồ sơ) → C (Redesign)** — mỗi phần deploy xong rồi mới làm phần sau

## Trạng thái quyết định
- ✅ Chốt: khách hàng = chủ hàng/doanh nghiệp vận chuyển; quản lý thông tin liên hệ + trạng thái + ghi chú + thống kê + liên kết kế hoạch
- ✅ Chốt: bộ hồ sơ theo khách hàng + tháng; cột "Ngày" = ngày tàu (kế hoạch); hoá đơn GTGT do kế toán upload file; thành tiền trong Đề nghị thanh toán để trống (kế toán nhập tay — chưa có đơn giá khách hàng)
- ⏳ Chờ chốt: định dạng xuất (Excel .xlsx là đủ hay thêm PDF), bố cục redesign (1/2/3), màu sắc/logo thương hiệu