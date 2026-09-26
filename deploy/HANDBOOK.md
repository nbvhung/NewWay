# 📘 Hướng dẫn vận hành — Hệ thống New Way

> Tài liệu dành cho người **không chuyên IT**.
> Nếu có sự cố ngoài các mục dưới đây, hãy gọi **0399706485**.

> 🕘 **Bản 2.0 — cập nhật 26/09/2026.** Đã sửa lại theo hệ thống thực tế đang chạy:
> địa chỉ web nay là **`https://newwaytraco.com`** (trước ghi `newway.congty.vn`),
> **toàn bộ dữ liệu nay nằm trên VPS** — **không còn dùng server công ty**, và mục 4 + 5
> được viết lại chi tiết.

---

## 1. Hệ thống gồm những gì?

```
Tài xế / nhân viên (điện thoại, máy tính)
    │
    ▼
[INTERNET — https://newwaytraco.com]
    │
    ▼
VPS AZDIGI (103.221.223.230) — máy chủ thuê ngoài, chạy 24/7
    ├── 🌐 Web (giao diện)      → container newway-frontend-1
    ├── ⚙️ API (xử lý dữ liệu)   → container newway-backend-1
    ├── 🗄️ Database (DỮ LIỆU)   → container newway-postgres-1   ← toàn bộ dữ liệu ở đây
    ├── ⚡ Redis (bộ nhớ đệm)    → container newway-redis-1
    └── 💾 Backup tự động        → thư mục /opt/backups trên VPS
```

- **Chỉ có MỘT máy chủ duy nhất là VPS** (thuê của AZDIGI, đặt tại datacenter). Không còn
  server đặt tại văn phòng công ty.
- **Dữ liệu nằm ngay trên VPS**, trong container `newway-postgres-1`. Nghĩa là web và dữ liệu
  "sống chung" một chỗ: VPS hỏng thì cả hai cùng hỏng → **mục 5 (backup) là phần quan trọng nhất
  của tài liệu này**.
- Quy mô dữ liệu hiện tại (26/09/2026): khoảng **22 tài khoản, 253 kế hoạch, 1.545 bản ghi
  sản lượng, 7.071 container**, dung lượng database ~**15 MB**.
- Địa chỉ web: **https://newwaytraco.com** (và `www.newwaytraco.com`).
- Chứng chỉ bảo mật HTTPS (SSL) do Let's Encrypt cấp, **tự động gia hạn** — không cần làm gì.
  Hết hạn lần tới: **02/12/2026**.

---

## 2. Cách kiểm tra hệ thống đang chạy

**Cách 1 — Dùng điện thoại (nhanh nhất):**
- Mở trình duyệt Safari/Chrome
- Vào địa chỉ: `https://newwaytraco.com`
- Nếu thấy **trang đăng nhập** → hệ thống **đang chạy bình thường**
- Nếu thấy "Site not found" / "Không thể truy cập" → xem **mục 3**

**Cách 2 — Gọi cho tài xế:**
- Nhờ một tài xế thử đăng nhập và nhập số liệu
- Nếu được → OK

**Cách 3 — Nhờ kỹ thuật kiểm tra (khi 2 cách trên không kết luận được):**
- Kỹ thuật sẽ chạy `docker compose ps` trên VPS và phải thấy **đủ 4 container** đều `Up`:
  `newway-frontend-1`, `newway-backend-1`, `newway-postgres-1`, `newway-redis-1`.

---

## 3. Khi nào cần gọi hỗ trợ kỹ thuật?

### 🟢 Trường hợp KHÔNG cần gọi:
- Quên mật khẩu → nhờ admin đặt lại (không tự gọi kỹ thuật)
- Chậm, load lâu → thử F5 refresh, hoặc đợi 1-2 phút
- Lỗi "Mạng không ổn định" → kiểm tra wifi/4G của tài xế
- Không xoá được dữ liệu vì **đòi mật khẩu xoá** → đó là tính năng chống xoá nhầm, mật khẩu
  là **348** (xem mục 4.9)

### 🔴 Trường hợp CẦN gọi ngay:
| Hiện tượng | Nguyên nhân thường | Gọi số |
|---|---|---|
| **Không vào được web** (trắng trang, "Site not found") | Domain hết hạn / SSL lỗi / VPS dừng | 0399706485 |
| **Trang đăng nhập hiện ra nhưng không đăng nhập được** ("Lỗi server") | Database trong VPS không chạy được | 0399706485 |
| **Trang load được, đăng nhập được, nhưng không hiện dữ liệu** | Lỗi phần mềm | 0399706485 |
| **Bot Zalo không trả lời tài xế** | Token bot hết hạn / mất kết nối Zalo | 0399706485 |

---

## 4. Lưu ý về máy chủ & dữ liệu (QUAN TRỌNG)

> ⚠️ **Đây là mục quan trọng nhất.** Đọc kỹ trước khi làm bất cứ điều gì liên quan tới máy chủ.

