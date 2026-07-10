'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      if (user.role === 'ops' || user.role === 'admin' || user.role === 'super_admin' || user.role === 'hr') {
        router.replace('/admin');
      } else {
        router.replace('/form');
      }
    }
  }, [user, router]);

  return null;
}
