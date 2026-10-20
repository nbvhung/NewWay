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

## 2. Sử dụng

### Cách khuyến nghị: TAB GỬI riêng (ổn định nhất)
1. Mở một tab `https://chat.zalo.me`, **mở đúng nhóm đích**.
2. Bấm icon extension → **📌 Đặt tab đang mở (nhóm đích) làm TAB GỬI**.
   (Tên nhóm được tự điền vào ô **Nhóm đích**.)
3. Bật **Bật chuyển tiếp** → **Lưu**.
4. Mở (các) tab Zalo khác ở hội thoại cần theo dõi. Khi có tin **đến**, extension
   sẽ gửi thẳng vào TAB GỬI (không cần tìm/đổi nhóm).

Giữ tab GỬI luôn mở (có thể ghim). Nếu tab GỬI bị đóng, extension tự xử lý theo
cách dự phòng (mở nhóm đích theo tên trong tab nguồn).

### Cách dự phòng (không đặt TAB GỬI)
1. Mở `https://chat.zalo.me` và đăng nhập.
2. Bấm icon extension → bật **Bật chuyển tiếp**.
3. Nhập **Nhóm đích** = tên hiển thị đúng của nhóm.
4. Chọn loại nội dung cần chuyển (Chữ / Ảnh / File), **Tiền tố**, **Độ trễ** → **Lưu**.

**Gửi thử:** bấm **🧪 Gửi thử** để kiểm tra.
**Log:** khung **Log gần đây** trong popup hiển thị từng bước (phát hiện tin,
mở nhóm, gửi thành công/lỗi) giúp kiểm tra nhanh.

### Phạm vi hoạt động
- Mặc định chỉ theo dõi **hội thoại đang mở**.
- Bật **Quét hội thoại chưa đọc** để extension tự mở lần lượt các hội thoại có tin
  chưa đọc (tối đa 5 mỗi vòng, ~20 giây/lần) → forward rồi quay lại hội thoại cũ.
- **Không** forward tin do chính bạn gửi đi.
- **Chống lặp:** nếu đang ở chính nhóm đích thì bỏ qua.

## 3. Cơ chế hoạt động

| Thành phần | Vai trò |
|---|---|
| `src/content.js` | Theo dõi DOM Zalo, phát hiện tin đến, trích chữ/ảnh/file; gửi trực tiếp ở TAB GỬI hoặc tự mở nhóm đích (dự phòng) |
| `src/background.js` | Điều phối TAB GỬI (worker tab), lưu log, mở tab Zalo khi bật extension |
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
| `Không tìm thấy ô soạn tin` | TAB GỬI chưa mở đúng hội thoại hoặc Zalo chưa render xong → bấm F5 tab đó, mở đúng nhóm đích rồi thử lại. |
| `Không chèn được chữ vào ô soạn tin` | Ô soạn tin chưa focus/khác cấu trúc → F5 lại tab, hoặc bật Debug để xem DOM. |
| `Ô soạn vẫn còn nội dung — gửi thất bại` | Nút Gửi/Enter không kích hoạt → thử gửi tay 1 tin trong tab đó để chắc tài khoản không bị hạn chế. |
| `Không tìm thấy nhóm/hội thoại` (chế độ dự phòng) | Tên nhóm không khớp → dùng TAB GỬI, hoặc nhập đúng tên hiển thị. |
| Quét chưa đọc = 0 nhưng có tin chưa đọc | Zalo đổi badge → bật Debug, gửi tôi log; hoặc mở trực tiếp hội thoại đó (chế độ theo dõi hội thoại đang mở vẫn chạy). |

Tab GỬI phải **mở đúng nhóm đích** và **được F5 sau khi cập nhật extension**.

## 6. Hạn chế & lưu ý

- Tab Zalo phải **mở thường trực** (nên ghim tab); tắt máy/ngủ là ngừng.
- Phụ thuộc giao diện Zalo → có thể hỏng sau khi Zalo cập nhật.
- Album nhiều ảnh được gửi lần lượt; video được xử lý như file.
- Tự động hoá Zalo Web có thể **vi phạm điều khoản sử dụng** của Zalo. Tự cân nhắc
  rủi ro với tài khoản.
