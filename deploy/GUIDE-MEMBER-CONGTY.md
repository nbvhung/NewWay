# 🖥️ HƯỚNG DẪN TỪNG BƯỚC — Setup DB trên Server công ty (Windows + VirtualBox)

> Dành cho **người thao tác qua UltraVNC** trên máy server công ty.
> **Phương án:** Giữ nguyên Windows → cài **Ubuntu Server trong VirtualBox** → chạy database trong máy ảo.
> Windows của bạn vẫn dùng bình thường, không cài lại gì cả.

---

## TÓM TẮT

| Bước | Nội dung | Kiểm tra xong khi |
|---|---|---|
| 1 | Kiểm tra máy có hỗ trợ ảo hóa | "Virtualization: Enabled" |
| 2 | Tải VirtualBox + Ubuntu ISO | 2 file có sẵn trên máy |
| 3 | Cài VirtualBox | Mở được chương trình |
| 4 | Tạo máy ảo Ubuntu | VM xuất hiện trong danh sách |
| 5 | Cài Ubuntu vào máy ảo | Vào được màn hình đăng nhập |
| 6 | Bật "Autostart" + tắt sleep | Máy ảo tự chạy khi máy bật |
| 7 | Chạy script cài đặt DB | "DB Server setup complete!" |
| 8 | Ghi lại thông tin quan trọng | Đã ghi giấy + báo quản lý |
| 9 | Mở port 51820 trên router | Quy tắc xuất hiện trong router |

---

## BƯỚC 1 — Kiểm tra máy có hỗ trợ ảo hóa

**Trên máy server công ty (qua UltraVNC):**

1. Nhấn `Windows + R` → gõ `msinfo32` → Enter.
2. Tìm dòng **"Virtualization"** (Ảo hóa):
   - `Enabled` (Bật) → ✅ làm tiếp Bước 2.
   - `Disabled` (Tắt) → phải bật trong BIOS: khởi động lại máy, nhấn `Del`/`F2` khi máy khởi động → tìm **Intel VT-x** / **AMD-V** / **SVM** → set **Enabled** → lưu (F10) → khởi động lại.

> Cũng nên kiểm tra RAM: `Windows+R` → `dxdiag` → xem dòng Memory. Cần tối thiểu **4GB** (2GB cho máy ảo).

---

## BƯỚC 2 — Tải phần mềm cần thiết

Trên máy server công ty, mở trình duyệt (Chrome/Edge) tải **2 file**:

1. **VirtualBox**: vào `https://www.virtualbox.org/wiki/Downloads` → tải **"Windows hosts"** (file `.exe`, ~110MB).
2. **Ubuntu Server**: vào `https://releases.ubuntu.com/22.04/` → tải file `ubuntu-22.04.x-live-server-amd64.iso` (~2GB).

**✅ Xong khi:** Có 2 file trong thư mục Downloads.

---

## BƯỚC 3 — Cài VirtualBox

1. Mở file `.exe` vừa tải.
2. Bấm **Next** → **Next** → **Next** → khi hỏi "Warning Network Interfaces" → **Yes** → **Install**.
3. Chờ cài xong → **Finish** (VirtualBox tự mở).

**✅ Xong khi:** Cửa sổ VirtualBox hiện ra với thanh menu.

---

## BƯỚC 4 — Tạo máy ảo Ubuntu

1. Trong VirtualBox: bấm **New** (biểu tượng dấu +).
2. Điền:
   - **Name:** `newway-db`
   - **Folder:** để mặc định
   - **ISO Image:** bấm folder → chọn file `.iso` Ubuntu vừa tải
3. Bấm **Next**.
4. **Username + Password**: đặt tên và mật khẩu (VD user `newway`, mật khẩu tự đặt) → **Next**. (Đây là tài khoản login Ubuntu — nhớ kỹ.)
5. **Unattended install**: để mặc định → **Next**.
6. **Hardware:**
   - **Base Memory:** kéo tối thiểu **2048 MB** (nếu máy có >8GB RAM thì đặt 4096)
   - **Processors:** 2 (nếu có)
   → **Next**.
7. **Virtual hard disk:** chọn **Create** → size để mặc định 25GB → **Next** → **Finish**.

