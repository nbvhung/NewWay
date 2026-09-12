'use client';

import { useAdminData } from '../layout';
import { ContainerCodesTab } from '@/components/admin/ContainerCodesTab';
import { useToast } from '@/components/ui/toast';

export default function AdminContainersPage() {
  const { user, allUsers, allShippingLines, loading } = useAdminData();
  const { toast } = useToast();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return (
    <ContainerCodesTab allShippingLines={allShippingLines} user={user} allUsers={allUsers} toast={toast} />
  );
}