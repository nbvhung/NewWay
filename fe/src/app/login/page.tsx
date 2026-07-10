'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  if (user) {
    if (user.role === 'tonghop' || user.role === 'admin' || user.role === 'supper_admin') {
      router.replace('/admin');
    } else {
      router.replace('/form');
    }
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(username.trim(), password);
      if (u.role === 'tonghop' || u.role === 'admin' || u.role === 'supper_admin') {
        router.push('/admin');
      } else {
        router.push('/form');
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(26,86,219,0.15)_0%,transparent_60%),radial-gradient(ellipse_at_80%_20%,rgba(6,182,212,0.1)_0%,transparent_50%)]" />

      <div className="relative z-10 w-full max-w-[420px] bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-2xl p-10 sm:p-12 shadow-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#1a56db] to-[#06b6d4] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-[0_8px_32px_rgba(26,86,219,0.4)]">
            🚛
          </div>
          <h1 className="text-xl font-bold leading-tight">Xác nhận sản lượng<br />xe NEW WAY</h1>
          <p className="text-xs text-[#94a3b8] mt-1">Vui lòng đăng nhập để tiếp tục</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/12 border border-red-500/30 text-[#f87171] text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5 tracking-wide">
              Tên đăng nhập <span className="text-[#ef4444] ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập..."
              className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none transition-all focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5 tracking-wide">
              Mật khẩu <span className="text-[#ef4444] ml-0.5">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu..."
              className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none transition-all focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white font-semibold text-sm shadow-[0_4px_15px_rgba(26,86,219,0.4)] transition-all hover:shadow-[0_6px_20px_rgba(26,86,219,0.5)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Đang xử lý...
              </span>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
