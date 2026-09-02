'use client';

import { useState, useEffect, useMemo } from 'react';
import { salaryApi } from '@/lib/api-salary';
import { usersApi } from '@/lib/api-users';
import { submissionsApi } from '@/lib/api-submissions';
import { SalaryItem, SalaryRecordItem, SalarySettings, User, DriverAdvance } from '@/types';

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

  // Giá trị chung (form)
  const [fixedSalary, setFixedSalary] = useState('');
  const [attendanceBonus, setAttendanceBonus] = useState('');
  const [standardDays, setStandardDays] = useState('');
  const [oldCarAllowance, setOldCarAllowance] = useState('');
  const [bhxhNld, setBhxhNld] = useState('');
  const [parkingHph2, setParkingHph2] = useState('');
  const [farHomeCommon, setFarHomeCommon] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Form tài xế
  const [form, setForm] = useState({
    fixedSalary: '',
    attendanceBonus: '',
    hasFarHome: false,
    allowanceFarHome: '',
    allowanceWaitLoadingRate: '',
    daysOff: '',
    hasOldCar: false,
    allowanceOldCar: '',
    hasParkingHph2: false,
    allowanceParking: '',
    hasBhxh: true,
    chiHo: '',
  });

  // Giá trị nền tài xế (sửa trong tab này)
  const [baseFarHome, setBaseFarHome] = useState('');
  const [baseOldCar, setBaseOldCar] = useState(false);
  const [baseBhxh, setBaseBhxh] = useState(true);
  const [savingBase, setSavingBase] = useState(false);

  // Tạm ứng state
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [editingAdvanceId, setEditingAdvanceId] = useState<number | null>(null);
  const [advanceDraft, setAdvanceDraft] = useState({ amount: '', monthlyDeduction: '', note: '', date: '', deductStart: '' });
  const [savingAdvance, setSavingAdvance] = useState(false);


  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
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
      setFarHomeCommon(fmtMoney(data.settings?.allowanceFarHome));
    } catch (e: any) {
      toast(e?.response?.data?.message || e?.message || 'Không thể tải dữ liệu', 'error');
    } finally {
      if (!silent) setLoading(false);
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
      setForm({ fixedSalary: '', attendanceBonus: '', hasFarHome: false, allowanceFarHome: '', allowanceWaitLoadingRate: '', daysOff: '', hasOldCar: false, allowanceOldCar: '', hasParkingHph2: false, allowanceParking: '', hasBhxh: true, chiHo: '' });
      setBaseFarHome('');
      setBaseOldCar(false);
      setBaseBhxh(true);
      return;
    }
    const rec = records.find(r => r.driverId === id);
    const drv = drivers.find(d => d.id === id);
    setForm({
      fixedSalary: fmtMoney(rec?.fixedSalary),
      attendanceBonus: fmtMoney(rec?.attendanceBonus),
      hasFarHome: rec?.hasFarHome || false,
      allowanceFarHome: rec?.allowanceFarHomeOverride != null ? fmtMoney(rec.allowanceFarHomeOverride) : '',
      allowanceWaitLoadingRate: fmtMoney(rec?.allowanceWaitLoadingRate),
      daysOff: (rec?.daysOff || []).join(', '),
      hasOldCar: rec?.hasOldCar || false,
      allowanceOldCar: rec?.oldCarAllowanceOverride != null ? fmtMoney(rec.oldCarAllowanceOverride) : '',
      hasParkingHph2: rec?.hasParkingHph2 || false,
      allowanceParking: rec?.parkingHph2Override != null ? fmtMoney(rec.parkingHph2Override) : '',
      hasBhxh: rec?.hasBhxh ?? true,
      chiHo: fmtMoney(rec?.chiHo),
    });
    setBaseFarHome(fmtMoney(drv?.allowanceFarHome));
    setBaseOldCar(drv?.oldCar || false);
    setBaseBhxh(drv?.payBhxh ?? true);
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
        allowanceFarHome: Number(farHomeCommon.replace(/[^\d]/g, '')) || 0,
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
        allowanceFarHome: form.allowanceFarHome.trim() === '' ? null : (Number(allowanceFarHomeValue) || 0),
        hasFarHome: form.hasFarHome,
        allowanceWaitLoadingRate: Number(waitLoadingAmountValue) || 0,
        daysOff: daysOffList,
        hasOldCar: form.hasOldCar,
        oldCarAllowance: form.allowanceOldCar.trim() === '' ? null : (Number(oldCarOverrideValue) || 0),
        hasParkingHph2: form.hasParkingHph2,
        parkingHph2: form.allowanceParking.trim() === '' ? null : (Number(parkingOverrideValue) || 0),
        hasBhxh: form.hasBhxh,
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
        payBhxh: baseBhxh,
      });
      toast(`Đã lưu giá trị nền cho ${selectedDriver.fullName}`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSavingBase(false);
    }
  };

  const createAdvance = async () => {
    if (!selectedDriver) return;
    const amount = Number(advanceDraft.amount.replace(/[^\d]/g, '')) || 0;
    const monthlyDeduction = Number(advanceDraft.monthlyDeduction.replace(/[^\d]/g, '')) || 0;
    if (amount <= 0) { toast('Vui lòng nhập số tiền tạm ứng', 'error'); return; }
    if (monthlyDeduction <= 0) { toast('Vui lòng nhập mức khấu trừ hàng tháng', 'error'); return; }
    setSavingAdvance(true);
    try {
      if (editingAdvanceId) {
        // Sửa
        await salaryApi.updateAdvance(editingAdvanceId, {
          amount,
          monthlyDeduction,
          note: advanceDraft.note.trim() || undefined,
          date: advanceDraft.date || undefined,
          deductStart: advanceDraft.deductStart || undefined,
        });
        toast(`Đã cập nhật tạm ứng`, 'success');
      } else {
        // Tạo mới
        await salaryApi.createAdvance({
          driverId: selectedDriver.id,
          amount,
          monthlyDeduction,
          note: advanceDraft.note.trim() || undefined,
          date: advanceDraft.date || undefined,
          deductStart: advanceDraft.deductStart || undefined,
        });
        toast(`Đã thêm tạm ứng cho ${selectedDriver.fullName}`, 'success');
      }
      setAdvanceDraft({ amount: '', monthlyDeduction: '', note: '', date: '', deductStart: '' });
      setEditingAdvanceId(null);
      setShowAdvanceForm(false);
      loadData(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Lưu tạm ứng thất bại', 'error');
    } finally {
      setSavingAdvance(false);
    }
  };

  const deleteAdvance = async (id: number) => {
    if (!confirm('Xóa khoản tạm ứng này? (Lái xe đã trả hết)')) return;
    try {
      await salaryApi.deleteAdvance(id);
      toast('Đã xóa khoản tạm ứng', 'success');
      loadData(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Xóa thất bại', 'error');
    }
  };

  const resetAdvanceDeduct = async () => {
    if (!selectedRecord) return;
    try {
      await salaryApi.resetAdvanceDeduct(selectedRecord.id);
      toast('Đã đặt lại khấu trừ tự động', 'success');
      loadData(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Đặt lại thất bại', 'error');
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

  const updateItemDefaultAmount = async (id: number, amountStr: string) => {
    try {
      await salaryApi.updateItem(id, {
        defaultAmount: Number(amountStr.replace(/[^\d]/g, '')) || 0,
      });
      loadData();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const toggleRecordItem = async (itemId: number, enabled: boolean) => {
    if (!selectedRecord) return;
    // Optimistic: cập nhật ngay để checkbox xanh tức thì
    const prev = records;
    setRecords(prev.map(r => {
      if (r.driverId !== selectedRecord.driverId) return r;
      return {
        ...r,
        recordItems: (r.recordItems || []).map(v =>
          v.itemId === itemId ? { ...v, enabled } : v
        ),
      };
    }));
    try {
      const ri = recordItems.find(v => v.itemId === itemId);
      await salaryApi.updateRecord(selectedRecord.id, {
        recordItems: { [itemId]: { enabled, amount: ri?.overrideAmount ?? null } },
      });
      await loadData(true);
    } catch (e: any) {
      setRecords(prev);
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const updateRecordItemAmount = async (itemId: number, amountStr: string) => {
    if (!selectedRecord) return;
    const ri = recordItems.find(v => v.itemId === itemId);
    try {
      await salaryApi.updateRecord(selectedRecord.id, {
        recordItems: { [itemId]: { enabled: ri?.enabled ?? true, amount: amountStr.trim() === '' ? null : (Number(amountStr.replace(/[^\d]/g, '')) || 0) } },
      });
      await loadData(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  // Tick cập nhật ngay (optimistic) cho phụ cấp theo lái xe — không unmount form
  const toggleFarHome = async (checked: boolean) => {
    if (!selectedRecord) return;
    setForm(f => ({ ...f, hasFarHome: checked }));
    try {
      await salaryApi.updateRecord(selectedRecord.id, {
        hasFarHome: checked,
        allowanceFarHome: checked ? (form.allowanceFarHome.trim() === '' ? null : Number(allowanceFarHomeValue) || 0) : null,
      });
      await loadData(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const updateFarHomeAmount = async (amountStr: string) => {
    if (!selectedRecord) return;
    try {
      await salaryApi.updateRecord(selectedRecord.id, {
        allowanceFarHome: amountStr.trim() === '' ? null : (Number(amountStr.replace(/[^\d]/g, '')) || 0),
      });
      await loadData(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const updateOldCarAmount = async (amountStr: string) => {
    if (!selectedRecord) return;
    try {
      await salaryApi.updateRecord(selectedRecord.id, {
        oldCarAllowance: amountStr.trim() === '' ? null : (Number(amountStr.replace(/[^\d]/g, '')) || 0),
      });
      await loadData(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const updateParkingAmount = async (amountStr: string) => {
    if (!selectedRecord) return;
    try {
      await salaryApi.updateRecord(selectedRecord.id, {
        parkingHph2: amountStr.trim() === '' ? null : (Number(amountStr.replace(/[^\d]/g, '')) || 0),
      });
      await loadData(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
  };

  const fixedSalaryValue = Number(form.fixedSalary.replace(/[^\d]/g, '')) || 0;
  const attendanceBonusValue = Number(form.attendanceBonus.replace(/[^\d]/g, '')) || 0;
  const farHomeCommonValue = Number(farHomeCommon.replace(/[^\d]/g, '')) || 0;
  const allowanceFarHomeValue = form.hasFarHome
    ? (form.allowanceFarHome.trim() === '' ? farHomeCommonValue : (Number(form.allowanceFarHome.replace(/[^\d]/g, '')) || 0))
    : 0;
  const waitLoadingAmountValue = Number(form.allowanceWaitLoadingRate.replace(/[^\d]/g, '')) || 0;
  const oldCarOverrideValue = Number(form.allowanceOldCar.replace(/[^\d]/g, '')) || 0;
  const parkingOverrideValue = Number(form.allowanceParking.replace(/[^\d]/g, '')) || 0;
  const chiHoValue = Number(form.chiHo.replace(/[^\d]/g, '')) || 0;
  const daysOffList = form.daysOff.split(',').map(s => s.trim()).filter(s => s !== '').map(s => parseInt(s)).filter(n => !isNaN(n));

  const chuyenCan = (selectedRecord && selectedRecord.ngayCong >= selectedRecord.standardDays) ? attendanceBonusValue : 0;
  const luongKhoan = selectedRecord?.luongKhoan || 0;
  const tip = selectedRecord?.tip || 0;
  const allowanceWaitLoading = waitLoadingAmountValue;
  const oldCarAllowanceValue = Number(oldCarAllowance.replace(/[^\d]/g, '')) || 0;
  const allowanceOldCar = form.hasOldCar ? (form.allowanceOldCar.trim() === '' ? oldCarAllowanceValue : oldCarOverrideValue) : 0;
  const parkingHph2Value = Number(parkingHph2.replace(/[^\d]/g, '')) || 0;
  const allowanceParking = form.hasParkingHph2 ? (form.allowanceParking.trim() === '' ? parkingHph2Value : parkingOverrideValue) : 0;
  const bhxhPercentValue = Number(bhxhNld.replace(',', '.')) || 0;
  const bhxhValue = form.hasBhxh
    ? Math.round((fixedSalaryValue * bhxhPercentValue) / 100)
    : 0;

  // Khoản lương động — đọc từ selectedRecord.recordItems (đã có enabled + amount)
  const recordItems = selectedRecord?.recordItems || [];
  const itemSumAdd = recordItems.filter(v => v.enabled && v.kind === 'add').reduce((s, v) => s + v.amount, 0);
  const itemSumDeduct = recordItems.filter(v => v.enabled && v.kind === 'deduct').reduce((s, v) => s + v.amount, 0);

  // Tạm ứng
  const advanceDeductValue = selectedRecord?.advanceDeduct || 0;
  const totalRemainingAdvance = selectedRecord?.totalRemainingAdvance || 0;
  const advanceRemainingAfter = selectedRecord?.advanceRemainingAfter ?? 0;
  const driverAdvances: DriverAdvance[] = selectedRecord?.advances || [];


  const total = luongKhoan + fixedSalaryValue + chuyenCan + allowanceFarHomeValue + allowanceWaitLoading + allowanceOldCar + allowanceParking + tip + itemSumAdd - itemSumDeduct - chiHoValue - bhxhValue - advanceDeductValue;


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

        {/* Danh sách khoản lương động — sửa giá trị trực tiếp */}
        {items.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5">
              <span className="text-xs font-medium text-[#64748b]">Khoản lương cộng/khấu trừ</span>
            </div>
            <div className="overflow-x-auto border border-[rgba(0,0,0,0.06)] rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-[#f8fafc] text-[#334155]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Tên khoản</th>
                    <th className="px-3 py-2 text-left font-semibold">Loại</th>
                    <th className="px-3 py-2 text-right font-semibold">Giá trị chung (VNĐ)</th>
                    <th className="px-3 py-2"></th>
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
                      <td className="px-3 py-2 text-right">
                        <input defaultValue={fmtMoney(it.defaultAmount)} onBlur={e => updateItemDefaultAmount(it.id, e.target.value)}
                          inputMode="numeric" className="w-32 px-2 py-1.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-md text-sm text-right text-[#0f172a] outline-none focus:border-[#1a56db]" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => deleteItem(it.id)} className="text-[#b91c1c] hover:underline cursor-pointer">🗑</button>
                      </td>
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
            <label className={labelCls}>Phụ cấp nhà xa (VNĐ/tháng)</label>
            <input value={farHomeCommon} onChange={e => setFarHomeCommon(e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
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
          <button onClick={() => loadData()}
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
                  {/* Khấu trừ tạm ứng */}
                  {advanceDeductValue > 0 || driverAdvances.length > 0 ? (
                    <div>
                      <label className={labelCls}>
                        💸 Khấu trừ tạm ứng tháng này (VNĐ)
                      </label>
                      <div className="px-3.5 py-2.5 bg-[#fff7ed] border border-[#fed7aa] rounded-lg text-sm font-bold text-[#c2410c]">
                        {fmtMoney(advanceDeductValue)} ₫
                        {selectedRecord?.advanceDeductOverridden && (
                          <span className="ml-2 text-[10px] font-medium text-[#9a3412] bg-[#fee2e2] px-1.5 py-0.5 rounded">✏️ Đã sửa tay</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-amber-600 flex-1">
                          Dư nợ còn lại sau tháng này: <strong>{fmtMoney(advanceRemainingAfter)} ₫</strong>
                          {advanceRemainingAfter === 0 && <span className="ml-1 text-green-600">✅ Đã trả hết</span>}
                        </p>
                        {selectedRecord?.advanceDeductOverridden && (
                          <button onClick={resetAdvanceDeduct} className="text-[10px] text-[#1a56db] hover:underline cursor-pointer shrink-0">↩️ Đặt lại tự động</button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className={labelCls}>BHXH - NLĐ ({String(bhxhPercentValue).replace('.', ',')}%)</label>
                    <div className="px-3.5 py-2.5 bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a]">{fmtMoney(bhxhValue)} ₫</div>
                    <p className="text-[10px] text-[#64748b] mt-1">Trừ vào lương: {fmtMoney(bhxhValue)} ₫</p>
                  </div>
                  <div>
                    <label className={labelCls}>Chờ đóng hàng (VNĐ)</label>
                    <input value={form.allowanceWaitLoadingRate} onChange={e => setForm(f => ({ ...f, allowanceWaitLoadingRate: e.target.value }))} inputMode="numeric" placeholder="0" className={inputCls} />
                    <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceWaitLoading)} ₫</p>
                  </div>
                </div>

                {/* Phần TICK (dưới) — Phụ cấp */}
                <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
                  <h4 className="text-sm font-bold mb-3">✅ Phụ cấp — {selectedDriver.fullName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Phụ cấp nhà xa */}
                    <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasFarHome}
                          onChange={e => toggleFarHome(e.target.checked)}
                          className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                        🏠 Phụ cấp nhà xa
                      </label>
                      {form.hasFarHome && (
                        <input value={form.allowanceFarHome} onChange={e => setForm(f => ({ ...f, allowanceFarHome: e.target.value }))} onBlur={e => updateFarHomeAmount(e.target.value)} inputMode="numeric" placeholder="Dùng giá trị chung" className="mt-2 w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-md text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
                      )}
                      <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceFarHomeValue)} ₫</p>
                    </div>

                    {/* Xe cũ */}
                    <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasOldCar} onChange={e => setForm(f => ({ ...f, hasOldCar: e.target.checked }))}
                          className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                        🚚 Xe cũ
                      </label>
                      {form.hasOldCar && (
                        <input value={form.allowanceOldCar} onChange={e => setForm(f => ({ ...f, allowanceOldCar: e.target.value }))} onBlur={e => updateOldCarAmount(e.target.value)} inputMode="numeric" placeholder="Dùng giá trị chung" className="mt-2 w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-md text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
                      )}
                      <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceOldCar)} ₫</p>
                    </div>

                    {/* Gửi xe HPH 2 */}
                    <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasParkingHph2} onChange={e => setForm(f => ({ ...f, hasParkingHph2: e.target.checked }))}
                          className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                        🅿️ Gửi xe HPH 2
                      </label>
                      {form.hasParkingHph2 && (
                        <input value={form.allowanceParking} onChange={e => setForm(f => ({ ...f, allowanceParking: e.target.value }))} onBlur={e => updateParkingAmount(e.target.value)} inputMode="numeric" placeholder="Dùng giá trị chung" className="mt-2 w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-md text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
                      )}
                      <p className="text-[10px] text-[#64748b] mt-1">Thành tiền: {fmtMoney(allowanceParking)} ₫</p>
                    </div>

                    {/* Đóng bảo hiểm (BHXH) */}
                    <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasBhxh} onChange={e => setForm(f => ({ ...f, hasBhxh: e.target.checked }))}
                          className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                        🛡️ Đóng bảo hiểm (BHXH)
                      </label>
                      <p className="text-[10px] text-[#64748b] mt-1">Trừ BHXH {fmtMoney(bhxhValue)} ₫ {form.hasBhxh ? '' : '(không trừ)'}</p>
                    </div>

                    {/* Khoản lương động — mỗi khoản 1 tick + ô nhập số tiền */}
                    {recordItems.map(v => (
                      <div key={v.itemId} className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={v.enabled}
                            onChange={e => toggleRecordItem(v.itemId, e.target.checked)}
                            className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                          <span className="text-xs font-medium text-[#64748b] cursor-pointer" onClick={() => toggleRecordItem(v.itemId, !v.enabled)}>
                            {v.kind === 'add' ? '➕' : '➖'} {v.name}
                          </span>
                        </div>
                        {v.enabled && (
                          <input defaultValue={v.overrideAmount != null ? fmtMoney(v.overrideAmount) : ''} onBlur={e => updateRecordItemAmount(v.itemId, e.target.value)}
                            inputMode="numeric" placeholder="Dùng giá trị chung" className="mt-2 w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-md text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
                        )}
                        <p className="text-[10px] text-[#64748b] mt-1">
                          {v.kind === 'add' ? 'Cộng thêm' : 'Khấu trừ'}: {fmtMoney(v.amount)} ₫
                        </p>
                      </div>
                    ))}
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
                  </div>
                  <div className="mt-3">
                    <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                      <input type="checkbox" checked={baseOldCar} onChange={e => setBaseOldCar(e.target.checked)}
                        className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                      🚚 Xe cũ mặc định
                    </label>
                  </div>
                  <div className="mt-3">
                    <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                      <input type="checkbox" checked={baseBhxh} onChange={e => setBaseBhxh(e.target.checked)}
                        className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
                      🛡️ Đóng bảo hiểm mặc định
                    </label>
                  </div>
                  <button onClick={saveBase} disabled={savingBase}
                    className="mt-3 px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer disabled:opacity-50">
                    {savingBase ? 'Đang lưu...' : '💾 Lưu giá trị nền'}
                  </button>
                </div>

                {/* Quản lý tạm ứng */}
                <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold">💸 Tạm ứng — {selectedDriver.fullName}</h4>
                    <div className="flex items-center gap-2">
                      {totalRemainingAdvance > 0 && (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Dư nợ: {fmtMoney(totalRemainingAdvance)} ₫
                        </span>
                      )}
                      {totalRemainingAdvance === 0 && driverAdvances.length > 0 && (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">✅ Đã trả hết</span>
                      )}
                      <button onClick={() => { setShowAdvanceForm(!showAdvanceForm); setAdvanceDraft({ amount: '', monthlyDeduction: '', note: '', date: '', deductStart: '' }); setEditingAdvanceId(null); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer">
                        ➕ Thêm tạm ứng
                      </button>
                    </div>
                  </div>

                  {/* Form thêm tạm ứng */}
                  {showAdvanceForm && (
                    <div className="mb-4 p-3 bg-[#fffbeb] border border-[#fde68a] rounded-lg">
                      <p className="text-xs font-bold text-[#92400e] mb-3">{editingAdvanceId ? '✏️ Sửa khoản tạm ứng' : '➕ Thêm khoản tạm ứng mới'}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Số tiền tạm ứng (VNĐ) *</label>
                          <input value={advanceDraft.amount} onChange={e => setAdvanceDraft(d => ({ ...d, amount: e.target.value }))} inputMode="numeric" placeholder="11.000.000" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Khấu trừ mỗi tháng (VNĐ) *</label>
                          <input value={advanceDraft.monthlyDeduction} onChange={e => setAdvanceDraft(d => ({ ...d, monthlyDeduction: e.target.value }))} inputMode="numeric" placeholder="2.000.000" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Ngày tạm ứng</label>
                          <input type="date" value={advanceDraft.date} onChange={e => setAdvanceDraft(d => ({ ...d, date: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Bắt đầu khấu trừ từ tháng *</label>
                          <input type="date" value={advanceDraft.deductStart} onChange={e => setAdvanceDraft(d => ({ ...d, deductStart: e.target.value }))} className={inputCls} />
                          <p className="text-[10px] text-[#64748b] mt-1">Tháng đầu tiên bị trừ vào lương (để trống = tháng tạm ứng)</p>
                        </div>
                        <div>
                          <label className={labelCls}>Ghi chú</label>
                          <input value={advanceDraft.note} onChange={e => setAdvanceDraft(d => ({ ...d, note: e.target.value }))} placeholder="VD: Mua xe, ứng lương..." className={inputCls} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={createAdvance} disabled={savingAdvance}
                          className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white disabled:opacity-50 cursor-pointer">
                          {savingAdvance ? 'Đang lưu...' : editingAdvanceId ? '💾 Cập nhật' : '💾 Lưu tạm ứng'}
                        </button>
                        <button onClick={() => { setShowAdvanceForm(false); setEditingAdvanceId(null); setAdvanceDraft({ amount: '', monthlyDeduction: '', note: '', date: '', deductStart: '' }); }} className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] cursor-pointer">
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Danh sách tạm ứng */}
                  {driverAdvances.length > 0 ? (
                    <div className="overflow-x-auto border border-[rgba(0,0,0,0.06)] rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-[#f8fafc] text-[#334155]">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Ngày TU</th>
                            <th className="px-3 py-2 text-left font-semibold">Bắt đầu trừ</th>
                            <th className="px-3 py-2 text-right font-semibold">Tổng TU (₫)</th>
                            <th className="px-3 py-2 text-right font-semibold">Trừ/tháng (₫)</th>
                            <th className="px-3 py-2 text-left font-semibold">Ghi chú</th>
                            <th className="px-3 py-2 text-center font-semibold">Trạng thái</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {driverAdvances.map(adv => (
                            <tr key={adv.id} className="border-t border-[rgba(0,0,0,0.05)]">
                              <td className="px-3 py-2 whitespace-nowrap">{adv.date}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {adv.deductStart
                                  ? <span className="font-medium text-[#1a56db]">{adv.deductStart}</span>
                                  : <span className="text-[#94a3b8]">= ngày TU</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-[#c2410c]">{fmtMoney(adv.amount)}</td>
                              <td className="px-3 py-2 text-right">{fmtMoney(adv.monthlyDeduction)}</td>
                              <td className="px-3 py-2 text-[#64748b]">{adv.note || '—'}</td>
                              <td className="px-3 py-2 text-center">
                                {adv.isPaidOff
                                  ? <span className="text-green-600 font-semibold">✅ Hết nợ</span>
                                  : <span className="text-amber-600 font-semibold">⏳ Còn nợ</span>}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setAdvanceDraft({
                                        amount: String(adv.amount),
                                        monthlyDeduction: String(adv.monthlyDeduction),
                                        note: adv.note || '',
                                        date: adv.date,
                                        deductStart: adv.deductStart || '',
                                      });
                                      setEditingAdvanceId(adv.id);
                                      setShowAdvanceForm(true);
                                    }}
                                    className="text-[#1a56db] hover:underline cursor-pointer" title="Sửa">✏️</button>
                                  <button onClick={() => deleteAdvance(adv.id)} className="text-[#b91c1c] hover:underline cursor-pointer" title="Lái xe đã trả hết">🗑</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-[#94a3b8] italic">Chưa có khoản tạm ứng nào.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
