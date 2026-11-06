# HƯỚNG DẪN ĐỐI CHIẾU SẢN LƯỢNG THÁNG VỚI FILE BẢNG KÊ KHÁCH HÀNG

> **Mục đích:** kiểm tra file bảng kê gửi khách (Excel) có khớp với dữ liệu VPS (container đã claim) hay không, theo từng khách hàng / tuyến / mã container / loại container.
>
> **Đây là số liệu chốt với khách — không được tự ý sửa số, không được bỏ qua cảnh báo.**
>
> Phiên bản tài liệu: 06/11/2026. Dump đối chiếu gần nhất: `newway_check (1).dump`.

---

## 0. PHẠM VI VÀ NGUYÊN TẮC

1. Chỉ đọc dữ liệu, **không sửa database VPS**.
2. Dump được restore vào database tạm trên máy local (`newway_check`), không ảnh hưởng production.
3. Đối tượng so sánh:
   - **VPS**: các container đã claim (`container_imports.submission_id IS NOT NULL`) của khách hàng trong tháng.
   - **FILE**: các sheet tàu + sheet `TỔNG` của file bảng kê khách hàng.
4. Chỉ kiểm tra container thuộc xe công ty. Các dòng xe ngoài trong file (VENDOR = `KĐ`, `TV`, `RRS`, `HDN`, `NOBI`…) được đưa vào trạng thái `VPS CHƯA CLAIM` nếu VPS có container nhưng chưa claim; **không** tính là thiếu/thừa cont.
5. **KÉO VỀ (KV)** và **KD2** là các lượt phát sinh thêm: vẫn tính là thêm cont nhưng **tách riêng** thành `THÊM: KÉO VỀ` / `THÊM: KD2`, không trộn vào số cont chính.
6. **MEDLOG** (route `TV-MEDLOG MP`) tạm để trạng thái `MEDLOG: CHỜ FILE`, chưa kiểm tra (theo yêu cầu).
7. `QUỸ CHUNG` không phải xe thật. Nếu VPS còn claim gắn QUỸ CHUNG thì vẫn tính theo VPS; nếu file bỏ cont đó thì là `THIẾU: FILE` (trừ khi người dùng chủ động loại QUỸ CHUNG khỏi phạm vi).

---

## 1. BỘ FILE CẦN MANG SANG MÁY CÔNG TY

Copy **nguyên thư mục** `docs/doi-chieu-bang-ke/`, gồm:

| File | Vai trò |
|---|---|
| `HUONG-DAN-DOI-CHIEU.md` | Tài liệu này |
| `reconcile.py` | Script đối chiếu + xuất Excel (bắt buộc dùng đúng file này, **không chép tay code từ tài liệu**) |
| `requirements.txt` | Thư viện Python cần cài |

Ngoài ra cần mang theo:

- File dump mới nhất từ VPS (ví dụ `newway_check (1).dump`).
- Các file bảng kê Excel của khách hàng trong tháng (ví dụ 3 file `Sản lượng VC T10.2026 HPH-NW lần 1/2/3 (...).xlsx`).

> **Tuyệt đối không sửa tay file `reconcile.py` bằng PowerShell `Get-Content ... | Set-Content`** — PowerShell 5.1 sẽ làm hỏng dấu tiếng Việt. Nếu cần sửa, dùng VS Code / opencode và lưu UTF-8.

---

## 2. CHUẨN BỊ MÔI TRƯỜNG

### 2.1. Phần mềm

- Windows 10/11.
- PostgreSQL local (bản 18 hoặc mới hơn) đang chạy, có `psql.exe`, `pg_restore.exe`.
  - Đường dẫn mặc định: `C:\Program Files\PostgreSQL\18\bin\`.
- Python 3.10+ (khuyến nghị 3.12/3.13/3.14).
- Node.js không cần cho bước này.

### 2.2. Cài thư viện Python

Mở PowerShell:

```powershell
python -m pip install -r "D:\NWW\NewWay\docs\doi-chieu-bang-ke\requirements.txt"
```

Kiểm tra:

```powershell
python -c "import psycopg2, openpyxl; print('OK')"
```

### 2.3. Biến môi trường chống lỗi tiếng Việt

Trước **mọi** lần chạy Python, chạy:

```powershell
$env:PYTHONIOENCODING="utf-8"
$env:PYTHONUTF8="1"
```

Nếu không đặt, có thể gặp `UnicodeEncodeError` hoặc dấu tiếng Việt bị lỗi.

---

## 3. LẤY DUMP TỪ VPS

### 3.1. SSH vào VPS

```bash
ssh root@103.221.223.230
```

### 3.2. Tạo dump

Cách an toàn nhất (dump toàn bộ DB, file nằm trên host VPS):

```bash
cd /opt/newway
docker exec newway-postgres-1 pg_dump -U postgres -d newway -Fc > /opt/newway/newway_check.dump
ls -lh /opt/newway/newway_check.dump
```

Nếu muốn dump gọn một số bảng:

```bash
docker exec newway-postgres-1 pg_dump -U postgres -d newway \
  -t users -t vehicles -t shipping_lines -t routes \
  -t container_imports -t container_claims -t submissions \
  -t customers -t customer_prices -t customer_surcharges \
  -t driver_vehicle_assignments -t plan_vehicle_overrides \
  --no-owner --no-privileges -Fc > /opt/newway/newway_check.dump
