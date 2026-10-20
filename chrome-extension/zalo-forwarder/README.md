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
4. Chọn loại nội dung cần chuyển (Chữ / Ảnh / File), **Tiền tố**, **Độ trễ** → **Lưu**.

Khi có tin **đến** ở hội thoại đang mở, extension sẽ:
mở nhóm đích (ô tìm kiếm / danh sách bên trái) → gửi nội dung → **quay lại**
hội thoại cũ. Bạn không cần mở 2 tab Zalo.

**Gửi thử:** bấm **🧪 Gửi thử** để kiểm tra.
**Quét ngay:** bấm **🔄 Quét hội thoại chưa đọc ngay** để quét một lượt.
**Log:** khung **Log gần đây** hiển thị từng bước (phát hiện tin, mở nhóm, gửi
thành công/lỗi) giúp kiểm tra nhanh.

### Phạm vi hoạt động
- Mặc định chỉ theo dõi **hội thoại đang mở**.
- Bật **Quét hội thoại chưa đọc** để extension tự mở lần lượt các hội thoại có tin
  chưa đọc (tối đa 5 mỗi vòng, ~20 giây/lần) → forward rồi quay lại hội thoại cũ.
- **Không** forward tin do chính bạn gửi đi.
- **Chống lặp:** nếu đang ở chính nhóm đích thì bỏ qua.

> Trong lúc extension chuyển sang nhóm đích để gửi, tab Zalo sẽ tạm đổi hội thoại
> vài giây rồi tự quay lại — đây là đặc điểm của cách chạy 1 tab.

## 3. Cơ chế hoạt động

| Thành phần | Vai trò |
|---|---|
| `src/content.js` | Theo dõi DOM Zalo, phát hiện tin đến, trích chữ/ảnh/file; mở nhóm đích, gửi rồi quay lại hội thoại cũ |
| `src/background.js` | Mở tab Zalo khi bật extension + lưu log |
| `src/popup.*` | Giao diện cấu hình |

- Ảnh/file được tải bằng `fetch()` (cùng phiên đăng nhập) → tạo `File` → dán vào ô
  soạn tin bằng sự kiện `paste`.
- Chống trùng bằng `data-msgid` (hoặc hash nội dung) lưu trong bộ nhớ phiên tab.

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
| `Không tìm thấy ô soạn tin` | Zalo chưa render xong hoặc đang ở màn hình không có ô soạn → bấm F5 tab Zalo rồi thử lại. |
| `Không chèn được chữ vào ô soạn tin` | Ô soạn tin chưa focus/khác cấu trúc → F5 lại tab, hoặc bật Debug để xem DOM. |
| `Ô soạn vẫn còn nội dung — gửi thất bại` | Nút Gửi/Enter không kích hoạt → thử gửi tay 1 tin để chắc tài khoản không bị hạn chế. |
| `Không tìm thấy nhóm/hội thoại` | Tên nhóm không khớp → nhập đúng tên hiển thị trong Zalo. |
| Quét chưa đọc = 0 nhưng có tin chưa đọc | Zalo đổi badge → bật Debug, gửi tôi log; hoặc mở trực tiếp hội thoại đó (chế độ theo dõi hội thoại đang mở vẫn chạy). |

Sau khi cập nhật extension: **Reload** ở `chrome://extensions` và **F5** tab Zalo.

## 6. Hạn chế & lưu ý

- Tab Zalo phải **mở thường trực** (nên ghim tab); tắt máy/ngủ là ngừng.
- Phụ thuộc giao diện Zalo → có thể hỏng sau khi Zalo cập nhật.
- Album nhiều ảnh được gửi lần lượt; video được xử lý như file.
- Tự động hoá Zalo Web có thể **vi phạm điều khoản sử dụng** của Zalo. Tự cân nhắc
  rủi ro với tài khoản.
