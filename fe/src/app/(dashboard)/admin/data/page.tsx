'use client';

import { useAdminData } from '../layout';
import { DataTab } from '@/components/admin/DataTab';

export default function AdminDataPage() {
  const { user, allUsers, allShippingLines, loading, reload } = useAdminData();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return (
    <DataTab
      user={user}
      allUsers={allUsers}
      allShippingLines={allShippingLines}
      loadUsers={reload}
      loadShippingLines={reload}
    />
  );
}