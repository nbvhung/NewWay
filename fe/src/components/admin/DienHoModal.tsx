'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { submissionsApi } from '@/lib/api-submissions';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { usersApi } from '@/lib/api-users';
import { User, ShippingLine } from '@/types';
import { fmtNgay } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DienHoModal({ open, onClose }: Props) {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [plans, setPlans] = useState<ShippingLine[]>([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    hang20: '', hang40: '', vo20: '', vo40: '',
    vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '',
  });

  useEffect(() => {
    if (!open) return;
    setError('');
    Promise.all([
      usersApi.getAll().then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
        setDrivers(list.filter((u: User) => u.role === 'laixe'));
      }),
      shippingLinesApi.getAllAdmin().then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
        setPlans(list.filter((p: ShippingLine) => !p.completed));
      }),
    ]).catch(() => setError('Không thể tải dữ liệu'));
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedDriver) { setError('Vui lòng chọn lái xe'); return; }
    if (!selectedPlan) { setError('Vui lòng chọn kế hoạch'); return; }
    setSaving(true);
    setError('');
    try {
      const sl = plans.find(p => String(p.id) === selectedPlan);
      await submissionsApi.create({
        driverId: Number(selectedDriver),
        shippingLine: sl?.name || '',
        shippingLineId: Number(selectedPlan),
        route: sl?.routeName || '',
        ...form,
      });
      setForm({ hang20: '', hang40: '', vo20: '', vo40: '', vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '' });
      setSelectedDriver('');
      setSelectedPlan('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="📝 Điền hộ cho lái xe"
      footer={
        <div className="flex gap-2 w-full">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">
            Đóng
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] hover:shadow-[0_6px_20px_rgba(26,86,219,0.5)] transition-all disabled:opacity-50 cursor-pointer">
            {saving ? 'Đang lưu...' : '💾 Lưu'}
          </button>
        </div>
      }>
      <div className="space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/12 border border-red-500/30 text-[#f87171] text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[#64748b] mb-1">Lái xe <span className="text-[#ef4444]">*</span></label>
          <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]">
            <option value="">-- Chọn lái xe --</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.fullName} ({d.username}){d.soXe ? ` - ${d.soXe}` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#64748b] mb-1">Kế hoạch <span className="text-[#ef4444]">*</span></label>
          <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]">
            <option value="">-- Chọn kế hoạch --</option>
            {plans.map(sl => (
              <option key={sl.id} value={sl.id}>
                {[sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ')}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Hàng 20</label>
            <input type="number" value={form.hang20} onChange={e => setForm(f => ({ ...f, hang20: e.target.value }))}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Hàng 40</label>
            <input type="number" value={form.hang40} onChange={e => setForm(f => ({ ...f, hang40: e.target.value }))}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vỏ 20</label>
            <input type="number" value={form.vo20} onChange={e => setForm(f => ({ ...f, vo20: e.target.value }))}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vỏ 40</label>
            <input type="number" value={form.vo40} onChange={e => setForm(f => ({ ...f, vo40: e.target.value }))}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vỏ 20FR <span className="text-[#94a3b8]">(1 bó = 4 cái)</span></label>
            <input type="number" value={form.vo20fr} onChange={e => setForm(f => ({ ...f, vo20fr: e.target.value }))}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vỏ 40FR <span className="text-[#94a3b8]">(1 bó = 4 cái)</span></label>
            <input type="number" value={form.vo40fr} onChange={e => setForm(f => ({ ...f, vo40fr: e.target.value }))}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vệ sinh lại <span className="text-[#94a3b8]">(Chuyến)</span></label>
            <input type="number" value={form.veSinhLai} onChange={e => setForm(f => ({ ...f, veSinhLai: e.target.value }))}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Kéo về <span className="text-[#94a3b8]">(Chuyến)</span></label>
            <input type="number" value={form.keoVe} onChange={e => setForm(f => ({ ...f, keoVe: e.target.value }))}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">TIP <span className="text-[#94a3b8]">(x 1.000đ)</span></label>
            <input type="number" value={form.tip} onChange={e => setForm(f => ({ ...f, tip: e.target.value }))}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
          </div>
        </div>
      </div>
    </Modal>
  );
}