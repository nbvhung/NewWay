# 🖥️ Hướng dẫn setup Server công ty — dành cho member tại công ty

> Tài liệu dành cho người ở **công ty** thao tác trên **máy chủ đặt tại văn phòng**.
> Làm theo từng bước, chạy xong gửi kết quả về cho người quản lý hệ thống.

---

## 1. Nhiệm vụ của bạn

Máy chủ đặt tại công ty chỉ làm **1 việc: chứa database** của hệ thống.
Tất cả ứng dụng (web, app, bot) chạy trên VPS bên ngoài — VPS kết nối vào database của mình qua một "đường hầm an toàn" (WireGuard).

```
VPS bên ngoài ────đường hầm WireGuard────► Server công ty (chứa database)
```

## 2. Chuẩn bị

- **1 máy tính** để làm server (có thể là PC cũ/PC mini — không cần mạnh, chỉ cần chạy 24/7).
- Máy **nối mạng có dây (cáp mạng)** — quan trọng, không dùng wifi.
- Cài sẵn **Ubuntu Server 22.04 LTS** lên máy (nếu chưa cài, nhờ người kỹ thuật cài giúp).

## 3. Cài Ubuntu Server 22.04 (nếu chưa có)

1. Tải file Ubuntu Server 22.04 từ trang chủ → ghi ra USB (dùng Rufus/BalenaEtcher).
2. Bật máy boot từ USB → làm theo hướng dẫn cài đặt (chọn Tiếng Anh, chọn **Install Ubuntu Server**).
3. Khi đến bước chọn tài khoản: đặt **username** và **mật khẩu** riêng của bạn.
4. Cài xong, đăng nhập bằng username + mật khẩu vừa tạo.

## 4. Ghi chú IP tĩnh

Máy server cần **IP tĩnh trong mạng nội bộ** (VD `192.168.1.50`).
- Nếu không biết cách đặt, hãy đăng nhập router (VD mở trình duyệt gõ `192.168.1.1`) → tìm mục **DHCP Reservation** / **Port Forwarding** → gán IP cố định cho máy server.

## 5. Chạy script cài đặt (1 lệnh)

> Script cài tự động: PostgreSQL (database) + WireGuard (đường hầm) + firewall + backup hàng ngày.

Bạn cần file script `setup-db.sh` — xin từ người quản lý hệ thống (gửi qua USB/mail).

```bash
sudo su
cd ~
cp <đường dẫn file setup-db.sh> .
chmod +x setup-db.sh
bash setup-db.sh
```

Chờ chạy xong (khoảng 2–5 phút).

## 6. Việc QUAN TRỌNG — ghi lại kết quả

Sau khi script chạy xong, màn hình in ra nhiều thông tin. **Bạn phải chụp ảnh / ghi chép lại**:

| Mục | Ghi chú | Gửi cho ai |
|---|---|---|
| **SERVER_PUB** (public key WireGuard) | Chuỗi ký tự dạng `abc123...` | ✅ **Gửi cho quản lý hệ thống** (không cần bảo mật) |
| Password `newway_app` | Mật khẩu database | 🔒 **Không gửi qua chat** — lưu giấy/bảo mật, báo quản lý qua điện thoại |
| Password `newway_migrate` | Mật khẩu database (khác) | 🔒 Như trên |
| **GPG passphrase** | Dùng khi khôi phục backup | 🔒 Như trên |

> 🔒 **Quy tắc vàng:** 3 mật khẩu trên **không bao giờ gửi qua Zalo/email**. Chỉ giao trực tiếp hoặc gọi điện đọc.

## 7. Mở port trên router (BẮT BUỘC)

Đây là bước dễ quên nhất. Nếu bỏ qua, VPS bên ngoài **không vào được database**.

1. Đăng nhập router (VD `192.168.1.1`).
2. Tìm mục **Port Forwarding** / **Virtual Server** / **NAT**.
3. Thêm 1 quy tắc:
   - **Port:** `51820`
   - **Giao thức:** `UDP`
   - **Địa chỉ đích:** IP của máy server (VD `192.168.1.50`)
4. Lưu lại.

> Nếu công ty dùng IP tĩnh do ISP cấp thì tốt. Nếu mạng dùng CGNAT (không có IP thật) thì báo quản lý hệ thống để xử lý riêng.

## 8. Chờ kết nối từ VPS

- Sau khi VPS bên ngoài cài xong, họ sẽ gửi cho bạn 1 chuỗi public key.
- Bạn mở file cấu hình:
  ```bash
  sudo nano /etc/wireguard/wg0.conf
  ```
- Tìm dòng `PublicKey = <CLIENT_PUB_KEY>` → thay `<CLIENT_PUB_KEY>` bằng public key nhận được.
- Lưu (Ctrl+O, Enter) → thoát (Ctrl+X).
- Khởi động lại đường hầm:
  ```bash
  systemctl restart wg-quick@wg0
  ```

## 9. Kiểm tra hệ thống hoạt động

- Mở điện thoại → trình duyệt → vào `https://domain` (người quản lý gửi).
- Nếu vào được trang đăng nhập → **toàn bộ hệ thống OK**.

## 10. Lưu ý vận hành hàng ngày

- ✅ **Luôn bật máy** 24/7 — không tự tắt, không rút dây mạng/nguồn.
- ✅ Cắm **UPS** (lưu điện) nếu có — phòng mất điện.
- ✅ Kiểm tra đèn nguồn mỗi sáng.
- Backup chạy **tự động 2:00 sáng** mỗi ngày, lưu tại `/backups` (mã hóa).
- Nếu mất điện/mất mạng: hệ thống ngừng hoạt động, khi có lại điện/mạng thì **tự chạy lại trong 1–2 phút** — dữ liệu không mất.

## 11. Khi có sự cố

| Hiện tượng | Xử lý |
|---|---|
| Máy server tắt nguồn | Bật lại, chờ 1–2 phút |
| Mất mạng công ty | Báo quản lý hệ thống |
| Không vào được web | Gọi quản lý hệ thống |
| Cần di chuyển/sửa máy | Báo trước 24h, không tự ý rút điện |

---

*Phiên bản: 1.0 — dành cho member tại công ty*