```

> Khuyến nghị dump **toàn bộ** để không thiếu bảng khi đối chiếu về sau.

### 3.3. Copy về Windows

Chạy trên máy Windows (nhập mật khẩu SSH khi được hỏi):

```powershell
scp root@103.221.223.230:/opt/newway/newway_check.dump "C:\Users\<TÊN_MÁY>\Downloads\newway_check.dump"
```

Đặt tên có ngày để tránh lẫn:

```powershell
scp root@103.221.223.230:/opt/newway/newway_check.dump "C:\Users\<TÊN_MÁY>\Downloads\newway_check_20261106.dump"
```

---

## 4. RESTORE DUMP VÀO DATABASE TẠM

> Chỉ làm trên máy local. Không chạy lệnh `DROP DATABASE` trên VPS.

Mở PowerShell, đặt mật khẩu PostgreSQL local (ví dụ `123456`):

```powershell
$env:PGPASSWORD="123456"
$psql="C:\Program Files\PostgreSQL\18\bin\psql.exe"
$pr="C:\Program Files\PostgreSQL\18\bin\pg_restore.exe"
```

Xoá/tạo lại DB tạm:

```powershell
& $psql -h localhost -U postgres -d postgres -c "DROP DATABASE IF EXISTS newway_check WITH (FORCE);"
& $psql -h localhost -U postgres -d postgres -c "CREATE DATABASE newway_check;"
```

Restore:

```powershell
& $pr -h localhost -U postgres -d newway_check --no-owner --no-privileges "C:\Users\<TÊN_MÁY>\Downloads\newway_check.dump"
```

Kiểm tra nhanh:

```powershell
& $psql -h localhost -U postgres -d newway_check -c "select count(*) from container_imports;"
& $psql -h localhost -U postgres -d newway_check -c "select count(*) from container_claims;"
& $psql -h localhost -U postgres -d newway_check -c "select count(*) from shipping_lines;"
```

Nếu báo `database "newway_check" does not exist` ở bước DROP: bỏ qua, đó là thông báo bình thường.

---

## 5. CẤU HÌNH SCRIPT

Mở `docs/doi-chieu-bang-ke/reconcile.py`, sửa **duy nhất** phần đầu:

```python
DB = dict(host='localhost', port=5432, dbname='newway_check', user='postgres', password='123456')
MONTH, YEAR = 10, 2026

CUSTOMER_FILES = {
    2: [os.path.expanduser('~/Downloads/*T10.2026 HPH-NW*.xlsx')],
    # Khách khác: thêm ID + glob file bảng kê của khách đó
}

