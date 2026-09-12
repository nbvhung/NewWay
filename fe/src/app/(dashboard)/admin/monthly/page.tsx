'use client';

import { useAdminData } from '../layout';
import { MonthlyPlansTab } from '@/components/admin/MonthlyPlansTab';

export default function AdminMonthlyPage() {
  const { user, loading } = useAdminData();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return <MonthlyPlansTab user={user} />;
}