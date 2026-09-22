'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hasPerm } from '@/lib/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  perm: string;
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
    items: () => [{ href: '/admin/overview', label: 'Tổng Quan', icon: '📊', perm: 'dashboard.view' }],
  },
  {
    label: 'Vận hành',
    icon: '🚛',
    items: (role) => {
      if (role === 'hr') return [{ href: '/admin/plans', label: 'Kế hoạch', icon: '🚢', perm: 'plan.view' }];
      return [
        { href: '/admin/data', label: role === 'ops' ? 'Thống kê' : 'Tất cả dữ liệu', icon: '📊', perm: 'entry.view_all' },
        { href: '/admin/plans', label: 'Kế hoạch', icon: '🚢', perm: 'plan.view' },
        { href: '/admin/monthly', label: 'Kế hoạch theo tháng', icon: '📅', perm: 'entry.view_all' },
        { href: '/admin/completed', label: 'Đã hoàn thành', icon: '✅', perm: 'plan.view' },
        { href: '/admin/containers', label: 'Mã Số Container', icon: '🗃️', perm: 'container.view' },
        { href: '/admin/chat', label: 'Lịch sử chat', icon: '💬', perm: 'zalo.chat' },
      ];
    },
  },
  {
    label: 'Khách hàng & Doanh thu',
    icon: '💼',
    items: () => [{ href: '/admin/customers', label: 'Khách hàng', icon: '👥', perm: 'customer.view' }],
  },
  {
    label: 'Nhân sự & Lương',
    icon: '🧑‍💼',
    items: (role) => [
      ...(role === 'hr' ? [{ href: '/admin/data', label: 'Lương chuyến', icon: '📊', perm: 'entry.view_all' }] : []),
      { href: '/admin/routes', label: 'Tuyến đường', icon: '🛤️', perm: 'route.view' },
      { href: '/admin/salary', label: 'Lương Tháng', icon: '💵', perm: 'salary.view' },
    ],
  },
  {
    label: 'Hệ thống',
    icon: '⚙️',
    items: () => [{ href: '/admin/users', label: 'Tài khoản', icon: '🧑‍💼', perm: 'user.view' }],
  },
];

export function AdminSidebar({ user }: { user: any }) {
  const pathname = usePathname();
  if (!user) return null;

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items(user.role).filter((item) => hasPerm(user, item.perm)),
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
    items: g.items(user.role).filter((item) => hasPerm(user, item.perm)),
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