OUTPUT = os.path.expanduser('~/Downloads/HPH_T10_kiem_tra_cont_theo_tuyen.xlsx')
```

Giải thích:

| Biến | Ý nghĩa |
|---|---|
| `DB` | Thông tin database tạm local vừa restore |
| `MONTH`, `YEAR` | Tháng/năm cần đối chiếu |
| `CUSTOMER_FILES` | Map `customer_id` → danh sách glob file bảng kê của khách đó |
| `OUTPUT` | Đường dẫn file Excel kết quả |
| `EXTRA_CLAIMS` | Các claim được tách thành "thêm cont": mặc định `KV`, `KD2` |
| `SHORT` | Tên sheet ngắn cho khách hàng |

### 5.1. Cách biết `customer_id`

```sql
select id, name from customers order by id;
```

### 5.2. Thêm khách hàng khác

Ví dụ có file bảng kê HE CHUN tháng 10/2026:

```python
CUSTOMER_FILES = {
    2: [os.path.expanduser('~/Downloads/*T10.2026 HPH-NW*.xlsx')],
    1: [os.path.expanduser('~/Downloads/*T10.2026 HE-CHUN*.xlsx')],
}
```

- Khách **không** có trong `CUSTOMER_FILES` sẽ được xuất dữ liệu VPS với trạng thái `CHƯA CÓ FILE`.
- File bảng kê của khách khác phải cùng cấu trúc template: sheet tàu + `TỔNG` + `QT` + `số xe` + `PPNL`.
- Nếu khách dùng mẫu khác, phải viết parser riêng; **không tự động áp template HPH cho khách khác khi chưa kiểm tra**.

### 5.3. Đổi tháng

Ví dụ tháng 11/2026:

```python
MONTH, YEAR = 11, 2026
CUSTOMER_FILES = {
    2: [os.path.expanduser('~/Downloads/*T11.2026 HPH-NW*.xlsx')],
}
OUTPUT = os.path.expanduser('~/Downloads/HPH_T11_kiem_tra_cont_theo_tuyen.xlsx')
```

Phải đổi cả glob file và tên output để không ghi đè tháng cũ.

---

## 6. CHẠY ĐỐI CHIẾU

```powershell
$env:PYTHONIOENCODING="utf-8"
$env:PYTHONUTF8="1"
python "D:\NWW\NewWay\docs\doi-chieu-bang-ke\reconcile.py"
```

Kết quả in ra dạng:

```
Saved C:\Users\...\Downloads\HPH_T10_kiem_tra_cont_theo_tuyen.xlsx
CÔNG TY ... HPH LOGISTICS 3201 {'THIẾU: FILE': 765, 'OK': 1579, ...}
...
```

Mở file Excel vừa tạo.

---

## 7. CẤU TRÚC FILE KẾT QUẢ

File Excel gồm:

1. **`TONG HOP`**: tổng theo khách hàng + bảng chú thích trạng thái.
2. **`TONG HOP TUYEN`**: tổng theo từng tuyến của từng khách.
3. **Mỗi khách hàng 1 sheet** (ví dụ `HPH`, `HE CHUN`, `CIMC`, `WAN HAI`…).

Cột trong sheet khách hàng:

| Cột | Nội dung |
|---|---|
| A | Tuyến đường (theo VPS) |
| B | Mã kế hoạch (`shipping_lines.id`) |
| C | Tên kế hoạch |
| D | Ngày kế hoạch |
| E | Mã container |
| F | Loại VPS (H20/H40/V20/V40/V20FR/V40FR) |
| G | Loại trên file (20F/40F/20E/40E hoặc rỗng với bó FR) |
| H | Xe thực chạy (theo VPS) |
| I | Trạng thái |
| J | Ghi chú |

Màu trạng thái:

- Đỏ nhạt: `THIẾU: FILE`
- Vàng nhạt: `THIẾU: VPS`
- Cam: `SAI LOẠI`
- Xanh dương nhạt: `THÊM: KÉO VỀ`
- Xanh lá nhạt: `THÊM: KD2` / `OK`
- Xám: `VPS CHƯA CLAIM`
- Tím nhạt: `MEDLOG: CHỜ FILE`
- Vàng: `CHƯA CÓ FILE`

---

## 8. QUY TẮC DỮ LIỆU VÀ NGHIỆP VỤ (BẮT BUỘC HIỂU ĐÚNG)

### 8.1. Bảng dữ liệu chính

| Bảng | Cột quan trọng | Ý nghĩa |
|---|---|---|
| `shipping_lines` | `id`, `name`, `ngay`, `route_name`, `customer_id`, `dealed_prices` | Kế hoạch chuyến; `dealed_prices` là đơn giá chốt theo loại cont (JSONB) |
| `container_imports` | `container_code`, `type`, `shipping_line_id`, `submission_id`, `bundle_id`, `vehicle_id` | Container trong kế hoạch; `submission_id IS NOT NULL` = đã có lái xe claim |
| `container_claims` | `container_import_id`, `claim_type`, `submission_id` | Lượt claim: `CLAIM`, `CLAMP`, `KV`, `KD2`, `CLASSIFY`, `REGO`… |
| `submissions` | `actual_vehicle_id`, `user_id` | Phiếu ghi nhận của lái xe |
| `users` | `home_vehicle_id` | Xe hiện tại của lái xe |
| `vehicles` | `id`, `so_xe` | Danh mục xe thật |
| `customer_surcharges` | `value`, `plan_ids`, `calc_type` | Phụ phí (tháng 10/2026 = 10%) |

### 8.2. Số cont trên dashboard

- Dashboard đếm **container đã claim** (`submission_id IS NOT NULL`).
- Không phải số dòng claim. Ví dụ 1 container có 2 claim (CLAIM + KV) vẫn là 1 cont.
- Do đó khi so với dashboard phải dùng `count(container_imports)` có `submission_id IS NOT NULL`.

SQL kiểm tra:

```sql
select count(*) as claimed
from container_imports ci
join shipping_lines sl on sl.id = ci.shipping_line_id
where sl.customer_id = 2
  and sl.route_name = 'HPH-GREENPORT'
  and sl.ngay between '2026-10-01' and '2026-10-31'
  and ci.submission_id is not null;
