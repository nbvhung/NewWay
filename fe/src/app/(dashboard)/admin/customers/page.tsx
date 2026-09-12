'use client';

import { useAdminData } from '../layout';
import { CustomersTab } from '@/components/admin/CustomersTab';
import { useToast } from '@/components/ui/toast';

export default function AdminCustomersPage() {
  const { loading, reload } = useAdminData();
  const { toast } = useToast();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return <CustomersTab onRefresh={reload} toast={toast} />;
}