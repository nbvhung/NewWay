'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminData } from './layout';

export default function AdminIndexPage() {
  const { user } = useAdminData();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === 'partner') router.replace('/admin/progress');
    else if (user?.role === 'ops') router.replace('/admin/data');
    else if (user?.role === 'hr') router.replace('/admin/data');
    else router.replace('/admin/data');
  }, [user, router]);

  return <div className="py-20 text-center text-[#78716c] text-sm">Đang chuyển hướng...</div>;
}