```

### 8.3. Map loại container giữa VPS và file

| VPS `type` | Cột trên file |
|---|---|
| `H20` | `20F` (20'F) |
| `H40` | `40F` (40'F) |
| `V20` | `20E` (20'E) |
| `V40` | `40E` (40'E) |
| `V20FR` | `20E` (dòng đầu bó/lẻ); các thành viên còn lại của bó để trống |
| `V40FR` | `40E` (dòng đầu bó/lẻ); các thành viên còn lại của bó để trống |

Quy tắc FR:

- **Bó FR** (cùng `bundle_id`, cùng kế hoạch, ≥ 2 container): cả bó chỉ tính **1 lượt giá**. Trên file: dòng đầu mang loại + giá, các dòng sau để trống loại/giá.
- **FR lẻ** (không có `bundle_id`): tính như vỏ thường (`V20FR` → giá `V20`, `V40FR` → giá `V40`).
- Khi kiểm tra loại, script chấp nhận `V20FR`/`V40FR` có cột file là `20E`/`40E` hoặc rỗng (nếu là thành viên bó).

### 8.4. Kẹp

- Cặp kẹp được đánh dấu bởi claim `CLAMP`.
- Chỉ tính giá kẹp (`KV20`/`KV20FR`) khi kế hoạch có đơn giá kẹp và 2 container cùng loại.
- Trên file, cặp kẹp có thể hiển thị thành nhóm `20'E Kẹp`/`40'E Kẹp` hoặc 2 dòng liền nhau.

### 8.5. Kéo về (KV) và KD2

- `KV` = lượt kéo về; `KD2` = lượt KD2.
- **Vẫn là lượt thật, có doanh thu**, nhưng khi đối chiếu số cont phải **tách riêng**.
- Script đưa thành 2 trạng thái:
  - `THÊM: KÉO VỀ`
  - `THÊM: KD2`
- Nếu file có dòng thứ 2 cho cùng mã cont → ghi chú `có trong file`.
- Nếu file thiếu dòng đó → ghi chú `KHÔNG có trong file`.
- `CLASSIFY` và `CLAMP` **không** tách thành "thêm cont".

### 8.6. Xe ngoài

- Dòng file có `VENDOR` khác `NW` là xe ngoài.
- VPS vẫn có container đó (thường `submission_id IS NULL`) → trạng thái `VPS CHƯA CLAIM`.
- Không tính là `THIẾU: VPS`.
- Chỉ khi **VPS hoàn toàn không có mã cont đó** mới là `THIẾU: VPS`.

### 8.7. QUỸ CHUNG

- `vehicles.so_xe = 'QUỸ CHUNG'` (id 22) không phải xe thật.
- Nếu VPS còn claim gắn QUỸ CHUNG: cont vẫn là cont đã claim; nếu file bỏ → `THIẾU: FILE`.
- Nếu người dùng đã bỏ claim QUỸ CHUNG: cont thành `submission_id NULL`; file còn dòng → `VPS CHƯA CLAIM`.

### 8.8. MEDLOG

- Route `TV-MEDLOG MP` chưa kiểm tra.
- Script đưa trạng thái `MEDLOG: CHỜ FILE`.
- Không cộng vào `THIẾU: FILE`.

### 8.9. Đơn giá và phụ phí

- Giá trên `QT` = `dealed_prices[loại cont] × (1 + phụ phí%)`.
- Tháng 10/2026: phụ phí = **10%** (theo `customer_surcharges`).
- Sheet `PPNL` trong file có thể ghi 8% (nội dung mẫu cũ) — **không dùng PPNL để tính**, chỉ dùng để tham khảo. Nếu khách thắc mắc, giải thích theo bảng phụ phí thực tế trong hệ thống.
- VAT = 8%.

---

## 9. THUẬT TOÁN ĐỐI CHIẾU (CHI TIẾT)

### 9.1. Xác định VPS

- Lấy tất cả `container_imports` thuộc các `shipping_lines` của khách hàng trong khoảng `ngay` của tháng.
- Container "đã claim" = `submission_id IS NOT NULL`.
- Claim lấy từ `container_claims` theo `container_import_id`.

### 9.2. Đọc file

- Bỏ qua các sheet `QT`, `số xe`, `PPNL`.
- `TỔNG` là sheet tổng.
- Các sheet còn lại là sheet tàu.
- Dữ liệu bắt đầu từ **dòng 5**; dòng 4 là header; dòng 3 là tổng 20/40; dòng 1-2 là tiêu đề.
- Cột:
  - B: số container
  - C: ngày
  - D/E/F/G: 20F/40F/20E/40E
  - H: tuyến đường
  - I: tàu
  - J: xe
  - K: vendor (`NW`, `KĐ`, `TV`, `RRS`, `HDN`, `NOBI`…)

### 9.3. Map sheet tàu → kế hoạch

- Với mỗi sheet, đếm số mã container trùng với từng kế hoạch của khách trong tháng.
- Chọn kế hoạch có số trùng nhiều nhất.
- Đây là cách tránh phụ thuộc tên sheet/tên tàu (tên trên file có thể khác `shipping_lines.name`).

### 9.4. Khớp container

- Nếu kế hoạch **có sheet tàu**: chỉ tìm mã cont trong đúng sheet đó.
- Nếu kế hoạch **không có sheet tàu**: tìm trong sheet `TỔNG` theo mã cont + ngày lệch tối đa **±3 ngày**.
- Không khớp toàn cục theo mã cont, vì một mã có thể xuất hiện ở 2 kế hoạch khác ngày.
  - Ví dụ thực tế: `SKHU9950435` có ở DONGJIN 13/10 và KOBE 15/10; `SRLU1000779` có ở CHUYỂN BÃI 14/10 và KOBE 15/10.
  - Nếu khớp toàn cục sẽ bỏ sót cont thiếu ở kế hoạch này vì tìm thấy ở kế hoạch khác.
- Ngày trên file có thể lệch ngày kế hoạch ±1-3 ngày (ví dụ kế hoạch 09/10 nhưng dòng ghi 10/10); vì vậy dùng ±3.

### 9.5. Xác định trạng thái

Với mỗi container đã claim của VPS:

1. Tìm dòng file khớp mã + đúng kế hoạch.
2. Không có dòng nào → `THIẾU: FILE`.
3. Có dòng nhưng loại file không khớp loại VPS (theo bảng map + quy tắc bó FR) → `SAI LOẠI`.
4. Khớp → `OK`.

Với mỗi claim `KV` / `KD2` của container:

- Thêm 1 dòng trạng thái `THÊM: KÉO VỀ` / `THÊM: KD2`.
- Ghi chú `có trong file` nếu file có > 1 dòng cho cùng mã cont trong cùng kế hoạch; ngược lại `KHÔNG có trong file`.

Với mỗi dòng file:

1. Nếu mã cont **không có** trong `container_imports` của đúng kế hoạch → `THIẾU: VPS`.
2. Nếu có nhưng `submission_id IS NULL` → `VPS CHƯA CLAIM`.
3. Nếu có và đã claim → đã được xử lý ở bước VPS, không thêm dòng trùng.

### 9.6. Sắp xếp

Sắp theo: tuyến → ngày → mã kế hoạch → trạng thái → mã cont.

---

## 10. Ý NGHĨA TRẠNG THÁI (ĐỌC KỸ)

| Trạng thái | Nghĩa chính xác |
|---|---|
| `OK` | VPS có, file có, mã + loại khớp |
| `THIẾU: FILE` | **VPS có, file không có** (file đang thiếu cont này) |
| `THIẾU: VPS` | **File có, VPS không có** (file có cont mà VPS hoàn toàn không có) |
| `SAI LOẠI` | Có cả hai nhưng loại cont khác nhau |
| `THÊM: KÉO VỀ` | Lượt kéo về (KV), tính thêm cont, để riêng |
| `THÊM: KD2` | Lượt KD2, tính thêm cont, để riêng |
| `VPS CHƯA CLAIM` | File có, VPS có container nhưng chưa gán lái xe/claim (thường là xe ngoài) |
| `MEDLOG: CHỜ FILE` | Tuyến MEDLOG chưa kiểm tra |
| `CHƯA CÓ FILE` | Khách hàng chưa có file bảng kê để đối chiếu |

> Câu ghi nhớ:
> - `THIẾU: FILE` = "VPS có, file thiếu".
> - `THIẾU: VPS` = "file có, VPS thiếu".

---

## 11. BASELINE KIỂM TRA (DUMP `newway_check (1).dump`, 06/11/2026)

Dùng các số này để kiểm tra script chạy đúng với **đúng dump này**. Nếu dump mới hơn, các số có thể thay đổi — khi đó phải giải thích nguyên nhân, không được ép số.

### 11.1. Tổng theo khách hàng (tháng 10/2026)

| Khách hàng | Claimed |
|---|---:|
| HPH | 3.049 |
| HE CHUN | 1.005 |
| WAN HAI | 375 |
| CIMC | 33 |
| AESC | 7 |
| HAVICO | 2 |
| P&N | 2 |

### 11.2. HPH theo tuyến

| Tuyến | Claimed |
|---|---:|
| HPH-GREENPORT | 748 |
| HPH-NDV | 476 |
| HPH-TV | 289 |
| HPH - HAI AN | 20 |
| HPH 2 - VIMC DV | 10 |
| HPH 2 <-> HPH 1 | 1 |
| HUNTRUNG-DINHVU | 10 |
| HUN TRÙNG LẠCH HUYỆN | 10 |
| VINATANK-TÂN VŨ | 5 |
| VỆ SINH LẠI | 10 |
| OFFHIRE DINH VU | 1 |
| HICT - NDV | 6 |
| NDV-HICT | 3 |
| HICT-HPH | 325 |
| NỘI CẢNG | 429 |
| Đóng hàng SNP-SK LEAVEO | 1 |
| TV-MEDLOG MP | 705 |

### 11.3. HPH-GREENPORT theo loại

`748 = H20 261 + H40 321 + V40 142 + V40FR 24`.

> Con số **750 / H40 322 / V40 144 / V40FR 23** là theo dump cũ (05/11/2026). Với dump `(1)` phải là 748 / 321 / 142 / 24.

### 11.4. Kết quả đối chiếu HPH với 3 file bảng kê

| Trạng thái | Số dòng |
|---|---:|
| OK | 1.579 |
| THIẾU: FILE | 765 |
| THIẾU: VPS | 0 |
| SAI LOẠI | 0 |
| THÊM: KÉO VỀ | 3 |
| THÊM: KD2 | 1 |
| VPS CHƯA CLAIM | 148 |
| MEDLOG: CHỜ FILE | 705 |

Chi tiết `THIẾU: FILE` (765):

- `HPH-GREENPORT`: 1 — `SKHU9950435` (H40, DONGJIN 13/10, xe 15C 01376).
- `HPH-NDV`: 0 (trước đây `WHSU8082742` đã được bỏ claim).
- `HICT - NDV`: 6
- `NDV-HICT`: 3
- `HICT-HPH`: 325
- `NỘI CẢNG` (MSC ELIZABETH III): 429
- `Đóng hàng SNP-SK LEAVEO`: 1

Chi tiết `THÊM`:

- `THÊM: KÉO VỀ` (3): `SKHU6369094`, `FSCU8576809`, `HLHU8488731`.
- `THÊM: KD2` (1): `SKHU6369094`.

Chi tiết `VPS CHƯA CLAIM` (148):

- 72 dòng HPH-GREENPORT: 70 xe ngoài + 2 cont `HLHU8322817`, `SKHU6482691` (trước đây claim QUỸ CHUNG, nay đã bỏ claim).
- 68 dòng HPH-NDV: xe ngoài (FENG HAI/YOKOHAMA…).
- 8 dòng HPH-TV: `WHLU0550728`, `WHLU0614870`, `WHSU2104187`, `WHSU2199161`, `WHSU2211950`, `WHSU2521154`, `WHSU2539852`, `WHSU2642921` (W105 11/10, trước đây QUỸ CHUNG).

### 11.5. Những thay đổi của dump `(1)` so với dump cũ

- Bỏ claim của 11 container QUỸ CHUNG (danh sách ở mục 11.4).
- `SKHU9950435` (DONGJIN 13/10): đổi từ QUỸ CHUNG sang 15C 01376 (submission 1817).
- `SRLU1000779` (KOBE 15/10): đổi loại V40 → V40FR (FR lẻ, vẫn tính giá V40).

---

## 12. LÀM THÁNG MỚI HOẶC KHÁCH MỚI

### 12.1. Tháng mới

1. Lấy dump mới.
2. Restore vào `newway_check`.
3. Sửa `MONTH`, `YEAR`.
4. Sửa glob file bảng kê của khách (đúng tháng).
5. Sửa `OUTPUT` (tránh ghi đè).
6. Chạy lại.
7. Kiểm tra baseline mới (không dùng baseline tháng 10).

### 12.2. Khách mới

1. Lấy `customer_id` bằng SQL.
2. Thêm vào `CUSTOMER_FILES`.
3. Kiểm tra file của khách có cùng cấu trúc sheet không.
4. Chạy; xem sheet khách mới.
5. Nếu khách dùng mẫu Excel khác → báo lại, không tự đoán.

### 12.3. Thêm loại cont mới

Sửa `CATMAP` trong `reconcile.py`:

```python
CATMAP = {'H20': '20F', 'H40': '40F', 'V20': '20E', 'V40': '40E',
          'V20FR': '20E', 'V40FR': '40E'}
