'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  financeApi, FinanceEntry, FinanceAdmin, FinanceAuditLog, FinanceCostItem, CostItemInput,
  FinanceVehicle,
} from '@/lib/api-finance';
import { useAuth } from '@/providers/auth-provider';
import { Modal } from '@/components/ui/modal';
import { VehicleSelect } from './VehicleSelect';
import { confirmDelete } from '@/lib/delete-guard';

interface Props { user?: any; }

const MONTHS_VI = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN');

const COST_FIELDS = ['suaChua', 'nhienLieu', 'cpKhac'] as const;
const FIELD_LABEL: Record<string, string> = {
  suaChua: 'Sửa chữa',
  nhienLieu: 'Nhiên liệu',
  cpKhac: 'CP Khác',
  vonXe: 'Vốn xe',
  vonMooc: 'Vốn mooc',
  vonKhac: 'Vốn khác',
  note: 'Ghi chú',
};

/** Gợi ý tên khoản chi hay dùng (datalist). */
const NAME_SUGGESTIONS: Record<string, string[]> = {
  suaChua: ['Thay nhớt', 'Vá lốp', 'Thay lốp', 'Sửa phanh', 'Sửa điện', 'Thay gương', 'Bảo dưỡng', 'Sửa hộp số', 'Thay cầu', 'Sơn xe'],
  nhienLieu: ['Đổ dầu', 'Đổ dầu lần 1', 'Đổ dầu lần 2', 'Dầu máy', 'Dầu cầu', 'Dầu hộp số', 'Nước làm mát'],
  cpKhac: ['Phí cầu đường', 'Phí bến bãi', 'Tiền ăn', 'Nhà nghỉ', 'Rửa xe', 'Phí qua trạm', 'Khác'],
};

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

