'use client';

import { useAuth } from '@/providers/auth-provider';
import { DashboardTab } from '@/components/admin/DashboardTab';

export default function OverviewPage() {
  const { user } = useAuth();

  if (!user || (user.role !== 'admin' && user.role !== 'supper_admin')) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center text-[#78716c]">
          <div className="text-4xl mb-3">🔒</div>
          <div className="text-sm">Bạn không có quyền truy cập trang này.</div>
        </div>
      </div>
    );
  }

  return <DashboardTab />;
}
