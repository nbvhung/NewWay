'use client';

import { useState, useEffect, useMemo } from 'react';
import { salaryApi } from '@/lib/api-salary';
import { usersApi } from '@/lib/api-users';
import { SalaryRecordItem, SalarySettings, User } from '@/types';

interface Props {
  currentUser: any;
  allUsers: User[];
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const MONTHS_VI = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

function nowVN(): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  return {
    month: Number(parts.find(p => p.type === 'month')?.value),
    year: Number(parts.find(p => p.type === 'year')?.value),
  };
}

function fmtMoney(v: number | undefined | null): string {
  if (v == null || v === 0) return '0';
  return Math.floor(v).toLocaleString('vi-VN');
}

export function SalaryTab({ currentUser, allUsers, toast }: Props) {
  const vnNow = useMemo(nowVN, []);
  const [month, setMonth] = useState(vnNow.month);
  const [year, setYear] = useState(vnNow.year);
  const [settings, setSettings] = useState<SalarySettings | null>(null);
  const [records, setRecords] = useState<SalaryRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Giá trị chung (form)
  const [fixedSalary, setFixedSalary] = useState('');
  const [attendanceBonus, setAttendanceBonus] = useState('');
  const [standardDays, setStandardDays] = useState('');
  const [oldCarAllowance, setOldCarAllowance] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Form tài xế
  const [form, setForm] = useState({
    fixedSalary: '',
    attendanceBonus: '',
    allowanceFarHome: '',
    allowanceWaitLoadingRate: '',
    waitLoadingCount: '',
    daysOff: '',
    hasOldCar: false,
  });

  // Giá trị nền tài xế (sửa trong tab này)
  const [baseFarHome, setBaseFarHome] = useState('');
  const [baseWaitLoading, setBaseWaitLoading] = useState('');
  const [baseOldCar, setBaseOldCar] = useState(false);
  const [savingBase, setSavingBase] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await salaryApi.getRecords(month, year);
      const data = res.data?.data;
      setSettings(data.settings);
      setRecords(data.records || []);
      setFixedSalary(fmtMoney(data.settings?.fixedSalary));
      setAttendanceBonus(fmtMoney(data.settings?.attendanceBonus));
      setStandardDays(String(data.settings?.standardDays ?? 26));
      setOldCarAllowance(fmtMoney(data.settings?.oldCarAllowance));
    } catch (e: any) {
      toast(e?.response?.data?.message || e?.message || 'Không thể tải dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [month, year]);

  const drivers = useMemo(() => {
    return allUsers
      .filter(u => u.role === 'laixe')
      .sort((a, b) => (parseInt(a.stt) || 999999) - (parseInt(b.stt) || 999999) || a.fullName.localeCompare(b.fullName));
  }, [allUsers]);

  const selectedRecord = records.find(r => r.driverId === selectedId) || null;
  const selectedDriver = drivers.find(d => d.id === selectedId) || null;

  const pickDriver = (id: number | null) => {
    setSelectedId(id);
    if (id == null) {
      setForm({ fixedSalary: '', attendanceBonus: '', allowanceFarHome: '', allowanceWaitLoadingRate: '', waitLoadingCount: '', daysOff: '', hasOldCar: false });
      setBaseFarHome('');
      setBaseWaitLoading('');
      setBaseOldCar(false);
      return;
    }
    const rec = records.find(r => r.driverId === id);
    const drv = drivers.find(d => d.id === id);
    setForm({
      fixedSalary: fmtMoney(rec?.fixedSalary),
      attendanceBonus: fmtMoney(rec?.attendanceBonus),
      allowanceFarHome: fmtMoney(rec?.allowanceFarHome),
      allowanceWaitLoadingRate: fmtMoney(rec?.allowanceWaitLoadingRate),
      waitLoadingCount: String(rec?.waitLoadingCount ?? 0),
      daysOff: (rec?.daysOff || []).join(', '),
      hasOldCar: rec?.hasOldCar || false,
    });
    setBaseFarHome(fmtMoney(drv?.allowanceFarHome));
    setBaseWaitLoading(fmtMoney(drv?.allowanceWaitLoading));
    setBaseOldCar(drv?.oldCar || false);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await salaryApi.updateSettings({
        fixedSalary: Number(fixedSalary.replace(/[^\d]/g, '')) || 0,
        attendanceBonus: Number(attendanceBonus.replace(/[^\d]/g, '')) || 0,
        standardDays: Number(standardDays) || 26,
        oldCarAllowance: Number(oldCarAllowance.replace(/[^\d]/g, '')) || 0,
      });
      toast('Đã lưu giá trị chung', 'success');
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const saveRecord = async () => {
    if (!selectedRecord || !selectedDriver) {
      toast('Vui lòng chọn lái xe', 'error');
      return;
    }
    setSaving(true);
    try {
      await salaryApi.updateRecord(selectedRecord.id, {
        fixedSalary: Number(fixedSalaryValue) || 0,
        attendanceBonus: Number(attendanceBonusValue) || 0,
        allowanceFarHome: Number(allowanceFarHomeValue) || 0,
        allowanceWaitLoadingRate: Number(waitLoadingRateValue) || 0,
        waitLoadingCount: Number(waitLoadingCountValue) || 0,
        daysOff: daysOffList,
        hasOldCar: form.hasOldCar,
      });
      toast(`Đã lưu cho ${selectedDriver.fullName}`, 'success');
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveBase = async () => {
    if (!selectedDriver) return;
    setSavingBase(true);
    try {
      await usersApi.update(selectedDriver.id, {
        allowanceFarHome: Number(baseFarHome.replace(/[^\d]/g, '')) || 0,
        allowanceWaitLoading: Number(baseWaitLoading.replace(/[^\d]/g, '')) || 0,
        oldCar: baseOldCar,
      });
      toast(`Đã lưu giá trị nền cho ${selectedDriver.fullName}`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSavingBase(false);
    }
  };

  const fixedSalaryValue = Number(form.fixedSalary.replace(/[^\d]/g, '')) || 0;
  const attendanceBonusValue = Number(form.attendanceBonus.replace(/[^\d]/g, '')) || 0;
  const allowanceFarHomeValue = Number(form.allowanceFarHome.replace(/[^\d]/g, '')) || 0;
  const waitLoadingRateValue = Number(form.allowanceWaitLoadingRate.replace(/[^\d]/g, '')) || 0;
  const waitLoadingCountValue = Number(form.waitLoadingCount.replace(/[^\d]/g, '')) || 0;
  const daysOffList = form.daysOff.split(',').map(s => s.trim()).filter(s => s !== '').map(s => parseInt(s)).filter(n => !isNaN(n));

  const chuyenCan = (selectedRecord && selectedRecord.ngayCong >= selectedRecord.standardDays) ? attendanceBonusValue : 0;
  const luongKhoan = selectedRecord?.luongKhoan || 0;
  const tip = selectedRecord?.tip || 0;
  const allowanceWaitLoading = waitLoadingRateValue * waitLoadingCountValue;
  const oldCarAllowanceValue = Number(oldCarAllowance.replace(/[^\d]/g, '')) || 0;
  const allowanceOldCar = form.hasOldCar ? oldCarAllowanceValue : 0;
  const total = luongKhoan + fixedSalaryValue + chuyenCan + allowanceFarHomeValue + allowanceWaitLoading + allowanceOldCar + tip;

  const inputCls = "w-full px-3.5 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]";
  const labelCls = "block text-xs font-medium text-[#64748b] mb-1.5";

  return (
    <div className="space-y-5">
      {/* Giá trị chung */}
      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">💰 Giá trị chung toàn công ty</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Lương cứng (VNĐ/tháng)</label>
            <input value={fixedSalary} onChange={e => setFixedSalary(e.target.value)} inputMode="numeric" placeholder="7.000.000" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Chuyên cần (VNĐ/tháng)</label>
            <input value={attendanceBonus} onChange={e => setAttendanceBonus(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Số ngày công chuẩn</label>
            <input value={standardDays} onChange={e => setStandardDays(e.target.value)} inputMode="numeric" placeholder="26" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phụ cấp xe cũ (VNĐ/tháng)</label>
            <input value={oldCarAllowance} onChange={e => setOldCarAllowance(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
          </div>
        </div>
        <button onClick={saveSettings} disabled={savingSettings}
          className="mt-4 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] disabled:opacity-50 cursor-pointer">
          {savingSettings ? 'Đang lưu...' : '💾 Lưu giá trị chung'}
        </button>
      </div>

      {/* Chọn tháng/năm */}
      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-base font-bold mb-4">📅 Chọn tháng</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className={labelCls}>Tháng</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{MONTHS_VI[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Năm</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]">
              {Array.from({ length: 5 }, (_, i) => vnNow.year - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button onClick={loadData}
            className="px-4 py-2.5 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">
            🔄 Làm mới
          </button>
        </div>

        {/* Chọn lái xe + nhập liệu */}
        {!loading && (
          <div className="mt-5 border-t border-[rgba(0,0,0,0.06)] pt-5">
            <label className={labelCls}>Lái xe</label>
            <select value={selectedId ?? ''} onChange={e => pickDriver(e.target.value ? Number(e.target.value) : null)}
              className="w-full max-w-[520px] px-3.5 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]">
              <option value="">-- Chọn lái xe --</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.stt || ''} {d.fullName} ({d.username}){d.soXe ? ` - ${d.soXe}` : ''}</option>
              ))}
            </select>

            {selectedRecord && selectedDriver && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="px-4 py-3 rounded-lg bg-[#f0f9ff] border border-[#bae6fd]">
                    <div className="text-[10px] font-medium text-[#0284c7]">Lương khoán</div>
                    <div className="text-sm font-bold text-[#0369a1]">{fmtMoney(luongKhoan)} ₫</div>
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0]">
                    <div className="text-[10px] font-medium text-[#16a34a]">TIP</div>
                    <div className="text-sm font-bold text-[#15803d]">{fmtMoney(tip)} ₫</div>
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-[#fefce8] border border-[#fde68a]">
                    <div className="text-[10px] font-medium text-[#a16207]">Ngày công</div>
                    <div className="text-sm font-bold text-[#854d0e]">{selectedRecord.ngayCong} / {selectedRecord.standardDays} ngày</div>
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-[#eef2ff] border border-[#c7d2fe]">
                    <div className="text-[10px] font-medium text-[#4338ca]">Tổng thanh toán</div>
                    <div className="text-sm font-bold text-[#3730a3]">{fmtMoney(total)} ₫</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Lương cứng (VNĐ)</label>
                    <input value={form.fixedSalary} onChange={e => setForm(f => ({ ...f, fixedSalary: e.target.value }))} inputMode="numeric" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Chuyên cần (VNĐ)</label>
                    <input value={form.attendanceBonus} onChange={e => setForm(f => ({ ...f, attendanceBonus: e.target.value }))} inputMode="numeric" className={inputCls} />
                    <p className="text-[10px] text-[#64748b] mt-1">Chuyên cần tháng này: {chuyenCan >= 0 ? `${fmtMoney(chuyenCan)} ₫` : ''} ({selectedRecord.ngayCong >= selectedRecord.standardDays ? 'Đủ ngày' : 'Thiếu ngày'})</p>
                  </div>
                  <div>
                    <label className={labelCls}>Phụ cấp nhà xa (VNĐ/tháng)</label>
                    <input value={form.allowanceFarHome} onChange={e => setForm(f => ({ ...f, allowanceFarHome: e.target.value }))} inputMode="numeric" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phụ cấp chờ đóng hàng (VNĐ/chuyến)</label>
                    <input value={form.allowanceWaitLoadingRate} onChange={e => setForm(f => ({ ...f, allowanceWaitLoadingRate: e.target.value }))} inputMode="numeric" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Số lần chờ đóng hàng</label>
                    <input value={form.waitLoadingCount} onChange={e => setForm(f => ({ ...f, waitLoadingCount: e.target.value }))} inputMode="numeric" className={inputCls} />
                    <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceWaitLoading)} ₫</p>
                  </div>
                  <div>
                    <label className={labelCls}>Ngày nghỉ (cách nhau dấu phẩy)</label>
                    <input value={form.daysOff} onChange={e => setForm(f => ({ ...f, daysOff: e.target.value }))} placeholder="VD: 2, 8, 15" className={inputCls} />
                  </div>
                  <div className="flex flex-col justify-end pb-1">
                    <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                      <input type="checkbox" checked={form.hasOldCar} onChange={e => setForm(f => ({ ...f, hasOldCar: e.target.checked }))}
                        className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                      🚚 Xe cũ
                    </label>
                    <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceOldCar)} ₫</p>
                  </div>
                </div>

                <button onClick={saveRecord} disabled={saving}
                  className="px-5 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer">
                  {saving ? 'Đang lưu...' : '💾 Lưu thành phần lương'}
                </button>

                {/* Giá trị nền theo tài xế */}
                <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
                  <h4 className="text-sm font-bold mb-2">🏠 Giá trị nền (mặc định kế thừa tháng sau) — {selectedDriver.fullName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[520px]">
                    <div>
                      <label className={labelCls}>Phụ cấp nhà xa mặc định</label>
                      <input value={baseFarHome} onChange={e => setBaseFarHome(e.target.value)} inputMode="numeric" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Phụ cấp chờ đóng hàng mặc định</label>
                      <input value={baseWaitLoading} onChange={e => setBaseWaitLoading(e.target.value)} inputMode="numeric" className={inputCls} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                      <input type="checkbox" checked={baseOldCar} onChange={e => setBaseOldCar(e.target.checked)}
                        className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                      🚚 Xe cũ mặc định
                    </label>
                  </div>
                  <button onClick={saveBase} disabled={savingBase}
                    className="mt-3 px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer disabled:opacity-50">
                    {savingBase ? 'Đang lưu...' : '💾 Lưu giá trị nền'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
