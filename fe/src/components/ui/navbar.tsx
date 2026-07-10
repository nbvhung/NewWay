'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { ROLE_LABELS } from '@/lib/utils';

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const isActive = (path: string) => pathname.startsWith(path);

  const roleClass =
    user.role === 'supper_admin'
      ? 'bg-red-500/20 text-red-400'
      : user.role === 'admin'
      ? 'bg-amber-500/20 text-amber-400'
      : user.role === 'ops'
      ? 'bg-purple-500/20 text-purple-400'
      : user.role === 'hr'
      ? 'bg-green-500/20 text-green-400'
      : 'bg-blue-500/20 text-blue-400';

  return (
    <nav className="bg-[rgba(15,23,42,0.95)] backdrop-blur-xl border-b border-[rgba(255,255,255,0.08)] sticky top-0 z-[100]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/form" className="flex items-center gap-2.5 font-bold text-base">
            <span className="w-7 h-7 bg-gradient-to-br from-[#1a56db] to-[#06b6d4] rounded-md flex items-center justify-center text-xs text-white font-bold">
              N
            </span>
            <span className="hidden sm:inline">New Way</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/form"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive('/form')
                  ? 'bg-[#1e293b] text-[#f1f5f9]'
                  : 'text-[#94a3b8] hover:text-[#f1f5f9]'
              }`}
            >
              📝 Nhập liệu
            </Link>
            <Link
              href="/my-data"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive('/my-data')
                  ? 'bg-[#1e293b] text-[#f1f5f9]'
                  : 'text-[#94a3b8] hover:text-[#f1f5f9]'
              }`}
            >
              📊 Dữ liệu của tôi
            </Link>
            {(user.role === 'ops' || user.role === 'admin' || user.role === 'supper_admin' || user.role === 'hr') && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive('/admin')
                    ? 'bg-[#1e293b] text-amber-400'
                    : 'text-[#94a3b8] hover:text-amber-400'
                }`}
              >
                ⚙️ Quản lý
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#1e293b] rounded-lg border border-[rgba(255,255,255,0.08)] text-xs">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#1a56db] to-[#06b6d4] flex items-center justify-center font-bold text-[10px] text-white">
              {(user.fullName || user.username || '?')[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium">{user.fullName}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide ${roleClass}`}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>

          <button
            className="md:hidden flex flex-col gap-1 p-1 bg-none border-none cursor-pointer z-[101]"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span className={`block w-5 h-0.5 bg-[#f1f5f9] rounded transition-all ${menuOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
            <span className={`block w-5 h-0.5 bg-[#f1f5f9] rounded transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-[#f1f5f9] rounded transition-all ${menuOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
          </button>

          <button
            onClick={logout}
            className="text-xs font-medium text-[#94a3b8] px-2.5 py-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] hover:text-[#f1f5f9] transition-all cursor-pointer"
          >
            🚪
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-[rgba(255,255,255,0.08)] bg-[rgba(15,23,42,0.98)] px-4 pb-4 pt-2 flex flex-col gap-1">
          <Link href="/form" className="px-3 py-2 rounded-lg text-sm" onClick={() => setMenuOpen(false)}>
            📝 Nhập liệu
          </Link>
          <Link href="/my-data" className="px-3 py-2 rounded-lg text-sm" onClick={() => setMenuOpen(false)}>
            📊 Dữ liệu của tôi
          </Link>
          {(user.role === 'ops' || user.role === 'admin' || user.role === 'supper_admin' || user.role === 'hr') && (
            <Link href="/admin" className="px-3 py-2 rounded-lg text-sm text-amber-400" onClick={() => setMenuOpen(false)}>
              ⚙️ Quản lý
            </Link>
          )}
          <div className="flex items-center gap-2 px-3 py-2 mt-2 border-t border-[rgba(255,255,255,0.08)] pt-3 text-xs text-[#64748b]">
            {user.fullName} — {ROLE_LABELS[user.role] || user.role}
          </div>
        </div>
      )}
    </nav>
  );
}
