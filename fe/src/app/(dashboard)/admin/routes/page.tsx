'use client';

import { useAdminData } from '../layout';
import { RoutesTab } from '@/components/admin/RoutesTab';
import { useToast } from '@/components/ui/toast';

export default function AdminRoutesPage() {
  const { allRoutes, loading, reload } = useAdminData();
  const { toast } = useToast();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return <RoutesTab allRoutes={allRoutes} onRefresh={reload} toast={toast} />;
}