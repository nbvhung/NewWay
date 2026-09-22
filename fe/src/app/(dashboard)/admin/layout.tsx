'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { usersApi } from '@/lib/api-users';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { routesApi } from '@/lib/api-routes';
import { customersApi } from '@/lib/api-customers';
import { User, ShippingLine, Route, Customer } from '@/types';
import { AdminSidebar, MobileAdminNav } from '@/components/layout/admin-sidebar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { hasAnyPerm } from '@/lib/permissions';

const STAFF_PERMS = [
  'entry.view_all',
  'plan.view',
  'container.view',
  'customer.view',
  'route.view',
  'salary.view',
  'dashboard.view',
  'user.view',
];

interface AdminData {
  user: any;
  allUsers: User[];
  allShippingLines: ShippingLine[];
  allRoutes: Route[];
  allCustomers: Customer[];
  loading: boolean;
  reload: () => void;
}

const AdminDataContext = createContext<AdminData>({
  user: null,
  allUsers: [],
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
    loadShippingLines();
    loadRoutes();
    loadCustomers();
  };

  useEffect(() => {
    Promise.all([loadUsers(), loadShippingLines(), loadRoutes(), loadCustomers()]).finally(() =>
      setLoading(false),
    );
  }, []);

  if (authLoading) return <LoadingSpinner className="min-h-[60vh]" />;
  if (!user) return null;
  if (!hasAnyPerm(user, STAFF_PERMS)) {
    return <div className="text-center py-16 text-[#78716c] text-sm">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <AdminDataContext.Provider
      value={{ user, allUsers, allShippingLines, allRoutes, allCustomers, loading, reload }}
    >
      <div className="flex gap-5 items-start">
        <AdminSidebar user={user} />
        <main className="flex-1 min-w-0">
          <MobileAdminNav user={user} />
          {children}
        </main>
      </div>
    </AdminDataContext.Provider>
  );
}