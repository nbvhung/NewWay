'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Customer, CustomerPrice, CustomerSurcharge, CustomerAuditLog } from '@/types';
import { customersApi } from '@/lib/api-customers';
import { useAuth } from '@/providers/auth-provider';
import { Modal } from '@/components/ui/modal';
import { fmtDateTime } from '@/lib/utils';

interface Props {
  onRefresh?: () => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  address: '',
  contactName: '',
  mst: '',
  bankName: '',
  bankAccount: '',
  note: '',
  status: 'active' as 'active' | 'inactive',
};

const PRICE_TYPES = ['H20', 'H40', 'V20', 'V40', 'V20FR', 'V40FR', 'VSL', 'TIP'];

const ACTION_LABEL: Record<string, string> = {
  CREATE: '➕ Tạo mới',
  UPDATE: '✏️ Sửa',
  DELETE: '🗑️ Xóa',
};

function downloadBlob(res: any, fallback: string) {
  const cd = res.headers?.['content-disposition'] as string | undefined;
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

function formatChanges(raw: string): string {
  if (!raw) return '';
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      const entries = Object.entries(obj);
      return entries
        .map(([k, v]) => {
          if (v && typeof v === 'object' && 'old' in (v as any) && 'new' in (v as any)) {
            return `${k}: ${(v as any).old} → ${(v as any).new}`;
          }
          return `${k}: ${String(v)}`;
        })
        .join('; ');
    }
  } catch {}
  return raw;
}

