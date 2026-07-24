import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { useAuthStore } from '../src/store/auth-store';
import { ToastProvider } from '../src/components/Toast';

export default function RootLayout() {
  const { restoreSession, loading } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  if (loading) return null;

  return (
    <ToastProvider>
      <Slot />
    </ToastProvider>
  );
}
