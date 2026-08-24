'use client';

import { useState } from 'react';
import { submissionsApi } from '@/lib/api-submissions';

interface Props {
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function nowVN(): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  return {
    month: Number(parts.find(p => p.type === 'month')?.value),
    year: Number(parts.find(p => p.type === 'year')?.value),
  };
}

const MONTHS_VI = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

export function MonthlySalaryTab({ toast }: Props) {
  const vnNow = nowVN();
  const [month, setMonth] = useState(vnNow.month);
  const [year, setYear] = useState(vnNow.year);
  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await submissionsApi.exportLuongThang(month, year);
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename\*?=(?:UTF-8''|)([^;]+)/);
      const filename = match ? decodeURIComponent(match[1]) : `Lương - Đội Xe - T${String(month).padStart(2, '0')}.${year}.xlsx`;
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Đã xuất file lương tháng ${MONTHS_VI[month]} ${year}`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || e?.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setExporting(false);
    }
  };

  const labelCls = "block text-[10px] font-medium text-[#64748b] mb-1";
  const selectCls = "px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]";

  return (
    <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
      <h3 className="text-base font-bold mb-4">💵 Lương Tháng</h3>
      <p className="text-xs text-[#64748b] mb-4">Chọn tháng/năm và xuất file Excel thanh toán lương cho lái xe (BANG LUONG LX).</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className={labelCls}>Tháng</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectCls}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{MONTHS_VI[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Năm</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectCls}>
            {Array.from({ length: 5 }, (_, i) => vnNow.year - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button onClick={exportExcel} disabled={exporting}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer">
          {exporting ? '⏳ Đang xuất...' : '📥 Xuất Excel'}
        </button>
      </div>
    </div>
  );
}