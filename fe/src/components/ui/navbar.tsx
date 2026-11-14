'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { ROLE_LABELS } from '@/lib/utils';
import { hasPerm } from '@/lib/permissions';
import { Modal } from '@/components/ui/modal';

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!user) return null;

  const links: { href: string; label: string; show: boolean }[] = [
    { href: '/form', label: '📝 Nhập liệu', show: hasPerm(user, 'entry.submit') },
    { href: '/dien-ho', label: '📝 Điền hộ', show: hasPerm(user, 'entry.enter_for_other') },
    {
      href: '/my-data',
      label: user.role === 'ops' ? '📊 SL TỔNG TÀU' : '📊 Sản lượng của tôi',
      show: user.role === 'laixe' || hasPerm(user, 'entry.view_all') || user.role === 'ops',
    },
    { href: '/admin', label: user.role === 'partner' ? '📈 Tiến độ' : '⚙️ Quản lý', show: user.role === 'partner' || hasPerm(user, 'entry.view_all') || hasPerm(user, 'customer.view') || hasPerm(user, 'salary.view') || hasPerm(user, 'dashboard.view') || hasPerm(user, 'user.view') || hasPerm(user, 'route.view') || hasPerm(user, 'plan.view') },
  ];
  const visibleLinks = links.filter((l) => l.show);

  const isActive = (path: string) =>
    path === '/admin' ? pathname.startsWith('/admin') : pathname.startsWith(path);

  const linkCls = (path: string) =>
    `px-3 py-1.5 rounded-lg text-[15px] font-medium transition-all ${
      isActive(path)
        ? 'bg-[#fef3c7] text-[#92400e]'
        : 'text-[#78716c] hover:bg-[#f5f5f4] hover:text-[#1c1917]'
    }`;

  return (
    <nav className="bg-[rgba(250,250,249,0.95)] backdrop-blur-xl border-b border-[#e7e5e4] sticky top-0 z-[100]">
      <div className="w-full px-4 sm:px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-base">
            <Image
              src="/logo.png"
              alt="New Way Logo"
              width={28}
              height={28}
              className="rounded-md object-contain"
              priority
            />
            <span className="hidden sm:inline">New Way</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {visibleLinks.map((l) => (
              <Link key={l.href} href={l.href} className={linkCls(l.href)}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <button
          className="md:hidden flex flex-col gap-1 p-1 bg-none border-none cursor-pointer z-[101]"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <span className={`block w-5 h-0.5 bg-[#1c1917] rounded transition-all ${menuOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
          <span className={`block w-5 h-0.5 bg-[#1c1917] rounded transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-[#1c1917] rounded transition-all ${menuOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-sm font-medium text-[#1c1917] px-3 py-1.5 bg-[#ffffff] rounded-lg border border-[#e7e5e4]">
            {user.fullName}
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="text-xs font-medium text-[#78716c] px-3 py-1.5 rounded-lg border border-[#e7e5e4] hover:text-[#1c1917] transition-all cursor-pointer"
          >
            🚪 Đăng xuất
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-[#e7e5e4] bg-[rgba(250,250,249,0.98)] px-4 pb-4 pt-2 flex flex-col gap-1">
          {visibleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`px-3 py-2 rounded-lg text-[15px] ${
                isActive(l.href) ? 'bg-[#fef3c7] text-[#92400e]' : 'text-[#78716c]'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <div className="flex items-center justify-between px-3 py-2 mt-2 border-t border-[#e7e5e4] pt-3 text-xs text-[#78716c]">
            <span>{user.fullName} — {ROLE_LABELS[user.role] || user.role}</span>
          </div>
        </div>
      )}
      <Modal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="🚪 Xác nhận đăng xuất"
        footer={
          <>
            <button onClick={() => setShowLogoutConfirm(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] transition-all cursor-pointer">
              Hủy
            </button>
            <button onClick={() => { setShowLogoutConfirm(false); logout(); }} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white shadow-[0_4px_15px_rgba(239,68,68,0.4)] transition-all cursor-pointer">
              ✅ Đăng xuất
            </button>
          </>
        }
      >
        <p className="text-sm text-[#78716c]">Bạn có chắc chắn muốn đăng xuất không?</p>
      </Modal>
    </nav>
  );
}