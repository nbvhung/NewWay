'use client';

import { useState, useEffect, useMemo } from 'react';
import { salaryApi } from '@/lib/api-salary';
import { usersApi } from '@/lib/api-users';
import { submissionsApi } from '@/lib/api-submissions';
import { SalaryItem, SalaryRecordItem, SalarySettings, User } from '@/types';

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
  const [items, setItems] = useState<SalaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Modal thêm/sửa khoản lương
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemDraft, setItemDraft] = useState<{ id: number | null; name: string; kind: 'add' | 'deduct'; defaultAmount: string }[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  // Modal sửa số tiền theo lái xe
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [amountDraft, setAmountDraft] = useState<{ itemId: number; name: string; kind: 'add' | 'deduct'; enabled: boolean; amount: string }[]>([]);
  const [savingAmount, setSavingAmount] = useState(false);

  // Giá trị chung (form)
  const [fixedSalary, setFixedSalary] = useState('');
  const [attendanceBonus, setAttendanceBonus] = useState('');
  const [standardDays, setStandardDays] = useState('');
  const [oldCarAllowance, setOldCarAllowance] = useState('');
  const [bhxhNld, setBhxhNld] = useState('');
  const [parkingHph2, setParkingHph2] = useState('');
  const [waitLoadingRate, setWaitLoadingRate] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Form tài xế
  const [form, setForm] = useState({
    fixedSalary: '',
    attendanceBonus: '',
    allowanceFarHome: '',
    hasWaitLoading: false,
    waitLoadingHours: '',
    daysOff: '',
    hasOldCar: false,
    hasParkingHph2: false,
    chiHo: '',
  });

  // Giá trị nền tài xế (sửa trong tab này)
  const [baseFarHome, setBaseFarHome] = useState('');
  const [baseOldCar, setBaseOldCar] = useState(false);
  const [savingBase, setSavingBase] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await salaryApi.getRecords(month, year);
      const data = res.data?.data;
      setSettings(data.settings);
      setRecords(data.records || []);
      setItems(data.items || []);
      setFixedSalary(fmtMoney(data.settings?.fixedSalary));
      setAttendanceBonus(fmtMoney(data.settings?.attendanceBonus));
      setStandardDays(String(data.settings?.standardDays ?? 26));
      setOldCarAllowance(fmtMoney(data.settings?.oldCarAllowance));
      setBhxhNld(String(data.settings?.bhxhNld ?? 10.5));
      setParkingHph2(fmtMoney(data.settings?.parkingHph2));
      setWaitLoadingRate(fmtMoney(data.settings?.allowanceWaitLoadingRate));
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
      setForm({ fixedSalary: '', attendanceBonus: '', allowanceFarHome: '', hasWaitLoading: false, waitLoadingHours: '', daysOff: '', hasOldCar: false, hasParkingHph2: false, chiHo: '' });
      setBaseFarHome('');
      setBaseOldCar(false);
      return;
    }
    const rec = records.find(r => r.driverId === id);
    const drv = drivers.find(d => d.id === id);
    setForm({
      fixedSalary: fmtMoney(rec?.fixedSalary),
      attendanceBonus: fmtMoney(rec?.attendanceBonus),
      allowanceFarHome: fmtMoney(rec?.allowanceFarHome),
      hasWaitLoading: rec?.hasWaitLoading || false,
      waitLoadingHours: String(rec?.waitLoadingHours ?? 0),
      daysOff: (rec?.daysOff || []).join(', '),
      hasOldCar: rec?.hasOldCar || false,
      hasParkingHph2: rec?.hasParkingHph2 || false,
      chiHo: fmtMoney(rec?.chiHo),
    });
    setBaseFarHome(fmtMoney(drv?.allowanceFarHome));
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
        bhxhNld: Number(bhxhNld.replace(',', '.')) || 0,
        parkingHph2: Number(parkingHph2.replace(/[^\d]/g, '')) || 0,
        allowanceWaitLoadingRate: Number(waitLoadingRate.replace(/[^\d]/g, '')) || 0,
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
        hasWaitLoading: form.hasWaitLoading,
        waitLoadingHours: Number(waitLoadingHoursValue) || 0,
        daysOff: daysOffList,
        hasOldCar: form.hasOldCar,
        hasParkingHph2: form.hasParkingHph2,
        chiHo: Number(chiHoValue) || 0,
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
        oldCar: baseOldCar,
      });
      toast(`Đã lưu giá trị nền cho ${selectedDriver.fullName}`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSavingBase(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await submissionsApi.exportLuongThang(month, year);
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename\*?=(?:UTF-8''|)([^;]+)/);
      const filename = match ? decodeURIComponent(match[1]) : `Lương - Đội Xe - T${String(month).padStart(2, '0')}.${year}.xlsx`;
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Đã xuất file lương tháng ${MONTHS_VI[month]} ${year}`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || e?.message || 'Xuất Excel thất bại', 'error');
    } finally {
      setExporting(false);
    }
  };

  const openAddItemModal = () => {
    setItemDraft([{ id: null, name: '', kind: 'add', defaultAmount: '' }]);
    setShowItemModal(true);
  };

  const openEditItemModal = () => {
    setItemDraft(items.map(it => ({
      id: it.id,
      name: it.name,
      kind: it.kind,
      defaultAmount: fmtMoney(it.defaultAmount),
    })));
    setShowItemModal(true);
  };

  const saveItems = async () => {
    const valid = itemDraft.filter(r => r.name.trim() !== '');
    if (valid.length === 0) {
      toast('Chưa có khoản nào để lưu', 'error');
      return;
    }
    setSavingItems(true);
    try {
      for (const row of valid) {
        const payload = {
          name: row.name.trim(),
          kind: row.kind,
          defaultAmount: Number(row.defaultAmount.replace(/[^\d]/g, '')) || 0,
        };
        if (row.id == null) {
          await salaryApi.createItem(payload);
        } else {
          await salaryApi.updateItem(row.id, payload);
        }
      }
      setShowItemModal(false);
      toast('Đã lưu khoản lương', 'success');
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu khoản thất bại', 'error');
    } finally {
      setSavingItems(false);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm('Xóa khoản lương này?')) return;
    try {
      await salaryApi.deleteItem(id);
      toast('Đã xóa khoản lương', 'success');
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Xóa thất bại', 'error');
    }
  };

  const toggleRecordItem = async (itemId: number, enabled: boolean) => {
    if (!selectedRecord) return;
    try {
      const ri = recordItems.find(v => v.itemId === itemId);
      await salaryApi.updateRecord(selectedRecord.id, {
        recordItems: { [itemId]: { enabled, amount: ri?.amount ?? null } },
      });
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const updateRecordItemAmount = async (itemId: number, amountStr: string) => {
    if (!selectedRecord) return;
    const ri = recordItems.find(v => v.itemId === itemId);
    const amount = Number(amountStr.replace(/[^\d]/g, '')) || 0;
    try {
      await salaryApi.updateRecord(selectedRecord.id, {
        recordItems: { [itemId]: { enabled: ri?.enabled ?? true, amount } },
      });
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  // Tick cập nhật ngay (optimistic) cho phụ cấp theo lái xe — không unmount form
  const toggleFarHome = async (checked: boolean) => {
    if (!selectedRecord) return;
    if (!checked) {
      setForm(f => ({ ...f, allowanceFarHome: '' }));
      try {
        await salaryApi.updateRecord(selectedRecord.id, { allowanceFarHome: 0 });
        loadData();
      } catch (e: any) {
        toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
      }
      return;
    }
    const prev = selectedRecord.allowanceFarHome;
    if (prev > 0) {
      setForm(f => ({ ...f, allowanceFarHome: fmtMoney(prev) }));
    }
    try {
      await salaryApi.updateRecord(selectedRecord.id, { allowanceFarHome: prev > 0 ? prev : 0 });
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const updateFarHomeAmount = async (amountStr: string) => {
    if (!selectedRecord) return;
    const amount = Number(amountStr.replace(/[^\d]/g, '')) || 0;
    setForm(f => ({ ...f, allowanceFarHome: amountStr }));
    try {
      await salaryApi.updateRecord(selectedRecord.id, { allowanceFarHome: amount });
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const toggleWaitLoading = async (checked: boolean) => {
    if (!selectedRecord) return;
    setForm(f => ({ ...f, hasWaitLoading: checked }));
    try {
      await salaryApi.updateRecord(selectedRecord.id, {
        hasWaitLoading: checked,
      });
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const updateWaitLoadingHours = async (hoursStr: string) => {
    if (!selectedRecord) return;
    const hours = Number(hoursStr.replace(/[^\d]/g, '')) || 0;
    setForm(f => ({ ...f, waitLoadingHours: hoursStr }));
    try {
      await salaryApi.updateRecord(selectedRecord.id, {
        waitLoadingHours: hours,
      });
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  // Modal sửa số tiền theo lái xe
  const openAmountModal = () => {
    setAmountDraft(recordItems.map(v => ({
      itemId: v.itemId,
      name: v.name,
      kind: v.kind,
      enabled: v.enabled,
      amount: fmtMoney(v.amount),
    })));
    setShowAmountModal(true);
  };

  const saveAmounts = async () => {
    if (!selectedRecord) return;
    setSavingAmount(true);
    try {
      const recordItemsPayload: Record<string, { enabled: boolean; amount: number | null }> = {};
      for (const row of amountDraft) {
        const amt = row.amount.trim() === '' ? null : (Number(row.amount.replace(/[^\d]/g, '')) || 0);
        recordItemsPayload[row.itemId] = { enabled: row.enabled, amount: amt };
      }
      await salaryApi.updateRecord(selectedRecord.id, { recordItems: recordItemsPayload });
      setShowAmountModal(false);
      toast(`Đã lưu số tiền cho ${selectedDriver?.fullName}`, 'success');
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSavingAmount(false);
    }
  };


  const fixedSalaryValue = Number(form.fixedSalary.replace(/[^\d]/g, '')) || 0;
  const attendanceBonusValue = Number(form.attendanceBonus.replace(/[^\d]/g, '')) || 0;
  const allowanceFarHomeValue = Number(form.allowanceFarHome.replace(/[^\d]/g, '')) || 0;
  const waitLoadingHoursValue = Number(form.waitLoadingHours.replace(/[^\d]/g, '')) || 0;
  const chiHoValue = Number(form.chiHo.replace(/[^\d]/g, '')) || 0;
  const daysOffList = form.daysOff.split(',').map(s => s.trim()).filter(s => s !== '').map(s => parseInt(s)).filter(n => !isNaN(n));

  const chuyenCan = (selectedRecord && selectedRecord.ngayCong >= selectedRecord.standardDays) ? attendanceBonusValue : 0;
  const luongKhoan = selectedRecord?.luongKhoan || 0;
  const tip = selectedRecord?.tip || 0;
  const waitLoadingRateValue = Number(waitLoadingRate.replace(/[^\d]/g, '')) || 0;
  const allowanceWaitLoading = form.hasWaitLoading ? waitLoadingRateValue * waitLoadingHoursValue : 0;
  const oldCarAllowanceValue = Number(oldCarAllowance.replace(/[^\d]/g, '')) || 0;
  const allowanceOldCar = form.hasOldCar ? oldCarAllowanceValue : 0;
  const parkingHph2Value = Number(parkingHph2.replace(/[^\d]/g, '')) || 0;
  const allowanceParking = form.hasParkingHph2 ? parkingHph2Value : 0;
  const bhxhPercentValue = Number(bhxhNld.replace(',', '.')) || 0;
  const bhxhValue = Math.round((fixedSalaryValue * bhxhPercentValue) / 100);

  // Khoản lương động — đọc từ selectedRecord.recordItems (đã có enabled + amount)
  const recordItems = selectedRecord?.recordItems || [];
  const itemSumAdd = recordItems.filter(v => v.enabled && v.kind === 'add').reduce((s, v) => s + v.amount, 0);
  const itemSumDeduct = recordItems.filter(v => v.enabled && v.kind === 'deduct').reduce((s, v) => s + v.amount, 0);

  const total = luongKhoan + fixedSalaryValue + chuyenCan + allowanceFarHomeValue + allowanceWaitLoading + allowanceOldCar + allowanceParking + tip + itemSumAdd - itemSumDeduct - chiHoValue - bhxhValue;

  const inputCls = "w-full px-3.5 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]";
  const labelCls = "block text-xs font-medium text-[#64748b] mb-1.5";

  return (
    <div className="space-y-5">
      {/* Giá trị chung */}
      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">💰 Lương và Phụ cấp
          <button onClick={openAddItemModal}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">
            ➕ Thêm khoản lương
          </button>
        </h3>

        {/* Danh sách khoản lương động */}
        {items.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-[#64748b]">Khoản lương cộng/khấu trừ</span>
              <button onClick={openEditItemModal}
                className="text-[11px] font-medium text-[#1a56db] hover:underline cursor-pointer">✏️ Sửa danh sách</button>
            </div>
            <div className="overflow-x-auto border border-[rgba(0,0,0,0.06)] rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-[#f8fafc] text-[#334155]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Tên khoản</th>
                    <th className="px-3 py-2 text-left font-semibold">Loại</th>
                    <th className="px-3 py-2 text-right font-semibold">Giá trị chung (VNĐ)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className="border-t border-[rgba(0,0,0,0.05)]">
                      <td className="px-3 py-2">{it.name}</td>
                      <td className="px-3 py-2">
                        {it.kind === 'add'
                          ? <span className="text-[#15803d]">➕ Cộng thêm</span>
                          : <span className="text-[#b91c1c]">➖ Khấu trừ</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{fmtMoney(it.defaultAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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
          <div>
            <label className={labelCls}>BHXH - NLĐ (%)</label>
            <input value={bhxhNld} onChange={e => setBhxhNld(e.target.value)} inputMode="decimal" placeholder="10,5" className={inputCls} />
            <p className="text-[10px] text-[#64748b] mt-1">Tính theo lương cứng của từng lái xe (VD lương 7.000.000 × 10,5% = 735.000 ₫)</p>
          </div>
          <div>
            <label className={labelCls}>Tiền gửi xe HPH 2 (VNĐ/tháng)</label>
            <input value={parkingHph2} onChange={e => setParkingHph2(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Chờ đóng hàng (VNĐ/giờ)</label>
            <input value={waitLoadingRate} onChange={e => setWaitLoadingRate(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
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
          <button onClick={exportExcel} disabled={exporting}
            className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer">
            {exporting ? '⏳ Đang xuất...' : '📥 Xuất Excel'}
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
                    <div className="text-[10px] font-medium text-[#0284c7]">Lương chuyến</div>
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

                {/* Phần INPUT (trên) */}
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
                    <label className={labelCls}>Ngày nghỉ (cách nhau dấu phẩy)</label>
                    <input value={form.daysOff} onChange={e => setForm(f => ({ ...f, daysOff: e.target.value }))} placeholder="VD: 2, 8, 15" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Chi hộ (Cty chi) (VNĐ)</label>
                    <input value={form.chiHo} onChange={e => setForm(f => ({ ...f, chiHo: e.target.value }))} inputMode="numeric" placeholder="0" className={inputCls} />
                    <p className="text-[10px] text-[#64748b] mt-1">Trừ vào lương: {fmtMoney(chiHoValue)} ₫</p>
                  </div>
                  <div>
                    <label className={labelCls}>BHXH - NLĐ ({String(bhxhPercentValue).replace('.', ',')}%)</label>
                    <div className="px-3.5 py-2.5 bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a]">{fmtMoney(bhxhValue)} ₫</div>
                    <p className="text-[10px] text-[#64748b] mt-1">Trừ vào lương: {fmtMoney(bhxhValue)} ₫</p>
                  </div>
                </div>

                {/* Phần TICK (dưới) — Phụ cấp */}
                <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
                  <h4 className="text-sm font-bold mb-3">✅ Phụ cấp — {selectedDriver.fullName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Phụ cấp nhà xa */}
                    <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.allowanceFarHome !== '' && Number(form.allowanceFarHome.replace(/[^\d]/g, '')) > 0}
                          onChange={e => toggleFarHome(e.target.checked)}
                          className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                        🏠 Phụ cấp nhà xa
                      </label>
                      {form.allowanceFarHome !== '' && Number(form.allowanceFarHome.replace(/[^\d]/g, '')) > 0 && (
                        <input value={form.allowanceFarHome} onChange={e => updateFarHomeAmount(e.target.value)} inputMode="numeric" className="mt-2 w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-md text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
                      )}
                      <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceFarHomeValue)} ₫</p>
                    </div>

                    {/* Phụ cấp chờ đóng hàng (theo giờ) */}
                    <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasWaitLoading}
                          onChange={e => toggleWaitLoading(e.target.checked)}
                          className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                        ⏱️ Chờ đóng hàng
                      </label>
                      {form.hasWaitLoading && (
                        <div className="mt-2 flex items-center gap-2">
                          <input value={form.waitLoadingHours} onChange={e => updateWaitLoadingHours(e.target.value)} inputMode="numeric" placeholder="Số tiếng" className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-md text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
                          <span className="text-xs text-[#64748b]">giờ × {fmtMoney(waitLoadingRateValue)}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceWaitLoading)} ₫</p>
                    </div>

                    {/* Xe cũ */}
                    <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasOldCar} onChange={e => setForm(f => ({ ...f, hasOldCar: e.target.checked }))}
                          className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                        🚚 Xe cũ
                      </label>
                      <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceOldCar)} ₫</p>
                    </div>

                    {/* Gửi xe HPH 2 */}
                    <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasParkingHph2} onChange={e => setForm(f => ({ ...f, hasParkingHph2: e.target.checked }))}
                          className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                        🅿️ Gửi xe HPH 2
                      </label>
                      <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceParking)} ₫</p>
                    </div>

                    {/* Khoản lương động — mỗi khoản 1 tick */}
                    {recordItems.map(v => (
                      <div key={v.itemId} className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                        <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                          <input type="checkbox" checked={v.enabled}
                            onChange={e => toggleRecordItem(v.itemId, e.target.checked)}
                            className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                          {v.kind === 'add' ? '➕' : '➖'} {v.name}
                        </label>
                        <p className="text-[10px] text-[#64748b] mt-1">
                          {v.kind === 'add' ? 'Cộng thêm' : 'Khấu trừ'}: {fmtMoney(v.amount)} ₫
                        </p>
                      </div>
                    ))}
                  </div>

                  {recordItems.length > 0 && (
                    <button onClick={openAmountModal}
                      className="mt-3 px-4 py-2 rounded-lg text-xs font-medium text-[#1a56db] border border-[#1a56db]/30 hover:bg-[#1a56db]/5 cursor-pointer">
                      ✏️ Sửa số tiền
                    </button>
                  )}
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

      {/* Modal sửa số tiền theo lái xe */}
      {showAmountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAmountModal(false)}>
          <div className="bg-[#ffffff] rounded-xl shadow-2xl w-full max-w-xl p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">✏️ Sửa số tiền — {selectedDriver?.fullName}</h3>
              <button onClick={() => setShowAmountModal(false)} className="text-xl text-[#64748b] hover:text-[#0f172a] cursor-pointer">×</button>
            </div>
            <p className="text-xs text-[#64748b] mb-3">Để trống số tiền = dùng giá trị chung của khoản.</p>
            <div className="space-y-2">
              {amountDraft.map(row => (
                <div key={row.itemId} className="flex items-center gap-3 border border-[rgba(0,0,0,0.06)] rounded-lg p-3">
                  <input type="checkbox" checked={row.enabled} onChange={e => {
                    const next = [...amountDraft];
                    const i = next.findIndex(x => x.itemId === row.itemId);
                    next[i] = { ...next[i], enabled: e.target.checked };
                    setAmountDraft(next);
                  }} className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                  <span className="flex-1 text-sm font-medium">{row.name}
                    <span className="ml-2 text-[10px] font-normal text-[#64748b]">{row.kind === 'add' ? 'Cộng thêm' : 'Khấu trừ'}</span>
                  </span>
                  <input value={row.amount} onChange={e => {
                    const next = [...amountDraft];
                    const i = next.findIndex(x => x.itemId === row.itemId);
                    next[i] = { ...next[i], amount: e.target.value };
                    setAmountDraft(next);
                  }} inputMode="numeric" placeholder="Giá trị chung" className="w-32 px-2 py-1.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-md text-sm text-right text-[#0f172a] outline-none focus:border-[#1a56db]" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={saveAmounts} disabled={savingAmount}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer">
                {savingAmount ? 'Đang lưu...' : '💾 Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal thêm/sửa khoản lương */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowItemModal(false)}>
          <div className="bg-[#ffffff] rounded-xl shadow-2xl w-full max-w-2xl p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">➕ Khoản lương (cộng thêm / khấu trừ)</h3>
              <button onClick={() => setShowItemModal(false)} className="text-xl text-[#64748b] hover:text-[#0f172a] cursor-pointer">×</button>
            </div>
            <div className="overflow-x-auto border border-[rgba(0,0,0,0.06)] rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-[#f8fafc] text-[#334155]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Tên phụ cấp</th>
                    <th className="px-3 py-2 text-left font-semibold">Loại</th>
                    <th className="px-3 py-2 text-right font-semibold">Giá trị (VNĐ)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {itemDraft.map((row, idx) => (
                    <tr key={idx} className="border-t border-[rgba(0,0,0,0.05)]">
                      <td className="px-2 py-2">
                        <input value={row.name} onChange={e => {
                          const next = [...itemDraft];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setItemDraft(next);
                        }} placeholder="VD: Phụ cấp điện thoại" className={inputCls} />
                      </td>
                      <td className="px-2 py-2">
                        <select value={row.kind} onChange={e => {
                          const next = [...itemDraft];
                          next[idx] = { ...next[idx], kind: e.target.value as 'add' | 'deduct' };
                          setItemDraft(next);
                        }} className="px-2 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]">
                          <option value="add">➕ Cộng thêm</option>
                          <option value="deduct">➖ Khấu trừ</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input value={row.defaultAmount} onChange={e => {
                          const next = [...itemDraft];
                          next[idx] = { ...next[idx], defaultAmount: e.target.value };
                          setItemDraft(next);
                        }} inputMode="numeric" placeholder="0" className={inputCls} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => {
                          if (row.id != null) {
                            salaryApi.deleteItem(row.id).then(() => { toast('Đã xóa khoản lương', 'success'); setItemDraft(itemDraft.filter((_, i) => i !== idx)); });
                          } else {
                            setItemDraft(itemDraft.filter((_, i) => i !== idx));
                          }
                        }} className="text-[#b91c1c] hover:underline cursor-pointer">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => setItemDraft([...itemDraft, { id: null, name: '', kind: 'add', defaultAmount: '' }])}
                className="px-3 py-2 rounded-lg text-xs font-medium text-[#1a56db] border border-[#1a56db]/30 hover:bg-[#1a56db]/5 cursor-pointer">
                ➕ Thêm dòng
              </button>
              <button onClick={saveItems} disabled={savingItems}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer">
                {savingItems ? 'Đang lưu...' : '💾 Lưu khoản lương'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