/** Widget 1 nhóm chi phí: tổng (chỉ đọc) + nút thêm/thu gọn chi tiết. */
function CostGroup({
  category, label, icon, total, items, onAdd, onEdit, onDelete, vehicleLabel,
}: {
  category: string;
  label: string;
  icon: string;
  total: number;
  items: FinanceCostItem[];
  onAdd: () => void;
  onEdit: (it: FinanceCostItem) => void;
  onDelete: (it: FinanceCostItem) => void;
  /** Nhãn xe của 1 dòng chi phí ('' nếu là chi phí chung) */
  vehicleLabel: (vehicleUserId: number | null) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
      <div className="flex items-stretch">
        {/* Bên trái: tổng số (không cho sửa) */}
        <div className="flex-1 px-3 py-2.5 bg-[#faf9f7] flex items-center gap-2 min-w-0">
          <span className="text-[15px]">{icon}</span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-[#78716c] truncate">{label}</p>
            <p className="text-[15px] font-bold text-red-600 whitespace-nowrap">{fmt(total)} ₫</p>
          </div>
          {items.length > 0 && (
            <button onClick={() => setOpen(o => !o)}
              className="ml-auto text-[10px] text-[#a8a29e] hover:text-[#d97706] cursor-pointer shrink-0">
              {open ? '▾' : '▸'} {items.length}
            </button>
          )}
        </div>
        {/* Bên phải: nút thêm chi phí */}
        <button onClick={onAdd}
          className="px-3 bg-white border-l border-[#e7e5e4] text-[11px] font-semibold text-[#d97706] hover:bg-amber-50 cursor-pointer whitespace-nowrap">
          ＋ Thêm
        </button>
      </div>

      {/* Danh sách chi tiết */}
      {open && items.length > 0 && (
        <div className="border-t border-[#f5f5f4] divide-y divide-[#f5f5f4] max-h-[220px] overflow-y-auto">
          {items.map(it => (
            <div key={it.id} className="px-3 py-2 flex items-start gap-2 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-[#1c1917] truncate">{it.name || '(không tên)'}</span>
                  {it.itemDate && <span className="text-[9px] text-[#a8a29e]">{new Date(it.itemDate).toLocaleDateString('vi-VN')}</span>}
                </div>
                {vehicleLabel(it.vehicleUserId) && (
                  <p className="text-[10px] text-blue-600 truncate">🚛 {vehicleLabel(it.vehicleUserId)}</p>
                )}
                {it.note && <p className="text-[10px] text-[#78716c] truncate">{it.note}</p>}
              </div>
              <span className="text-[11px] font-bold text-red-600 whitespace-nowrap">{fmt(Number(it.amount))} ₫</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(it)} title="Sửa" className="text-[10px] text-[#78716c] hover:text-[#d97706] cursor-pointer">✏️</button>
                <button onClick={() => onDelete(it)} title="Xóa" className="text-[10px] text-[#78716c] hover:text-red-600 cursor-pointer">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FinanceTab(_props: Props) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'supper_admin';

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // ── Mật khẩu xem chi phí / nhập vốn đầu tư ───────────
  const [costPassword, setCostPassword] = useState('');   // đã xác thực, dùng gửi kèm request
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwChecking, setPwChecking] = useState(false);
  const unlocked = costPassword !== '';

  // Admin phải mở khoá bằng mật khẩu mới nhập được vốn đầu tư; supper_admin được miễn.
  const canEditInvest = isSuperAdmin || unlocked;

  // ── Ô lọc admin (chỉ supper_admin) ────────────────────
  const [admins, setAdmins] = useState<FinanceAdmin[]>([]);
  const [targetUserId, setTargetUserId] = useState<number | ''>('');

  const [form, setForm] = useState({
    suaChua: '', nhienLieu: '', cpKhac: '',
    vonXe: '', vonMooc: '', vonKhac: '',
    note: '',
  });

  // ── Chi tiết chi phí ─────────────────────────────────
  const [costItems, setCostItems] = useState<Record<string, FinanceCostItem[]>>({ suaChua: [], nhienLieu: [], cpKhac: [] });
  const [costTotals, setCostTotals] = useState({ suaChua: 0, nhienLieu: 0, cpKhac: 0 });

  // ── Bên A / Bên B ────────────────────────────────────
  // Bên là thuộc tính của tài khoản chủ vốn; mỗi bên có sổ chi phí riêng.
  const [ben, setBen] = useState('A');
  const [benLabel, setBenLabel] = useState('Bên A');
  const [ownerName, setOwnerName] = useState('');
  /** Xe thuộc bên đang xem — chỉ hiện xe của bên này. */
  const [vehicles, setVehicles] = useState<FinanceVehicle[]>([]);
  const vehicleById = useMemo(() => {
    const m = new Map<number, FinanceVehicle>();
    vehicles.forEach(v => m.set(Number(v.id), v));
    return m;
  }, [vehicles]);
  const vehicleLabel = useCallback((vehicleUserId: number | null) => {
    if (!vehicleUserId) return '';
    const v = vehicleById.get(Number(vehicleUserId));
    if (!v) return `Xe #${vehicleUserId}`;
    return [v.soXe, v.fullName].filter(Boolean).join(' – ') || v.username;
  }, [vehicleById]);

  // ── Popup thêm/sửa khoản chi phí ─────────────────────
  const [itemOpen, setItemOpen] = useState(false);
  const [itemCategory, setItemCategory] = useState<string>('suaChua');
  const [itemEditing, setItemEditing] = useState<FinanceCostItem | null>(null);
  const [itemForm, setItemForm] = useState({ itemDate: '', name: '', amount: '', note: '' });
  /** Xe được chọn cho khoản chi này (1 hoặc nhiều) */
  const [itemVehicles, setItemVehicles] = useState<number[]>([]);
  /** Số tiền riêng của từng xe, key = vehicleUserId */
  const [itemAmounts, setItemAmounts] = useState<Record<number, string>>({});
  const [itemSaving, setItemSaving] = useState(false);

  const [history, setHistory] = useState<FinanceAuditLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await financeApi.get(month, year, {
        password: unlocked ? costPassword : undefined,
        targetUserId: isSuperAdmin && targetUserId ? Number(targetUserId) : undefined,
      });
      const d: FinanceEntry = res.data as any;
      setForm({
        suaChua:   String(d.suaChua   || ''),
        nhienLieu: String(d.nhienLieu || ''),
        cpKhac:    String(d.cpKhac    || ''),
        vonXe:     String(d.vonXe     || ''),
        vonMooc:   String(d.vonMooc   || ''),
        vonKhac:   String(d.vonKhac   || ''),
        note:      d.note ?? '',
      });
      setCostItems(d.costItems || { suaChua: [], nhienLieu: [], cpKhac: [] });
      setCostTotals(d.costTotals || { suaChua: 0, nhienLieu: 0, cpKhac: 0 });
      setBen(d.ben || 'A');
      setBenLabel(d.benLabel || `Bên ${d.ben || 'A'}`);
      setOwnerName(d.ownerName || '');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Không tải được dữ liệu');
    } finally { setLoading(false); }
  }, [month, year, costPassword, unlocked, targetUserId, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  // Nạp danh sách XE của bên đang xem (chỉ xe cùng bên mới hiện)
  useEffect(() => {
    let cancelled = false;
    financeApi.listVehicles({ targetUserId: isSuperAdmin && targetUserId ? Number(targetUserId) : undefined })
      .then(r => { if (!cancelled) setVehicles(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (!cancelled) setVehicles([]); });
    return () => { cancelled = true; };
  }, [isSuperAdmin, targetUserId, month, year]);

  // Nạp danh sách admin cho ô lọc (chỉ supper_admin)
  useEffect(() => {
    if (!isSuperAdmin) return;
    financeApi.listAdmins()
      .then(r => setAdmins(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAdmins([]));
  }, [isSuperAdmin]);

  const loadHistory = useCallback(async () => {
    if (!unlocked) return;
    try {
      const r = await financeApi.getHistory(month, year, {
        password: costPassword,
        targetUserId: isSuperAdmin && targetUserId ? Number(targetUserId) : undefined,
      });
      setHistory(Array.isArray(r.data) ? r.data : []);
    } catch { setHistory([]); }
  }, [month, year, costPassword, unlocked, targetUserId, isSuperAdmin]);

  const unlock = async () => {
    setPwChecking(true); setPwError('');
    try {
      const r = await financeApi.verifyPassword(pwInput);
      if (r.data?.ok) {
        setCostPassword(pwInput);
        setPwInput('');
      } else {
        setPwError('Mật khẩu không đúng');
      }
    } catch {
      setPwError('Mật khẩu không đúng');
    } finally { setPwChecking(false); }
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await financeApi.upsert(month, year, {
        suaChua:   unlocked ? Number(form.suaChua   || 0) : undefined,
        nhienLieu: unlocked ? Number(form.nhienLieu || 0) : undefined,
        cpKhac:    unlocked ? Number(form.cpKhac    || 0) : undefined,
        vonXe:     canEditInvest ? Number(form.vonXe   || 0) : undefined,
        vonMooc:   canEditInvest ? Number(form.vonMooc || 0) : undefined,
        vonKhac:   canEditInvest ? Number(form.vonKhac || 0) : undefined,
        note:      form.note || null,
        ...(isSuperAdmin && targetUserId ? { targetUserId: Number(targetUserId) } : {}),
      }, { password: unlocked ? costPassword : undefined });
      setSaved(true);
      if (showHistory) loadHistory();
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Lỗi lưu dữ liệu');
    } finally { setSaving(false); }
  };

  const setF = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  // ── Popup thêm/sửa khoản chi phí ─────────────────────
  const openAddItem = (category: string) => {
    setItemCategory(category);
    setItemEditing(null);
    setItemForm({ itemDate: new Date().toISOString().slice(0, 10), name: '', amount: '', note: '' });
    setItemVehicles([]);
    setItemAmounts({});
    setItemOpen(true);
  };

  const openEditItem = (category: string, it: FinanceCostItem) => {
    setItemCategory(category);
    setItemEditing(it);
    setItemForm({
      itemDate: it.itemDate ? String(it.itemDate).slice(0, 10) : '',
      name: it.name || '',
      amount: String(it.amount || ''),
      note: it.note || '',
    });
    const vid = it.vehicleUserId ? Number(it.vehicleUserId) : 0;
    setItemVehicles(vid ? [vid] : []);
    setItemAmounts(vid ? { [vid]: String(it.amount || '') } : {});
    setItemOpen(true);
  };

  const submitItem = async () => {
    if (!itemForm.name.trim()) { setError('Vui lòng nhập tên khoản chi'); return; }
    const base: any = {
      category: itemCategory,
      itemDate: itemForm.itemDate || null,
      name: itemForm.name.trim(),
      note: itemForm.note || null,
      ...(isSuperAdmin && targetUserId ? { targetUserId: Number(targetUserId) } : {}),
    };

    // ── SỬA: 1 dòng = 1 xe (hoặc chi phí chung) ──
    if (itemEditing) {
      const vid = itemVehicles[0] ?? null;
      const amount = vid ? Number(itemAmounts[vid] || 0) : Number(itemForm.amount || 0);
      setItemSaving(true); setError('');
      try {
        await financeApi.updateCostItem(
          itemEditing.id,
          { ...base, vehicleUserId: vid, amount } as CostItemInput,
          { password: costPassword },
        );
        setItemOpen(false);
        await load();
        if (showHistory) loadHistory();
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Lỗi lưu khoản chi phí');
      } finally { setItemSaving(false); }
      return;
    }

    // ── THÊM: chọn nhiều xe → mỗi xe 1 dòng, mỗi xe 1 số tiền ──
    const rows = itemVehicles.map(id => ({ vehicleUserId: id, amount: Number(itemAmounts[id] || 0) }));
    if (rows.length > 0 && rows.every(r => r.amount <= 0)) {
      setError('Vui lòng nhập số tiền cho ít nhất 1 xe'); return;
    }
    if (rows.length === 0 && Number(itemForm.amount || 0) <= 0) {
      setError('Vui lòng nhập số tiền'); return;
    }
    setItemSaving(true); setError('');
    try {
      if (rows.length > 0) {
        await financeApi.addCostItemsBulk(
          month, year, { ...base, vehicles: rows }, { password: costPassword },
        );
      } else {
        await financeApi.addCostItem(
          month, year,
          { ...base, vehicleUserId: null, amount: Number(itemForm.amount || 0) } as CostItemInput,
          { password: costPassword },
        );
      }
      setItemOpen(false);
      await load();
      if (showHistory) loadHistory();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Lỗi lưu khoản chi phí');
    } finally { setItemSaving(false); }
  };

  const deleteItem = async (it: FinanceCostItem) => {
    // Xoá luôn phải nhập mật khẩu 348 (popup của <DeleteGuardHost />).
    const res = await confirmDelete({
      message: `Xóa khoản "${it.name}" (${fmt(Number(it.amount))} ₫)?`,
      action: (pw) => financeApi.deleteCostItem(it.id, { password: pw }),
    });
    if (res === undefined) return;
    await load();
    if (showHistory) loadHistory();
  };

  const totalVon    = ['vonXe', 'vonMooc', 'vonKhac'].reduce((s, k) => s + Number((form as any)[k] || 0), 0);

  const COST_META: Record<string, { label: string; icon: string }> = {
    suaChua:   { label: 'Sửa chữa',   icon: '🔧' },
    nhienLieu: { label: 'Nhiên liệu', icon: '⛽' },
    cpKhac:    { label: 'CP Khác',    icon: '📦' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-[#1c1917]">💰 Tài Chính</h2>
          <p className="text-[11px] text-[#78716c] mt-0.5">Nhập chi phí & vốn đầu tư theo tháng</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Bên đang xem: A / B. Mỗi bên có sổ chi phí riêng, xe riêng. */}
          <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-blue-200 bg-blue-50 text-blue-700 whitespace-nowrap"
            title={ownerName ? `Sổ của ${ownerName}` : undefined}>
            {benLabel}{ownerName ? ` · ${ownerName}` : ''}
          </span>
          {isSuperAdmin && (
            <select value={targetUserId} onChange={e => setTargetUserId(e.target.value ? +e.target.value : '')}
              className="px-3 py-2 text-[12px] bg-white border border-[#e7e5e4] rounded-lg outline-none cursor-pointer"
              title="Chọn bên / chủ vốn để xem và nhập">
              <option value="">— Của tôi —</option>
              {admins.map(a => (
                <option key={a.id} value={a.id}>
                  Bên {a.ben} — {a.fullName} (@{a.username})
                </option>
              ))}
            </select>
          )}
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

      {error && (
        <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
      )}

      {/* ── Khoá chi phí: yêu cầu mật khẩu ────────────────── */}
      {!unlocked && (
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-[16px]">🔒</div>
            <div>
              <p className="text-[13px] font-bold text-[#1c1917]">Xem chi phí &amp; nhập vốn đầu tư</p>
              <p className="text-[10px] text-[#78716c]">Nhập mật khẩu để xem chi phí và nhập vốn đầu tư</p>
            </div>
          </div>
          <div className="flex gap-2 max-w-sm">
            <input
              type="password" value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') unlock(); }}
              placeholder="Mật khẩu..."
              className="flex-1 px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-sm outline-none focus:border-[#d97706]"
            />
            <button onClick={unlock} disabled={pwChecking || !pwInput}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white bg-[#d97706] disabled:opacity-50 cursor-pointer">
              {pwChecking ? '...' : 'Mở khoá'}
            </button>
          </div>
          {pwError && <p className="text-[11px] text-red-600 mt-2">{pwError}</p>}
        </div>
      )}

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
              {unlocked && (
                <span className="ml-auto text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">Đã mở khoá</span>
              )}
            </div>

            {!unlocked ? (
              <div className="py-8 text-center text-[12px] text-[#a8a29e]">
                🔒 Nhập mật khẩu phía trên để xem chi phí
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {COST_FIELDS.map(cat => (
                    <CostGroup
                      key={cat}
                      category={cat}
                      label={COST_META[cat].label}
                      icon={COST_META[cat].icon}
                      total={(costTotals as any)[cat] || 0}
                      items={costItems[cat] || []}
                      onAdd={() => openAddItem(cat)}
                      onEdit={it => openEditItem(cat, it)}
                      onDelete={deleteItem}
                      vehicleLabel={vehicleLabel}
                    />
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-[#f5f5f4] flex justify-between">
                  <span className="text-[12px] font-semibold text-[#78716c]">Tổng chi phí</span>
                  <span className="text-[14px] font-bold text-red-600">
                    {fmt((costTotals.suaChua || 0) + (costTotals.nhienLieu || 0) + (costTotals.cpKhac || 0))} ₫
                  </span>
                </div>
                <button onClick={() => { setShowHistory(s => { const n = !s; if (n) loadHistory(); return n; }); }}
                  className="mt-3 text-[11px] font-medium text-[#d97706] hover:underline cursor-pointer">
                  {showHistory ? '▾ Ẩn lịch sử chỉnh sửa' : '▸ Xem lịch sử chỉnh sửa (chi phí & vốn)'}
                </button>
              </>
            )}
          </div>

          {/* Vốn đầu tư — admin cần mật khẩu, supper_admin được miễn */}
          <div className="bg-white border border-[#e7e5e4] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[16px]">🏗️</div>
              <div>
                <p className="text-[13px] font-bold text-[#1c1917]">Vốn Đầu Tư</p>
                <p className="text-[10px] text-[#78716c]">Xe, mooc và tài sản khác</p>
              </div>
              {!canEditInvest && (
                <span className="ml-auto text-[10px] text-[#a8a29e]">chỉ đọc</span>
              )}
            </div>
            {canEditInvest ? (
              <>
                {targetUserId && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3">
                    Đang nhập vốn cho: <strong>{admins.find(a => a.id === targetUserId)?.fullName}</strong>
                  </p>
                )}
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
              </>
            ) : (
              <div className="space-y-3 opacity-80">
                {([['Xe', form.vonXe], ['Mooc', form.vonMooc], ['Khác', form.vonKhac]] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="flex justify-between px-3 py-2 bg-[#faf9f7] rounded-lg">
                    <span className="text-[12px] text-[#78716c]">{l}</span>
                    <span className="text-[12px] font-semibold text-[#1c1917]">{fmt(Number(v || 0))} ₫</span>
                  </div>
                ))}
                <p className="text-[10px] text-[#a8a29e]">* Nhập mật khẩu ở trên để nhập vốn đầu tư.</p>
              </div>
            )}
          </div>

          {/* Lịch sử chỉnh sửa chi phí & vốn đầu tư */}
          {unlocked && showHistory && (
            <div className="lg:col-span-2 bg-white border border-[#e7e5e4] rounded-xl p-5">
              <p className="text-[13px] font-bold text-[#1c1917] mb-3">🕘 Lịch sử chỉnh sửa chi phí &amp; vốn đầu tư — {MONTHS_VI[month]}/{year}</p>
              {history.length === 0 ? (
                <p className="text-[12px] text-[#a8a29e] py-4 text-center">Chưa có lịch sử chỉnh sửa</p>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {history.map(h => {
                    let changes: Record<string, { old: number; new: number; action?: string; itemName?: string }> = {};
                    try { changes = JSON.parse(h.changes); } catch {}
                    return (
                      <div key={h.id} className="rounded-lg border border-[#f5f5f4] px-4 py-2.5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[12px] font-semibold text-[#1c1917]">{h.editedByName || `User#${h.editedById}`}</span>
                          <span className="text-[10px] text-[#a8a29e]">{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {Object.entries(changes).map(([f, c]) => (
                            <span key={f} className="text-[11px] text-[#78716c]">
                              <strong className="text-[#1c1917]">{FIELD_LABEL[f] || f}</strong>
                              {c.itemName ? ` (${c.itemName})` : ''}
                              {c.action ? ` — ${c.action === 'ADD' ? 'thêm' : c.action === 'DELETE' ? 'xóa' : 'sửa'}` : ''}: {fmt(c.old)} → <span className="text-[#d97706] font-semibold">{fmt(c.new)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving || !canEditInvest}
          title={!canEditInvest ? 'Nhập mật khẩu để chỉnh sửa chi phí & vốn đầu tư' : undefined}
          className="px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-[#f59e0b] to-[#d97706] shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_20px_rgba(245,158,11,0.5)] transition-shadow disabled:opacity-50 cursor-pointer">
          {saving ? 'Đang lưu...' : saved ? '✅ Đã lưu!' : '💾 Lưu tháng này'}
        </button>
      </div>

      {/* ── Popup thêm/sửa khoản chi phí ────────────────── */}
      <Modal
        open={itemOpen}
        onClose={() => setItemOpen(false)}
        title={`${itemEditing ? '✏️ Sửa' : '➕ Thêm'} khoản — ${COST_META[itemCategory]?.label || ''}`}
        footer={
          <div className="flex gap-2 w-full justify-end">
            <button onClick={() => setItemOpen(false)}
              className="px-4 py-2 rounded-lg text-[12px] font-medium border border-[#e7e5e4] text-[#78716c] hover:bg-[#faf9f7] cursor-pointer">
              Huỷ
            </button>
            <button onClick={submitItem} disabled={itemSaving}
              className="px-5 py-2 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-[#f59e0b] to-[#d97706] disabled:opacity-50 cursor-pointer">
              {itemSaving ? 'Đang lưu...' : itemEditing ? '✅ Cập nhật' : '✅ Thêm'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-[#78716c] mb-1 block">Ngày</label>
            <input type="date" value={itemForm.itemDate}
              onChange={e => setItemForm(f => ({ ...f, itemDate: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-sm outline-none focus:border-[#d97706]" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#78716c] mb-1 block">Tên khoản chi <span className="text-red-400">*</span></label>
            <input type="text" list={`sugg-${itemCategory}`} value={itemForm.name}
              onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
              placeholder="vd: Thay nhớt, Đổ dầu..."
              className="w-full px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-sm outline-none focus:border-[#d97706]" />
            <datalist id={`sugg-${itemCategory}`}>
              {(NAME_SUGGESTIONS[itemCategory] || []).map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          {/* Chọn xe: 1 hoặc nhiều. Xe quyết định khoản chi thuộc bên A hay B. */}
          <div>
            <label className="text-[11px] font-medium text-[#78716c] mb-1 block">
              🚛 Xe <span className="text-[#a8a29e] font-normal">
                {itemEditing
                  ? '(1 xe / 1 dòng)'
                  : '(chọn 1 hoặc nhiều xe — để trống = chi phí chung)'}
              </span>
            </label>
            <VehicleSelect
              drivers={vehicles}
              selected={itemVehicles}
              onChange={(ids) => {
                const next = itemEditing ? ids.slice(-1) : ids;
                setItemVehicles(next);
                setItemAmounts(prev => {
                  const keep: Record<number, string> = {};
                  next.forEach(id => { keep[id] = prev[id] ?? ''; });
                  return keep;
                });
              }}
            />
            {vehicles.length === 0 && (
              <p className="text-[10px] text-[#a8a29e] mt-1">
                {benLabel} chưa có xe nào. Gán xe cho bên trong tab Tài khoản (Xe được xem dữ liệu + Bên).
              </p>
            )}
          </div>

          {/* Số tiền: chọn xe thì mỗi xe 1 ô riêng, không chọn xe thì 1 ô chung */}
          {itemVehicles.length > 0 ? (
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-[#78716c] block">
                Số tiền từng xe <span className="text-red-400">*</span>
              </label>
              {itemVehicles.map(id => (
                <div key={id} className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-[11px] text-[#1c1917] truncate">
                    {vehicleLabel(id)}
                  </span>
                  <div className="relative w-40 shrink-0">
                    <input type="number" min="0" value={itemAmounts[id] ?? ''}
                      onChange={e => setItemAmounts(prev => ({ ...prev, [id]: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-1.5 bg-white border border-[#e7e5e4] rounded-lg text-sm text-right outline-none focus:border-[#d97706]" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#a8a29e]">₫</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-[#f5f5f4]">
                <span className="text-[11px] font-semibold text-[#78716c]">
                  Tổng {itemVehicles.length} xe
                </span>
                <span className="text-[12px] font-bold text-red-600">
                  {fmt(itemVehicles.reduce((s, id) => s + Number(itemAmounts[id] || 0), 0))} ₫
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-medium text-[#78716c] mb-1 block">Số tiền <span className="text-red-400">*</span></label>
              <div className="relative">
                <input type="number" min="0" value={itemForm.amount}
                  onChange={e => setItemForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-sm outline-none focus:border-[#d97706]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#a8a29e]">₫</span>
              </div>
              {itemForm.amount && Number(itemForm.amount) > 0 && (
                <p className="text-[10px] text-[#a8a29e] mt-0.5">{fmt(Number(itemForm.amount))} ₫</p>
              )}
            </div>
          )}
          <div>
            <label className="text-[11px] font-medium text-[#78716c] mb-1 block">Ghi chú</label>
            <textarea rows={2} value={itemForm.note}
              onChange={e => setItemForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Ghi chú thêm..."
              className="w-full px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-sm outline-none focus:border-[#d97706] resize-none" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
