import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { useAuthStore } from '../src/store/auth-store';

export default function RootLayout() {
  const { restoreSession, loading } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  if (loading) return null;

  return <Slot />;
}
