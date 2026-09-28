'use client';

import { useEffect, useMemo, useState } from 'react';

interface Props {
  drivers: VehicleLike[]; // chỉ các tài khoản lái xe
  selected: number[] | null; // null = xem tất cả; [] = không ai; [ids] = giới hạn
  onChange: (ids: number[] | null) => void;
}

/** Dạng tối thiểu mà VehicleSelect cần — User và FinanceVehicle đều khớp. */
export interface VehicleLike {
  id: number;
  fullName: string;
  username: string;
  soXe?: string;
  stt?: string;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

export function VehicleSelect({ drivers, selected, onChange }: Props) {
  const [q, setQ] = useState('');
  // null = xem tất cả (không giới hạn)
  const isViewAll = selected === null;
  const sel = new Set((selected ?? []).map(Number));

  useEffect(() => { setQ(''); }, [JSON.stringify(selected)]);

  const filtered = useMemo(() => {
    const s = normalize(q.trim());
    if (!s) return drivers;
    return drivers.filter((d) =>
      normalize(`${d.fullName} ${d.username} ${d.soXe || ''} ${d.stt || ''}`).includes(s),
    );
  }, [drivers, q]);

  const toggle = (id: number) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const visibleIds = filtered.map((d) => d.id);
  const allVisibleOn = visibleIds.length > 0 && visibleIds.every((id) => sel.has(id));

  return (
    <div className="border border-[#e7e5e4] rounded-lg overflow-hidden">
      {/* Toggle xem tất cả vs giới hạn */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
        <label className="flex items-center gap-1.5 cursor-pointer select-none flex-1" onClick={() => onChange(isViewAll ? [] : null)}>
          <input
            type="checkbox"
            checked={isViewAll}
            onChange={() => onChange(isViewAll ? [] : null)}
            className="w-3.5 h-3.5 accent-[#10b981] cursor-pointer"
          />
          <span className={`text-[10px] font-bold ${isViewAll ? 'text-emerald-700' : 'text-[#78716c]'}`}>
            {isViewAll ? '✅ Xem tất cả xe (không giới hạn)' : '🔒 Giới hạn theo xe cụ thể bên dưới'}
          </span>
        </label>
      </div>
      {/* Khi giới hạn: hiện danh sách xe để chọn */}
      {!isViewAll && (
        <>
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white border-b border-[#e7e5e4]">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 Tìm tên, biển số, STT..."
              className="flex-1 min-w-0 px-2 py-1 bg-[#f5f5f4] border border-[#e7e5e4] rounded-md text-[10px] text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]"
            />
            <button
              type="button"
              onClick={() => onChange(allVisibleOn ? (selected ?? []).filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...(selected ?? []), ...visibleIds])))}
              className="px-2 py-1 rounded-md text-[9px] font-semibold border border-[#f59e0b] text-[#d97706] hover:bg-[rgba(245,158,11,0.1)] cursor-pointer whitespace-nowrap"
            >
              {allVisibleOn ? 'Bỏ chọn' : '☑️ Chọn hết'}
            </button>
          </div>
          <div className="max-h-[180px] overflow-y-auto p-1.5 flex flex-col gap-1">
            {filtered.length === 0 && <div className="text-[10px] text-[#a8a29e] px-2 py-3 text-center">Không có lái xe phù hợp</div>}
            {filtered.map((d) => {
              const on = sel.has(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md border cursor-pointer select-none transition-all ${
                    on ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.1)]' : 'border-[#e7e5e4] bg-white hover:border-[#f59e0b]'
                  }`}
                  onClick={(e) => { e.preventDefault(); toggle(d.id); }}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(d.id)} className="w-3.5 h-3.5 accent-[#f59e0b] cursor-pointer" />
                  <span className="text-[10px] font-semibold text-[#1c1917] truncate">
                    {[d.stt, d.fullName, d.soXe].filter(Boolean).join(' – ')}
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
