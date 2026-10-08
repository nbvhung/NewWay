'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  vehiclesApi,
  VehicleItem,
  VehicleOverride,
} from '@/lib/api-vehicles';
import { dashboardApi, DashboardOverview } from '@/lib/api-dashboard';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { Modal } from '@/components/ui/modal';
import { confirmDelete } from '@/lib/delete-guard';
import { User } from '@/types';

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

export function VehiclesTab({ allUsers, toast }: Props) {
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
      load();
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
                      {[p.name, p.ngay ? p.ngay.split('-').reverse().join('-') : ''].filter(Boolean).join(' / ')}
                    </option>
                  ))}
                </select>
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
                      <td className="px-3 py-2.5 text-[#1c1917]">{o.planName}{o.planNgay ? ` · ${o.planNgay}` : ''}</td>
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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
function VehicleDetail({
  detail, overview, overrides, month, year, loading, setMonth, setYear, reload, onEdit, onAssign, onRemoveOverride,
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
}) {
  const id = detail.id;
  const rev = overview?.revenue.byVehicle.find((v) => v.vehicleId === id) || null;
  const costV = (overview?.cost.byVehicle || []).find((v) => v.vehicleId === id) || null;
  const sumItems = (group: 'cost' | 'investment', cat: string) =>
    ((group === 'cost' ? overview?.cost.items?.[cat] : overview?.investment.items?.[cat]) ?? [])
      .filter((it) => it.vehicleUserId === id)
      .reduce((s, i) => s + Number(i.amount || 0), 0);
  const suaChua = sumItems('cost', 'suaChua');
  const nhienLieu = sumItems('cost', 'nhienLieu');
  const cpKhac = sumItems('cost', 'cpKhac');
  const luong = (costV?.luongNguoiLai || 0) + (costV?.bhxhCty || 0);
  const totalCost = luong + suaChua + nhienLieu + cpKhac;
  const revenue = rev?.revenue || 0;
  const profit = revenue - totalCost;
  const vonXe = sumItems('investment', 'vonXe');
  const vonMooc = sumItems('investment', 'vonMooc');
  const vonKhac = sumItems('investment', 'vonKhac');
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
              <Stat label="Lương khoán" value={rev?.luongKhoan || 0} color="#dc2626" />
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
              <Stat label="Lương lái xe + BHXH" value={luong} color="#dc2626" />
              <Stat label="Nhiên liệu" value={nhienLieu} color="#0891b2" />
              <Stat label="Sửa chữa" value={suaChua} color="#7c3aed" />
              <Stat label="CP khác" value={cpKhac} color="#059669" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <Stat label="Vốn xe" value={vonXe} color="#2563eb" />
              <Stat label="Vốn mooc" value={vonMooc} color="#2563eb" />
              <Stat label="Vốn khác" value={vonKhac} color="#78716c" />
              <Stat label="Tổng vốn" value={capital} color="#2563eb" />
            </div>
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
                  <div key={o.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#e7e5e4]">
                    <span className="text-[12px] text-[#1c1917]">{o.planName}{o.planNgay ? ` · ${o.planNgay}` : ''}</span>
                    <span className="text-[12px] text-[#78716c]">👤 {o.driverName}</span>
                    <button onClick={() => onRemoveOverride(o)} className="px-2 py-1 text-[11px] rounded border border-[#fecaca] text-red-600 cursor-pointer">🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <div className="rounded-lg p-3 border border-[#e7e5e4] bg-[#fafaf9]">
      <p className="text-[10px] text-[#78716c] mb-0.5">{label}</p>
      <p className="text-[16px] font-extrabold" style={{ color }}>{fmt(value)}</p>
      <p className="text-[9px] text-[#a8a29e]">{unit || '₫'}</p>
    </div>
  );
}
