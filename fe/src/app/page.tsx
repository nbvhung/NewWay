'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.role === 'ops' || user.role === 'admin' || user.role === 'supper_admin' || user.role === 'hr') {
        router.replace('/admin');
      } else {
        router.replace('/form');
      }
    } else {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
}
