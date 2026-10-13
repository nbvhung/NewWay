'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminData } from '../layout';
import { auditApi, AuditLogItem } from '@/lib/api-audit';
import { fmtDateTime } from '@/lib/utils';

const STATUS_CLS = (s: number) =>
  s >= 200 && s < 300
    ? 'bg-emerald-100 text-emerald-700'
    : s >= 400 && s < 500
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';

const METHOD_CLS: Record<string, string> = {
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-purple-100 text-purple-700',
  DELETE: 'bg-red-100 text-red-700',
  GET: 'bg-slate-100 text-slate-600',
};

export default function AdminAuditPage() {
  const { user, allUsers } = useAdminData();
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState('');
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await auditApi.list({
        userId: userId ? Number(userId) : undefined,
        from: from || undefined,
        to: to || undefined,
        q: q.trim() || undefined,
        limit,
        offset,
      });
      const d = res.data as unknown as { data?: AuditLogItem[]; total?: number };
      setItems(Array.isArray(d?.data) ? d.data : []);
      setTotal(Number(d?.total) || 0);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Không tải được nhật ký');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [userId, from, to, q, offset]);

  useEffect(() => {
    load();
  }, [load]);

  if (user && user.role !== 'admin' && user.role !== 'supper_admin') {
    return (
      <div className="py-16 text-center text-[#78716c] text-sm">
        Chỉ admin xem được nhật ký thao tác.
      </div>
    );
  }

  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[#e7e5e4] rounded-xl p-4">
        <h2 className="text-base font-bold mb-3">📜 Lịch sử thao tác</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-[10px] text-[#78716c] mb-1">Người thực hiện</label>
            <select
              value={userId}
              onChange={(e) => { setOffset(0); setUserId(e.target.value); }}
              className="px-2.5 py-1.5 border border-[#e7e5e4] rounded-lg text-xs cursor-pointer"
            >
              <option value="">-- Tất cả --</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[#78716c] mb-1">Từ ngày</label>
            <input type="date" value={from} onChange={(e) => { setOffset(0); setFrom(e.target.value); }}
              className="px-2.5 py-1.5 border border-[#e7e5e4] rounded-lg text-xs" />
          </div>
          <div>
            <label className="block text-[10px] text-[#78716c] mb-1">Đến ngày</label>
            <input type="date" value={to} onChange={(e) => { setOffset(0); setTo(e.target.value); }}
              className="px-2.5 py-1.5 border border-[#e7e5e4] rounded-lg text-xs" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] text-[#78716c] mb-1">Từ khóa (đường dẫn)</label>
            <input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setOffset(0), load())}
              placeholder="vd: ket-thuc"
              className="w-full px-2.5 py-1.5 border border-[#e7e5e4] rounded-lg text-xs" />
          </div>
          <button onClick={() => { setOffset(0); load(); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer">
            🔍 Tìm
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e7e5e4] rounded-xl overflow-hidden">
        {err && <div className="px-4 py-3 text-sm text-red-600">{err}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#f5f5f4] text-[#78716c] text-left">
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Thời gian</th>
                <th className="px-3 py-2 font-semibold">Người thực hiện</th>
                <th className="px-3 py-2 font-semibold">Thao tác</th>
                <th className="px-3 py-2 font-semibold">Đường dẫn</th>
                <th className="px-3 py-2 font-semibold">KQ</th>
                <th className="px-3 py-2 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[#78716c]">Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[#78716c]">Không có dữ liệu</td></tr>
              ) : items.map((it) => (
                <tr key={it.id} className="border-t border-[#e7e5e4] hover:bg-[#fafaf9] align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-[#78716c]">{fmtDateTime(it.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#1c1917]">{it.fullName || it.username || '—'}</div>
                    <div className="text-[10px] text-[#a8a29e]">{it.role}{it.username ? ` · ${it.username}` : ''}</div>
                  </td>
                  <td className="px-3 py-2">{it.action || <span className="text-[#a8a29e]">—</span>}</td>
                  <td className="px-3 py-2">
                    <span className={`mr-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${METHOD_CLS[it.method] || 'bg-slate-100 text-slate-600'}`}>{it.method}</span>
                    <span className="text-[#475569] break-all">{it.path}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_CLS(it.status)}`}>{it.status}</span>
                  </td>
                  <td className="px-3 py-2 text-[#78716c] whitespace-nowrap">{it.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-3 py-2 border-t border-[#e7e5e4] text-[12px] text-[#78716c]">
          <span>Tổng {total} · Trang {page}/{pages}</span>
          <div className="flex gap-2">
            <button disabled={offset <= 0} onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-2.5 py-1 rounded border border-[#e7e5e4] disabled:opacity-40 cursor-pointer">← Trước</button>
            <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}
              className="px-2.5 py-1 rounded border border-[#e7e5e4] disabled:opacity-40 cursor-pointer">Sau →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