**✅ Xong khi:** Trong danh sách VirtualBox có máy `newway-db`.

---

## BƯỚC 5 — Cài Ubuntu vào máy ảo

1. Chọn máy `newway-db` → bấm **Start**.
2. Một cửa sổ mới mở ra, Ubuntu chạy cài đặt. Làm theo:
   - Chọn **English** → **Install Ubuntu Server**
   - Cứ bấm **Done** cho các bước mặc định (network DHCP, mirror, storage…)
   - Khi hỏi **"Install OpenSSH server"** → bấm **Space** để chọn ✓ → **Done** (để sau này SSH vào máy ảo được)
   - **"Featured Server Snaps"** → bỏ trống → **Done**
   - Màn hình **Profile setup**: đặt username + password (giống Bước 4) → **Done**
   - Chờ cài xong → **Reboot Now**
3. Máy ảo khởi động lại → hiện màn hình login Ubuntu (màu đen).

**✅ Xong khi:** Cửa sổ Ubuntu hiện dòng login `newway-db login:`. Đăng nhập bằng username + password Bước 4.

---

## BƯỚC 6 — Lấy IP máy ảo

Trong cửa sổ Ubuntu (đã đăng nhập), gõ:
```bash
ip addr show | grep "inet 192"
```
- Kết quả VD: `inet 192.168.1.60/24`
- **Ghi lại IP** (VD `192.168.1.60`).

> ⚠️ Mặc định VirtualBox dùng chế độ NAT → IP máy ảo **khác dải** IP công ty, VPS bên ngoài không vào được. **Bắt buộc chuyển sang "Bridged":**

1. Tắt máy ảo: trong cửa sổ Ubuntu gõ `sudo shutdown now`.
2. Trong VirtualBox: chọn máy `newway-db` → **Settings** → **Network**.
3. **Attached to:** đổi từ **NAT** → **Bridged Adapter**.
4. **Name:** chọn card mạng của máy (VD `Realtek...` hoặc `Intel...` — chọn cái đang kết nối mạng).
5. **OK** → **Start** máy ảo lại → đăng nhập → chạy lại lệnh `ip addr show` → giờ phải ra IP dạng `192.168.1.x`.

**✅ Xong khi:** IP máy ảo nằm trong dải `192.168.1.x` (cùng mạng công ty).

---

## BƯỚC 7 — Bật Auto-start + tắt Sleep (QUAN TRỌNG)

Máy ảo phải **chạy 24/7** cùng máy server. Làm trên máy **Windows** (không phải trong Ubuntu):

**7.1. Tắt chế độ ngủ của Windows:**
- `Windows + R` → gõ `powercfg.cpl` → Enter.
- Chọn **Change plan settings** → **Change advanced power settings** → **Sleep** → **Sleep after** → đặt **Never** → **OK**.

**7.2. VirtualBox tự chạy máy ảo khi bật máy:**
- Tạo 1 file trên Desktop: chuột phải → **New → Text Document** → đặt tên `start-vm.bat`.
- Mở file đó bằng Notepad → dán dòng:
  ```bat
  "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" startvm newway-db --type headless
  ```
  (Nếu cài VirtualBox ở nơi khác, đổi đường dẫn cho đúng.)
- Lưu lại.
- Mở **Task Scheduler** (`Windows + R` → `taskschd.msc` → Enter):
  - **Create Task** → **General:** tên `StartNewWayVM`, đánh dấu ✓ *Run whether user is logged on or not*.
  - Tab **Triggers** → **New** → chọn *At startup* → OK.
  - Tab **Actions** → **New** → *Start a program* → **Program/script:** chọn file `start-vm.bat` → OK.
  - **OK** → nhập password Windows khi được hỏi.

**✅ Xong khi:** Khởi động lại máy Windows, đợi 2 phút, Ubuntu tự chạy (kiểm tra: mở VirtualBox thấy `newway-db` đang "Running").

---

## BƯỚC 8 — Chạy script cài đặt DB

**8.1.** Người quản lý gửi file `setup-db.sh` → chép file đó vào **Windows** (VD Desktop).