### 4.1. Dữ liệu của công ty đang nằm ở đâu?

- **Tất cả** dữ liệu (tài khoản, kế hoạch, sản lượng, container, lương, khách hàng, chi phí,
  lịch sử chat Zalo) nằm trong **database trên VPS AZDIGI** — container tên `newway-postgres-1`.
- **Không có bản dữ liệu nào ở văn phòng công ty nữa.** Server công ty (máy ảo VirtualBox) đã
  **ngừng dùng** — xem mục 4.7.
- Ngoài ra còn **1 bản sao lưu** được tải về máy tính của quản lý (xem mục 5).

### 4.2. ✅ NÊN làm

- **Kiểm tra web mỗi sáng** bằng cách mở `https://newwaytraco.com` (30 giây) — xem mục 2.
- **Kiểm tra backup mỗi tuần** một lần — xem mục 5.3 (2 phút).
- **Ghi nhớ ngày hết hạn domain** `newwaytraco.com`: gia hạn trước hạn ít nhất 2 tuần. Domain
  hết hạn = **toàn bộ hệ thống không truy cập được** (dù dữ liệu vẫn còn).
- **Báo trước cho kỹ thuật** khi công ty có thay đổi: đổi nhà mạng internet, đổi người quản lý,
  đổi số điện thoại nhận thông báo.

### 4.3. ❌ KHÔNG được làm (tuyệt đối)

| Việc | Vì sao nguy hiểm |
|---|---|
| **Tự đăng nhập VPS rồi xoá/sửa file trong `/opt/newway`** | Làm hỏng code đang chạy → web sập ngay |
| **Chạy lệnh `docker` tuỳ ý** (nhất là `docker rm`, `docker volume rm`, `docker compose down -v`) | `volume rm`/`down -v` sẽ **XOÁ SẠCH DATABASE** — mất toàn bộ dữ liệu |
| **Xoá thư mục `/opt/backups`** | Mất hết bản sao lưu — không còn gì để khôi phục |
| **Đổi mật khẩu trong file `.env`** (nhất là `DATABASE_PASSWORD`) | Backend không kết nối được database → web sập |
| **Xoá / đổi cấu hình Nginx hoặc chứng chỉ SSL** | Web mất HTTPS, trình duyệt báo "Không bảo mật" |
| **Đổi DNS của domain `newwaytraco.com`** | Web trỏ sai chỗ → không vào được |
| **Nâng cấp/gia hạn VPS bằng cách tạo máy mới rồi xoá máy cũ** | Máy mới **không có dữ liệu** → mất sạch |
| **Cho người lạ quyền truy cập VPS** | Rủi ro mất dữ liệu, bị tống tiền |

> 🔑 **Quy tắc vàng:** *Không chắc thì đừng bấm.* Mọi việc liên quan tới VPS, hãy gọi kỹ thuật
> **0399706485** trước.

### 4.4. Những việc CHỈ kỹ thuật được làm

1. Cập nhật phiên bản phần mềm (deploy code mới)
2. Chạy các thay đổi cấu trúc database (migration)
3. Khôi phục dữ liệu từ backup
4. Đổi cấu hình `.env`, Nginx, SSL, DNS
5. Xoá dữ liệu hàng loạt hoặc xử lý dữ liệu sai

### 4.5. Mất internet ở công ty thì sao?

- **Không ảnh hưởng gì.** Vì VPS nằm ngoài công ty, chỉ cần điện thoại/máy tính của người dùng
  có internet (wifi hoặc 4G) là vào được hệ thống bình thường.
- Chỉ khi **mất internet ở đúng máy đang dùng** thì người đó không vào được — đổi sang 4G là xong.

### 4.6. Nếu VPS gặp sự cố (sập, hỏng, mất dữ liệu)

1. **Gọi kỹ thuật ngay: 0399706485** — càng sớm càng tốt.
2. **Không tự khởi động lại VPS** bằng nút Power/Restart trong panel AZDIGI khi chưa hỏi kỹ thuật.
3. Trong lúc chờ: hệ thống có thể **không dùng được**, nhưng **dữ liệu vẫn còn** trong các bản
   backup (mục 5) → sẽ khôi phục được, mất tối đa dữ liệu của **30 phút** gần nhất.
4. Tuyệt đối không mua VPS mới rồi nhờ người khác cài lại từ đầu — sẽ **mất toàn bộ dữ liệu**.

### 4.7. Server công ty cũ (đã ngừng dùng)

- Trước đây hệ thống dùng 1 máy ảo Ubuntu (VirtualBox) đặt tại văn phòng công ty để chứa database,
  kết nối với VPS qua mạng riêng WireGuard.
- **Nay không dùng nữa.** Database đã chuyển hẳn lên VPS; đường truyền WireGuard tới
  `10.8.0.2` hiện **không còn kết nối**.
