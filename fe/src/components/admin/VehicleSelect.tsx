'use client';

import { useEffect, useMemo, useState } from 'react';

interface Props {
  drivers: VehicleLike[]; // chỉ các tài khoản lái xe
  selected: number[];
  onChange: (ids: number[]) => void;
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
  // Luôn so sánh theo number để tránh mismatch string/number từ API
  const sel = new Set(selected.map(Number));

  // Reset ô tìm kiếm mỗi khi danh sách xe được chọn thay đổi (mở modal mới)
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
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#f5f5f4] border-b border-[#e7e5e4]">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Tìm tên, biển số, STT..."
          className="flex-1 min-w-0 px-2 py-1 bg-[#ffffff] border border-[#e7e5e4] rounded-md text-[10px] text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]"
        />
        <button
          type="button"
          onClick={() => onChange(allVisibleOn ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])))}
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
    </div>
  );
}