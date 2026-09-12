'use client';

import { useAdminData } from '../layout';
import { SalaryTab } from '@/components/admin/SalaryTab';
import { useToast } from '@/components/ui/toast';

export default function AdminSalaryPage() {
  const { user, allUsers, loading } = useAdminData();
  const { toast } = useToast();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return <SalaryTab currentUser={user} allUsers={allUsers} toast={toast} />;
}