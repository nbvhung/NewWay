'use client';

import { PERMISSION_GROUPS, PERMISSION_KEYS } from '@/lib/permissions';

interface Props {
  selected: string[];
  onChange: (perms: string[]) => void;
  grantable?: string[]; // quyền mà người quản lý hiện tại có thể gán (mục khác hiện mờ)
  compact?: boolean;
}

export function PermissionChecklist({ selected, onChange, grantable, compact }: Props) {
  const grantableSet = new Set(grantable || PERMISSION_KEYS);
  const selectedSet = new Set(selected);

  const toggle = (key: string) => {
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  const toggleGroup = (keys: string[]) => {
    const next = new Set(selectedSet);
    const groupKeys = keys.filter((k) => grantableSet.has(k));
    const allOn = groupKeys.every((k) => next.has(k));
    if (allOn) groupKeys.forEach((k) => next.delete(k));
    else groupKeys.forEach((k) => next.add(k));
    onChange(Array.from(next));
  };

  const countFor = (keys: string[]) => keys.filter((k) => selectedSet.has(k)).length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">
          🛡️ Quyền chi tiết <span className="text-[#f59e0b]">({selected.length}/{PERMISSION_KEYS.length} quyền)</span>
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onChange(grantable ? selected.filter((k) => !grantableSet.has(k)) : [])}
            className="px-2 py-1 rounded-md text-[9px] font-semibold border border-[#e7e5e4] text-[#78716c] hover:text-[#1c1917] cursor-pointer"
          >
            Bỏ tất cả
          </button>
          <button
            type="button"
            onClick={() => onChange(Array.from(new Set([...selected.filter((k) => !grantableSet.has(k)), ...(grantable || PERMISSION_KEYS)])))}
            className="px-2 py-1 rounded-md text-[9px] font-semibold border border-[#f59e0b] text-[#d97706] hover:bg-[rgba(245,158,11,0.1)] cursor-pointer"
          >
            ☑️ Chọn tất cả
          </button>
        </div>
      </div>

      {PERMISSION_GROUPS.map((g) => {
        const grantableGroupKeys = g.items.map((i) => i.key).filter((k) => grantableSet.has(k));
        const selectedCount = countFor(g.items.map((i) => i.key));
        return (
          <div key={g.group} className="border border-[#e7e5e4] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(g.items.map((i) => i.key))}
              className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#f5f5f4] text-left cursor-pointer hover:bg-[#efefec] transition-all"
            >
              <span className="text-[10px] font-bold text-[#57534e]">{g.group}</span>
              <span className="text-[9px] font-semibold text-[#a8a29e]">
                {grantableGroupKeys.length > 0 ? (
                  <span className="flex items-center gap-1">
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] ${selectedCount === g.items.length ? 'bg-[#10b981] border-[#10b981] text-white' : selectedCount > 0 ? 'bg-[#fbbf24] border-[#fbbf24] text-white' : 'bg-white border-[#d6d3d1]'}`}>
                      {selectedCount === g.items.length ? '✓' : selectedCount > 0 ? '–' : ''}
                    </span>
                    {selectedCount}/{g.items.length}
                  </span>
                ) : (
                  <span>{selectedCount}/{g.items.length}</span>
                )}
              </span>
            </button>
            <div className={compact ? 'flex flex-col' : 'grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#f0f0ee]'}>
              {g.items.map((p) => {
                const canGrant = grantableSet.has(p.key);
                const on = selectedSet.has(p.key);
                return (
                  <label
                    key={p.key}
                    className={`flex items-start gap-2 px-2.5 py-1.5 bg-white cursor-pointer select-none ${canGrant ? '' : 'opacity-40 cursor-not-allowed'}`}
                    onClick={(e) => {
                      e.preventDefault();
                      if (canGrant) toggle(p.key);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!canGrant}
                      onChange={() => canGrant && toggle(p.key)}
                      className="mt-0.5 w-3.5 h-3.5 accent-[#f59e0b] cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-[#1c1917] leading-tight">{p.label}</div>
                      <div className="text-[9px] text-[#a8a29e] leading-tight">{p.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}