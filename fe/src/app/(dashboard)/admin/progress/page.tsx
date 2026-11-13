'use client';

import { useAdminData } from '../layout';
import { ProgressTab } from '@/components/admin/ProgressTab';
import { useToast } from '@/components/ui/toast';

export default function AdminProgressPage() {
  const { loading } = useAdminData();
  const { toast } = useToast();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return <ProgressTab toast={toast} />;
}

