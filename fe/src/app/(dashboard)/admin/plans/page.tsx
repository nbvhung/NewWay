'use client';

import { useAdminData } from '../layout';
import { ShippingLinesTab } from '@/components/admin/ShippingLinesTab';
import { useToast } from '@/components/ui/toast';

export default function AdminPlansPage() {
  const { user, allShippingLines, allRoutes, allUsers, assignmentUsers, allCustomers, loading, reload } = useAdminData();
  const { toast } = useToast();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return (
    <ShippingLinesTab
      user={user}
      allShippingLines={allShippingLines}
      allRoutes={allRoutes}
      allUsers={allUsers}
      assignmentUsers={assignmentUsers}
      allCustomers={allCustomers}
      onRefresh={reload}
      toast={toast}
    />
  );
}