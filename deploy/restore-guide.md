# 🔄 Hướng dẫn Khôi phục Database (Restore)

> Dành cho **kỹ thuật**. Chỉ chạy khi database bị hỏng / mất dữ liệu và cần khôi phục từ backup.
>
> 🕘 **Cập nhật 26/09/2026.** Bản cũ hướng dẫn giải mã file `.sql.gz.gpg` và restore vào server công ty
> bằng role `newway_app` — **cả hai đều không còn tồn tại**. Xem *"Thay đổi so với bản cũ"* ở cuối.

---

## 1. Backup nằm ở đâu, định dạng gì?

| Lớp | Vị trí | Nội dung | Giữ bao nhiêu |
|---|---|---|---|
| **30 phút** (khi có thay đổi) | `/opt/backups/incr/` (trên VPS) | `.dump` | 96 file gần nhất |
| **Ngày** (02:00 sáng) | `/opt/backups/` (trên VPS) | `.dump` | 30 ngày |
| **Bản sao về máy quản lý** | `D:\NWW\backups\` (máy Windows) | `.dump` | 60 ngày |

**Định dạng:** PostgreSQL **custom format** (`pg_dump -Fc`) — file nhị phân, tên dạng
`newway_20260926_110001.dump`.

- ✅ **KHÔNG mã hoá** — không cần GPG, không cần passphrase.
- ✅ **KHÔNG phải file `.sql`** — không mở bằng Notepad, không chạy bằng `psql < file`.
- ✅ Restore bằng công cụ **`pg_restore`**.

> 💡 **Chọn bản nào để khôi phục?** Chọn file **mới nhất** trong `/opt/backups/incr/`
> (mất tối đa 30 phút dữ liệu). Nếu thư mục đó trống hoặc hỏng, dùng file mới nhất trong
> `/opt/backups/` (mất tối đa 1 ngày). Nếu cả VPS hỏng, dùng bản trên `D:\NWW\backups\`.

---

## 2. Yêu cầu

- Đã SSH được vào VPS: `ssh root@103.221.223.230`
- Container `newway-postgres-1` **đang chạy** (`docker compose ps`)
- File backup `.dump` cần khôi phục

> ⚠️ **NGUYÊN TẮC BẮT BUỘC: thử trên database tạm trước, chỉ khi OK mới đưa lên database thật.**
> Restore đè lên database đang chạy sẽ **mất dữ liệu hiện tại**.

---

## 3. Quy trình restore (làm đúng thứ tự)

### Bước 1 — Xác định file backup mới nhất

```bash
ls -lht /opt/backups/incr/*.dump | head -5     # backup 30 phút
ls -lht /opt/backups/*.dump      | head -5     # backup ngày
```

Ghi lại tên file, ví dụ: `/opt/backups/incr/newway_20260926_110001.dump`

### Bước 2 — Kiểm tra file backup có đọc được không

```bash
docker exec -i newway-postgres-1 pg_restore -l \
  < /opt/backups/incr/newway_20260926_110001.dump | head -20
```

- ✅ Ra danh sách bảng (dạng `TABLE public users`) → file tốt, làm tiếp.
- ❌ Báo lỗi `did not find magic string` → **file hỏng**, chọn file khác.

### Bước 3 — Restore thử vào database TẠM

```bash
# Tạo database tạm
docker exec -i newway-postgres-1 psql -U postgres -d postgres \
  -c "DROP DATABASE IF EXISTS newway_restore_test;"
docker exec -i newway-postgres-1 psql -U postgres -d postgres \
  -c "CREATE DATABASE newway_restore_test;"

# Restore vào database tạm
docker exec -i newway-postgres-1 pg_restore \
  -U postgres -d newway_restore_test --no-owner --no-privileges \
  < /opt/backups/incr/newway_20260926_110001.dump
```

> `--no-owner --no-privileges`: bỏ qua chủ sở hữu/quyền trong file dump — cần thiết vì dump được
> tạo bởi `postgres` và khôi phục cũng bằng `postgres`. Bỏ 2 cờ này có thể báo lỗi `role does not exist`.

### Bước 4 — Kiểm tra dữ liệu trong database tạm

```bash
docker exec -i newway-postgres-1 psql -U postgres -d newway_restore_test -c "
SELECT
  (SELECT count(*) FROM users)        AS users,
  (SELECT count(*) FROM shipping_lines) AS plans,
  (SELECT count(*) FROM submissions)  AS submissions;"
```

So sánh với con số kỳ vọng. **26/09/2026 mức tham chiếu:** users ≈ 22, plans ≈ 253, submissions ≈ 1.545.
Nếu số liệu hợp lý → làm tiếp Bước 5. Nếu rỗng hoặc quá ít → **dừng lại**, chọn file backup khác.

### Bước 5 — Đưa lên database thật

> ⚠️ **Từ đây trở đi là ghi đè dữ liệu thật. Chắc chắn rồi mới làm.**
> Nên **tạo 1 bản backup mới ngay trước khi ghi đè** để có đường lùi:
> ```bash
> docker exec newway-postgres-1 pg_dump -U postgres -d newway -Fc \
>   > /opt/backups/newway_before_restore_$(date +%Y%m%d_%H%M%S).dump
> ```

**Cách A — Giữ nguyên database, chỉ khôi phục lại (nhanh, rủi ro hơn):**
```bash
docker exec -i newway-postgres-1 pg_restore \
  -U postgres -d newway --clean --if-exists --no-owner --no-privileges \
  < /opt/backups/incr/newway_20260926_110001.dump
```
`--clean --if-exists` sẽ xoá object cũ rồi tạo lại. Lỗi `does not exist, skipping` là **bình thường**.

**Cách B — Xoá database rồi tạo mới (sạch nhất, khuyến nghị khi DB hỏng nặng):**
```bash
# 1. Dừng backend để không ai ghi vào DB
cd /opt/newway && docker compose stop backend

# 2. Xoá + tạo lại database
docker exec -i newway-postgres-1 psql -U postgres -d postgres \
  -c "DROP DATABASE IF EXISTS newway;"
docker exec -i newway-postgres-1 psql -U postgres -d postgres \
  -c "CREATE DATABASE newway;"

# 3. Restore
docker exec -i newway-postgres-1 pg_restore \
  -U postgres -d newway --no-owner --no-privileges \
  < /opt/backups/incr/newway_20260926_110001.dump

# 4. Chạy lại backend
docker compose start backend
docker compose logs --tail=30 backend
```

### Bước 6 — Kiểm tra hệ thống

```bash
docker compose ps                                    # 4 container Up
curl -I https://newwaytraco.com                      # 200
docker exec -i newway-postgres-1 psql -U postgres -d newway -c "SELECT count(*) FROM submissions;"
```
- Mở web → đăng nhập → xem dữ liệu → phải thấy dữ liệu đã khôi phục.
- Nhờ 1 tài xế thử đăng nhập.

### Bước 7 — Dọn database tạm

```bash
docker exec -i newway-postgres-1 psql -U postgres -d postgres \
  -c "DROP DATABASE IF EXISTS newway_restore_test;"
```

---

## 4. Khôi phục từ bản backup trên máy Windows (`D:\NWW\backups\`)

Khi VPS mất sạch (phải dựng lại từ đầu):

```bash
# 1. Trên máy Windows — tải file cần dùng lên VPS
scp "D:\NWW\backups\newway_20260926_110001.dump" root@103.221.223.230:/opt/backups/restore.dump
```

```bash
# 2. Trên VPS — dựng lại hệ thống theo deploy/GUIDE-VPS-AZDIGI.md (Bước 1→8)
#    (chạy tới khi docker compose up -d --build xong, 4 container Up)

# 3. Restore dữ liệu vào database vừa tạo
docker exec -i newway-postgres-1 psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS newway;"
docker exec -i newway-postgres-1 psql -U postgres -d postgres -c "CREATE DATABASE newway;"
docker exec -i newway-postgres-1 pg_restore -U postgres -d newway --no-owner --no-privileges \
  < /opt/backups/restore.dump

# 4. Kiểm tra
docker exec -i newway-postgres-1 psql -U postgres -d newway -c "SELECT count(*) FROM users;"
docker compose restart backend
```

---

## 5. Lỗi thường gặp

| Lỗi | Nguyên nhân | Xử lý |
|---|---|---|
| `did not find magic string in file header` | File không phải định dạng custom (hoặc hỏng) | Kiểm tra lại file; dùng file `.dump` khác |
| `role "newway_app" does not exist` | File dump cũ còn ghi owner cũ | Thêm `--no-owner --no-privileges` |
| `database "newway" is being accessed by other users` | Backend đang kết nối | `docker compose stop backend` rồi làm lại |
| `permission denied` khi đọc `/opt/backups/incr/...` | Thiếu quyền | Chạy lệnh bằng `root` |
| `command not found: pg_restore` | Chạy ngoài container | Phải chạy qua `docker exec ... newway-postgres-1` |
| Restore xong nhưng web không thấy dữ liệu | Backend còn cache / chưa restart | `docker compose restart backend` |
| Số liệu khôi phục ít hơn mong đợi | Chọn sai file backup | Thử file mới hơn trong `/opt/backups/incr/` |

---

## 6. Thay đổi so với bản cũ (đã lỗi thời)

| Bản cũ ghi | Thực tế (đã sửa) |
|---|---|
| File backup `.sql.gz.gpg`, phải `gpg --decrypt` | File `.dump` **custom format, không mã hoá** |
| Backup ở `/backups` trên **server công ty** | Backup ở `/opt/backups/` (+ `/opt/backups/incr/`) **trên VPS** |
| Restore bằng `psql -U newway_app -d newway < restore.sql` | Restore bằng **`pg_restore`** vào container **`newway-postgres-1`**, user **`postgres`** |
| Có `GPG_PASS` | **Không còn** — không cần passphrase |
| "Chỉ chạy khi server công ty hỏng" | Server công ty **đã ngừng dùng** — nay chỉ có VPS |

---

*Phiên bản 2.0 — 26/09/2026 · VPS AZDIGI 103.221.223.230 · DB: container `newway-postgres-1`, user `postgres`*
