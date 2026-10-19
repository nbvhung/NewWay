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

1. Mở `https://chat.zalo.me` và đăng nhập.
2. Bấm icon extension → bật **Bật chuyển tiếp**.
3. Nhập **Nhóm đích** = tên hiển thị đúng của nhóm (vd `Nhóm OPS New Way`).
4. Chọn loại nội dung cần chuyển (Chữ / Ảnh / File), tuỳ chọn **Tiền tố**, **Độ trễ**.
5. Bấm **Lưu**. Từ giờ, khi có tin nhắn **đến** trong hội thoại đang mở,
   extension sẽ tự mở nhóm đích, gửi nội dung rồi quay lại.

**Gửi thử:** bấm **🧪 Gửi thử** để kiểm tra cấu hình nhóm đích.

### Phạm vi hoạt động
- Mặc định chỉ theo dõi **hội thoại đang mở**.
- Bật **Quét hội thoại chưa đọc** để extension tự mở lần lượt các hội thoại có tin
  chưa đọc (tối đa 5 mỗi vòng, ~20 giây/lần) → forward rồi quay lại hội thoại cũ.
- **Không** forward tin do chính bạn gửi đi.
- **Chống lặp:** nếu đang ở chính nhóm đích thì bỏ qua.

## 3. Cơ chế hoạt động

| Thành phần | Vai trò |
|---|---|
| `src/content.js` | Theo dõi DOM Zalo, phát hiện tin đến, trích chữ/ảnh/file, mở nhóm đích và gửi |
| `src/background.js` | Mở tab Zalo khi bật extension / khởi động Chrome |
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

## 5. Hạn chế & lưu ý

- Tab Zalo phải **mở thường trực** (nên ghim tab); tắt máy/ngủ là ngừng.
- Phụ thuộc giao diện Zalo → có thể hỏng sau khi Zalo cập nhật.
- Album nhiều ảnh được gửi lần lượt; video được xử lý như file.
- Tự động hoá Zalo Web có thể **vi phạm điều khoản sử dụng** của Zalo. Tự cân nhắc
  rủi ro với tài khoản.
