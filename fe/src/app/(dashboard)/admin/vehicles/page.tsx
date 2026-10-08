'use client';

import { useAdminData } from '../layout';
import { VehiclesTab } from '@/components/admin/VehiclesTab';
import { useToast } from '@/components/ui/toast';

export default function AdminVehiclesPage() {
  const { user, allUsers, loading } = useAdminData();
  const { toast } = useToast();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return <VehiclesTab currentUser={user} allUsers={allUsers} toast={toast} />;
}
