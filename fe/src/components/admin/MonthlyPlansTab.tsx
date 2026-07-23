'use client';

import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/ui/stats-card';
import { Submission } from '@/types';
import { submissionsApi } from '@/lib/api-submissions';

interface Props {
  user: any;
}

const MONTHS_VI = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

export function MonthlyPlansTab({ user }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const toDate = new Date(year, month, 0).toISOString().slice(0, 10);
      const res = await submissionsApi.getAll({ from_date: fromDate, to_date: toDate });
      setSubmissions(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
  }, [month, year]);

  const exportExcel = async () => {
    try {
      const res = await submissionsApi.exportExcel({
        mode: 'monthly',
        month: String(month),
        year: String(year),
      });
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename\*?=(?:UTF-8''|)([^;]+)/);
      const filename = match ? decodeURIComponent(match[1]) : `KeHoachThang_${String(month).padStart(2, '0')}_${year}.xlsx`;
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const driverDataMap = new Map<number, { fullName: string; username: string; stt: string; soXe: string; h20: number; h40: number; v20: number; v40: number; v20fr: number; v40fr: number; vsl: number; tip: number; kv: number }>();
  for (const sub of submissions as any[]) {
    const uid = sub.userId;
    if (!driverDataMap.has(uid)) {
      driverDataMap.set(uid, { fullName: sub.user?.fullName || sub.driverName || '', username: sub.user?.username || '', stt: sub.user?.stt || '', soXe: sub.user?.soXe || '', h20: 0, h40: 0, v20: 0, v40: 0, v20fr: 0, v40fr: 0, vsl: 0, tip: 0, kv: 0 });
    }
    const d = driverDataMap.get(uid)!;
    d.h20 += parseFloat(sub.hang20) || 0;
    d.h40 += parseFloat(sub.hang40) || 0;
    d.v20 += parseFloat(sub.vo20) || 0;
    d.v40 += parseFloat(sub.vo40) || 0;
    d.v20fr += parseFloat(sub.vo20fr) || 0;
    d.v40fr += parseFloat(sub.vo40fr) || 0;
    d.vsl += parseFloat(sub.veSinhLai) || 0;
    d.tip += parseFloat(sub.tip) || 0;
    d.kv += parseFloat(sub.keoVe) || 0;
  }

  const drivers = Array.from(driverDataMap.entries()).map(([id, d]) => ({ id, ...d }));
  drivers.sort((a, b) => (parseInt(a.stt) || 0) - (parseInt(b.stt) || 0) || a.fullName.localeCompare(b.fullName));

  let sumH20 = 0, sumH40 = 0, sumV20 = 0, sumV40 = 0, sumV20fr = 0, sumV40fr = 0, sumVsl = 0, sumKv = 0, sumTip = 0;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-4">
        <StatsCard icon="📋" value={submissions.length} label="Tổng bản ghi" />
        <StatsCard icon="🚢" value={drivers.length} label="Lái xe" />
      </div>

      <div className="flex flex-wrap gap-2.5 items-end mb-4 p-4 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl">
        <div>
          <label className="block text-[10px] font-medium text-[#64748b] mb-1">Tháng</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#64748b] mb-1">Năm</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]">
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button onClick={exportExcel}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] cursor-pointer">
          📥 Xuất Excel
        </button>
        <button onClick={loadData}
          className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">
          🔄 Làm mới
        </button>
      </div>

      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl overflow-x-auto">
        {loading ? (
          <div className="text-center py-16 text-[#64748b] text-sm">Đang tải...</div>
        ) : driverDataMap.size === 0 ? (
          <div className="text-center py-16 text-[#64748b] text-sm">📭 Không có dữ liệu tháng {month}/{year}</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc]">
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">Xe</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">BKS</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">Lái xe NW</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">H20</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">H40</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">V20</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">V40</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">V20FR</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">V40FR</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">VSL</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">KV</th>
                <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">TIP</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => {
                sumH20 += d.h20; sumH40 += d.h40; sumV20 += d.v20; sumV40 += d.v40;
                sumV20fr += d.v20fr; sumV40fr += d.v40fr; sumVsl += d.vsl; sumKv += d.kv; sumTip += d.tip;
                return (
                  <tr key={d.id} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.03)]">
                    <td className="px-3 py-2.5 font-medium">{d.stt || i + 1}</td>
                    <td className="px-3 py-2.5">{d.soXe || '—'}</td>
                    <td className="px-3 py-2.5">{d.fullName}</td>
                    <td className="px-3 py-2.5">{d.h20 || '—'}</td>
                    <td className="px-3 py-2.5">{d.h40 || '—'}</td>
                    <td className="px-3 py-2.5">{d.v20 || '—'}</td>
                    <td className="px-3 py-2.5">{d.v40 || '—'}</td>
                    <td className="px-3 py-2.5">{d.v20fr || '—'}</td>
                    <td className="px-3 py-2.5">{d.v40fr || '—'}</td>
                    <td className="px-3 py-2.5">{d.vsl || '—'}</td>
                    <td className="px-3 py-2.5">{d.kv || '—'}</td>
                    <td className="px-3 py-2.5">{d.tip || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[rgba(26,86,219,0.08)] font-semibold">
                <td className="px-3 py-2.5" colSpan={3}>Tổng cộng</td>
                <td className="px-3 py-2.5">{sumH20 || ''}</td>
                <td className="px-3 py-2.5">{sumH40 || ''}</td>
                <td className="px-3 py-2.5">{sumV20 || ''}</td>
                <td className="px-3 py-2.5">{sumV40 || ''}</td>
                <td className="px-3 py-2.5">{sumV20fr || ''}</td>
                <td className="px-3 py-2.5">{sumV40fr || ''}</td>
                <td className="px-3 py-2.5">{sumVsl || ''}</td>
                <td className="px-3 py-2.5">{sumKv || ''}</td>
                <td className="px-3 py-2.5">{sumTip || ''}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