export function CustomersTab({ onRefresh, toast }: Props) {
  const { user } = useAuth();
  const canEdit = user?.role === 'hr' || user?.role === 'admin' || user?.role === 'supper_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'supper_admin';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Customer | null>(null);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [section, setSection] = useState<'dossier' | 'prices' | 'surcharges'>('dossier');
  const [stats, setStats] = useState<{ plans: number; soChuyen: number; containers: number } | null>(null);
  const [hasInvoice, setHasInvoice] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Đơn giá
  const [prices, setPrices] = useState<CustomerPrice[]>([]);
  const [priceModal, setPriceModal] = useState(false);
  const [priceEditId, setPriceEditId] = useState<number | null>(null);
  const [priceForm, setPriceForm] = useState({ fromDay: '', toDay: '', containerType: 'H20', unitPrice: '' });

  // Phụ phí
  const [surcharges, setSurcharges] = useState<CustomerSurcharge[]>([]);
  const [surModal, setSurModal] = useState(false);
  const [surEditId, setSurEditId] = useState<number | null>(null);
  const [surForm, setSurForm] = useState({ name: '', calcType: 'add', value: '', fromDay: '', toDay: '', note: '' });

  // Lịch sử
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntity, setHistoryEntity] = useState<'price' | 'surcharge'>('price');
  const [history, setHistory] = useState<CustomerAuditLog[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await customersApi.getAll();
      const list = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
      setCustomers(list);
    } catch (err: any) {
      toast(err?.message || 'Không thể tải danh sách khách hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadStats = useCallback(async (id: number, m: number, y: number) => {
    try {
      const res = await customersApi.getStats(id, m, y);
      setStats({ plans: res.data.plans, soChuyen: res.data.soChuyen, containers: res.data.containers });
    } catch {
      setStats(null);
    }
  }, []);

  const loadPrices = useCallback(async (id: number, m: number, y: number) => {
    try {
      const res = await customersApi.getPrices(id, m, y);
      setPrices(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPrices([]);
    }
  }, []);

  const loadSurcharges = useCallback(async (id: number, m?: number, y?: number) => {
    try {
      const res = await customersApi.getSurcharges(id, m, y);
      setSurcharges(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSurcharges([]);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    if (section === 'dossier') loadStats(selected.id, month, year);
    if (section === 'prices') loadPrices(selected.id, month, year);
    if (section === 'surcharges') loadSurcharges(selected.id, month, year);
  }, [selected, section, month, year, loadStats, loadPrices, loadSurcharges]);

  const checkInvoice = useCallback(async (id: number, m: number, y: number) => {
    try {
      const res = await customersApi.getInvoice(id, m, y);
      setHasInvoice((res.data as any).size > 0);
    } catch {
      setHasInvoice(false);
    }
  }, []);

  useEffect(() => {
    if (selected && section === 'dossier') checkInvoice(selected.id, month, year);
  }, [selected, section, month, year, checkInvoice]);

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      contactName: c.contactName || '',
      mst: c.mst || '',
      bankName: c.bankName || '',
      bankAccount: c.bankAccount || '',
      note: c.note || '',
      status: c.status || 'active',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast('Vui lòng nhập tên khách hàng', 'error'); return; }
    setSaving(true);
    try {
      if (editId) {
        await customersApi.update(editId, form);
        toast('Đã cập nhật khách hàng', 'success');
      } else {
        await customersApi.create(form);
        toast('Đã thêm khách hàng', 'success');
      }
      setModalOpen(false);
      await load();
      if (selected && editId) {
        const updated = customers.find((c) => c.id === editId);
        if (updated) setSelected(updated);
      }
      onRefresh?.();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Customer) => {
    if (!confirm(`Xóa khách hàng "${c.name}"?`)) return;
    try {
      const res = await customersApi.remove(c.id);
      toast(res.data.message, 'success');
      if (selected?.id === c.id) setSelected(null);
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Xóa thất bại', 'error');
    }
  };

  const setStatus = async (c: Customer, status: 'active' | 'inactive') => {
    try {
      await customersApi.update(c.id, { status });
      toast(status === 'inactive' ? 'Đã ngừng hoạt động' : 'Đã kích hoạt', 'success');
      await load();
      if (selected?.id === c.id) setSelected({ ...selected, status });
    } catch (err: any) {
      toast(err?.message || 'Lỗi', 'error');
    }
  };

  const downloadDossier = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      const res = await customersApi.downloadPaymentDossier(selected.id, month, year);
      downloadBlob(res, `ThanhToan_${selected.name}_T${String(month).padStart(2, '0')}.${year}.xlsx`);
      toast('Đã xuất hồ sơ thanh toán', 'success');
    } catch (err: any) {
      toast(err?.message || 'Xuất thất bại', 'error');
    } finally {
      setExporting(false);
    }
  };

  const uploadInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    try {
      const res = await customersApi.uploadInvoice(selected.id, month, year, file);
      toast(res.data.message, 'success');
      setHasInvoice(true);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Upload thất bại', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const downloadInvoice = async () => {
    if (!selected) return;
    try {
      const res = await customersApi.getInvoice(selected.id, month, year);
      downloadBlob(res, `HoaDon_${selected.name}_T${String(month).padStart(2, '0')}.${year}.pdf`);
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Chưa có hoá đơn cho tháng này', 'error');
    }
  };

  // ── Đơn giá ────────────────────────────────────────────────────
  const openAddPrice = () => {
    setPriceEditId(null);
    setPriceForm({ fromDay: '', toDay: '', containerType: 'H20', unitPrice: '' });
    setPriceModal(true);
  };

  const openEditPrice = (p: CustomerPrice) => {
    setPriceEditId(p.id);
    setPriceForm({
      fromDay: String(p.fromDay),
      toDay: String(p.toDay),
      containerType: p.containerType,
      unitPrice: String(p.unitPrice),
    });
    setPriceModal(true);
  };

  const savePrice = async () => {
    if (!selected) return;
    if (!priceForm.fromDay || !priceForm.toDay || !priceForm.unitPrice) {
      toast('Vui lòng điền đầy đủ từ ngày, đến ngày và đơn giá', 'error');
      return;
    }
    const data = {
      month,
      year,
      fromDay: Number(priceForm.fromDay),
      toDay: Number(priceForm.toDay),
      containerType: priceForm.containerType,
      unitPrice: Number(priceForm.unitPrice),
    };
    setSaving(true);
    try {
      if (priceEditId) {
        await customersApi.updatePrice(selected.id, priceEditId, data);
        toast('Đã cập nhật đơn giá', 'success');
      } else {
        await customersApi.createPrice(selected.id, data);
        toast('Đã thêm đơn giá', 'success');
      }
      setPriceModal(false);
      await loadPrices(selected.id, month, year);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removePrice = async (p: CustomerPrice) => {
    if (!selected) return;
    if (!confirm(`Xóa đơn giá ${p.containerType} (${p.fromDay}-${p.toDay}/${p.month}/${p.year})?`)) return;
    try {
      await customersApi.deletePrice(selected.id, p.id);
      toast('Đã xóa đơn giá', 'success');
      await loadPrices(selected.id, month, year);
    } catch (err: any) {
      toast(err?.message || 'Xóa thất bại', 'error');
    }
  };

  // ── Phụ phí ────────────────────────────────────────────────────
  const openAddSur = () => {
    setSurEditId(null);
    setSurForm({ name: '', calcType: 'add', value: '', fromDay: '', toDay: '', note: '' });
    setSurModal(true);
  };

  const openEditSur = (s: CustomerSurcharge) => {
    setSurEditId(s.id);
    setSurForm({ name: s.name, calcType: s.calcType, value: String(s.value), fromDay: String(s.fromDay), toDay: String(s.toDay), note: s.note || '' });
    setSurModal(true);
  };

  const saveSur = async () => {
    if (!selected) return;
    if (!surForm.name.trim() || surForm.value === '' || !surForm.fromDay || !surForm.toDay) {
      toast('Vui lòng nhập tên, giá trị và khoảng thời gian phụ phí', 'error');
      return;
    }
    const data = {
      name: surForm.name.trim(),
      calcType: surForm.calcType as 'add' | 'percent',
      value: Number(surForm.value),
      month,
      year,
      fromDay: Number(surForm.fromDay),
      toDay: Number(surForm.toDay),
      note: surForm.note,
    };
    setSaving(true);
    try {
      if (surEditId) {
        await customersApi.updateSurcharge(selected.id, surEditId, data);
        toast('Đã cập nhật phụ phí', 'success');
      } else {
        await customersApi.createSurcharge(selected.id, data);
        toast('Đã thêm phụ phí', 'success');
      }
      setSurModal(false);
      await loadSurcharges(selected.id, month, year);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleSur = async (s: CustomerSurcharge) => {
    if (!selected) return;
    try {
      await customersApi.updateSurcharge(selected.id, s.id, { active: !s.active });
      await loadSurcharges(selected.id, month, year);
    } catch (err: any) {
      toast(err?.message || 'Lỗi', 'error');
    }
  };

  const removeSur = async (s: CustomerSurcharge) => {
    if (!selected) return;
    if (!confirm(`Xóa phụ phí "${s.name}"?`)) return;
    try {
      await customersApi.deleteSurcharge(selected.id, s.id);
      toast('Đã xóa phụ phí', 'success');
      await loadSurcharges(selected.id, month, year);
    } catch (err: any) {
      toast(err?.message || 'Xóa thất bại', 'error');
    }
  };

  // ── Lịch sử ────────────────────────────────────────────────────
  const openHistory = async (entity: 'price' | 'surcharge') => {
    if (!selected) return;
    setHistoryEntity(entity);
    setHistoryOpen(true);
    try {
      const res = await customersApi.getHistory(selected.id, entity);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]";
  const btnPrimary = "px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] disabled:opacity-50 cursor-pointer";

  const activeCustomers = useMemo(() => customers.filter(c => c.status === 'active'), [customers]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">👥 Danh sách khách hàng</h3>
          <button onClick={openAdd} className={btnPrimary}>
            ➕ Thêm khách hàng
          </button>
        </div>
        {loading ? (
          <div className="text-center py-12 text-[#78716c] text-sm">Đang tải...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-[#78716c] text-sm">Chưa có khách hàng. Bấm "Thêm khách hàng" để bắt đầu.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {customers.map(c => (
              <div key={c.id}
                onClick={() => setSelected(c)}
                className={`px-3.5 py-3 bg-[#f9f9f8] border rounded-lg text-xs cursor-pointer transition-all ${
                  selected?.id === c.id ? 'border-[#f59e0b] ring-1 ring-[#f59e0b]' : 'border-[#e7e5e4] hover:border-[#f59e0b]'
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-[#1c1917] truncate">{c.name}</span>
                    {c.status === 'inactive' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.15)] text-red-600">Ngừng</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(c)}
                      title="Sửa thông tin"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-sm hover:shadow-md hover:brightness-105 transition-all cursor-pointer">
                      ✏️ Sửa
                    </button>
                    {c.status === 'active' ? (
                      <button onClick={() => setStatus(c, 'inactive')}
                        title="Ngừng hoạt động"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#f5f5f4] border border-[#d4d4d0] text-[#57534e] hover:bg-[#e7e5e4] hover:border-[#a8a29e] transition-all cursor-pointer">
                        ⏸ Ngừng
                      </button>
                    ) : (
                      <button onClick={() => setStatus(c, 'active')}
                        title="Kích hoạt trở lại"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-sm hover:shadow-md hover:brightness-105 transition-all cursor-pointer">
                        ▶ Kích hoạt
                      </button>
                    )}
                    <button onClick={() => remove(c)}
                      title="Xóa khách hàng"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white shadow-sm hover:shadow-md hover:brightness-105 transition-all cursor-pointer">
                      🗑 Xóa
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-[#78716c] mt-1">
                  <span>👤 Tên: <span className="font-medium text-[#1c1917]">{c.contactName || '—'}</span></span>
                  <span className="ml-3">🏦 MST: <span className="font-medium text-[#1c1917]">{c.mst || '—'}</span></span>
                </div>
                <div className="text-[11px] text-[#78716c] mt-0.5">
                  <span>✉️ Email: <span className="font-medium text-[#1c1917]">{c.email || '—'}</span></span>
                  <span className="ml-3">📞 SĐT: <span className="font-medium text-[#1c1917]">{c.phone || '—'}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5 sticky top-20">
        {!selected ? (
          <div className="text-center py-16 text-[#78716c] text-sm">Chọn 1 khách hàng để xem hồ sơ.</div>
        ) : (
          <>
            <h3 className="text-base font-bold mb-1">📂 Khách hàng</h3>
            <div className="text-sm font-bold text-[#1c1917] mb-3">{selected.name}</div>

            <div className="flex gap-1.5 mb-3">
              {([
                { key: 'dossier' as const, label: '📂 Hồ sơ' },
                { key: 'prices' as const, label: '💵 Đơn giá' },
                { key: 'surcharges' as const, label: '➕ Phụ phí' },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    section === s.key
                      ? 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]'
                      : 'bg-[#ffffff] text-[#78716c] border-[#e7e5e4] hover:text-[#1c1917]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
                <select value={month} onChange={e => setMonth(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-sm border border-[#e7e5e4] outline-none cursor-pointer flex-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-sm border border-[#e7e5e4] outline-none cursor-pointer flex-1">
                  {[year, year - 1, year - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

            {section === 'dossier' && (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="px-3 py-2.5 bg-[#f9f9f8] border border-[#e7e5e4] rounded-lg text-center">
                    <div className="text-lg font-extrabold text-[#f59e0b]">{stats?.plans ?? '—'}</div>
                    <div className="text-[9px] text-[#78716c] font-semibold uppercase">Kế hoạch</div>
                  </div>
                  <div className="px-3 py-2.5 bg-[#f9f9f8] border border-[#e7e5e4] rounded-lg text-center">
                    <div className="text-lg font-extrabold text-[#d97706]">{stats?.soChuyen ?? '—'}</div>
                    <div className="text-[9px] text-[#78716c] font-semibold uppercase">Chuyến</div>
                  </div>
                  <div className="px-3 py-2.5 bg-[#f9f9f8] border border-[#e7e5e4] rounded-lg text-center">
                    <div className="text-lg font-extrabold text-[#059669]">{stats?.containers ?? '—'}</div>
                    <div className="text-[9px] text-[#78716c] font-semibold uppercase">Container</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button onClick={downloadDossier} disabled={exporting}
                    className="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">
                    {exporting ? 'Đang xuất...' : '📥 Xuất hồ sơ thanh toán'}
                  </button>
                  <label className={`w-full py-2.5 rounded-lg text-xs font-medium text-center bg-gradient-to-r from-[#10b981] to-[#059669] text-white cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
                    {uploading ? 'Đang tải...' : hasInvoice ? '🔄 Đổi hoá đơn' : '📄 Upload hoá đơn GTGT'}
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={uploadInvoice} disabled={uploading} />
                  </label>
                  {hasInvoice && (
                    <button onClick={downloadInvoice}
                      className="w-full py-2.5 rounded-lg text-xs font-medium text-[#d97706] border border-[rgba(245,158,11,0.4)] hover:bg-[rgba(245,158,11,0.05)] cursor-pointer">
                      ⬇️ Tải hoá đơn tháng {month}
                    </button>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#e7e5e4] space-y-1 text-[10px] text-[#78716c]">
                  <div>MST: <span className="font-medium text-[#1c1917]">{selected.mst || '—'}</span></div>
                  <div>Ngân hàng: <span className="font-medium text-[#1c1917]">{selected.bankName || '—'} {selected.bankAccount ? `- ${selected.bankAccount}` : ''}</span></div>
                  <div>Địa chỉ: <span className="font-medium text-[#1c1917]">{selected.address || '—'}</span></div>
                </div>
              </>
            )}

            {section === 'prices' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#1c1917]">💵 Đơn giá tháng {month}/{year}</span>
                  <div className="flex gap-1.5">
                    {isAdmin && (
                      <button onClick={() => openHistory('price')}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">📜 Lịch sử</button>
                    )}
                    {canEdit && (
                      <button onClick={openAddPrice} className={btnPrimary}>➕ Thêm</button>
                    )}
                  </div>
                </div>
                {prices.length === 0 ? (
                  <div className="text-center py-8 text-[#78716c] text-sm">Chưa có đơn giá cho tháng này.</div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
                    {prices.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-[#f9f9f8] border border-[#e7e5e4] rounded-lg text-xs">
                        <div>
                          <span className="font-bold text-[#1c1917]">{p.containerType}</span>
                          <span className="ml-2 text-[#78716c]">{p.fromDay} → {p.toDay}/{p.month}/{p.year}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#d97706]">{Number(p.unitPrice).toLocaleString('vi-VN')} ₫</span>
                          {canEdit && (
                            <>
                              <button onClick={() => openEditPrice(p)} title="Sửa đơn giá" className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white hover:brightness-105 cursor-pointer">✏️ Sửa</button>
                              <button onClick={() => removePrice(p)} title="Xóa đơn giá" className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white hover:brightness-105 cursor-pointer">🗑 Xóa</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {section === 'surcharges' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#1c1917]">➕ Phụ phí tháng {month}/{year}</span>
                  <div className="flex gap-1.5">
                    {isAdmin && (
                      <button onClick={() => openHistory('surcharge')}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">📜 Lịch sử</button>
                    )}
                    {canEdit && (
                      <button onClick={openAddSur} className={btnPrimary}>➕ Thêm</button>
                    )}
                  </div>
                </div>
                {surcharges.length === 0 ? (
                  <div className="text-center py-8 text-[#78716c] text-sm">Chưa có phụ phí nào.</div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
                    {surcharges.map(s => (
                      <div key={s.id} className="px-3 py-2.5 bg-[#f9f9f8] border border-[#e7e5e4] rounded-lg text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-[#1c1917]">{s.name}</span>
                            <span className="ml-2 text-[#78716c]">{s.fromDay} → {s.toDay}/{s.month}/{s.year}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canEdit && (
                              <>
                                <button onClick={() => toggleSur(s)}
                                  title={s.active ? 'Tắt phụ phí' : 'Bật phụ phí'}
                                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                    s.active
                                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                      : 'bg-[#f0f0ee] border border-[#d4d4d0] text-[#78716c] hover:bg-[#e7e5e4]'
                                  }`}>
                                  {s.active ? '🟢 Bật' : '⚪ Tắt'}
                                </button>
                                <button onClick={() => openEditSur(s)} title="Sửa phụ phí" className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white hover:brightness-105 cursor-pointer">✏️ Sửa</button>
                                <button onClick={() => removeSur(s)} title="Xóa phụ phí" className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white hover:brightness-105 cursor-pointer">🗑 Xóa</button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-[#78716c] mt-1">
                          {s.calcType === 'add'
                            ? <span className="px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.12)] text-emerald-700 font-semibold">Cộng {Number(s.value).toLocaleString('vi-VN')} ₫</span>
                            : <span className="px-1.5 py-0.5 rounded bg-[rgba(245,158,11,0.12)] text-[#d97706] font-semibold">{Number(s.value)}% Đơn giá</span>}
                          {s.note && <span className="ml-2">{s.note}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? '✏️ Sửa khách hàng' : '➕ Thêm khách hàng'}
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
              Hủy
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tên khách hàng <span className="text-[#ef4444]">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="vd: Công ty ABC" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Điện thoại</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Email</label>
              <input type="text" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Người liên hệ</label>
              <input type="text" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">MST</label>
              <input type="text" value={form.mst} onChange={e => setForm(f => ({ ...f, mst: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Ngân hàng</label>
              <input type="text" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Số tài khoản</label>
              <input type="text" value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Địa chỉ</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Ghi chú</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
      </Modal>

      <Modal
        open={priceModal}
        onClose={() => setPriceModal(false)}
        title={priceEditId ? '✏️ Sửa đơn giá' : '➕ Thêm đơn giá'}
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setPriceModal(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
              Hủy
            </button>
            <button onClick={savePrice} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Từ ngày <span className="text-[#ef4444]">*</span></label>
              <input type="number" min="1" max="31" value={priceForm.fromDay} onChange={e => setPriceForm(f => ({ ...f, fromDay: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Đến ngày <span className="text-[#ef4444]">*</span></label>
              <input type="number" min="1" max="31" value={priceForm.toDay} onChange={e => setPriceForm(f => ({ ...f, toDay: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Loại container</label>
            <select value={priceForm.containerType} onChange={e => setPriceForm(f => ({ ...f, containerType: e.target.value }))}
              className={inputCls}>
              {PRICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Đơn giá (VNĐ) <span className="text-[#ef4444]">*</span></label>
            <input type="number" min="0" value={priceForm.unitPrice} onChange={e => setPriceForm(f => ({ ...f, unitPrice: e.target.value }))} className={inputCls} />
          </div>
          <p className="text-[10px] text-[#a8a29e]">Áp dụng cho tháng {month}/{year}. Mỗi (khoảng thời gian, loại) chỉ 1 giá.</p>
        </div>
      </Modal>

      <Modal
        open={surModal}
        onClose={() => setSurModal(false)}
        title={surEditId ? '✏️ Sửa phụ phí' : '➕ Thêm phụ phí'}
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setSurModal(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
              Hủy
            </button>
            <button onClick={saveSur} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tên phụ phí <span className="text-[#ef4444]">*</span></label>
            <input type="text" value={surForm.name} onChange={e => setSurForm(f => ({ ...f, name: e.target.value }))} placeholder="vd: Phụ phí hạ container" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Phương pháp tính</label>
            <select value={surForm.calcType} onChange={e => setSurForm(f => ({ ...f, calcType: e.target.value }))} className={inputCls}>
              <option value="add">➕ Cộng thêm (số tiền cố định)</option>
              <option value="percent">% Đơn giá gốc (theo loại container)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Từ ngày <span className="text-[#ef4444]">*</span></label>
              <input type="number" min="1" max="31" value={surForm.fromDay} onChange={e => setSurForm(f => ({ ...f, fromDay: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Đến ngày <span className="text-[#ef4444]">*</span></label>
              <input type="number" min="1" max="31" value={surForm.toDay} onChange={e => setSurForm(f => ({ ...f, toDay: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">{surForm.calcType === 'add' ? 'Giá trị (VNĐ)' : 'Phần trăm (%)'} <span className="text-[#ef4444]">*</span></label>
            <input type="number" min="0" value={surForm.value} onChange={e => setSurForm(f => ({ ...f, value: e.target.value }))}
              placeholder={surForm.calcType === 'add' ? 'vd: 50000' : 'vd: 5'} className={inputCls} />
            {surForm.calcType === 'percent' && (
              <p className="text-[10px] text-[#a8a29e] mt-1">Tính trên đơn giá đúng loại container (vd V40 = 500.000 → 5% = 25.000).</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Ghi chú</label>
            <input type="text" value={surForm.note} onChange={e => setSurForm(f => ({ ...f, note: e.target.value }))} className={inputCls} />
          </div>
        </div>
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={historyEntity === 'price' ? '📜 Lịch sử đơn giá' : '📜 Lịch sử phụ phí'}
        footer={
          <button onClick={() => setHistoryOpen(false)}
            className="px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
            Đóng
          </button>
        }
      >
        {history.length === 0 ? (
          <div className="text-center py-8 text-[#78716c] text-sm">Chưa có lịch sử.</div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
            {history.map(h => (
              <div key={h.id} className="px-3 py-2 bg-[#f9f9f8] border border-[#e7e5e4] rounded-lg text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    h.action === 'CREATE' ? 'bg-[rgba(16,185,129,0.15)] text-emerald-700'
                    : h.action === 'UPDATE' ? 'bg-[rgba(245,158,11,0.15)] text-[#d97706]'
                    : 'bg-[rgba(239,68,68,0.15)] text-red-600'
                  }`}>{ACTION_LABEL[h.action] || h.action}</span>
                  <span className="text-[10px] text-[#78716c]">{fmtDateTime(h.createdAt)}</span>
                </div>
                <div className="mt-1 text-[#1c1917] font-medium">👤 {h.performedByName || '—'}</div>
                {h.changes && <div className="mt-0.5 text-[10px] text-[#78716c] break-words">{formatChanges(h.changes)}</div>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}