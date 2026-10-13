'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { canSeeTab } from '@/lib/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Quyền hiển thị tab (tab.*) */
  tab: string;
  /** Quyền chức năng fallback cho tài khoản chưa cấu hình quyền tab */
  fallback: string[];
  /** Nếu có: chỉ hiện cho các username này (bỏ qua hệ thống phân quyền tab). */
  onlyUsernames?: string[];
}

interface NavGroup {
  label: string;
  icon: string;
  items: (role: string) => NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: 'Tổng Quan',
    icon: '📊',
    items: () => [
      { href: '/admin/overview', label: 'Tổng Quan', icon: '📊', tab: 'tab.overview', fallback: ['dashboard.view'] },
    ],
  },
  {
    label: 'Vận hành',
    icon: '🚛',
    items: (role) => [
      { href: '/admin/data', label: role === 'ops' ? 'Thống kê' : 'Tất cả dữ liệu', icon: '📊', tab: 'tab.data', fallback: ['entry.view_all'] },
      { href: '/admin/plans', label: 'Kế hoạch', icon: '🚢', tab: 'tab.plans', fallback: ['plan.view'] },
      { href: '/admin/monthly', label: 'Kế hoạch theo tháng', icon: '📅', tab: 'tab.monthly', fallback: ['entry.view_all'] },
      { href: '/admin/completed', label: 'Đã hoàn thành', icon: '✅', tab: 'tab.completed', fallback: ['plan.view'] },
      { href: '/admin/containers', label: 'Mã Số Container', icon: '🗃️', tab: 'tab.containers', fallback: ['container.view'] },
      { href: '/admin/chat', label: 'Lịch sử chat', icon: '💬', tab: 'tab.chat', fallback: ['zalo.chat'] },
    ],
  },
  {
    label: 'Khách hàng & Doanh thu',
    icon: '💼',
    items: () => [{ href: '/admin/customers', label: 'Khách hàng', icon: '👥', tab: 'tab.customers', fallback: ['customer.view'] }],
  },
  {
    label: 'Nhân sự & Lương',
    icon: '🧑‍💼',
    items: (role) => [
      ...(role === 'hr' ? [{ href: '/admin/data', label: 'Lương chuyến', icon: '📊', tab: 'tab.data', fallback: ['entry.view_all'] }] : []),
      { href: '/admin/routes', label: 'Tuyến đường', icon: '🛤️', tab: 'tab.routes', fallback: ['route.view'] },
      { href: '/admin/salary', label: 'Lương Tháng', icon: '💵', tab: 'tab.salary', fallback: ['salary.view'] },
    ],
  },
  {
    label: 'Hệ thống',
    icon: '⚙️',
    items: () => [
      { href: '/admin/users', label: 'Tài khoản', icon: '🧑‍💼', tab: 'tab.users', fallback: ['user.view'] },
      { href: '/admin/vehicles', label: 'Quản lý XE', icon: '🚛', tab: 'tab.vehicles', fallback: ['vehicle.view'] },
      { href: '/admin/audit', label: 'Lịch sử thao tác', icon: '📜', tab: 'tab.audit', fallback: ['audit.view'], onlyUsernames: ['superadmin'] },
    ],
  },
];

export function AdminSidebar({ user }: { user: any }) {
  const pathname = usePathname();
  if (!user) return null;

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items(user.role).filter((item) =>
      item.onlyUsernames
        ? item.onlyUsernames.includes(user.username)
        : canSeeTab(user, item.tab, item.fallback),
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="hidden lg:flex flex-col w-[230px] shrink-0 bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-3 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-2 pb-1 text-xs font-bold uppercase tracking-wider text-[#a8a29e]">
              {g.icon} {g.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-all border-l-2 ${
                      active
                        ? 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]'
                        : 'text-[#78716c] border-transparent hover:bg-[#f5f5f4] hover:text-[#1c1917]'
                    }`}
                  >
                    <span className="text-sm leading-none">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function MobileAdminNav({ user }: { user: any }) {
  const pathname = usePathname();
  if (!user) return null;
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items(user.role).filter((item) =>
      item.onlyUsernames
        ? item.onlyUsernames.includes(user.username)
        : canSeeTab(user, item.tab, item.fallback),
    ),
  })).filter((g) => g.items.length > 0);
  return (
    <div className="lg:hidden flex flex-col gap-1 mb-4">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="px-2 pb-0.5 text-xs font-bold uppercase tracking-wider text-[#a8a29e]">
            {g.icon} {g.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2.5 py-1.5 rounded-lg text-[13px] font-medium border transition-all ${
                    active
                      ? 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]'
                      : 'text-[#78716c] border-[#e7e5e4] bg-[#ffffff]'
                  }`}
                >
                  {item.icon} {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}