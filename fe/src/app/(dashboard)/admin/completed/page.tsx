'use client';

import { useAdminData } from '../layout';
import { CompletedPlansTab } from '@/components/admin/CompletedPlansTab';

export default function AdminCompletedPage() {
  const { user, loading, reload } = useAdminData();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return <CompletedPlansTab user={user} onRefresh={reload} />;
}