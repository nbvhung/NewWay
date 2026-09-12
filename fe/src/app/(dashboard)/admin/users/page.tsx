'use client';

import { useAdminData } from '../layout';
import { UsersTab } from '@/components/admin/UsersTab';
import { useToast } from '@/components/ui/toast';

export default function AdminUsersPage() {
  const { user, allUsers, loading, reload } = useAdminData();
  const { toast } = useToast();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return <UsersTab currentUser={user} allUsers={allUsers} onRefresh={reload} toast={toast} />;
}