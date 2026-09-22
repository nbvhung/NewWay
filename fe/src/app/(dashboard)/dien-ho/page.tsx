'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { submissionsApi } from '@/lib/api-submissions';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { usersApi } from '@/lib/api-users';
import { User, ShippingLine } from '@/types';
import { fmtNgay } from '@/lib/utils';
import { hasPerm } from '@/lib/permissions';

export default function DienHoPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [drivers, setDrivers] = useState<User[]>([]);
  const [plans, setPlans] = useState<ShippingLine[]>([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    hang20: '', hang40: '', vo20: '', vo40: '',
    vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '',
  });

  useEffect(() => {
    if (!user) return;
    if (!hasPerm(user, 'entry.enter_for_other')) {
      router.replace('/');
      return;
    }
    Promise.all([
      usersApi.getAll().then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
        setDrivers(list.filter((u: User) => u.role === 'laixe').sort((a: User, b: User) => (parseInt(a.stt) || 999999) - (parseInt(b.stt) || 999999)));
      }),
      shippingLinesApi.getAllAdmin().then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
        setPlans(list.filter((p: ShippingLine) => !p.completed));
      }),
    ]).catch(() => toast('Không thể tải dữ liệu', 'error'))
    .finally(() => setLoading(false));
  }, [user]);

  const currentPlan = plans.find(p => String(p.id) === selectedPlan);

  const handleSubmit = async () => {
    if (!selectedDriver) { toast('Vui lòng chọn lái xe', 'error'); return; }
    if (!selectedPlan) { toast('Vui lòng chọn kế hoạch', 'error'); return; }
    setSaving(true);
    try {
      await submissionsApi.create({
        driverId: Number(selectedDriver),
        shippingLine: currentPlan!.name,
        shippingLineId: Number(selectedPlan),
        route: currentPlan!.routeName || '',
        ...form,
      });
      toast('Đã lưu dữ liệu cho lái xe', 'success');
      setForm({ hang20: '', hang40: '', vo20: '', vo40: '', vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '' });
      setSelectedDriver('');
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePlan = () => {
    setSelectedPlan('');
    setSelectedDriver('');
    setForm({ hang20: '', hang40: '', vo20: '', vo40: '', vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '' });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold">📝 Điền hộ cho lái xe</h1>
        <p className="text-xs text-[#78716c] mt-1">Nhập liệu sản lượng thay cho lái xe</p>
      </div>

      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-6">
        {loading ? (
          <div className="text-center py-16 text-[#78716c] text-sm">Đang tải...</div>
        ) : (
          <div className="max-w-[580px] mx-auto space-y-4">
            {/* Step 1: Chọn kế hoạch - luôn ở trên cùng */}
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Kế hoạch <span className="text-[#ef4444]">*</span></label>
              {!selectedPlan ? (
                <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]">
                  <option value="">-- Chọn kế hoạch --</option>
                  {plans.map(sl => (
                    <option key={sl.id} value={sl.id}>
                      {[sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ')}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 bg-[#f5f5f4] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917]">
                    {[currentPlan?.name, currentPlan?.soChuyen, currentPlan?.routeName, fmtNgay(currentPlan?.ngay)].filter(Boolean).join(' / ')}
                  </div>
                  <button onClick={handleChangePlan}
                    className="px-3 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] transition-all cursor-pointer whitespace-nowrap">
                    🔄 Đổi
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Chọn lái xe + nhập liệu - chỉ hiện khi đã chọn kế hoạch */}
            {selectedPlan && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#78716c] mb-1.5">Lái xe <span className="text-[#ef4444]">*</span></label>
                  <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]">
                    <option value="">-- Chọn lái xe --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.fullName} ({d.username}){d.soXe ? ` - ${d.soXe}` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số hàng 20</label>
                    <input type="number" min="0" value={form.hang20} onChange={e => setForm(f => ({ ...f, hang20: e.target.value }))} placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số hàng 40</label>
                    <input type="number" min="0" value={form.hang40} onChange={e => setForm(f => ({ ...f, hang40: e.target.value }))} placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số vỏ 20</label>
                    <input type="number" min="0" value={form.vo20} onChange={e => setForm(f => ({ ...f, vo20: e.target.value }))} placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số vỏ 40</label>
                    <input type="number" min="0" value={form.vo40} onChange={e => setForm(f => ({ ...f, vo40: e.target.value }))} placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số vỏ 20FR <span className="text-[10px] text-[#a8a29e] font-normal">(1 bó = 4 cái)</span></label>
                    <input type="number" min="0" value={form.vo20fr} onChange={e => setForm(f => ({ ...f, vo20fr: e.target.value }))} placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số vỏ 40FR <span className="text-[10px] text-[#a8a29e] font-normal">(1 bó = 4 cái)</span></label>
                    <input type="number" min="0" value={form.vo40fr} onChange={e => setForm(f => ({ ...f, vo40fr: e.target.value }))} placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#78716c] mb-1.5">Vệ sinh lại <span className="text-[10px] text-[#a8a29e] font-normal">(Chuyến)</span></label>
                    <input type="number" min="0" value={form.veSinhLai} onChange={e => setForm(f => ({ ...f, veSinhLai: e.target.value }))} placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#78716c] mb-1.5">Kéo về <span className="text-[10px] text-[#a8a29e] font-normal">(Chuyến)</span></label>
                    <input type="number" min="0" value={form.keoVe} onChange={e => setForm(f => ({ ...f, keoVe: e.target.value }))} placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#78716c] mb-1.5">TIP (x 1.000đ)</label>
                    <input type="number" min="0" value={form.tip} onChange={e => setForm(f => ({ ...f, tip: e.target.value }))} placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => router.back()}
                    className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
                    Quay lại
                  </button>
                  <button onClick={handleSubmit} disabled={saving || !selectedDriver}
                    className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50">
                    {saving ? 'Đang lưu...' : '💾 Lưu'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}