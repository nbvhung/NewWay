'use client';

import { useState, useEffect, useMemo } from 'react';
import { vehiclesApi, VehicleItem } from '@/lib/api-vehicles';
import { Modal } from '@/components/ui/modal';
import { confirmDelete } from '@/lib/delete-guard';
import { User } from '@/types';

interface Props {
  currentUser: any;
  allUsers: User[];
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const emptyForm = {
  soXe: '',
  soMooc: '',
  stt: '',
  ngayHoatDong: '',
  ownerUserId: '' as number | '',
};

export function VehiclesTab({ allUsers, toast }: Props) {
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

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[18px] font-extrabold text-[#1c1917]">🚛 Quản lý XE</h2>
          <p className="text-[12px] text-[#78716c] mt-0.5">{vehicles.length} xe</p>
        </div>
        <div className="flex gap-2">
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
                <th className="px-3 py-2.5 font-semibold">Ngày HĐ</th>
                <th className="px-3 py-2.5 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[#78716c]">
                    Chưa có xe nào
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr key={v.id} className="border-t border-[#e7e5e4] hover:bg-[#fafaf9]">
                    <td className="px-3 py-2.5 font-semibold text-[#1c1917]">🚛 {v.soXe || '—'}</td>
                    <td className="px-3 py-2.5 text-[#78716c]">{v.soMooc || '—'}</td>
                    <td className="px-3 py-2.5 text-[#78716c]">{v.stt || '—'}</td>
                    <td className="px-3 py-2.5 text-[#78716c]">{v.ownerName || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(59,130,246,0.15)] text-blue-600">
                        Bên {v.ben}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#78716c]">
                      {v.drivers.length > 0
                        ? v.drivers.map((d) => d.fullName).join(', ')
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[#78716c]">{v.ngayHoatDong || '—'}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => openAssign(v)}
                        className="px-2 py-1 text-[11px] rounded border border-[#e7e5e4] hover:bg-[#f5f5f4] cursor-pointer mr-1"
                      >
                        👥 Lái xe
                      </button>
                      <button
                        onClick={() => openEdit(v)}
                        className="px-2 py-1 text-[11px] rounded border border-[#e7e5e4] hover:bg-[#f5f5f4] cursor-pointer mr-1"
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        onClick={() => remove(v)}
                        className="px-2 py-1 text-[11px] rounded border border-[#fecaca] text-red-600 hover:bg-[#fef2f2] cursor-pointer"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal thêm/sửa xe */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? '✏️ Sửa xe' : '➕ Thêm xe'}
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Biển số</label>
            <input
              value={form.soXe}
              onChange={(e) => setForm({ ...form, soXe: e.target.value })}
              placeholder="15H 07883"
              className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Số mooc</label>
            <input
              value={form.soMooc}
              onChange={(e) => setForm({ ...form, soMooc: e.target.value })}
              className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">STT</label>
            <input
              value={form.stt}
              onChange={(e) => setForm({ ...form, stt: e.target.value })}
              className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Ngày hoạt động</label>
            <input
              type="date"
              value={form.ngayHoatDong}
              onChange={(e) => setForm({ ...form, ngayHoatDong: e.target.value })}
              className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Chủ vốn</label>
            <select
              value={form.ownerUserId}
              onChange={(e) =>
                setForm({ ...form, ownerUserId: e.target.value === '' ? '' : Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b] cursor-pointer"
            >
              <option value="">— Chưa gán —</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}{a.ben ? ` (Bên ${a.ben})` : ''}
                </option>
              ))}
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
            <button
              onClick={() => setAssignOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={saveAssign}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Đang lưu...' : '💾 Lưu phân công'}
            </button>
          </>
        }
      >
        <input
          value={driverSearch}
          onChange={(e) => setDriverSearch(e.target.value)}
          placeholder="Tìm lái xe..."
          className="w-full px-3 py-2 mb-3 border border-[#e7e5e4] rounded-lg text-xs outline-none focus:border-[#f59e0b]"
        />
        <div className="max-h-[320px] overflow-y-auto flex flex-col gap-1">
          {filteredDrivers.map((d) => {
            const checked = assignIds.includes(d.id);
            return (
              <label
                key={d.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs border ${
                  checked ? 'border-[#f59e0b] bg-[#fef3c7]' : 'border-[#e7e5e4]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setAssignIds((prev) =>
                      e.target.checked
                        ? [...prev, d.id]
                        : prev.filter((x) => x !== d.id),
                    )
                  }
                />
                <span className="font-medium text-[#1c1917]">{d.fullName}</span>
                <span className="text-[#a8a29e]">@{d.username}</span>
                {d.soXe && <span className="text-[#a8a29e] ml-auto">🚛 {d.soXe}</span>}
              </label>
            );
          })}
        </div>
        <p className="text-[10px] text-[#a8a29e] mt-2">
          Lưu ý: chọn lái xe thuộc xe này sẽ gán `home_vehicle_id`. Lái xe không chọn sẽ được bỏ gán khỏi xe.
        </p>
      </Modal>
    </div>
  );
}
