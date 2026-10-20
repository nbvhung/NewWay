# Zalo Forwarder (Chrome Extension)

Tự động chuyển tiếp **tin nhắn mà người khác gửi tới tài khoản Zalo của bạn**
(chữ / ảnh / file) vào **một nhóm cố định**.

> ⚠️ Extension điều khiển **Zalo Web** (`chat.zalo.me`) nên chỉ chạy khi tab Zalo Web
> đang mở và đã đăng nhập. Zalo đổi giao diện có thể làm hỏng selector → xem mục
> "Bảo trì".

---

## 1. Cài đặt (Load unpacked)

1. Mở Chrome → `chrome://extensions`
2. Bật **Developer mode** (góc trên phải)
3. Bấm **Load unpacked** → chọn thư mục:
   `D:\NWW\NewWay\chrome-extension\zalo-forwarder`
4. Ghim extension lên thanh công cụ (biểu tượng ➜)

## 2. Sử dụng (chỉ cần **1 tab Zalo**)

1. Mở **một** tab `https://chat.zalo.me` và đăng nhập.
2. Bấm icon extension → bật **Bật chuyển tiếp**.
3. Nhập **Nhóm đích** = tên hiển thị đúng của nhóm (vd `Nhóm OPS New Way`).
4. Giữ bật **Chia sẻ gốc (giữ ảnh)** → **Lưu**.

Khi có tin **đến**, extension sẽ **chuột phải nội dung tin nhắn → "Chia sẻ"**,
nhập tên **nhóm đích** vào ô tìm kiếm, chọn nhóm rồi bấm nút **"Chia sẻ"**. Tin
được chia sẻ **nguyên bản** (giữ ảnh/file), **không lấy link và không gửi link**.

**Gửi thử:** bấm **🧪 Gửi thử** — extension chia sẻ tin nhắn gần nhất.
**Quét ngay:** bấm **🔄 Quét hội thoại chưa đọc ngay** để quét một lượt.
**Log:** khung **Log gần đây** hiển thị từng bước (mở menu, bấm Chia sẻ, nhập tên
nhóm, chọn nhóm, bấm Chia sẻ, thành công/lỗi) giúp kiểm tra nhanh.

### Phạm vi hoạt động
- Mặc định chỉ theo dõi **hội thoại đang mở**.
- Bật **Quét hội thoại chưa đọc** để extension tự mở lần lượt các hội thoại có tin
  chưa đọc (tối đa 5 mỗi vòng, ~20 giây/lần).
- **Không** forward tin do chính bạn gửi đi.
- **Chống lặp:** nếu đang ở chính nhóm đích thì bỏ qua.

> Nếu tắt **Chia sẻ gốc**, extension dùng cách cũ: mở nhóm đích rồi gửi lại
> nội dung (chữ/ảnh/file).

## 3. Cơ chế hoạt động

| Thành phần | Vai trò |
|---|---|
| `src/content.js` | Phát hiện tin đến; chuột phải tin → "Chia sẻ" → tìm & chọn nhóm đích → bấm Chia sẻ |
| `src/background.js` | Mở tab Zalo khi bật extension + lưu log |
| `src/popup.*` | Giao diện cấu hình |

- Chống trùng bằng `data-msgid` (hoặc hash nội dung) lưu trong bộ nhớ phiên tab.
- Chỉ chuyển tiếp tin **đến** (không phải tin của chính bạn).

## 4. Bảo trì khi Zalo đổi giao diện

Mở `src/content.js`, sửa mảng `SELECTORS` (mỗi mục là danh sách selector dự phòng):

```js
const SELECTORS = {
  messageList: ['#messageViewScroll', ...],
  messageItem: ['[id^="msg-"]', ...],
  composer:    ['#richInput', ...],
  sendBtn:     ['#richInputSendBtn', ...],
  searchInput: ['#contactSearch', ...],
  conversationItem: ['[class*="contact-item"]', ...],
};
```

Bật **Debug** trong popup rồi mở DevTools (F12) tab Zalo để xem log `[ZF]`.

## 5. Xử lý sự cố (xem "Log gần đây" trong popup)

| Log | Nguyên nhân / cách xử lý |
|---|---|
| `Không thấy mục "Chia sẻ" trong menu chuột phải` | Zalo đổi menu hoặc không nhận sự kiện chuột phải tổng hợp → gửi tôi dòng log (có kèm danh sách mục gần đó) để chỉnh. |
| `Không thấy hộp thoại chia sẻ` | Menu đã bấm nhưng hộp thoại chưa mở → F5 tab Zalo, thử lại; nếu vẫn lỗi gửi log. |
| `Không thấy nhóm "…" trong hộp thoại chia sẻ` | Nhập đúng tên hiển thị của nhóm; nhóm phải có trong danh sách chọn người nhận. |
| `Hộp thoại chia sẻ vẫn còn — chưa xác nhận được` | Nút xác nhận khác tên → gửi log để chỉnh. |
| `Không tìm thấy ô soạn tin` (chế độ gửi lại) | Chỉ dùng khi tắt "Chia sẻ gốc" → F5 tab Zalo. |
| Quét chưa đọc = 0 nhưng có tin chưa đọc | Zalo đổi badge → bật Debug, gửi tôi log; hoặc mở trực tiếp hội thoại đó. |

Sau khi cập nhật extension: **Reload** ở `chrome://extensions` và **F5** tab Zalo.

## 6. Hạn chế & lưu ý

- Tab Zalo phải **mở thường trực** (nên ghim tab); tắt máy/ngủ là ngừng.
- Phụ thuộc giao diện Zalo → có thể hỏng sau khi Zalo cập nhật.
- Album nhiều ảnh được gửi lần lượt; video được xử lý như file.
- Tự động hoá Zalo Web có thể **vi phạm điều khoản sử dụng** của Zalo. Tự cân nhắc
  rủi ro với tài khoản.
