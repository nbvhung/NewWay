'use client';

import { useState, useEffect } from 'react';
import { financeApi, FinanceEntry } from '@/lib/api-finance';

interface Props { user?: any; }

const MONTHS_VI = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN');

function NumInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#78716c] mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number" min="0" value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '0'}
          className="w-full px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#d97706] placeholder:text-[#c4c0bb]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#a8a29e]">₫</span>
      </div>
      {value && Number(value) > 0 && (
        <p className="text-[10px] text-[#a8a29e] mt-0.5">{fmt(Number(value))} ₫</p>
      )}
    </div>
  );
}

export function FinanceTab({ user }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    suaChua: '', nhienLieu: '', cpKhac: '',
    vonXe: '', vonMooc: '', vonKhac: '',
    note: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await financeApi.get(month, year);
      const d = res.data;
      setForm({
        suaChua:   String(d.suaChua   || ''),
        nhienLieu: String(d.nhienLieu || ''),
        cpKhac:    String(d.cpKhac    || ''),
        vonXe:     String(d.vonXe     || ''),
        vonMooc:   String(d.vonMooc   || ''),
        vonKhac:   String(d.vonKhac   || ''),
        note:      d.note ?? '',
      });
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [month, year]);

  const save = async () => {
    setSaving(true);
    try {
      await financeApi.upsert(month, year, {
        suaChua:   Number(form.suaChua   || 0),
        nhienLieu: Number(form.nhienLieu || 0),
        cpKhac:    Number(form.cpKhac    || 0),
        vonXe:     Number(form.vonXe     || 0),
        vonMooc:   Number(form.vonMooc   || 0),
        vonKhac:   Number(form.vonKhac   || 0),
        note:      form.note || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  const setF = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const totalChiPhi = ['suaChua', 'nhienLieu', 'cpKhac'].reduce((s, k) => s + Number((form as any)[k] || 0), 0);
  const totalVon    = ['vonXe', 'vonMooc', 'vonKhac'].reduce((s, k) => s + Number((form as any)[k] || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-[#1c1917]">💰 Tài Chính</h2>
          <p className="text-[11px] text-[#78716c] mt-0.5">Nhập chi phí & vốn đầu tư theo tháng</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="px-3 py-2 text-[12px] bg-white border border-[#e7e5e4] rounded-lg outline-none cursor-pointer">
            {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{MONTHS_VI[m]}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="px-3 py-2 text-[12px] bg-white border border-[#e7e5e4] rounded-lg outline-none cursor-pointer">
            {[year+1,year,year-1,year-2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#78716c] text-sm">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chi phí */}
          <div className="bg-white border border-[#e7e5e4] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[16px]">💸</div>
              <div>
                <p className="text-[13px] font-bold text-[#1c1917]">Chi Phí</p>
                <p className="text-[10px] text-[#78716c]">Sửa chữa, nhiên liệu, chi phí khác</p>
              </div>
            </div>
            <div className="space-y-3">
              <NumInput label="Sửa chữa"    value={form.suaChua}   onChange={setF('suaChua')} />
              <NumInput label="Nhiên liệu"  value={form.nhienLieu} onChange={setF('nhienLieu')} />
              <NumInput label="CP Khác"     value={form.cpKhac}    onChange={setF('cpKhac')} />
            </div>
            {totalChiPhi > 0 && (
              <div className="mt-4 pt-3 border-t border-[#f5f5f4] flex justify-between">
                <span className="text-[12px] font-semibold text-[#78716c]">Tổng chi phí</span>
                <span className="text-[14px] font-bold text-red-600">{fmt(totalChiPhi)} ₫</span>
              </div>
            )}
          </div>

          {/* Vốn đầu tư */}
          <div className="bg-white border border-[#e7e5e4] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[16px]">🏗️</div>
              <div>
                <p className="text-[13px] font-bold text-[#1c1917]">Vốn Đầu Tư</p>
                <p className="text-[10px] text-[#78716c]">Xe, mooc và tài sản khác</p>
              </div>
            </div>
            <div className="space-y-3">
              <NumInput label="Xe"    value={form.vonXe}    onChange={setF('vonXe')} />
              <NumInput label="Mooc"  value={form.vonMooc}  onChange={setF('vonMooc')} />
              <NumInput label="Khác"  value={form.vonKhac}  onChange={setF('vonKhac')} />
            </div>
            {totalVon > 0 && (
              <div className="mt-4 pt-3 border-t border-[#f5f5f4] flex justify-between">
                <span className="text-[12px] font-semibold text-[#78716c]">Tổng vốn</span>
                <span className="text-[14px] font-bold text-blue-600">{fmt(totalVon)} ₫</span>
              </div>
            )}
          </div>

          {/* Ghi chú */}
          <div className="lg:col-span-2 bg-white border border-[#e7e5e4] rounded-xl p-5">
            <label className="text-[11px] font-medium text-[#78716c] mb-1.5 block">Ghi chú (tuỳ chọn)</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={2} placeholder="Ghi chú thêm..."
              className="w-full px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#d97706] placeholder:text-[#c4c0bb] resize-none" />
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-[#f59e0b] to-[#d97706] shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_20px_rgba(245,158,11,0.5)] transition-shadow disabled:opacity-50 cursor-pointer">
          {saving ? 'Đang lưu...' : saved ? '✅ Đã lưu!' : '💾 Lưu tháng này'}
        </button>
      </div>
    </div>
  );
}
