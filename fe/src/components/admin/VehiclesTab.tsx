'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  vehiclesApi,
  VehicleItem,
  VehicleOverride,
  VehicleFinance,
} from '@/lib/api-vehicles';
import { dashboardApi, DashboardOverview } from '@/lib/api-dashboard';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { Modal } from '@/components/ui/modal';
import { confirmDelete } from '@/lib/delete-guard';
import { financeApi } from '@/lib/api-finance';
import { hasPerm } from '@/lib/permissions';
import { User } from '@/types';

/** Nhãn nhóm chi phí / vốn đầu tư (dùng ở Chi tiết xe). */
const FIN_CAT_LABEL: Record<string, string> = {
  suaChua: 'Sửa chữa',
  nhienLieu: 'Nhiên liệu',
  cpKhac: 'CP khác',
  vonXe: 'Vốn xe',
  vonMooc: 'Vốn mooc',
  vonKhac: 'Vốn khác',
};

/** Tải blob về máy, lấy tên file từ Content-Disposition nếu có. */
function downloadBlob(res: any, fallback: string) {
  const cd = res?.headers?.['content-disposition'] as string | undefined;
  let name = fallback;
  if (cd) {
    const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
    if (m) name = decodeURIComponent(m[1]);
  }
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Props {
  currentUser: any;
  allUsers: User[];
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString('vi-VN');
const MONTHS_VN = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

const emptyForm = {
  soXe: '',
  soMooc: '',
  stt: '',
  ngayHoatDong: '',
  ownerUserId: '' as number | '',
};

/** Loại khoản nhập kèm xe: chi phí hoặc vốn đầu tư. */
const ITEM_CATEGORIES: { key: string; label: string; group: 'cost' | 'invest' }[] = [
  { key: 'suaChua', label: 'Sửa chữa', group: 'cost' },
  { key: 'nhienLieu', label: 'Nhiên liệu', group: 'cost' },
  { key: 'cpKhac', label: 'CP khác', group: 'cost' },
  { key: 'vonXe', label: 'Vốn xe', group: 'invest' },
  { key: 'vonMooc', label: 'Vốn mooc', group: 'invest' },
  { key: 'vonKhac', label: 'Vốn khác', group: 'invest' },
];

export function VehiclesTab({ currentUser, allUsers, toast }: Props) {
  const now = new Date();
  const [view, setView] = useState<'list' | 'overrides' | 'detail'>('list');
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignVehicle, setAssignVehicle] = useState<VehicleItem | null>(null);
  const [assignIds, setAssignIds] = useState<number[]>([]);
  const [driverSearch, setDriverSearch] = useState('');

  // Nhập chi phí / vốn đầu tư kèm xe
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemVehicle, setItemVehicle] = useState<VehicleItem | null>(null);
  const [itemForm, setItemForm] = useState({ category: 'suaChua', itemDate: '', name: '', amount: '', note: '', password: '', invoice: false, invoiceAmount: '', cashAmount: '', transferAmount: '' });
  const [savingItem, setSavingItem] = useState(false);

  // Đảo lái xe
  const [overrides, setOverrides] = useState<VehicleOverride[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [ovForm, setOvForm] = useState({
    vehicleId: '' as number | '',
    planId: '' as number | '',
    driverId: '' as number | '',
  });

  // Chi tiết xe
  const [detail, setDetail] = useState<VehicleItem | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const admins = useMemo(
    () => allUsers.filter((u) => u.role === 'admin' || u.role === 'supper_admin'),
    [allUsers],
  );
  const drivers = useMemo(
    () => allUsers.filter((u) => u.role === 'laixe'),
    [allUsers],
  );

  const load = async () => {
    setLoading(true);
    try {
      const res = await vehiclesApi.getAll();
      setVehicles((res.data as any).data || []);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Không tải được danh sách xe', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadOverrides = async () => {
    try {
      const [ov, pl] = await Promise.all([
        vehiclesApi.listOverrides(),
        shippingLinesApi.getAllAdmin(),
      ]);
      setOverrides((ov.data as any).data || []);
      setPlans((pl.data as any).data || pl.data || []);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Không tải được đảo lái xe', 'error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (view === 'overrides') loadOverrides();
  }, [view]);

  // ── CRUD xe ──
  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };
  const openEdit = (v: VehicleItem) => {
    setEditId(v.id);
    setForm({
      soXe: v.soXe || '',
      soMooc: v.soMooc || '',
      stt: v.stt || '',
      ngayHoatDong: v.ngayHoatDong || '',
      ownerUserId: v.ownerUserId ?? '',
    });
    setModalOpen(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        soXe: form.soXe,
        soMooc: form.soMooc,
        stt: form.stt,
        ngayHoatDong: form.ngayHoatDong || null,
        ownerUserId: form.ownerUserId === '' ? null : Number(form.ownerUserId),
      };
      if (editId) await vehiclesApi.update(editId, payload);
      else await vehiclesApi.create(payload);
      setModalOpen(false);
      toast(editId ? 'Đã lưu xe' : 'Đã thêm xe', 'success');
      load();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };
  const remove = async (v: VehicleItem) => {
    const res = await confirmDelete({
      message: `Bạn chắc chắn muốn XÓA xe ${v.soXe || '#' + v.id}?`,
      action: () => vehiclesApi.remove(v.id),
    });
    if (res === undefined) return;
    toast('Đã xóa xe', 'success');
    load();
  };

  // ── Nhập chi phí / vốn đầu tư cho xe ──
  const openAddItem = (v: VehicleItem | null, category = 'suaChua') => {
    setItemVehicle(v);
    setItemForm({ category, itemDate: '', name: '', amount: '', note: '', password: '', invoice: false, invoiceAmount: '', cashAmount: '', transferAmount: '' });
    setItemModalOpen(true);
  };
  const onAmountChange = (v: string) => {
    setItemForm((f) => {
      const amt = Number(v.replace(/[^0-9]/g, '')) || 0;
      if (f.cashAmount || f.transferAmount) {
        const t = Number(f.transferAmount.replace(/[^0-9]/g, '')) || 0;
        return { ...f, amount: v, cashAmount: String(Math.max(0, amt - t)) };
      }
      return { ...f, amount: v, cashAmount: v ? String(amt) : '', transferAmount: v ? '0' : '' };
    });
  };
  const onCashChange = (v: string) => {
    setItemForm((f) => {
      const amt = Number(f.amount.replace(/[^0-9]/g, '')) || 0;
      const c = Number(v.replace(/[^0-9]/g, '')) || 0;
      return { ...f, cashAmount: v, transferAmount: String(Math.max(0, amt - c)) };
    });
  };
  const onTransferChange = (v: string) => {
    setItemForm((f) => {
      const amt = Number(f.amount.replace(/[^0-9]/g, '')) || 0;
      const t = Number(v.replace(/[^0-9]/g, '')) || 0;
      return { ...f, transferAmount: v, cashAmount: String(Math.max(0, amt - t)) };
    });
  };

  const submitItem = async () => {
    const amount = Number(itemForm.amount.replace(/[^0-9]/g, ''));
    if (!amount || amount <= 0) { toast('Nhập số tiền', 'error'); return; }
    const invoiceAmount = itemForm.invoice ? Number(itemForm.invoiceAmount.replace(/[^0-9]/g, '')) : null;
    if (itemForm.invoice && (!invoiceAmount || invoiceAmount <= 0)) { toast('Nhập số tiền xuất hoá đơn', 'error'); return; }
    if (invoiceAmount !== null && invoiceAmount > amount) { toast('Số tiền xuất HĐ không được lớn hơn khoản chi', 'error'); return; }
    const cashAmount = Number(itemForm.cashAmount.replace(/[^0-9]/g, '')) || 0;
    const transferAmount = Number(itemForm.transferAmount.replace(/[^0-9]/g, '')) || 0;
    if (cashAmount + transferAmount !== amount) { toast('Tiền mặt + chuyển khoản phải bằng số tiền', 'error'); return; }
    if (!itemForm.password) { toast('Nhập mật khẩu', 'error'); return; }
    setSavingItem(true);
    try {
      await financeApi.addCostItem(month, year, {
        category: itemForm.category,
        itemDate: itemForm.itemDate || null,
        name: itemForm.name,
        amount,
        invoiceAmount,
        cashAmount,
        transferAmount,
        note: itemForm.note || null,
        vehicleUserId: itemVehicle ? itemVehicle.id : null,
      }, { password: itemForm.password });
      setItemModalOpen(false);
      toast('Đã thêm khoản', 'success');
      if (detail && itemVehicle && detail.id === itemVehicle.id) openDetail(detail);
      load();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Thêm thất bại', 'error');
    } finally {
      setSavingItem(false);
    }
  };

  // ── phân công lái xe ──
  const openAssign = (v: VehicleItem) => {
    setAssignVehicle(v);
    setAssignIds(v.drivers.map((d) => d.id));
    setDriverSearch('');
    setAssignOpen(true);
  };
  const saveAssign = async () => {
    if (!assignVehicle) return;
    setSaving(true);
    try {
      await vehiclesApi.assignDrivers(assignVehicle.id, assignIds);
      setAssignOpen(false);
      toast('Đã cập nhật phân công lái xe', 'success');
      if (detail && detail.id === assignVehicle.id) openDetail(detail);
      await load();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── đảo lái xe ──
  const saveOverride = async () => {
    if (!ovForm.vehicleId || !ovForm.planId || !ovForm.driverId) {
      toast('Chọn đủ Xe, Kế hoạch và Lái xe', 'error');
      return;
    }
    setSaving(true);
    try {
      await vehiclesApi.upsertOverride({
        vehicleId: Number(ovForm.vehicleId),
        planId: Number(ovForm.planId),
        driverId: Number(ovForm.driverId),
      });
      toast('Đã lưu đảo lái xe', 'success');
      setOvForm({ vehicleId: '', planId: '', driverId: '' });
      loadOverrides();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };
  const removeOverride = async (o: VehicleOverride) => {
    const res = await confirmDelete({
      message: `Xoá đảo lái xe: KH "${o.planName}" – ${o.driverName} → ${o.vehicleLabel}?`,
      action: () => vehiclesApi.deleteOverride(o.id),
    });
    if (res === undefined) return;
    toast('Đã xoá', 'success');
    loadOverrides();
  };

  // ── chi tiết xe ──
  const openDetail = async (v: VehicleItem) => {
    setView('detail');
    setDetail(v);
    setDetailLoading(true);
    try {
      const [one, ov, dash] = await Promise.all([
        vehiclesApi.getOne(v.id),
        vehiclesApi.listOverrides({ vehicleId: v.id }),
        dashboardApi.getOverview(month, year),
      ]);
      setDetail((one.data as any).data || v);
      setOverrides((ov.data as any).data || []);
      setOverview((dash.data as any).data);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Không tải được chi tiết', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const reloadDetail = async () => {
    if (!detail) return;
    setDetailLoading(true);
    try {
      const dash = await dashboardApi.getOverview(month, year);
      setOverview((dash.data as any).data);
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = vehicles.filter((v) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      v.soXe.toLowerCase().includes(s) ||
      v.soMooc.toLowerCase().includes(s) ||
      v.ownerName.toLowerCase().includes(s) ||
      v.drivers.some((d) => d.fullName.toLowerCase().includes(s))
    );
  });
  const filteredDrivers = drivers.filter((d) => {
    const s = driverSearch.trim().toLowerCase();
    if (!s) return true;
    return (
      d.fullName.toLowerCase().includes(s) ||
      (d.username || '').toLowerCase().includes(s) ||
      (d.soXe || '').toLowerCase().includes(s)
    );
  });

  // ── Tab switch ──
  const tabBtn = (key: 'list' | 'overrides', label: string) => (
    <button
      onClick={() => setView(key)}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer ${
        view === key
          ? 'bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white'
          : 'bg-white border border-[#e7e5e4] text-[#78716c]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[18px] font-extrabold text-[#1c1917]">🚛 Quản lý XE</h2>
          <p className="text-[12px] text-[#78716c] mt-0.5">
            {view === 'detail' ? 'Chi tiết xe' : `${vehicles.length} xe`}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {view !== 'detail' && tabBtn('list', 'Danh sách xe')}
          {view !== 'detail' && tabBtn('overrides', 'Đảo lái xe')}
          {view === 'detail' && (
            <button
              onClick={() => { setView('list'); setDetail(null); setOverview(null); }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-[#e7e5e4] text-[#78716c] cursor-pointer"
            >
              ← Về danh sách
            </button>
          )}
        </div>
      </div>

      {/* ─── DANH SÁCH XE ─── */}
      {view === 'list' && (
        <>
          <div className="flex justify-end gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm biển số / chủ vốn / lái xe..."
              className="px-3 py-2 text-[12px] border border-[#e7e5e4] rounded-lg outline-none focus:border-[#f59e0b] w-[240px]"
            />
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer"
            >
              + Thêm xe
            </button>
            <button
              onClick={() => openAddItem(null, 'cpKhac')}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-white border border-[#e7e5e4] text-[#78716c] cursor-pointer"
            >
              + Chi phí chung
            </button>
          </div>
          {loading ? (
            <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e7e5e4]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#f5f5f4] text-[#78716c] text-left">
                    <th className="px-3 py-2.5 font-semibold">Biển số</th>
                    <th className="px-3 py-2.5 font-semibold">Mooc</th>
                    <th className="px-3 py-2.5 font-semibold">STT</th>
                    <th className="px-3 py-2.5 font-semibold">Chủ vốn</th>
                    <th className="px-3 py-2.5 font-semibold">Bên</th>
                    <th className="px-3 py-2.5 font-semibold">Lái xe</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-[#78716c]">Chưa có xe nào</td>
                    </tr>
                  ) : (
                    filtered.map((v) => (
                      <tr key={v.id} className="border-t border-[#e7e5e4] hover:bg-[#fafaf9]">
                        <td
                          className="px-3 py-2.5 font-semibold text-[#1c1917] cursor-pointer"
                          onClick={() => openDetail(v)}
                        >
                          🚛 {v.soXe || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-[#78716c]">{v.soMooc || '—'}</td>
                        <td className="px-3 py-2.5 text-[#78716c]">{v.stt || '—'}</td>
                        <td className="px-3 py-2.5 text-[#78716c]">{v.ownerName || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(59,130,246,0.15)] text-blue-600">
                            Bên {v.ben}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[#78716c]">
                          {v.drivers.length > 0 ? v.drivers.map((d) => d.fullName).join(', ') : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <button onClick={() => openDetail(v)} className="px-2 py-1 text-[11px] rounded border border-[#e7e5e4] hover:bg-[#f5f5f4] cursor-pointer mr-1">📊 Chi tiết</button>
                          <button onClick={() => openAssign(v)} className="px-2 py-1 text-[11px] rounded border border-[#e7e5e4] hover:bg-[#f5f5f4] cursor-pointer mr-1">👥 Lái xe</button>
                          <button onClick={() => openEdit(v)} className="px-2 py-1 text-[11px] rounded border border-[#e7e5e4] hover:bg-[#f5f5f4] cursor-pointer mr-1">✏️</button>
                          <button onClick={() => remove(v)} className="px-2 py-1 text-[11px] rounded border border-[#fecaca] text-red-600 hover:bg-[#fef2f2] cursor-pointer">🗑</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── ĐẢO LÁI XE ─── */}
      {view === 'overrides' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#e7e5e4] p-4">
            <p className="text-[12px] font-bold text-[#1c1917] mb-3">Thêm đảo lái xe (theo kế hoạch)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Xe (đã chạy)</label>
                <select
                  value={ovForm.vehicleId}
                  onChange={(e) => setOvForm({ ...ovForm, vehicleId: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs cursor-pointer"
                >
                  <option value="">— Chọn xe —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.soXe || `Xe #${v.id}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Kế hoạch</label>
                <select
                  value={ovForm.planId}
                  onChange={(e) => setOvForm({ ...ovForm, planId: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs cursor-pointer"
                >
                  <option value="">— Chọn kế hoạch —</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {[p.name, p.soChuyen, p.routeName, p.ngay ? p.ngay.split('-').reverse().join('-') : ''].filter(Boolean).join(' / ')}
                      {Array.isArray(p.vehicleTags) && p.vehicleTags.length > 0 ? ` — 🚛 ${p.vehicleTags.join(', ')}` : ''}
                    </option>
                  ))}
                </select>
                {(() => {
                  const sel = plans.find((p) => p.id === ovForm.planId);
                  const tags: string[] = Array.isArray(sel?.vehicleTags) ? sel.vehicleTags : [];
                  return tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tags.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(59,130,246,0.12)] text-[#2563eb]">🚛 {t}</span>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Lái xe (chạy xe đó)</label>
                <select
                  value={ovForm.driverId}
                  onChange={(e) => setOvForm({ ...ovForm, driverId: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs cursor-pointer"
                >
                  <option value="">— Chọn lái xe —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName}{d.soXe ? ` (${d.soXe})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={saveOverride}
              disabled={saving}
              className="mt-3 px-4 py-2 rounded-lg text-[12px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Đang lưu...' : '💾 Lưu đảo lái xe'}
            </button>
            <p className="text-[10px] text-[#a8a29e] mt-2">
              Ưu tiên cao nhất: doanh thu + lương chuyến tính cho xe đã chạy; lương cứng + BHXH vẫn theo xe nhà của lái xe.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#e7e5e4]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#f5f5f4] text-[#78716c] text-left">
                  <th className="px-3 py-2.5 font-semibold">Kế hoạch</th>
                  <th className="px-3 py-2.5 font-semibold">Lái xe</th>
                  <th className="px-3 py-2.5 font-semibold">Xe đã chạy</th>
                  <th className="px-3 py-2.5 font-semibold">Người đặt</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {overrides.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-[#78716c]">Chưa có đảo lái xe nào</td></tr>
                ) : (
                  overrides.map((o) => (
                    <tr key={o.id} className="border-t border-[#e7e5e4] hover:bg-[#fafaf9]">
                      <td className="px-3 py-2.5 text-[#1c1917]">{o.planName}{o.routeName ? ` · ${o.routeName}` : ''}{o.planNgay ? ` · ${o.planNgay}` : ''}</td>
                      <td className="px-3 py-2.5 text-[#78716c]">{o.driverName}</td>
                      <td className="px-3 py-2.5 font-semibold text-[#1c1917]">🚛 {o.vehicleLabel}</td>
                      <td className="px-3 py-2.5 text-[#78716c]">{o.createdByName || '—'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => removeOverride(o)} className="px-2 py-1 text-[11px] rounded border border-[#fecaca] text-red-600 hover:bg-[#fef2f2] cursor-pointer">🗑 Xoá</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── CHI TIẾT XE ─── */}
      {view === 'detail' && detail && (
        <VehicleDetail
          detail={detail}
          overview={overview}
          overrides={overrides}
          month={month}
          year={year}
          loading={detailLoading}
          setMonth={setMonth}
          setYear={setYear}
          reload={reloadDetail}
          onEdit={() => openEdit(detail)}
          onAssign={() => openAssign(detail)}
          onRemoveOverride={removeOverride}
          onAddCost={() => openAddItem(detail, 'suaChua')}
          onAddInvest={() => openAddItem(detail, 'vonXe')}
          currentUser={currentUser}
          toast={toast}
        />
      )}

      {/* Modal thêm/sửa xe */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? '✏️ Sửa xe' : '➕ Thêm xe'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] cursor-pointer">Hủy</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">{saving ? 'Đang lưu...' : '💾 Lưu'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Biển số</label>
            <input value={form.soXe} onChange={(e) => setForm({ ...form, soXe: e.target.value })} placeholder="15H 07883" className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Số mooc</label>
            <input value={form.soMooc} onChange={(e) => setForm({ ...form, soMooc: e.target.value })} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">STT</label>
            <input value={form.stt} onChange={(e) => setForm({ ...form, stt: e.target.value })} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Ngày hoạt động</label>
            <input type="date" value={form.ngayHoatDong} onChange={(e) => setForm({ ...form, ngayHoatDong: e.target.value })} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Chủ vốn</label>
            <select value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs cursor-pointer">
              <option value="">— Chưa gán —</option>
              {admins.map((a) => (<option key={a.id} value={a.id}>{a.fullName}{a.ben ? ` (Bên ${a.ben})` : ''}</option>))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Modal phân công lái xe */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={`👥 Phân công lái xe — ${assignVehicle?.soXe || ''}`}
        footer={
          <>
            <button onClick={() => setAssignOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] cursor-pointer">Hủy</button>
            <button onClick={saveAssign} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">{saving ? 'Đang lưu...' : '💾 Lưu phân công'}</button>
          </>
        }
      >
        <input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Tìm lái xe..." className="w-full px-3 py-2 mb-3 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
        <div className="max-h-[320px] overflow-y-auto flex flex-col gap-1">
          {filteredDrivers.map((d) => {
            const checked = assignIds.includes(d.id);
            return (
              <label key={d.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs border ${checked ? 'border-[#f59e0b] bg-[#fef3c7]' : 'border-[#e7e5e4]'}`}>
                <input type="checkbox" checked={checked} onChange={(e) => setAssignIds((prev) => e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id))} />
                <span className="font-medium text-[#1c1917]">{d.fullName}</span>
                <span className="text-[#a8a29e]">@{d.username}</span>
                {d.soXe && <span className="text-[#a8a29e] ml-auto">🚛 {d.soXe}</span>}
              </label>
            );
          })}
        </div>
      </Modal>

      {/* Modal thêm khoản chi phí / vốn đầu tư */}
      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={`➕ ${itemVehicle ? `Thêm cho xe ${itemVehicle.soXe || '#' + itemVehicle.id}` : 'Thêm chi phí chung'}`}
        footer={
          <>
            <button onClick={() => setItemModalOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] cursor-pointer">Hủy</button>
            <button onClick={submitItem} disabled={savingItem} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">{savingItem ? 'Đang lưu...' : '💾 Lưu'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Loại khoản</label>
            <select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs cursor-pointer">
              <optgroup label="Chi phí">
                {ITEM_CATEGORIES.filter((c) => c.group === 'cost').map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
              </optgroup>
              {itemVehicle && (
                <optgroup label="Vốn đầu tư">
                  {ITEM_CATEGORIES.filter((c) => c.group === 'invest').map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Ngày</label>
            <input type="date" value={itemForm.itemDate} onChange={(e) => setItemForm({ ...itemForm, itemDate: e.target.value })} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Số tiền (₫)</label>
            <input value={itemForm.amount} inputMode="numeric" onChange={(e) => onAmountChange(e.target.value)} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" placeholder="0" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Tên khoản</label>
            <input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" placeholder="VD: Thay nhớt, Vốn mua xe..." />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Ghi chú</label>
            <input value={itemForm.note} onChange={(e) => setItemForm({ ...itemForm, note: e.target.value })} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
          </div>
          <div className="col-span-2 flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-[11px] font-medium text-[#44403c] cursor-pointer">
              <input
                type="checkbox"
                checked={itemForm.invoice}
                onChange={(e) => setItemForm({ ...itemForm, invoice: e.target.checked, invoiceAmount: e.target.checked ? itemForm.invoiceAmount : '' })}
                className="w-4 h-4 accent-[#f59e0b] cursor-pointer"
              />
              Xuất HĐ
            </label>
            {itemForm.invoice && (
              <input
                value={itemForm.invoiceAmount}
                inputMode="numeric"
                onChange={(e) => setItemForm({ ...itemForm, invoiceAmount: e.target.value })}
                placeholder="Số tiền xuất được hoá đơn (₫)"
                className="flex-1 min-w-[200px] px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]"
              />
            )}
          </div>
          <div className="col-span-2 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-[#44403c]">💵 Tiền mặt</span>
            <input value={itemForm.cashAmount} inputMode="numeric" onChange={(e) => onCashChange(e.target.value)} placeholder="0" className="w-[120px] px-2 py-1.5 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
            <span className="text-[11px] font-medium text-[#44403c] ml-2">🏦 Chuyển khoản</span>
            <input value={itemForm.transferAmount} inputMode="numeric" onChange={(e) => onTransferChange(e.target.value)} placeholder="0" className="w-[120px] px-2 py-1.5 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
            <span className="text-[10px] text-[#a8a29e]">(mặt + CK = số tiền)</span>
          </div>
          <div className="col-span-2">
            <input type="password" value={itemForm.password} onChange={(e) => setItemForm({ ...itemForm, password: e.target.value })} className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
function VehicleDetail({
  detail, overview, overrides, month, year, loading, setMonth, setYear, reload, onEdit, onAssign, onRemoveOverride, onAddCost, onAddInvest, currentUser, toast,
}: {
  detail: VehicleItem;
  overview: DashboardOverview | null;
  overrides: VehicleOverride[];
  month: number;
  year: number;
  loading: boolean;
  setMonth: (n: number) => void;
  setYear: (n: number) => void;
  reload: () => void;
  onEdit: () => void;
  onAssign: () => void;
  onRemoveOverride: (o: VehicleOverride) => void;
  onAddCost: () => void;
  onAddInvest: () => void;
  currentUser: any;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const id = detail.id;
  const rev = overview?.revenue.byVehicle.find((v) => v.vehicleId === id) || null;
  const costV = (overview?.cost.byVehicle || []).find((v) => v.vehicleId === id) || null;

  // Vốn + chi phí lấy theo CHỦ VỐN CỦA XE (mọi sổ), để luôn hiện đúng của xe.
  const [fin, setFin] = useState<VehicleFinance | null>(null);
  const [sheetCat, setSheetCat] = useState<string | null>(null);
  const [showDriverSalary, setShowDriverSalary] = useState(false);
  const loadFin = async () => {
    try {
      const res = await vehiclesApi.getFinance(id, month, year);
      setFin(res.data.data);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    loadFin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, month, year]);

  const [exporting, setExporting] = useState(false);
  const doExport = async () => {
    setExporting(true);
    try {
      const res = await vehiclesApi.exportExcel(id, month, year);
      downloadBlob(res, `ThongKeXe_${detail.soXe || id}.xlsx`);
      toast('Đã xuất Excel', 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setExporting(false);
    }
  };

  const sumField = (cat: string) =>
    (fin?.items?.[cat] ?? []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const canEditFin =
    currentUser?.role === 'supper_admin' ||
    hasPerm(currentUser, 'finance.all') ||
    (fin?.ownerUserId != null && currentUser?.id === fin.ownerUserId);

  const suaChua = sumField('suaChua');
  const nhienLieu = sumField('nhienLieu');
  const cpKhac = sumField('cpKhac');
  const luong = (costV?.luongNguoiLai || 0) + (costV?.bhxhCty || 0);
  const totalCost = luong + suaChua + nhienLieu + cpKhac;
  const revenue = rev?.revenue || 0;
  const profit = revenue - totalCost;
  const vonXe = sumField('vonXe');
  const vonMooc = sumField('vonMooc');
  const vonKhac = sumField('vonKhac');
  const capital = vonXe + vonMooc + vonKhac;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-bold" style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)' }}>🚛</div>
          <div>
            <h3 className="text-[16px] font-extrabold text-[#1c1917]">{detail.soXe || `Xe #${id}`}</h3>
            <p className="text-[11px] text-[#78716c]">
              {detail.ownerName ? `Chủ vốn: ${detail.ownerName} (Bên ${detail.ben})` : `Bên ${detail.ben}`}
              {detail.soMooc ? ` · Mooc ${detail.soMooc}` : ''}
              {detail.stt ? ` · STT ${detail.stt}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select value={month} onChange={(e) => { setMonth(+e.target.value); setTimeout(reload, 0); }} className="px-2 py-1.5 rounded-lg text-[12px] border border-[#e7e5e4] cursor-pointer">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (<option key={m} value={m}>Tháng {m}</option>))}
          </select>
          <select value={year} onChange={(e) => { setYear(+e.target.value); setTimeout(reload, 0); }} className="px-2 py-1.5 rounded-lg text-[12px] border border-[#e7e5e4] cursor-pointer">
            {[year + 1, year, year - 1, year - 2].map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
          <button onClick={reload} className="px-3 py-1.5 rounded-lg text-[12px] border border-[#e7e5e4] cursor-pointer">↻</button>
          <button onClick={onEdit} className="px-3 py-1.5 rounded-lg text-[12px] border border-[#e7e5e4] cursor-pointer">✏️ Sửa</button>
          <button onClick={onAssign} className="px-3 py-1.5 rounded-lg text-[12px] border border-[#e7e5e4] cursor-pointer">👥 Lái xe</button>
          <button onClick={onAddCost} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer">➕ Chi phí</button>
          <button onClick={onAddInvest} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#2563eb] text-white cursor-pointer">➕ Vốn</button>
          {hasPerm(currentUser, 'export.data') && (
            <button onClick={doExport} disabled={exporting} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#16a34a] text-white disabled:opacity-50 cursor-pointer">{exporting ? 'Đang xuất...' : '📥 Xuất Excel'}</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>
      ) : (
        <>
          {/* Lái xe thuộc xe */}
          <div className="rounded-xl border border-[#e7e5e4] p-4">
            <p className="text-[12px] font-bold text-[#1c1917] mb-2">👥 Lái xe thuộc xe ({detail.drivers.length})</p>
            <div className="flex flex-wrap gap-2">
              {detail.drivers.length === 0 ? (
                <span className="text-[12px] text-[#a8a29e]">Chưa gán lái xe</span>
              ) : (
                detail.drivers.map((d) => (
                  <span key={d.id} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#fef3c7] text-[#92400e] border border-[#fcd34d]">
                    {d.fullName}{d.sdt ? ` · ${d.sdt}` : ''}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Doanh thu */}
          <div className="rounded-xl border border-[#e7e5e4] p-4">
            <p className="text-[12px] font-bold text-[#1c1917] mb-2">💰 Doanh thu {MONTHS_VN[month]}/{year}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Stat label="Doanh thu" value={revenue} color="#d97706" />
              <Stat label="Sản lượng" value={rev?.totalCont || 0} unit="cont" color="#1c1917" />
              <Stat label="Lương chuyến" value={rev?.luongKhoan || 0} color="#dc2626" />
            </div>
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {(rev?.routes?.length || 0) === 0 ? (
                <p className="text-[12px] text-[#a8a29e]">Chưa có tuyến nào</p>
              ) : (
                rev!.routes.map((rt, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#e7e5e4]">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold truncate text-[#1c1917]">{rt.routeName || '—'}</p>
                      <p className="text-[10px] text-[#78716c]">{rt.contCount} cont · {Object.entries(rt.contByType || {}).map(([t, n]) => `${t}×${n}`).join(', ')}</p>
                    </div>
                    <span className="text-[12px] font-bold text-[#d97706]">{fmt(rt.revenue)} ₫</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chi phí + vốn */}
          <div className="rounded-xl border border-[#e7e5e4] p-4">
            <p className="text-[12px] font-bold text-[#1c1917] mb-2">💸 Chi phí & Vốn đầu tư</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Lương lái xe + BHXH" value={luong} color="#dc2626" onClick={() => setShowDriverSalary(true)} />
              <Stat label="Nhiên liệu" value={nhienLieu} color="#0891b2" onClick={() => setSheetCat('nhienLieu')} />
              <Stat label="Sửa chữa" value={suaChua} color="#7c3aed" onClick={() => setSheetCat('suaChua')} />
              <Stat label="CP khác" value={cpKhac} color="#059669" onClick={() => setSheetCat('cpKhac')} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <Stat label="Vốn xe" value={vonXe} color="#2563eb" onClick={() => setSheetCat('vonXe')} />
              <Stat label="Vốn mooc" value={vonMooc} color="#2563eb" onClick={() => setSheetCat('vonMooc')} />
              <Stat label="Vốn khác" value={vonKhac} color="#78716c" onClick={() => setSheetCat('vonKhac')} />
              <Stat label="Tổng vốn" value={capital} color="#2563eb" />
            </div>
            <p className="text-[10px] text-[#a8a29e] mt-3">
              * Vốn/chi phí lấy theo chủ vốn của xe. Bấm vào từng ô để xem/sửa chi tiết từng dòng.
            </p>
          </div>

          {/* Lợi nhuận + chia vốn */}
          <div className="rounded-xl border border-[#e7e5e4] p-4">
            <p className="text-[12px] font-bold text-[#1c1917] mb-2">📈 Lợi nhuận & chia vốn</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label="Doanh thu" value={revenue} color="#d97706" />
              <Stat label="Tổng chi phí" value={totalCost} color="#dc2626" />
              <Stat label="Lợi nhuận" value={profit} color={profit >= 0 ? '#16a34a' : '#dc2626'} />
            </div>
            <p className="text-[10px] text-[#a8a29e] mt-2">
              {capital > 0
                ? `Tỷ lệ lợi nhuận/vốn: ${((profit / capital) * 100).toFixed(1)}% (vốn ${fmt(capital)} ₫)`
                : 'Chưa có vốn đầu tư để tính tỷ lệ.'}
            </p>
          </div>

          {/* Đảo lái xe của xe này */}
          <div className="rounded-xl border border-[#e7e5e4] p-4">
            <p className="text-[12px] font-bold text-[#1c1917] mb-2">🔁 Đảo lái xe theo kế hoạch ({overrides.length})</p>
            {overrides.length === 0 ? (
              <p className="text-[12px] text-[#a8a29e]">Chưa có đảo lái xe nào cho xe này</p>
            ) : (
              <div className="space-y-2">
                {overrides.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#e7e5e4]">
                    <span className="text-[12px] text-[#1c1917]">{o.planName}{o.routeName ? ` · ${o.routeName}` : ''}{o.planNgay ? ` · ${o.planNgay}` : ''}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(59,130,246,0.12)] text-[#2563eb]">🚛 {o.vehicleLabel}</span>
                    <span className="text-[12px] text-[#78716c]">👤 {o.driverName}</span>
                    <button onClick={() => onRemoveOverride(o)} className="px-2 py-1 text-[11px] rounded border border-[#fecaca] text-red-600 cursor-pointer">🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {sheetCat && (
        <FinanceItemsModal
          vehicleId={id}
          ownerUserId={fin?.ownerUserId ?? null}
          category={sheetCat}
          label={FIN_CAT_LABEL[sheetCat] || sheetCat}
          items={fin?.items?.[sheetCat] ?? []}
          month={month}
          year={year}
          canEdit={canEditFin}
          toast={toast}
          onChanged={loadFin}
          onClose={() => setSheetCat(null)}
        />
      )}

      {/* Modal chi tiết lương — góc nhìn chủ xe */}
      {showDriverSalary && (
        <Modal open={showDriverSalary} title="Chi phí lái xe (Chủ xe phải chi)" onClose={() => setShowDriverSalary(false)}>
          <div className="space-y-4 text-[12px]">
            <p className="text-[11px] text-[#78716c] bg-[#fef3c7] rounded-lg px-3 py-2 border border-[#fcd34d]">
              💡 <b>Góc nhìn chủ xe:</b> Hiển thị tất cả khoản chủ xe phải bỏ ra. <b>Lái phụ mượn xe</b> không thuộc biên chế → chỉ có lương chuyến, các ô còn lại = 0. BHXH CTY + BHXH NLĐ đều là tiền chủ xe phải chi.
            </p>
            {(!costV?.drivers || costV.drivers.length === 0) ? (
              <p className="text-center text-[#a8a29e] py-6">Chưa có dữ liệu lương lái xe tháng này.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#f5f3ff]">
                      {['Lái xe','Vai trò','Lương chuyến','Lương cứng','Chuyên cần','Phụ cấp','PC khác','TIP (hoàn)','BHXH CTY 21.5%','BHXH NLĐ 10.5%','Chi hộ','Tạm ứng','TỔNG CHỦ XE CHI'].map((h) => (
                        <th key={h} className={`px-2 py-1.5 text-left font-semibold border border-[#e7e5e4] whitespace-nowrap ${h === 'TỔNG CHỦ XE CHI' ? 'text-[#dc2626] bg-[#fef2f2]' : 'text-[#4c1d95]'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {costV.drivers.map((d: any, i: number) => {
                      const isMain = d.isMain;
                      const luongChuyen  = d.luongKhoan || 0;
                      const luongCung    = isMain ? (d.luongCung || 0)      : 0;
                      const chuyenCan    = isMain ? (d.chuyenCan || 0)     : 0;
                      const phuCap       = isMain ? (d.phuCap || 0)        : 0;
                      const pcKhac       = isMain ? (d.itemSumAdd || 0)    : 0;
                      const tipHoan      = isMain ? (d.tip || 0)    : 0;
                      const bhxhCty      = isMain ? (d.bhxhCty || 0)       : 0;
                      const bhxhNld      = isMain ? (d.bhxhNld || 0)       : 0;
                      const chiHo        = isMain ? (d.chiHo || 0)         : 0;
                      const tamUng       = isMain ? (d.advanceDeduct || 0) : 0;
                      const tongChuXeChi = luongChuyen + luongCung + chuyenCan + phuCap + pcKhac + tipHoan + bhxhCty + bhxhNld + chiHo + tamUng;
                      const dimCls = "text-[#c0c0c0] bg-[#f9f9f9]";
                      return (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafaf9]'}>
                          <td className="px-2 py-1.5 border border-[#e7e5e4] font-medium text-[#1c1917] whitespace-nowrap">{d.fullName || '—'}</td>
                          <td className="px-2 py-1.5 border border-[#e7e5e4] text-center">
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isMain ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-[#dbeafe] text-[#1e40af]'}`}>
                              {isMain ? 'Chính' : 'Phụ (mượn)'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 border border-[#e7e5e4] text-right text-[#059669] font-medium">{fmt(luongChuyen)}</td>
                          <td className={`px-2 py-1.5 border border-[#e7e5e4] text-right ${!isMain ? dimCls : ''}`}>{fmt(luongCung)}</td>
                          <td className={`px-2 py-1.5 border border-[#e7e5e4] text-right ${!isMain ? dimCls : ''}`}>{fmt(chuyenCan)}</td>
                          <td className={`px-2 py-1.5 border border-[#e7e5e4] text-right ${!isMain ? dimCls : ''}`}>{fmt(phuCap)}</td>
                          <td className={`px-2 py-1.5 border border-[#e7e5e4] text-right ${!isMain ? dimCls : ''}`}>{fmt(pcKhac)}</td>
                          <td className={`px-2 py-1.5 border border-[#e7e5e4] text-right ${!isMain ? dimCls : 'text-[#d97706]'}`}>{fmt(tipHoan)}</td>
                          <td className={`px-2 py-1.5 border border-[#e7e5e4] text-right ${!isMain ? dimCls : 'text-[#dc2626]'}`}>{fmt(bhxhCty)}</td>
                          <td className={`px-2 py-1.5 border border-[#e7e5e4] text-right ${!isMain ? dimCls : 'text-[#b45309]'}`}>{fmt(bhxhNld)}</td>
                          <td className={`px-2 py-1.5 border border-[#e7e5e4] text-right ${!isMain ? dimCls : 'text-[#7c3aed]'}`}>{fmt(chiHo)}</td>
                          <td className={`px-2 py-1.5 border border-[#e7e5e4] text-right ${!isMain ? dimCls : 'text-[#6b7280]'}`}>{fmt(tamUng)}</td>
                          <td className="px-2 py-1.5 border border-[#e7e5e4] text-right font-bold text-[#dc2626] bg-[#fef2f2]">{fmt(tongChuXeChi)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-[#fef9c3] font-bold">
                      <td className="px-2 py-1.5 border border-[#e7e5e4]" colSpan={2}>TỔNG CỘNG</td>
                      {(() => {
                        const tots = costV.drivers.reduce((acc: any, d: any) => {
                          const m = d.isMain;
                          acc.lc  += d.luongKhoan || 0;
                          acc.lg  += m ? (d.luongCung || 0)      : 0;
                          acc.cc  += m ? (d.chuyenCan || 0)     : 0;
                          acc.pc  += m ? (d.phuCap || 0)        : 0;
                          acc.pk  += m ? (d.itemSumAdd || 0)    : 0;
                          acc.tip += m ? (d.tip || 0)    : 0;
                          acc.bc  += m ? (d.bhxhCty || 0)       : 0;
                          acc.bn  += m ? (d.bhxhNld || 0)       : 0;
                          acc.ch  += m ? (d.chiHo || 0)         : 0;
                          acc.tu  += m ? (d.advanceDeduct || 0) : 0;
                          return acc;
                        }, { lc:0, lg:0, cc:0, pc:0, pk:0, tip:0, bc:0, bn:0, ch:0, tu:0 });
                        const total = tots.lc+tots.lg+tots.cc+tots.pc+tots.pk+tots.tip+tots.bc+tots.bn+tots.ch+tots.tu;
                        return [
                          <td key="lc"  className="px-2 py-1.5 border border-[#e7e5e4] text-right">{fmt(tots.lc)}</td>,
                          <td key="lg"  className="px-2 py-1.5 border border-[#e7e5e4] text-right">{fmt(tots.lg)}</td>,
                          <td key="cc"  className="px-2 py-1.5 border border-[#e7e5e4] text-right">{fmt(tots.cc)}</td>,
                          <td key="pc"  className="px-2 py-1.5 border border-[#e7e5e4] text-right">{fmt(tots.pc)}</td>,
                          <td key="pk"  className="px-2 py-1.5 border border-[#e7e5e4] text-right">{fmt(tots.pk)}</td>,
                          <td key="tip" className="px-2 py-1.5 border border-[#e7e5e4] text-right text-[#d97706]">{fmt(tots.tip)}</td>,
                          <td key="bc"  className="px-2 py-1.5 border border-[#e7e5e4] text-right text-[#dc2626]">{fmt(tots.bc)}</td>,
                          <td key="bn"  className="px-2 py-1.5 border border-[#e7e5e4] text-right">{fmt(tots.bn)}</td>,
                          <td key="ch"  className="px-2 py-1.5 border border-[#e7e5e4] text-right">{fmt(tots.ch)}</td>,
                          <td key="tu"  className="px-2 py-1.5 border border-[#e7e5e4] text-right">{fmt(tots.tu)}</td>,
                          <td key="tot" className="px-2 py-1.5 border border-[#e7e5e4] text-right text-[#dc2626] bg-[#fef2f2]">{fmt(total)}</td>,
                        ];
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-[10px] text-[#78716c] space-y-0.5 pt-2 border-t border-[#e7e5e4]">
              <p>• <b>TỔNG CHỦ XE CHI</b> = Lương chuyến + Lương cứng + Chuyên cần + Phụ cấp + TIP hoàn + BHXH CTY 21.5% + BHXH NLĐ 10.5% + Chi hộ + Tạm ứng</p>
              <p>• <b>Lái phụ mượn xe</b>: chỉ trả lương chuyến — lương cứng/BHXH/phụ cấp thuộc về xe nhà</p>
              <p>• <b>BHXH 32%</b> = CTY 21.5% + NLĐ 10.5% (trích lương, cty nộp hộ nhà nước)</p>
            </div>
          </div>
        </Modal>
      )}
      </div>
  );
}

function Stat({ label, value, unit, color, onClick }: { label: string; value: number; unit?: string; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      title={onClick ? 'Bấm để xem/sửa chi tiết' : undefined}
      className={`rounded-lg p-3 border border-[#e7e5e4] bg-[#fafaf9] ${onClick ? 'cursor-pointer hover:border-[#f59e0b] transition-colors' : ''}`}
    >
      <p className="text-[10px] text-[#78716c] mb-0.5">{label}</p>
      <p className="text-[16px] font-extrabold" style={{ color }}>{fmt(value)}</p>
      <p className="text-[9px] text-[#a8a29e]">{unit || '₫'}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
function FinanceItemsModal({
  vehicleId, ownerUserId, category, label, items, month, year, canEdit, toast, onChanged, onClose,
}: {
  vehicleId: number;
  ownerUserId: number | null;
  category: string;
  label: string;
  items: { id: number; itemDate: string | null; name: string; amount: number; invoiceAmount: number | null; cashAmount: number | null; transferAmount: number | null; note: string | null; month: number; year: number }[];
  month: number;
  year: number;
  canEdit: boolean;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [form, setForm] = useState({ itemDate: '', name: '', amount: '', note: '', invoice: false, invoiceAmount: '', cashAmount: '', transferAmount: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const resetForm = () => {
    setEditId(null);
    setForm({ itemDate: '', name: '', amount: '', note: '', invoice: false, invoiceAmount: '', cashAmount: '', transferAmount: '' });
  };
  const startEdit = (it: (typeof items)[number]) => {
    setEditId(it.id);
    setForm({
      itemDate: it.itemDate ? String(it.itemDate).slice(0, 10) : '',
      name: it.name || '',
      amount: String(it.amount || ''),
      note: it.note || '',
      invoice: it.invoiceAmount != null,
      invoiceAmount: it.invoiceAmount != null ? String(it.invoiceAmount) : '',
      cashAmount: it.cashAmount != null ? String(it.cashAmount) : '',
      transferAmount: it.transferAmount != null ? String(it.transferAmount) : '',
    });
  };
  const onAmountChange = (v: string) => {
    setForm((f) => {
      const amt = Number(v.replace(/[^0-9]/g, '')) || 0;
      if (f.cashAmount || f.transferAmount) {
        const t = Number(f.transferAmount.replace(/[^0-9]/g, '')) || 0;
        return { ...f, amount: v, cashAmount: String(Math.max(0, amt - t)) };
      }
      return { ...f, amount: v, cashAmount: v ? String(amt) : '', transferAmount: v ? '0' : '' };
    });
  };
  const onCashChange = (v: string) => {
    setForm((f) => {
      const amt = Number(f.amount.replace(/[^0-9]/g, '')) || 0;
      const c = Number(v.replace(/[^0-9]/g, '')) || 0;
      return { ...f, cashAmount: v, transferAmount: String(Math.max(0, amt - c)) };
    });
  };
  const onTransferChange = (v: string) => {
    setForm((f) => {
      const amt = Number(f.amount.replace(/[^0-9]/g, '')) || 0;
      const t = Number(v.replace(/[^0-9]/g, '')) || 0;
      return { ...f, transferAmount: v, cashAmount: String(Math.max(0, amt - t)) };
    });
  };
  const submit = async () => {
    if (!canEdit) return;
    if (!password) { toast('Nhập mật khẩu', 'error'); return; }
    const amount = Number(String(form.amount).replace(/[^0-9]/g, ''));
    if (!amount) { toast('Nhập số tiền', 'error'); return; }
    const invoiceAmount = form.invoice ? Number(String(form.invoiceAmount).replace(/[^0-9]/g, '')) : null;
    if (form.invoice && (!invoiceAmount || invoiceAmount <= 0)) { toast('Nhập số tiền xuất hoá đơn', 'error'); return; }
    if (invoiceAmount !== null && invoiceAmount > amount) { toast('Số tiền xuất HĐ không được lớn hơn khoản chi', 'error'); return; }
    const cashAmount = Number(String(form.cashAmount).replace(/[^0-9]/g, '')) || 0;
    const transferAmount = Number(String(form.transferAmount).replace(/[^0-9]/g, '')) || 0;
    if (cashAmount + transferAmount !== amount) { toast('Tiền mặt + chuyển khoản phải bằng số tiền', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        category,
        itemDate: form.itemDate || null,
        name: form.name,
        amount,
        invoiceAmount,
        cashAmount,
        transferAmount,
        note: form.note || null,
        vehicleUserId: vehicleId,
        targetUserId: ownerUserId ?? undefined,
      } as any;
      if (editId) await financeApi.updateCostItem(editId, payload, { password });
      else await financeApi.addCostItem(month, year, payload, { password });
      toast('Đã lưu khoản', 'success');
      resetForm();
      onChanged();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };
  const remove = async (it: (typeof items)[number]) => {
    if (!password) { toast('Nhập mật khẩu để xoá', 'error'); return; }
    try {
      await financeApi.deleteCostItem(it.id, { password });
      toast('Đã xoá', 'success');
      onChanged();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Xoá thất bại', 'error');
    }
  };
  const inputCls = 'w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]';

  return (
    <Modal
      open
      onClose={onClose}
      title={`${label} — Theo xe`}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] cursor-pointer">Đóng</button>
          {canEdit && (
            <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : editId ? '💾 Cập nhật' : '➕ Thêm'}
            </button>
          )}
        </>
      }
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-[#78716c]">{items.length} dòng · Tổng</span>
        <span className="text-[14px] font-extrabold text-[#1c1917]">{fmt(total)} ₫</span>
      </div>

      <div className="max-h-[240px] overflow-y-auto rounded-lg border border-[#e7e5e4] divide-y divide-[#e7e5e4]">
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[#78716c]">Chưa có khoản nào</div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate text-[#1c1917]">{it.name || '—'}</p>
                <p className="text-[10px] text-[#78716c]">
                  {it.itemDate ? String(it.itemDate).slice(0, 10) : '—'} · T{it.month}/{it.year}
                  {it.note ? ` · ${it.note}` : ''}
                  {it.invoiceAmount != null ? ` · 🧾 HĐ ${fmt(it.invoiceAmount)}` : ''}
                  {it.cashAmount != null ? ` · 💵 ${fmt(it.cashAmount)}` : ''}
                  {it.transferAmount != null ? ` · 🏦 ${fmt(it.transferAmount)}` : ''}
                </p>
              </div>
              <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: '#dc2626' }}>{fmt(it.amount)} ₫</span>
              {canEdit && (
                <>
                  <button onClick={() => startEdit(it)} className="px-1.5 py-0.5 rounded text-[10px] border border-[#e7e5e4] cursor-pointer">✏️</button>
                  <button onClick={() => remove(it)} className="px-1.5 py-0.5 rounded text-[10px] border border-[#fecaca] text-red-600 cursor-pointer">🗑</button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {canEdit ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="col-span-2 text-[11px] font-semibold text-[#78716c]">{editId ? 'Sửa dòng khoản' : 'Thêm dòng khoản mới'}</div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tên khoản (vd: Thay nhớt)" className={`${inputCls} col-span-2`} />
          <input type="date" value={form.itemDate} onChange={(e) => setForm({ ...form, itemDate: e.target.value })} className={inputCls} />
          <input value={form.amount} inputMode="numeric" onChange={(e) => onAmountChange(e.target.value)} placeholder="Số tiền (₫)" className={inputCls} />
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ghi chú" className={`${inputCls} col-span-2`} />
          <div className="col-span-2 flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-[11px] font-medium text-[#44403c] cursor-pointer">
              <input type="checkbox" checked={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.checked, invoiceAmount: e.target.checked ? form.invoiceAmount : '' })} className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
              Xuất HĐ
            </label>
            {form.invoice && (
              <input value={form.invoiceAmount} inputMode="numeric" onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })} placeholder="Số tiền xuất được hoá đơn (₫)" className={`${inputCls} flex-1 min-w-[160px]`} />
            )}
          </div>
          <div className="col-span-2 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-[#44403c]">💵 Tiền mặt</span>
            <input value={form.cashAmount} inputMode="numeric" onChange={(e) => onCashChange(e.target.value)} placeholder="0" className="w-[110px] px-2 py-1.5 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
            <span className="text-[11px] font-medium text-[#44403c] ml-2">🏦 Chuyển khoản</span>
            <input value={form.transferAmount} inputMode="numeric" onChange={(e) => onTransferChange(e.target.value)} placeholder="0" className="w-[110px] px-2 py-1.5 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]" />
            <span className="text-[10px] text-[#a8a29e]">(mặt + CK = số tiền)</span>
          </div>
          {editId && (
            <div className="col-span-2 flex justify-end">
              <button onClick={resetForm} className="px-3 py-2 rounded-lg text-xs border border-[#e7e5e4] text-[#78716c] whitespace-nowrap cursor-pointer">Huỷ sửa</button>
            </div>
          )}
          <div className="col-span-2">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-[#a8a29e]">Bạn chỉ xem được (cần là chủ vốn của xe hoặc có quyền tài chính để sửa).</p>
      )}
    </Modal>
  );
}
