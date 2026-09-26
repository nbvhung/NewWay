import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { useAuthStore } from '../src/store/auth-store';
import { ToastProvider } from '../src/components/Toast';
import { DeleteGuardHost } from '../src/components/DeleteGuard';

export default function RootLayout() {
  const { restoreSession, loading } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  if (loading) return null;

  return (
    <ToastProvider>
      <Slot />
      {/* Popup xác nhận xoá (bắt buộc mật khẩu 348) — dùng chung toàn app */}
      <DeleteGuardHost />
    </ToastProvider>
  );
}
