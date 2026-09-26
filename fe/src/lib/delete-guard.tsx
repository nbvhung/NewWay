'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { setActionPassword } from './axios-instance';

/**
 * Xoá dữ liệu = thao tác nguy hiểm → LUÔN phải nhập mật khẩu (348).
 *
 * Cách dùng ở bất kỳ component nào:
 *
 * ```tsx
 * const res = await confirmDelete({
 *   message: `Xoá tuyến đường "${name}"?`,
 *   action: () => routesApi.delete(id),
 * });
 * if (res === undefined) return;   // người dùng bấm Huỷ
 * toast('Đã xoá', 'success');
 * reload();
 * ```
 *
 * - Popup tự gắn mật khẩu vào header `x-cost-password` của request DELETE
 *   (qua `setActionPassword`) rồi xoá ngay sau khi xong.
 * - Sai mật khẩu / lỗi server: lỗi hiện ngay trong popup, popup giữ nguyên để
 *   người dùng nhập lại hoặc huỷ. Promise trả về `undefined` (không throw) nên
 *   không bao giờ gây unhandled rejection.
 * - Phải gắn `<DeleteGuardHost />` 1 lần (đang gắn ở `admin/layout.tsx`).
 */

export interface ConfirmDeleteOptions<T> {
  /** Tiêu đề popup. Mặc định "Xác nhận xoá". */
  title?: string;
  /** Nội dung cảnh báo — nói rõ xoá cái gì và hậu quả. */
  message: string;
  /** Nhãn nút xác nhận. Mặc định "Xoá". */
  confirmLabel?: string;
  /** Dòng ghi chú nhỏ dưới cảnh báo. Mặc định "Hành động này không thể hoàn tác." */
  note?: string;
  /** Hành động xoá thật sự (mật khẩu được gắn tự động vào header request DELETE;
   *  nếu API cần truyền mật khẩu riêng thì dùng tham số `password`). */
  action: (password: string) => Promise<T>;
  /** Gọi thêm khi thất bại (ngoài việc hiện lỗi trong popup). */
  onError?: (message: string) => void;
}

interface Pending {
  title: string;
  message: string;
  confirmLabel: string;
  note: string;
  action: (password: string) => Promise<unknown>;
  onError?: (message: string) => void;
  resolve: (value: unknown) => void;
}

/** Host đang gắn — chỉ 1 host cho toàn app. */
let host: ((p: Pending) => void) | null = null;

/** Lấy thông báo lỗi từ lỗi axios / Error / giá trị lạ. */
export function errorMessageOf(e: unknown, fallback = 'Xoá thất bại'): string {
  const err = e as { response?: { data?: { message?: unknown } }; message?: unknown };
  const raw = err?.response?.data?.message ?? err?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  return typeof raw === 'string' && raw ? raw : fallback;
}

export function confirmDelete<T>(opts: ConfirmDeleteOptions<T>): Promise<T | undefined> {
  const pending: Pending = {
    title: opts.title || 'Xác nhận xoá',
    message: opts.message,
    confirmLabel: opts.confirmLabel || 'Xoá',
    note: opts.note || 'Hành động này không thể hoàn tác.',
    action: opts.action,
    onError: opts.onError,
    resolve: () => {},
  };

  const promise = new Promise<T | undefined>((resolve) => {
    pending.resolve = resolve as (value: unknown) => void;
  });

  if (host) {
    host(pending);
    return promise;
  }

  // Fallback khi chưa gắn <DeleteGuardHost /> (trang ngoài khu admin).
  const agreed =
    typeof window !== 'undefined' &&
    window.confirm(`${pending.message}\n\nThao tác này cần mật khẩu xoá.`);
  if (!agreed) {
    pending.resolve(undefined);
    return promise;
  }
  const pw = typeof window !== 'undefined' ? window.prompt('Nhập mật khẩu xoá:') || '' : '';
  setActionPassword(pw.trim());
  pending
    .action(pw.trim())
    .then((data) => {
      setActionPassword('');
      pending.resolve(data);
    })
    .catch((e: unknown) => {
      setActionPassword('');
      const message = errorMessageOf(e);
      pending.onError?.(message);
      pending.resolve(undefined);
    });
  return promise;
}

export function DeleteGuardHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    host = (p) => {
      setPending(p);
      setPw('');
      setError('');
      setBusy(false);
    };
    return () => {
      host = null;
    };
  }, []);

  const cancel = () => {
    if (busy) return;
    const p = pending;
    setPending(null);
    setPw('');
    setError('');
    p?.resolve(undefined);
  };

  const submit = async () => {
    if (!pending || busy) return;
    if (!pw.trim()) {
      setError('Vui lòng nhập mật khẩu xoá.');
      return;
    }
    setBusy(true);
    setError('');
    setActionPassword(pw.trim());
    try {
      const data = await pending.action(pw.trim());
      setActionPassword('');
      const p = pending;
      setPending(null);
      setPw('');
      setBusy(false);
      p.resolve(data);
    } catch (e: unknown) {
      setActionPassword('');
      const message = errorMessageOf(e);
      setError(message);
      setBusy(false);
      pending.onError?.(message);
    }
  };

  return (
    <Modal
      open={!!pending}
      onClose={cancel}
      title={pending?.title || 'Xác nhận xoá'}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[#44403c] bg-[#f5f5f4] hover:bg-[#e7e5e4] transition-colors disabled:opacity-50 cursor-pointer"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-[#ef4444] to-[#dc2626] shadow-[0_4px_15px_rgba(239,68,68,0.35)] hover:shadow-[0_4px_20px_rgba(239,68,68,0.5)] transition-shadow disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Đang xoá...' : pending?.confirmLabel || 'Xoá'}
          </button>
        </>
      }
    >
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-[13px] font-semibold text-red-700 whitespace-pre-line">
          ⚠️ {pending?.message}
        </p>
        <p className="text-[11px] text-red-600 mt-1">{pending?.note}</p>
      </div>

      <div className="mt-4">
        <label className="text-[12px] font-semibold text-[#44403c]">
          Nhập mật khẩu xoá để xác nhận
        </label>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="••••"
          className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#e7e5e4] bg-white text-[14px] tracking-[0.2em] outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-red-100"
        />
        {error ? (
          <p className="text-[11px] font-medium text-red-600 mt-1.5">{error}</p>
        ) : (
          <p className="text-[11px] text-[#a8a29e] mt-1.5">
            Mật khẩu giúp tránh xoá nhầm. Mỗi lần xoá đều phải nhập lại.
          </p>
        )}
      </div>
    </Modal>
  );
}
