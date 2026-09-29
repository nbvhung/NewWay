'use client';

import { useState, useEffect, useMemo } from 'react';
import { salaryApi } from '@/lib/api-salary';
import { usersApi } from '@/lib/api-users';
import { submissionsApi } from '@/lib/api-submissions';
import { SalaryItem, SalaryRecordItem, SalarySettings, User, DriverAdvance, SalaryPaymentLog } from '@/types';
import { confirmDelete } from '@/lib/delete-guard';

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

function fmtDT(v: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const PAY_ACTION_LABEL: Record<string, { label: string; color: string }> = {
  FIXED_PAID: { label: '✅ Thanh toán lương cứng', color: 'text-green-600' },
  FIXED_UNDO: { label: '↩️ Hoàn tác lương cứng', color: 'text-red-600' },
  TOTAL_PAID: { label: '✅ Thanh toán tổng', color: 'text-green-600' },
  TOTAL_UNDO: { label: '↩️ Hoàn tác tổng', color: 'text-red-600' },
};

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
  const [showPayModal, setShowPayModal] = useState<'pay' | 'undo' | null>(null);
  const [payType, setPayType] = useState<'fixed' | 'total'>('fixed');
  const [payMonth, setPayMonth] = useState(vnNow.month);
  const [payYear, setPayYear] = useState(vnNow.year);
  const [paySelected, setPaySelected] = useState<Set<number>>(new Set());
  const [savingPay, setSavingPay] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<SalaryPaymentLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [payRecords, setPayRecords] = useState<SalaryRecordItem[]>([]);

  // Modal thêm/sửa khoản lương
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemDraft, setItemDraft] = useState<{ id: number | null; name: string; kind: 'add' | 'deduct'; defaultAmount: string }[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  // Giá trị chung (form)
  const [fixedSalary, setFixedSalary] = useState('');
  const [standardDays, setStandardDays] = useState('');
  const [oldCarAllowance, setOldCarAllowance] = useState('');
  const [bhxhNld, setBhxhNld] = useState('');
  const [parkingHph2, setParkingHph2] = useState('');
  const [farHomeCommon, setFarHomeCommon] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Form tài xế
  const [form, setForm] = useState({
    fixedSalary: '',
    hasFarHome: false,
    allowanceFarHome: '',
    allowanceWaitLoadingRate: '',
    daysOff: '',
    daysOffNote: '',
    hasOldCar: false,
    allowanceOldCar: '',
    hasParkingHph2: false,
    allowanceParking: '',
    hasBhxh: true,
    chiHo: '',
    advanceDeduct: '',
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
      setForm({ fixedSalary: '', hasFarHome: false, allowanceFarHome: '', allowanceWaitLoadingRate: '', daysOff: '', daysOffNote: '', hasOldCar: false, allowanceOldCar: '', hasParkingHph2: false, allowanceParking: '', hasBhxh: true, chiHo: '', advanceDeduct: '' });
      setBaseFarHome('');
      setBaseOldCar(false);
      setBaseBhxh(true);
      return;
    }
    const rec = records.find(r => r.driverId === id);
    const drv = drivers.find(d => d.id === id);
    setForm({
      fixedSalary: fmtMoney(rec?.fixedSalary),
      hasFarHome: rec?.hasFarHome || false,
      allowanceFarHome: rec?.allowanceFarHomeOverride != null ? fmtMoney(rec.allowanceFarHomeOverride) : '',
      allowanceWaitLoadingRate: fmtMoney(rec?.allowanceWaitLoadingRate),
      daysOff: (rec?.daysOff || []).join(', '),
      daysOffNote: rec?.daysOffNote || '',
      hasOldCar: rec?.hasOldCar || false,
      allowanceOldCar: rec?.oldCarAllowanceOverride != null ? fmtMoney(rec.oldCarAllowanceOverride) : '',
      hasParkingHph2: rec?.hasParkingHph2 || false,
      allowanceParking: rec?.parkingHph2Override != null ? fmtMoney(rec.parkingHph2Override) : '',
      hasBhxh: rec?.hasBhxh ?? true,
      chiHo: fmtMoney(rec?.chiHo),
      advanceDeduct: fmtMoney(rec?.advanceDeduct),
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
        allowanceFarHome: form.allowanceFarHome.trim() === '' ? null : (Number(allowanceFarHomeValue) || 0),
        hasFarHome: form.hasFarHome,
        allowanceWaitLoadingRate: Number(waitLoadingAmountValue) || 0,
        daysOff: daysOffList,
        daysOffNote: form.daysOffNote.trim() || null,
        hasOldCar: form.hasOldCar,
        oldCarAllowance: form.allowanceOldCar.trim() === '' ? null : (Number(oldCarOverrideValue) || 0),
        hasParkingHph2: form.hasParkingHph2,
        parkingHph2: form.allowanceParking.trim() === '' ? null : (Number(parkingOverrideValue) || 0),
        hasBhxh: form.hasBhxh,
        chiHo: Number(chiHoValue) || 0,
        advanceDeduct: Number(advanceDeductValue) || 0,
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
    // Xoá luôn phải nhập mật khẩu 348 (popup của <DeleteGuardHost />).
    const res = await confirmDelete({
      message: 'Xóa khoản tạm ứng này? (Lái xe đã trả hết)',
      action: () => salaryApi.deleteAdvance(id),
    });
    if (res === undefined) return;
    toast('Đã xóa khoản tạm ứng', 'success');
    loadData(true);
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

  const openPayModal = (mode: 'pay' | 'undo', type: 'fixed' | 'total' = 'fixed') => {
    setPayMonth(month);
    setPayYear(year);
    setPaySelected(new Set());
    setPayType(type);
    setShowPayModal(mode);
    loadPayRecords(month, year);
  };

  const loadPayRecords = async (m: number, y: number) => {
    try {
      const res = await salaryApi.getRecords(m, y);
      setPayRecords(res.data?.data?.records || []);
    } catch {
      setPayRecords([]);
    }
  };

  const openHistoryModal = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await salaryApi.getPaymentLogs(month, year);
      setHistoryLogs(res.data?.data || []);
    } catch (e: any) {
      setHistoryLogs([]);
      toast(e?.response?.data?.message || 'Không tải được lịch sử', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleAllPay = (checked: boolean) => {
    setPaySelected(checked ? new Set(drivers.map(d => d.id)) : new Set());
  };

  const togglePay = (id: number) => {
    setPaySelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitPay = async () => {
    if (!showPayModal || paySelected.size === 0) {
      toast('Vui lòng chọn ít nhất 1 lái xe', 'error');
      return;
    }
    setSavingPay(true);
    try {
      const driverIds = [...paySelected];
      const isUndo = showPayModal === 'undo';
      const payload = { driverIds, month: payMonth, year: payYear, undo: isUndo };
      if (payType === 'fixed') {
        const res = await salaryApi.payFixedSalary(payload);
        toast(res.data?.message || (isUndo ? `Đã hoàn tác lương cứng cho ${driverIds.length} lái xe` : `Đã thanh toán lương cứng cho ${driverIds.length} lái xe`), 'success');
      } else {
        const res = await salaryApi.payTotalSalary(payload);
        toast(res.data?.message || (isUndo ? `Đã hoàn tác tổng lương cho ${driverIds.length} lái xe` : `Đã thanh toán tổng lương cho ${driverIds.length} lái xe`), 'success');
      }
      setShowPayModal(null);
      setPaySelected(new Set());
      loadData(true);
    } catch (e: any) {
      toast(e?.response?.data?.message || e?.message || 'Thất bại', 'error');
    } finally {
      setSavingPay(false);
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
    // Xoá luôn phải nhập mật khẩu 348 (popup của <DeleteGuardHost />).
    const res = await confirmDelete({
      message: 'Xóa khoản lương này?',
      action: () => salaryApi.deleteItem(id),
    });
    if (res === undefined) return;
    toast('Đã xóa khoản lương', 'success');
    loadData();
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
  const farHomeCommonValue = Number(farHomeCommon.replace(/[^\d]/g, '')) || 0;
  const allowanceFarHomeValue = form.hasFarHome
    ? (form.allowanceFarHome.trim() === '' ? farHomeCommonValue : (Number(form.allowanceFarHome.replace(/[^\d]/g, '')) || 0))
    : 0;
  const waitLoadingAmountValue = Number(form.allowanceWaitLoadingRate.replace(/[^\d]/g, '')) || 0;
  const oldCarOverrideValue = Number(form.allowanceOldCar.replace(/[^\d]/g, '')) || 0;
  const parkingOverrideValue = Number(form.allowanceParking.replace(/[^\d]/g, '')) || 0;
  const chiHoValue = Number(form.chiHo.replace(/[^\d]/g, '')) || 0;
  const daysOffList = form.daysOff.split(',').map(s => s.trim()).filter(s => s !== '').map(s => parseInt(s)).filter(n => !isNaN(n));

  const chuyenCan = selectedRecord?.chuyenCan || 0;
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
  const advanceDeductValue = Number(form.advanceDeduct.replace(/[^\d]/g, '')) || 0;
  const totalRemainingAdvance = selectedRecord?.totalRemainingAdvance || 0;
  const advanceRemainingAfter = selectedRecord?.advanceRemainingAfter ?? 0;
  const driverAdvances: DriverAdvance[] = selectedRecord?.advances || [];


  const total = luongKhoan + fixedSalaryValue + chuyenCan + allowanceFarHomeValue + allowanceWaitLoading + allowanceOldCar + allowanceParking + tip + itemSumAdd - itemSumDeduct - chiHoValue - bhxhValue - advanceDeductValue;


  const inputCls = "w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]";
  const labelCls = "block text-xs font-medium text-[#78716c] mb-1.5";

  return (
    <div className="space-y-5">
      {/* Giá trị chung */}
      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">💰 Lương và Phụ cấp
          <button onClick={openAddItemModal}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] cursor-pointer">
            ➕ Thêm khoản lương
          </button>
        </h3>

        {/* Danh sách khoản lương động — sửa giá trị trực tiếp */}
        {items.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5">
              <span className="text-xs font-medium text-[#78716c]">Khoản lương cộng/khấu trừ</span>
            </div>
            <div className="overflow-x-auto border border-[rgba(0,0,0,0.06)] rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-[#f5f5f4] text-[#44403c]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Tên khoản</th>
                    <th className="px-3 py-2 text-left font-semibold">Loại</th>
                    <th className="px-3 py-2 text-right font-semibold">Giá trị chung (VNĐ)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className="border-t border-[#e7e5e4]">
                      <td className="px-3 py-2">{it.name}</td>
                      <td className="px-3 py-2">
                        {it.kind === 'add'
                          ? <span className="text-[#15803d]">➕ Cộng thêm</span>
                          : <span className="text-[#b91c1c]">➖ Khấu trừ</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input defaultValue={fmtMoney(it.defaultAmount)} onBlur={e => updateItemDefaultAmount(it.id, e.target.value)}
                          inputMode="numeric" className="w-32 px-2 py-1.5 bg-[#ffffff] border border-[#e7e5e4] rounded-md text-sm text-right text-[#1c1917] outline-none focus:border-[#f59e0b]" />
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
            <p className="text-[10px] text-[#78716c] mt-1">Tính theo lương cứng của từng lái xe (VD lương 7.000.000 × 10,5% = 735.000 ₫)</p>
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
          className="mt-4 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] disabled:opacity-50 cursor-pointer">
          {savingSettings ? 'Đang lưu...' : '💾 Lưu giá trị chung'}
        </button>
      </div>

      {/* Chọn tháng/năm */}
      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5">
        <h3 className="text-base font-bold mb-4">📅 Chọn tháng</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className={labelCls}>Tháng</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{MONTHS_VI[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Năm</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]">
              {Array.from({ length: 5 }, (_, i) => vnNow.year - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button onClick={() => loadData()}
            className="px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] transition-all cursor-pointer">
            🔄 Làm mới
          </button>
        </div>

        {/* 2 nửa: nửa trái = Xuất Excel, nửa phải = 2 nút thanh toán */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[rgba(0,0,0,0.06)] pt-4">
          <div className="flex items-center gap-2">
            <button onClick={exportExcel} disabled={exporting}
              className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer">
              {exporting ? '⏳ Đang xuất...' : '📥 Xuất Excel'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => openPayModal('pay', 'fixed')}
              className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] cursor-pointer">
              💰 Thanh Toán Lương Cứng
            </button>
            <button onClick={() => openPayModal('pay', 'total')}
              className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.35)] cursor-pointer">
              💵 Thanh Toán Tổng
            </button>
            <button onClick={() => openPayModal('undo')}
              className="px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[rgba(0,0,0,0.15)] hover:text-[#1c1917] hover:border-[#a8a29e] transition-all cursor-pointer">
              ↩️ Hoàn tác
            </button>
            <button onClick={openHistoryModal}
              className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white shadow-[0_4px_15px_rgba(124,58,237,0.3)] cursor-pointer">
              📜 Lịch sử
            </button>
          </div>
        </div>

        {/* Chọn lái xe + nhập liệu */}
        {!loading && (
          <div className="mt-5 border-t border-[rgba(0,0,0,0.06)] pt-5">
            <label className={labelCls}>Lái xe</label>
            <select value={selectedId ?? ''} onChange={e => pickDriver(e.target.value ? Number(e.target.value) : null)}
              className="w-full max-w-[520px] px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]">
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
                    <div className="px-3.5 py-2.5 bg-[#f5f5f4] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917]">
                      {fmtMoney(chuyenCan)} ₫
                    </div>
                    <p className="text-[10px] text-[#78716c] mt-1">Theo lương chuyến tháng này: {fmtMoney(luongKhoan)} ₫</p>
                  </div>
                  <div>
                    <label className={labelCls}>Ngày nghỉ (cách nhau dấu phẩy)</label>
                    <input value={form.daysOff} onChange={e => setForm(f => ({ ...f, daysOff: e.target.value }))} placeholder="VD: 2, 8, 15" className={inputCls} />
                    <p className="text-[10px] text-[#78716c] mt-1">Ghi chú ngày nghỉ (hiển thị cho lái xe)</p>
                    <input value={form.daysOffNote} onChange={e => setForm(f => ({ ...f, daysOffNote: e.target.value }))} placeholder="VD: Nghỉ lễ 2/9..." className={`${inputCls} mt-1`} />
                  </div>
                  <div>
                    <label className={labelCls}>Chi hộ (Cty chi) (VNĐ)</label>
                    <input value={form.chiHo} onChange={e => setForm(f => ({ ...f, chiHo: e.target.value }))} inputMode="numeric" placeholder="0" className={inputCls} />
                    <p className="text-[10px] text-[#78716c] mt-1">Trừ vào lương: {fmtMoney(chiHoValue)} ₫</p>
                  </div>
                  {/* Khấu trừ tạm ứng */}
                  {advanceDeductValue > 0 || driverAdvances.length > 0 ? (
                    <div>
                      <label className={labelCls}>
                        💸 Khấu trừ tạm ứng tháng này (VNĐ)
                        {selectedRecord?.advanceDeductOverridden && (
                          <span className="ml-2 text-[10px] font-medium text-[#9a3412] bg-[#fee2e2] px-1.5 py-0.5 rounded">✏️ Đã sửa tay</span>
                        )}
                      </label>
                      <input value={form.advanceDeduct} onChange={e => setForm(f => ({ ...f, advanceDeduct: e.target.value }))} inputMode="numeric" placeholder="0" className={inputCls} />
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-amber-600 flex-1">
                          Trừ vào lương: <strong>{fmtMoney(advanceDeductValue)} ₫</strong> · Dư nợ còn lại sau tháng này: <strong>{fmtMoney(advanceRemainingAfter)} ₫</strong>
                          {advanceRemainingAfter === 0 && <span className="ml-1 text-green-600">✅ Đã trả hết</span>}
                        </p>
                        {selectedRecord?.advanceDeductOverridden && (
                          <button onClick={resetAdvanceDeduct} className="text-[10px] text-[#f59e0b] hover:underline cursor-pointer shrink-0">↩️ Đặt lại tự động</button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className={labelCls}>BHXH - NLĐ ({String(bhxhPercentValue).replace('.', ',')}%)</label>
                    <div className="px-3.5 py-2.5 bg-[#f5f5f4] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917]">{fmtMoney(bhxhValue)} ₫</div>
                    <p className="text-[10px] text-[#78716c] mt-1">Trừ vào lương: {fmtMoney(bhxhValue)} ₫</p>
                  </div>
                  <div>
                    <label className={labelCls}>Chờ đóng hàng (VNĐ)</label>
                    <input value={form.allowanceWaitLoadingRate} onChange={e => setForm(f => ({ ...f, allowanceWaitLoadingRate: e.target.value }))} inputMode="numeric" placeholder="0" className={inputCls} />
                    <p className="text-[10px] text-[#78716c] mt-1">Thành tiền: {fmtMoney(allowanceWaitLoading)} ₫</p>
                  </div>
                </div>

                {/* Phần TICK (dưới) — Phụ cấp */}
                <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
                  <h4 className="text-sm font-bold mb-3">✅ Phụ cấp — {selectedDriver.fullName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Phụ cấp nhà xa */}
                    <div className="border border-[#e7e5e4] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasFarHome}
                          onChange={e => toggleFarHome(e.target.checked)}
                          className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
                        🏠 Phụ cấp nhà xa
                      </label>
                      {form.hasFarHome && (
                        <input value={form.allowanceFarHome} onChange={e => setForm(f => ({ ...f, allowanceFarHome: e.target.value }))} onBlur={e => updateFarHomeAmount(e.target.value)} inputMode="numeric" placeholder="Dùng giá trị chung" className="mt-2 w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-md text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]" />
                      )}
                      <p className="text-[10px] text-[#78716c] mt-1">Thành tiền: {fmtMoney(allowanceFarHomeValue)} ₫</p>
                    </div>

                    {/* Xe cũ */}
                    <div className="border border-[#e7e5e4] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasOldCar} onChange={e => setForm(f => ({ ...f, hasOldCar: e.target.checked }))}
                          className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
                        🚚 Xe cũ
                      </label>
                      {form.hasOldCar && (
                        <input value={form.allowanceOldCar} onChange={e => setForm(f => ({ ...f, allowanceOldCar: e.target.value }))} onBlur={e => updateOldCarAmount(e.target.value)} inputMode="numeric" placeholder="Dùng giá trị chung" className="mt-2 w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-md text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]" />
                      )}
                      <p className="text-[10px] text-[#78716c] mt-1">Thành tiền: {fmtMoney(allowanceOldCar)} ₫</p>
                    </div>

                    {/* Gửi xe HPH 2 */}
                    <div className="border border-[#e7e5e4] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasParkingHph2} onChange={e => setForm(f => ({ ...f, hasParkingHph2: e.target.checked }))}
                          className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
                        🅿️ Gửi xe HPH 2
                      </label>
                      {form.hasParkingHph2 && (
                        <input value={form.allowanceParking} onChange={e => setForm(f => ({ ...f, allowanceParking: e.target.value }))} onBlur={e => updateParkingAmount(e.target.value)} inputMode="numeric" placeholder="Dùng giá trị chung" className="mt-2 w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-md text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]" />
                      )}
                      <p className="text-[10px] text-[#78716c] mt-1">Thành tiền: {fmtMoney(allowanceParking)} ₫</p>
                    </div>

                    {/* Đóng bảo hiểm (BHXH) */}
                    <div className="border border-[#e7e5e4] rounded-lg p-3">
                      <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                        <input type="checkbox" checked={form.hasBhxh} onChange={e => setForm(f => ({ ...f, hasBhxh: e.target.checked }))}
                          className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
                        🛡️ Đóng bảo hiểm (BHXH)
                      </label>
                      <p className="text-[10px] text-[#78716c] mt-1">Trừ BHXH {fmtMoney(bhxhValue)} ₫ {form.hasBhxh ? '' : '(không trừ)'}</p>
                    </div>

                    {/* Khoản lương động — mỗi khoản 1 tick + ô nhập số tiền */}
                    {recordItems.map(v => (
                      <div key={v.itemId} className="border border-[#e7e5e4] rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={v.enabled}
                            onChange={e => toggleRecordItem(v.itemId, e.target.checked)}
                            className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
                          <span className="text-xs font-medium text-[#78716c] cursor-pointer" onClick={() => toggleRecordItem(v.itemId, !v.enabled)}>
                            {v.kind === 'add' ? '➕' : '➖'} {v.name}
                          </span>
                        </div>
                        {v.enabled && (
                          <input defaultValue={v.overrideAmount != null ? fmtMoney(v.overrideAmount) : ''} onBlur={e => updateRecordItemAmount(v.itemId, e.target.value)}
                            inputMode="numeric" placeholder="Dùng giá trị chung" className="mt-2 w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-md text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]" />
                        )}
                        <p className="text-[10px] text-[#78716c] mt-1">
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
                        className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
                      🚚 Xe cũ mặc định
                    </label>
                  </div>
                  <div className="mt-3">
                    <label className={`${labelCls} cursor-pointer flex items-center gap-2`}>
                      <input type="checkbox" checked={baseBhxh} onChange={e => setBaseBhxh(e.target.checked)}
                        className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
                      🛡️ Đóng bảo hiểm mặc định
                    </label>
                  </div>
                  <button onClick={saveBase} disabled={savingBase}
                    className="mt-3 px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] transition-all cursor-pointer disabled:opacity-50">
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
                          <p className="text-[10px] text-[#78716c] mt-1">Tháng đầu tiên bị trừ vào lương (để trống = tháng tạm ứng)</p>
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
                        <button onClick={() => { setShowAdvanceForm(false); setEditingAdvanceId(null); setAdvanceDraft({ amount: '', monthlyDeduction: '', note: '', date: '', deductStart: '' }); }} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Danh sách tạm ứng */}
                  {driverAdvances.length > 0 ? (
                    <div className="overflow-x-auto border border-[rgba(0,0,0,0.06)] rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-[#f5f5f4] text-[#44403c]">
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
                            <tr key={adv.id} className="border-t border-[#e7e5e4]">
                              <td className="px-3 py-2 whitespace-nowrap">{adv.date}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {adv.deductStart
                                  ? <span className="font-medium text-[#f59e0b]">{adv.deductStart}</span>
                                  : <span className="text-[#a8a29e]">= ngày TU</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-[#c2410c]">{fmtMoney(adv.amount)}</td>
                              <td className="px-3 py-2 text-right">{fmtMoney(adv.monthlyDeduction)}</td>
                              <td className="px-3 py-2 text-[#78716c]">{adv.note || '—'}</td>
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
                                    className="text-[#f59e0b] hover:underline cursor-pointer" title="Sửa">✏️</button>
                                  <button onClick={() => deleteAdvance(adv.id)} className="text-[#b91c1c] hover:underline cursor-pointer" title="Lái xe đã trả hết">🗑</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-[#a8a29e] italic">Chưa có khoản tạm ứng nào.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Lịch sử thanh toán */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-[#ffffff] rounded-xl shadow-2xl w-full max-w-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">📜 Lịch sử thanh toán — {MONTHS_VI[month]} {year}</h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-xl text-[#78716c] hover:text-[#1c1917] cursor-pointer">×</button>
            </div>
            {loadingHistory ? (
              <p className="text-sm text-[#78716c] py-6 text-center">Đang tải...</p>
            ) : historyLogs.length === 0 ? (
              <p className="text-xs text-[#a8a29e] italic py-6 text-center">Chưa có lịch sử thanh toán cho tháng này.</p>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto border border-[rgba(0,0,0,0.06)] rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-[#f5f5f4] text-[#44403c] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Thời gian</th>
                      <th className="px-3 py-2 text-left font-semibold">Lái xe</th>
                      <th className="px-3 py-2 text-left font-semibold">Hành động</th>
                      <th className="px-3 py-2 text-left font-semibold">Người thực hiện</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                    {historyLogs.map(log => {
                      const meta = PAY_ACTION_LABEL[log.action] || { label: log.action, color: 'text-[#1c1917]' };
                      return (
                        <tr key={log.id}>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDT(log.createdAt)}</td>
                          <td className="px-3 py-2 font-medium text-[#1c1917]">{log.driverName}</td>
                          <td className={`px-3 py-2 font-semibold ${meta.color}`}>{meta.label}</td>
                          <td className="px-3 py-2">{log.performedByName || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Thanh Toán Lương Cứng / Thanh Toán Tổng */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPayModal(null)}>
          <div className="bg-[#ffffff] rounded-xl shadow-2xl w-full max-w-xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">
                {showPayModal === 'undo'
                  ? `↩️ Hoàn tác thanh toán${payType === 'fixed' ? ' Lương Cứng' : ' Tổng'}`
                  : payType === 'fixed' ? '💰 Thanh Toán Lương Cứng' : '💵 Thanh Toán Tổng'}
              </h3>
              <button onClick={() => setShowPayModal(null)} className="text-xl text-[#78716c] hover:text-[#1c1917] cursor-pointer">×</button>
            </div>

            {/* Nếu là hoàn tác: chọn loại cần hoàn tác */}
            {showPayModal === 'undo' && (
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={payType === 'fixed'} onChange={() => setPayType('fixed')} className="accent-[#f59e0b]" />
                  Lương Cứng
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={payType === 'total'} onChange={() => setPayType('total')} className="accent-[#f59e0b]" />
                  Tổng Lương
                </label>
              </div>
            )}

            {/* Ô chọn tháng/năm */}
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div>
                <label className={labelCls}>Tháng</label>
                <select value={payMonth} onChange={e => { const m = Number(e.target.value); setPayMonth(m); loadPayRecords(m, payYear); }}
                  className="px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{MONTHS_VI[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Năm</label>
                <select value={payYear} onChange={e => { const y = Number(e.target.value); setPayYear(y); loadPayRecords(payMonth, y); }}
                  className="px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]">
                  {Array.from({ length: 5 }, (_, i) => vnNow.year - 2 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chọn tất cả */}
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-[#1c1917] cursor-pointer">
                <input type="checkbox" checked={drivers.length > 0 && paySelected.size === drivers.length} onChange={e => toggleAllPay(e.target.checked)} className="w-4 h-4 accent-[#f59e0b]" />
                Chọn tất cả ({drivers.length})
              </label>
              <button onClick={() => setPaySelected(new Set())} className="text-[11px] text-[#f59e0b] hover:underline cursor-pointer">Bỏ chọn</button>
            </div>

            {/* Danh sách lái xe */}
            <div className="max-h-[40vh] overflow-y-auto border border-[rgba(0,0,0,0.06)] rounded-lg divide-y divide-[rgba(0,0,0,0.04)]">
              {drivers.map(d => {
                const rec = payRecords.find(r => r.driverId === d.id);
                const paid = payType === 'fixed' ? !!rec?.fixedSalaryPaid : !!rec?.salaryPaid;
                return (
                  <label key={d.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#f5f5f4] text-sm">
                    <input type="checkbox" checked={paySelected.has(d.id)} onChange={() => togglePay(d.id)} className="w-4 h-4 accent-[#f59e0b]" />
                    <span className="text-[#1c1917] font-medium">{d.fullName}</span>
                    {d.soXe && <span className="text-[11px] text-[#a8a29e]">{d.soXe}</span>}
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {paid ? '✅ Đã' : 'Chưa'}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Nút xác nhận */}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowPayModal(null)}
                className="px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
                Hủy
              </button>
              <button onClick={submitPay} disabled={savingPay || paySelected.size === 0}
                className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer">
                {savingPay ? '⏳ Đang xử lý...' : showPayModal === 'undo' ? `Xác nhận hoàn tác (${paySelected.size})` : `Xác nhận thanh toán (${paySelected.size})`}
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
              <button onClick={() => setShowItemModal(false)} className="text-xl text-[#78716c] hover:text-[#1c1917] cursor-pointer">×</button>
            </div>
            <div className="overflow-x-auto border border-[rgba(0,0,0,0.06)] rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-[#f5f5f4] text-[#44403c]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Tên phụ cấp</th>
                    <th className="px-3 py-2 text-left font-semibold">Loại</th>
                    <th className="px-3 py-2 text-right font-semibold">Giá trị (VNĐ)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {itemDraft.map((row, idx) => (
                    <tr key={idx} className="border-t border-[#e7e5e4]">
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
                        }} className="px-2 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]">
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
                className="px-3 py-2 rounded-lg text-xs font-medium text-[#f59e0b] border border-[#f59e0b]/30 hover:bg-[#f59e0b]/5 cursor-pointer">
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
