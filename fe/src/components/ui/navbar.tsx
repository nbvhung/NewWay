'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { ROLE_LABELS } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!user) return null;

  const isActive = (path: string) => pathname.startsWith(path);

  const roleClass =
    user.role === 'supper_admin'
      ? 'bg-red-500/20 text-red-600'
      : user.role === 'admin'
      ? 'bg-amber-500/20 text-amber-600'
      : user.role === 'ops'
      ? 'bg-purple-500/20 text-purple-600'
      : user.role === 'hr'
      ? 'bg-green-500/20 text-green-600'
      : 'bg-blue-500/20 text-blue-600';

  return (
    <nav className="bg-[rgba(241,245,249,0.95)] backdrop-blur-xl border-b border-[rgba(0,0,0,0.08)] sticky top-0 z-[100]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/form" className="flex items-center gap-2.5 font-bold text-base">
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
            {user.role !== 'hr' && (
            <Link
              href="/form"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive('/form')
                  ? 'bg-[#ffffff] text-[#0f172a]'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              📝 Nhập liệu
            </Link>
            )}
            {user.role !== 'admin' && user.role !== 'hr' && (
            <Link
              href="/my-data"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive('/my-data')
                  ? 'bg-[#ffffff] text-[#0f172a]'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              📊 Sản lượng của tôi
            </Link>
            )}
            {(user.role === 'ops' || user.role === 'admin' || user.role === 'supper_admin' || user.role === 'hr') && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive('/admin')
                    ? 'bg-[#ffffff] text-amber-600'
                    : 'text-[#64748b] hover:text-amber-600'
                }`}
              >
                ⚙️ Quản lý
              </Link>
            )}
          </div>
        </div>

        <button
          className="md:hidden flex flex-col gap-1 p-1 bg-none border-none cursor-pointer z-[101]"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <span className={`block w-5 h-0.5 bg-[#0f172a] rounded transition-all ${menuOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
          <span className={`block w-5 h-0.5 bg-[#0f172a] rounded transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-[#0f172a] rounded transition-all ${menuOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#ffffff] rounded-lg border border-[rgba(0,0,0,0.08)] text-xs">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#1a56db] to-[#06b6d4] flex items-center justify-center font-bold text-[10px] text-white">
              {(user.fullName || user.username || '?')[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium">{user.fullName}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide ${roleClass}`}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="text-xs font-medium text-[#64748b] px-2.5 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer"
          >
            🚪
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-[rgba(0,0,0,0.08)] bg-[rgba(241,245,249,0.98)] px-4 pb-4 pt-2 flex flex-col gap-1">
          {user.role !== 'hr' && (
          <Link href="/form" className="px-3 py-2 rounded-lg text-sm" onClick={() => setMenuOpen(false)}>
            📝 Nhập liệu
          </Link>
          )}
          {user.role !== 'admin' && user.role !== 'hr' && (
          <Link href="/my-data" className="px-3 py-2 rounded-lg text-sm" onClick={() => setMenuOpen(false)}>
            📊 Sản lượng của tôi
          </Link>
          )}
          {(user.role === 'ops' || user.role === 'admin' || user.role === 'supper_admin' || user.role === 'hr') && (
            <Link href="/admin" className="px-3 py-2 rounded-lg text-sm text-amber-600" onClick={() => setMenuOpen(false)}>
              ⚙️ Quản lý
            </Link>
          )}
          <div className="flex items-center gap-2 px-3 py-2 mt-2 border-t border-[rgba(0,0,0,0.08)] pt-3 text-xs text-[#64748b]">
            {user.fullName} — {ROLE_LABELS[user.role] || user.role}
          </div>
        </div>
      )}
      <Modal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="🚪 Xác nhận đăng xuất"
        footer={
          <>
            <button onClick={() => setShowLogoutConfirm(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">
              Hủy
            </button>
            <button onClick={() => { setShowLogoutConfirm(false); logout(); }} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white shadow-[0_4px_15px_rgba(239,68,68,0.4)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.5)] transition-all cursor-pointer">
              ✅ Đăng xuất
            </button>
          </>
        }
      >
        <p className="text-sm text-[#64748b]">Bạn có chắc chắn muốn đăng xuất không?</p>
      </Modal>
    </nav>
  );
}
