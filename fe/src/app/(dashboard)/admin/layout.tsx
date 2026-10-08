'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { usersApi } from '@/lib/api-users';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { routesApi } from '@/lib/api-routes';
import { customersApi } from '@/lib/api-customers';
import { User, ShippingLine, Route, Customer } from '@/types';
import { AdminSidebar, MobileAdminNav } from '@/components/layout/admin-sidebar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DeleteGuardHost } from '@/lib/delete-guard';
import { hasAnyPerm, canSeeTab } from '@/lib/permissions';

const STAFF_PERMS = [
  'entry.view_all',
  'plan.view',
  'container.view',
  'vehicle.view',
  'customer.view',
  'route.view',
  'salary.view',
  'dashboard.view',
  'finance.view',
  'user.view',
  'zalo.chat',
  'tab.overview', 'tab.finance', 'tab.data', 'tab.plans', 'tab.monthly',
  'tab.completed', 'tab.containers', 'tab.vehicles', 'tab.chat', 'tab.customers',
  'tab.routes', 'tab.salary', 'tab.users',
];

/** Đường dẫn admin → quyền tab tương ứng (chặn gõ URL trực tiếp). */
const PATH_TAB: { path: string; tab: string; fallback: string[] }[] = [
  { path: '/admin/overview',   tab: 'tab.overview',   fallback: ['dashboard.view'] },
  { path: '/admin/finance',    tab: 'tab.finance',    fallback: ['finance.view', 'dashboard.view'] },
  { path: '/admin/data',       tab: 'tab.data',       fallback: ['entry.view_all'] },
  { path: '/admin/plans',      tab: 'tab.plans',      fallback: ['plan.view'] },
  { path: '/admin/monthly',    tab: 'tab.monthly',    fallback: ['entry.view_all'] },
  { path: '/admin/completed',  tab: 'tab.completed',  fallback: ['plan.view'] },
  { path: '/admin/containers', tab: 'tab.containers', fallback: ['container.view'] },
  { path: '/admin/vehicles',   tab: 'tab.vehicles',   fallback: ['vehicle.view'] },
  { path: '/admin/chat',       tab: 'tab.chat',       fallback: ['zalo.chat'] },
  { path: '/admin/customers',  tab: 'tab.customers',  fallback: ['customer.view'] },
  { path: '/admin/routes',     tab: 'tab.routes',     fallback: ['route.view'] },
  { path: '/admin/salary',     tab: 'tab.salary',     fallback: ['salary.view'] },
  { path: '/admin/users',      tab: 'tab.users',      fallback: ['user.view'] },
];

interface AdminData {
  user: any;
  allUsers: User[];
  /** Danh sách lái xe đầy đủ (không giới hạn theo visibleDriverIds) — dùng cho phân công kế hoạch. */
  assignmentUsers: User[];
  allShippingLines: ShippingLine[];
  allRoutes: Route[];
  allCustomers: Customer[];
  loading: boolean;
  reload: () => void;
}

const AdminDataContext = createContext<AdminData>({
  user: null,
  allUsers: [],
  assignmentUsers: [],
  allShippingLines: [],
  allRoutes: [],
  allCustomers: [],
  loading: true,
  reload: () => {},
});

export const useAdminData = () => useContext(AdminDataContext);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [assignmentUsers, setAssignmentUsers] = useState<User[]>([]);
  const [allShippingLines, setAllShippingLines] = useState<ShippingLine[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const res = await usersApi.getAll();
      setAllUsers(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
  };
  const loadAssignmentUsers = async () => {
    try {
      const res = await usersApi.getAllForAssignment();
      setAssignmentUsers(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {
      // Nếu không được phép (vd role khác) → fallback dùng danh sách thường
      setAssignmentUsers([]);
    }
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
  const loadCustomers = async () => {
    try {
      const res = await customersApi.getAll();
      setAllCustomers(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
  };

  const reload = () => {
    loadUsers();
    loadAssignmentUsers();
    loadShippingLines();
    loadRoutes();
    loadCustomers();
  };

  useEffect(() => {
    Promise.all([
      loadUsers(),
      loadAssignmentUsers(),
      loadShippingLines(),
      loadRoutes(),
      loadCustomers(),
    ]).finally(() => setLoading(false));
  }, []);

  const pathname = usePathname();
  const router = useRouter();

  // Chặn gõ URL trực tiếp vào tab không có quyền → chuyển sang tab đầu tiên được phép.
  useEffect(() => {
    if (!user) return;
    const here = PATH_TAB.find((e) => e.path === pathname);
    if (!here || canSeeTab(user, here.tab, here.fallback)) return;
    const first = PATH_TAB.find((e) => canSeeTab(user, e.tab, e.fallback));
    router.replace(first ? first.path : '/');
  }, [user, pathname, router]);

  if (authLoading) return <LoadingSpinner className="min-h-[60vh]" />;
  if (!user) return null;
  if (!hasAnyPerm(user, STAFF_PERMS)) {
    return <div className="text-center py-16 text-[#78716c] text-sm">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <AdminDataContext.Provider
      value={{ user, allUsers, assignmentUsers, allShippingLines, allRoutes, allCustomers, loading, reload }}
    >
      <div className="flex gap-5 items-start">
        <AdminSidebar user={user} />
        <main className="flex-1 min-w-0">
          <MobileAdminNav user={user} />
          {children}
        </main>
      </div>
      {/* Popup xác nhận xoá (bắt buộc mật khẩu 348) — dùng chung cho mọi tab admin */}
      <DeleteGuardHost />
    </AdminDataContext.Provider>
  );
}