**8.2.** Chia sẻ file vào máy ảo (2 cách, chọn 1):
- **Cách nhanh:** mở cửa sổ Ubuntu → menu **Devices** (trên thanh cửa sổ VirtualBox) → **Shared Folders** → **Shared Folders Settings** → thêm thư mục Desktop của Windows. Trong Ubuntu: `sudo mkdir -p /mnt/share && sudo mount -t vboxsf <tên-thu-mục> /mnt/share`.
- Hoặc copy file qua USB/SFTP nếu quen.

**8.3.** Trong Ubuntu, chạy:
```bash
sudo su
cp /mnt/share/setup-db.sh ~/
chmod +x setup-db.sh
bash setup-db.sh
```
- Chờ 2–5 phút → màn hình in **"✅ DB Server setup complete!"**.

**✅ Xong khi:** Hiện dòng `DB Server setup complete!`.

---

## BƯỚC 9 — Ghi lại thông tin QUAN TRỌNG

Chụp ảnh màn hình cuối. Sau đó:

| Mục | Gửi cho ai |
|---|---|
| **SERVER_PUB** (public key WireGuard) | ✅ Chụp & gửi quản lý hệ thống (KHÔNG cần bảo mật) |
| **App pass** (`newway_app`) | 🔒 Ghi giấy + **gọi điện** báo quản lý |
| **Migrate pass** (`newway_migrate`) | 🔒 Như trên |
| **GPG passphrase** | 🔒 Như trên |

> 🔒 3 mật khẩu không gửi qua Zalo/email — chỉ gọi điện hoặc giao trực tiếp.

---

## BƯỚC 10 — Mở port trên router (BẮT BUỘC)

1. Mở trình duyệt → gõ `192.168.1.1` → đăng nhập router (mật khẩu in trên tem).
2. Tìm **Port Forwarding** / **Virtual Server** / **NAT**.
3. Thêm quy tắc:
```
Tên:      newway-wg
Port:     51820
Protocol: UDP
Địa chỉ:  192.168.1.60   ← (IP máy ảo, Bước 6)
```
4. **Save/Apply**.

**✅ Xong khi:** Quy tắc `51820 UDP → 192.168.1.60` xuất hiện trong router.

---

## BƯỚC 11 — Chờ kết nối từ VPS

1. Quản lý sẽ gửi cho bạn chuỗi `CLIENT_PUB` (từ VPS).
2. Trong Ubuntu:
   ```bash
   sudo nano /etc/wireguard/wg0.conf
   ```
3. Tìm `PublicKey = <CLIENT_PUB_KEY>` → dán chuỗi nhận được vào đúng chỗ → `Ctrl+O` → `Enter` → `Ctrl+X`.
4. `systemctl restart wg-quick@wg0`

**✅ Xong khi:** Không báo lỗi.

---

## KIỂM TRA TỔNG (sau khi quản lý cài xong VPS)

Trong Ubuntu:
```bash
systemctl status wg-quick@wg0    # phải "active"
systemctl status postgresql      # phải "active"
```
Trên điện thoại: mở web do quản lý gửi → thấy **trang đăng nhập** = 🎉 hệ thống hoạt động.

---

## LƯU Ý VẬN HÀNH

- ✅ Máy Windows **không tắt, không ngủ**; máy ảo tự chạy khi bật máy.
- ✅ Cắm UPS nếu có.
- ✅ Mỗi sáng nhìn đèn nguồn máy.
- Backup DB **tự động 2:00 sáng** → lưu tại `/backups` (mã hóa).
- Nếu mất điện: khi có lại, Windows tự bật → máy ảo tự chạy → hệ thống chạy lại trong 1–2 phút.

---

## SỰ CỐ THƯỜNG GẶP

| Hiện tượng | Xử lý |
|---|---|
| Máy ảo không tự chạy khi bật máy | Mở Task Scheduler, kiểm tra task "StartNewWayVM" |
| VPS không vào được DB | Kiểm tra Bước 10 (port router) + Bước 11 (public key) |
| Máy bị ngủ, hệ thống chậm | Kiểm tra lại "Sleep after = Never" |
| Quên mật khẩu Ubuntu | Gọi quản lý hệ thống |

---

*Phiên bản: 1.1 — Windows + VirtualBox (08/2026)*
