'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DataTab } from '@/components/admin/DataTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { ShippingLinesTab } from '@/components/admin/ShippingLinesTab';
import { RoutesTab } from '@/components/admin/RoutesTab';
import { CompletedPlansTab } from '@/components/admin/CompletedPlansTab';
import { MonthlyPlansTab } from '@/components/admin/MonthlyPlansTab';
import { usersApi } from '@/lib/api-users';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { routesApi } from '@/lib/api-routes';
import { User, ShippingLine, Route } from '@/types';

type Tab = 'data' | 'users' | 'shipping-lines' | 'routes' | 'monthly-plans' | 'completed-plans';

const ALL_TABS: (role?: string) => { key: Tab; label: string; icon: string }[] = (role) => [
  { key: 'data', label: role === 'ops' ? 'Thống kê' : role === 'hr' ? 'Lương chuyến' : 'Tất cả dữ liệu', icon: '📊' },
  { key: 'users', label: 'Quản lý tài khoản', icon: '👥' },
  { key: 'shipping-lines', label: role === 'ops' ? 'Quản lý/Tạo kế hoạch' : 'Quản lý kế hoạch', icon: '🚢' },
  { key: 'monthly-plans', label: 'Kế hoạch theo tháng', icon: '📅' },
  { key: 'completed-plans', label: 'Kế hoạch đã hoàn thành', icon: '✅' },
  { key: 'routes', label: 'Quản lý tuyến đường', icon: '🛤️' },
];

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const TABS = ALL_TABS(user?.role).filter(t => {
    if (t.key === 'completed-plans' && (user?.role === 'laixe' || user?.role === 'hr')) return false;
    if (t.key === 'monthly-plans' && (user?.role === 'laixe' || user?.role === 'hr')) return false;
    if (t.key === 'routes' && user?.role === 'ops') return false;
    if (t.key === 'shipping-lines' && user?.role === 'hr') return false;
    if (t.key === 'users' && user?.role !== 'admin' && user?.role !== 'supper_admin') return false;
    return true;
  });
  const [activeTab, setActiveTab] = useState<Tab>('data');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allShippingLines, setAllShippingLines] = useState<ShippingLine[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadUsers(), loadShippingLines(), loadRoutes()]).finally(() => setLoading(false));
  }, []);

  const loadUsers = async () => {
    try {
      const res = await usersApi.getAll();
      setAllUsers(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
  };

  const loadShippingLines = async () => {
    try {
      const res = await shippingLinesApi.getAllAdmin();
      setAllShippingLines(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
  };

  const loadRoutes = async () => {
    try {
      const res = await routesApi.getAll();
      setAllRoutes(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
  };

  const refreshAll = () => {
    loadUsers();
    loadShippingLines();
    loadRoutes();
  };

  if (loading) return <LoadingSpinner className="min-h-[60vh]" />;

  if (user?.role === 'laixe') {
    return <div className="text-center py-16 text-[#64748b] text-sm">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold">⚙️ {user?.role === 'hr' ? 'HR Dashboard' : user?.role === 'admin' || user?.role === 'supper_admin' ? 'Dashboard' : 'Ops Dashboard'}</h1>
      </div>

      <div className="flex gap-1 border-b border-[rgba(0,0,0,0.08)] mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === t.key
                ? 'text-[#1a56db] border-b-[#1a56db]'
                : 'text-[#64748b] border-b-transparent hover:text-[#0f172a]'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'data' && (
        <DataTab
          user={user}
          allUsers={allUsers}
          allShippingLines={allShippingLines}
          loadUsers={loadUsers}
          loadShippingLines={loadShippingLines}
        />
      )}
      {activeTab === 'users' && (
        <UsersTab
          currentUser={user}
          allUsers={allUsers}
          onRefresh={loadUsers}
          toast={toast}
        />
      )}
      {activeTab === 'shipping-lines' && (
        <ShippingLinesTab
          user={user}
          allShippingLines={allShippingLines}
          allRoutes={allRoutes}
          allUsers={allUsers}
          onRefresh={() => { loadShippingLines(); loadRoutes(); }}
          toast={toast}
        />
      )}
      {activeTab === 'monthly-plans' && (
        <MonthlyPlansTab user={user} />
      )}
      {activeTab === 'completed-plans' && (
        <CompletedPlansTab user={user} onRefresh={loadShippingLines} />
      )}
      {activeTab === 'routes' && (
        <RoutesTab
          allRoutes={allRoutes}
          onRefresh={() => { loadRoutes(); }}
          toast={toast}
        />
      )}
    </div>
  );
}