- Vì vậy: **không cần bật, không cần bảo trì, không cần quan tâm** tới máy đó nữa. Máy có thể
  tắt hẳn. Tài liệu cũ hướng dẫn cài server công ty (`deploy/GUIDE-MEMBER-CONGTY.md`) **không còn
  áp dụng**.

### 4.8. Mất điện ở công ty thì sao?

- **Không ảnh hưởng** tới hệ thống (VPS thuê ngoài, có điện riêng ở datacenter).
- Chỉ ảnh hưởng tới người đang dùng máy tính ở công ty — dùng điện thoại 4G là vẫn vào được.

### 4.9. Mật khẩu xoá dữ liệu (từ 26/09/2026)

- **Mọi thao tác xoá** trong hệ thống (xoá container, kế hoạch, khách hàng, tài khoản, khoản lương,
  tin nhắn hẹn giờ...) đều hiện popup **yêu cầu nhập mật khẩu xoá**.
- Mật khẩu xoá là: **`348`**
- Mục đích: **chống xoá nhầm**. Mật khẩu **không được ghi nhớ** — mỗi lần xoá phải nhập lại,
  kể cả tài khoản quản trị cao nhất.
- Đây là mật khẩu **nội bộ**, chỉ chia sẻ cho người thực sự có quyền xoá dữ liệu.

---

## 5. Backup dữ liệu

### 5.1. Hệ thống tự backup — 2 lớp

| Lớp | Chạy khi nào | Lưu ở đâu | Giữ bao nhiêu |
|---|---|---|---|
| **Backup 30 phút** (khi dữ liệu có thay đổi) | Mỗi 30 phút, tự kiểm tra — **chỉ tạo file khi có dữ liệu mới** | `/opt/backups/incr/` trên VPS | **96 file gần nhất** (~2 ngày làm việc) |
| **Backup ngày** | **02:00 sáng mỗi ngày** | `/opt/backups/` trên VPS | **7 ngày** — file `newway_YYYYMMDD_020001.dump` |
| **Bản sao về máy quản lý** | Do máy tính của quản lý tự tải về | `D:\NWW\backups\` | **60 ngày** |

- File backup có dạng `newway_20260926_110001.dump` — là **bản dump chuẩn của PostgreSQL**
  (định dạng `custom`), **không mã hoá**. Muốn đọc phải dùng đúng công cụ của PostgreSQL.
- Tổng dung lượng backup trên VPS hiện tại: khoảng **61 MB**.
- Vì backup 30 phút chạy khi có thay đổi, **dữ liệu mất tối đa là 30 phút** trong tình huống xấu nhất.

### 5.2. Kiểm tra backup còn hoạt động không

**Cách 1 — Nhờ kỹ thuật:** kỹ thuật sẽ kiểm tra file backup mới nhất trong `/opt/backups/incr/`
và giờ chạy gần nhất trong `/opt/backups/backup30m.log`.

**Cách 2 — Trên máy tính của quản lý:** mở thư mục `D:\NWW\backups\`
- Thấy các file `.dump` có **ngày gần nhất là hôm nay** → backup đang chạy tốt ✅
- File mới nhất đã **cũ hơn 1 ngày** → gọi kỹ thuật ⚠️

### 5.3. Bao lâu kiểm tra 1 lần?

- **Hàng tuần:** mở `D:\NWW\backups\` xem file mới nhất có phải hôm nay không (30 giây).
- **Hàng tháng:** nhờ kỹ thuật kiểm tra log backup trên VPS và thử khôi phục thử 1 bản ra máy
  riêng để chắc chắn bản backup dùng được.

### 5.4. Khôi phục dữ liệu

Chỉ kỹ thuật làm, theo hướng dẫn trong `deploy/restore-guide.md`.
Nguyên tắc: **khôi phục từ bản backup mới nhất**, làm trên môi trường tạm rồi mới đưa lên hệ thống.

---

## 6. Chi phí vận hành hàng tháng

| Khoản | Số tiền | Ghi chú |
|---|---|---|
| **VPS AZDIGI** (103.221.223.230) | theo hoá đơn AZDIGI | Chạy web + API + database + Redis + backup, 24/7 |
| **Domain `newwaytraco.com`** | gia hạn **mỗi năm 1 lần** | Hết hạn là cả hệ thống không truy cập được — nhớ gia hạn sớm |
| **Chứng chỉ SSL** | **0 ₫** | Let's Encrypt, tự động gia hạn |
| **Bot Zalo** | theo bảng giá Zalo | Xem tại bot.zaloplatforms.com |

---

## 7. Danh sách liên hệ

| Vai trò | Tên | Số điện thoại |
|---|---|---|
| **Hỗ trợ kỹ thuật** | | **0399706485** |
| **Người quản trị hệ thống** | | |
| **Quản lý dữ liệu / kế toán** | | |

---

*Phiên bản: 2.0 — Cập nhật lần cuối: 26/09/2026*
*(Bản 1.0 — 07/2026 — đã lỗi thời: ghi sai địa chỉ web, sai nơi lưu dữ liệu, sai cơ chế backup.)*