```

Nếu loại mới chưa có trong `CATMAP`, script sẽ báo `SAI LOẠI` (vì `CATMAP.get()` trả `None`). Đừng bỏ qua; phải xác nhận với người phụ trách.

### 12.4. Thêm claim tách riêng

Sửa:

```python
EXTRA_CLAIMS = {'KV': 'THÊM: KÉO VỀ', 'KD2': 'THÊM: KD2'}
```

Ví dụ muốn tách `REGO`:

```python
EXTRA_CLAIMS = {'KV': 'THÊM: KÉO VỀ', 'KD2': 'THÊM: KD2', 'REGO': 'THÊM: REGO'}
```

Chỉ làm khi có yêu cầu rõ ràng; mặc định `CLASSIFY`, `CLAMP` không tách.

---

## 13. LỖI THƯỜNG GẶP VÀ CÁCH XỬ LÝ

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `UnicodeEncodeError` / dấu tiếng Việt lỗi | Chưa đặt UTF-8 | Chạy `$env:PYTHONIOENCODING="utf-8"; $env:PYTHONUTF8="1"` |
| `psycopg2.OperationalError` | PostgreSQL local chưa chạy / sai mật khẩu | Kiểm tra service PostgreSQL, sửa `DB` |
| `relation "container_imports" does not exist` | Restore nhầm DB / chưa restore | Restore lại vào `newway_check` |
| Không có sheet khách hàng | Glob file sai / file chưa tải | Kiểm tra `CUSTOMER_FILES`, `~/Downloads/*.xlsx` |
| `THIẾU: FILE` toàn bộ một tuyến | Tuyến không có trong file (HICT/MSC/…) | Xác nhận có thu riêng không; nếu có, bổ sung file |
| `SAI LOẠI` | File ghi sai loại hoặc loại mới | So mã cont, kiểm tra bảng map; không tự sửa nếu chưa xác nhận |
| `THIẾU: VPS` | File có mã không có trong VPS | Kiểm tra mã gõ sai / kế hoạch khác / file nháp |
| `VPS CHƯA CLAIM` nhiều | Xe ngoài hoặc claim bị bỏ | Đối chiếu với điều phối; nếu là xe công ty thì phải claim lại |
| Một cont bị tính 2 lần | Khớp toàn cục theo mã | Script đã khớp theo kế hoạch; kiểm tra lại `plan_sheet` |
| Số liệu dashboard khác script | Dashboard cache / filter khác | Chạy SQL ở mục 8.2; đảm bảo `submission_id IS NOT NULL`, đúng route, đúng tháng |
| Dòng FR bị báo `SAI LOẠI` | Bó FR: thành viên bó không có loại | Script đã chấp nhận `None` khi có `bundle_id`; nếu vẫn lỗi, kiểm tra `bundle_id` |
| Kẹp bị tính 2 cont | Claim `CLAMP` bị coi là cont riêng | `CLAMP` không tách; chỉ `KV`/`KD2` tách |
| File có dòng `KÉO VỀ` nhưng script không thấy | File không có dòng thứ 2 cho mã đó | Ghi chú `KHÔNG có trong file`; kiểm tra lại file |

---

## 14. CHECKLIST TRƯỚC KHI GỬI KHÁCH

- [ ] Đã lấy dump **mới nhất** từ VPS.
- [ ] Đã restore đúng vào `newway_check`.
- [ ] Đã đặt `MONTH`, `YEAR` đúng.
- [ ] Glob file bảng kê đúng tháng / đúng khách.
- [ ] Không có file tháng cũ trong glob (kiểm tra tên file).
- [ ] Chạy script không lỗi.
- [ ] Mở `TONG HOP`: số liệu khớp với dashboard (sau khi dashboard đã tính lại).
- [ ] Mở `TONG HOP TUYEN`: kiểm tra các tuyến có `THIẾU: FILE` lớn.
- [ ] Kiểm tra thủ công 5-10 dòng `THIẾU: FILE` / `THIẾU: VPS` / `SAI LOẠI`.
- [ ] Kiểm tra `THÊM: KÉO VỀ` / `THÊM: KD2` đã tách riêng.
- [ ] Xác nhận MEDLOG đang `MEDLOG: CHỜ FILE` và không bị cộng vào thiếu.
- [ ] Đối chiếu tiền: `QT` = giá kế hoạch × (1 + phụ phí 10%) + VAT 8%.
- [ ] Không sửa tay số liệu trong file Excel kết quả; nếu cần sửa, sửa nguồn (VPS/file) rồi chạy lại.
- [ ] Lưu file kết quả kèm ngày dump (ví dụ `HPH_T10_kiem_tra_cont_theo_tuyen_20261106.xlsx`).

---

## 15. PHỤ LỤC SQL KIỂM TRA NHANH

### 15.1. Đếm theo khách hàng

```sql
select c.id, c.name,
       count(distinct sl.id) as plans,
       count(ci.id) as containers,
       count(ci.id) filter (where ci.submission_id is not null) as claimed
from customers c
left join shipping_lines sl on sl.customer_id = c.id
     and sl.ngay between '2026-10-01' and '2026-10-31'
left join container_imports ci on ci.shipping_line_id = sl.id
group by 1,2
having count(distinct sl.id) > 0
order by 1;
```

### 15.2. Đếm theo tuyến

```sql
select sl.route_name,
       count(*) filter (where ci.submission_id is not null) as claimed,
       count(*) as total,
       count(*) filter (where ci.type='H20' and ci.submission_id is not null) as h20,
       count(*) filter (where ci.type='H40' and ci.submission_id is not null) as h40,
       count(*) filter (where ci.type='V20' and ci.submission_id is not null) as v20,
       count(*) filter (where ci.type='V40' and ci.submission_id is not null) as v40,
       count(*) filter (where ci.type='V40FR' and ci.submission_id is not null) as v40fr
from shipping_lines sl
join container_imports ci on ci.shipping_line_id = sl.id
where sl.customer_id = 2
  and sl.ngay between '2026-10-01' and '2026-10-31'
group by 1
order by 1;
```

### 15.3. Kiểm tra một container cụ thể

```sql
select ci.container_code, ci.type, ci.shipping_line_id, sl.name, sl.ngay,
       ci.submission_id, ci.vehicle_id, v.so_xe, ci.bundle_id
from container_imports ci
join shipping_lines sl on sl.id = ci.shipping_line_id
left join vehicles v on v.id = ci.vehicle_id
where ci.container_code = 'SKHU9950435'
order by sl.ngay;
```

### 15.4. Kiểm tra claim của một container

```sql
select ci.container_code, sl.name, sl.ngay, cl.claim_type, cl.submission_id, cl.created_at
from container_claims cl
join container_imports ci on ci.id = cl.container_import_id
join shipping_lines sl on sl.id = ci.shipping_line_id
where ci.container_code = 'SKHU6369094'
order by cl.created_at;
```

### 15.5. So sánh 2 dump (nếu cần)

Restore dump cũ vào `newway_check_old`, dump mới vào `newway_check`, rồi so sánh:

- container thêm/xoá theo `(shipping_line_id, container_code)`;
- `type` thay đổi;
- claim thay đổi theo `container_import_id` + `claim_type`;
- `submission_id` / `vehicle_id` thay đổi.

---

## 16. GHI CHÚ CUỐI

- File kết quả chỉ là **công cụ đối chiếu**, không thay thế việc xác nhận của người phụ trách.
- Mọi trường hợp `SAI LOẠI`, `THIẾU: VPS`, hoặc chênh tiền phải báo lại người phụ trách trước khi gửi khách.
- Nếu dump hoặc file bảng kê thay đổi, phải chạy lại từ đầu; không sửa tay file Excel kết quả.
- Khi bàn giao cho opencode ở máy khác, copy nguyên thư mục `docs/doi-chieu-bang-ke/` và file dump + file bảng kê; không copy riêng file `.md` nếu chưa copy `reconcile.py`.
