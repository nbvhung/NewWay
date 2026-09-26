import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from './Modal';
import { setActionPassword } from '../api/axios-instance';

/**
 * Xoá dữ liệu trên app = thao tác nguy hiểm → LUÔN phải nhập mật khẩu (348).
 *
 * Cách dùng:
 *
 * ```ts
 * const ok = await confirmDelete({
 *   message: 'Bạn chắc chắn muốn XÓA tài khoản này?',
 *   action: () => usersApi.delete(id),
 * });
 * if (!ok) return;          // người dùng huỷ / xoá thất bại
 * onRefresh();
 * ```
 *
 * - Mật khẩu được gắn tự động vào header `x-cost-password` của request DELETE
 *   rồi xoá ngay sau khi xong.
 * - Sai mật khẩu / lỗi server: lỗi hiện ngay trong popup, popup giữ nguyên để
 *   nhập lại hoặc huỷ. Promise KHÔNG bao giờ reject.
 * - Phải gắn `<DeleteGuardHost />` 1 lần (đang gắn ở `app/_layout.tsx`).
 */

export interface ConfirmDeleteOptions {
  /** Tiêu đề popup. Mặc định "Xác nhận xoá". */
  title?: string;
  /** Nội dung cảnh báo — nói rõ xoá cái gì và hậu quả. */
  message: string;
  /** Nhãn nút xác nhận. Mặc định "Xoá". */
  confirmLabel?: string;
  /** Dòng ghi chú nhỏ. Mặc định "Hành động này không thể hoàn tác." */
  note?: string;
  /** Hành động xoá thật sự (mật khẩu gắn tự động vào header DELETE). */
  action: (password: string) => Promise<unknown>;
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
  resolve: (ok: boolean) => void;
}

let host: ((p: Pending) => void) | null = null;

/** Trả về `true` nếu xoá thành công, `false` nếu huỷ hoặc thất bại. */
export function confirmDelete(opts: ConfirmDeleteOptions): Promise<boolean> {
  const pending: Pending = {
    title: opts.title || 'Xác nhận xoá',
    message: opts.message,
    confirmLabel: opts.confirmLabel || 'Xoá',
    note: opts.note || 'Hành động này không thể hoàn tác.',
    action: opts.action,
    onError: opts.onError,
    resolve: () => {},
  };

  const promise = new Promise<boolean>((resolve) => {
    pending.resolve = resolve;
  });

  if (host) {
    host(pending);
  } else {
    // Chưa gắn host (không nên xảy ra) → không cho xoá để tránh mất dữ liệu.
    console.warn('[DeleteGuard] chưa gắn <DeleteGuardHost /> — chặn thao tác xoá.');
    pending.resolve(false);
  }
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
    p?.resolve(false);
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
      await pending.action(pw.trim());
      setActionPassword('');
      const p = pending;
      setPending(null);
      setPw('');
      setBusy(false);
      p.resolve(true);
    } catch (e: any) {
      setActionPassword('');
      const message =
        e?.response?.data?.message || e?.message || 'Xoá thất bại';
      setError(Array.isArray(message) ? message.join(', ') : String(message));
      setBusy(false);
      pending.onError?.(String(message));
    }
  };

  return (
    <Modal
      visible={!!pending}
      onClose={cancel}
      title={pending?.title || 'Xác nhận xoá'}
      footer={
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={cancel} disabled={busy}>
            <Text style={styles.cancelBtnText}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerBtn} onPress={submit} disabled={busy}>
            <Text style={styles.dangerBtnText}>
              {busy ? 'Đang xoá...' : pending?.confirmLabel || 'Xoá'}
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.warnBox}>
        <Text style={styles.warnText}>⚠️ {pending?.message}</Text>
        <Text style={styles.warnNote}>{pending?.note}</Text>
      </View>

      <Text style={styles.label}>Nhập mật khẩu xoá để xác nhận</Text>
      <TextInput
        style={styles.input}
        value={pw}
        onChangeText={(t) => {
          setPw(t);
          setError('');
        }}
        secureTextEntry
        keyboardType="number-pad"
        placeholder="••••"
        placeholderTextColor="#94a3b8"
        autoFocus
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.hint}>Mật khẩu giúp tránh xoá nhầm. Mỗi lần xoá đều phải nhập lại.</Text>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  dangerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  dangerBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  warnBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  warnText: { fontSize: 13, fontWeight: '600', color: '#b91c1c' },
  warnNote: { fontSize: 11, color: '#dc2626', marginTop: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    letterSpacing: 3,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  error: { fontSize: 11, fontWeight: '600', color: '#dc2626', marginTop: 6 },
  hint: { fontSize: 11, color: '#94a3b8', marginTop: 6 },
});
