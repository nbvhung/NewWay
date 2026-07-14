# 📘 Hướng dẫn vận hành — Hệ thống New Way

> Tài liệu dành cho người **không chuyên IT**.
> Nếu có sự cố ngoài các mục dưới đây, hãy gọi **0399706485**.

---

## 1. Hệ thống gồm những gì?

```
Tài xế (điện thoại/di động)
    │
    ▼
[INTERNET — https://newway.congty.vn]
    │
    ├── VPS (máy chủ thuê ngoài)  ← chạy ứng dụng
    │
    └── Server công ty              ← chứa database (dữ liệu)
```

- **VPS**: máy chủ bên thứ 3 (Hetzner), chạy 24/7, có backup tự động
- **Server công ty**: máy chủ đặt tại văn phòng, chỉ chứa database, **không thể truy cập từ internet**

---

## 2. Cách kiểm tra hệ thống đang chạy

**Cách 1** — Dùng điện thoại:
- Mở trình duyệt Safari/Chrome
- Vào địa chỉ: `https://newway.congty.vn`
- Nếu thấy trang đăng nhập → hệ thống **đang chạy bình thường**

**Cách 2** — Gọi cho tài xế:
- Nhờ một tài xế thử đăng nhập và nhập số liệu
- Nếu được → OK

---

## 3. Khi nào cần gọi hỗ trợ kỹ thuật?

### 🟢 Trường hợp KHÔNG cần gọi:
- Quên mật khẩu → dùng chức năng "Quên mật khẩu" hoặc nhờ admin tạo lại
- Chậm, load lâu → thử F5 refresh, hoặc đợi 1-2 phút
- Lỗi "Mạng không ổn định" → kiểm tra wifi/4G của tài xế

### 🔴 Trường hợp CẦN gọi ngay:
| Hiện tượng | Nguyên nhân thường | Gọi số |
|---|---|---|
| **Không vào được web** (trắng trang, "Site not found") | Domain hết hạn / SSL lỗi | |
| **Trang đăng nhập hiện ra nhưng không đăng nhập được** ("Lỗi server") | Database server không kết nối được | |
| **Trang load được, đăng nhập được, nhưng không hiện dữ liệu** | Lỗi phần mềm | |

---

## 4. Lưu ý về Server công ty (quan trọng)

Server công ty chứa **toàn bộ dữ liệu** (tài xế, sản lượng, lương).

### ✅ NÊN làm:
- Cắm **UPS** (lưu điện) cho server — phòng mất điện đột xuất
- Đảm bảo **internet ổn định** — nếu có thể, dùng thêm 4G dự phòng
- Kiểm tra **đèn nguồn server** xanh mỗi sáng

### ❌ KHÔNG được làm:
- **Tự ý tắt nguồn** server
- **Rút dây mạng** hoặc dây nguồn
- **Di chuyển** server khi đang chạy
- **Cắm USB/ổ cứng lạ** vào server

### ⚠ Nếu cần bảo trì/di chuyển server:
1. **Báo trước cho kỹ thuật 24h**
2. Chờ hướng dẫn tắt đúng cách
3. Tuyệt đối không tự ý rút điện

### Mất điện / Mất mạng:
- Nếu mất điện hoặc mất internet ở công ty → **tài xế sẽ không vào được hệ thống**
- Khi điện/mạng có lại → hệ thống tự hoạt động trở lại **trong 1-2 phút**
- Dữ liệu không mất (đã được backup hàng ngày)

### Hỏng ổ cứng / Phần cứng:
- Nếu server bị hỏng phần cứng → dữ liệu có thể mất tối đa **24h** (từ lần backup cuối)
- Backup được lưu tại: thư mục `/backups` trên server (mã hoá, an toàn)

---

## 5. Backup dữ liệu

Hệ thống **tự động backup** mỗi ngày lúc **2:00 sáng**.

- File backup được **mã hoá** (kể cả có lấy được cũng không đọc được)
- Backup cũ hơn **30 ngày** tự động xoá
- Định kỳ (hàng tháng) kiểm tra thư mục backup còn hoạt động không

**Để kiểm tra backup:**
1. Mở folder `\\server\backups\` trên máy tính
2. Nếu có file `.sql.gz.gpg` → backup đang chạy bình thường

---

## 6. Chi phí vận hành hàng tháng

| Khoản | Số tiền | Ghi chú |
|---|---|---|
| VPS (Hetzner) | ~$6/tháng | Thuê ngoài, thanh toán qua thẻ |
| Domain | ~$10/năm | Gia hạn mỗi năm 1 lần |

---

## 7. Danh sách liên hệ

| Vai trò | Tên | Số điện thoại |
|---|---|---|
| **Hỗ trợ kỹ thuật** | | |
| **Người quản trị hệ thống** | | |

---

*Phiên bản: 1.0 — Cập nhật lần cuối: 07/2026*
