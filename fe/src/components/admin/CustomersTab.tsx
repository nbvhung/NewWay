'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Customer, CustomerPrice, CustomerSurcharge, CustomerAuditLog, Route } from '@/types';
import { customersApi, DossierStatus, DossierFileType } from '@/lib/api-customers';
import { routesApi } from '@/lib/api-routes';
import { useAuth } from '@/providers/auth-provider';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { fmtDateTime } from '@/lib/utils';
import { hasPerm, hasAnyPerm } from '@/lib/permissions';

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
  type: 'customer' as 'customer' | 'subvendor',
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
  const canEdit = hasAnyPerm(user, ['customer.manage', 'customer.price', 'customer.surcharge']);
  const isAdmin = hasPerm(user, 'customer.history');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'subvendor'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
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
  const [dossierStatus, setDossierStatus] = useState<DossierStatus | null>(null);
  const [uploading, setUploading] = useState<DossierFileType | null>(null);
  const [exporting, setExporting] = useState(false);

  // Đơn giá
  const [prices, setPrices] = useState<CustomerPrice[]>([]);
  const [priceModal, setPriceModal] = useState(false);
  const [priceEditId, setPriceEditId] = useState<number | null>(null);
  const [priceForm, setPriceForm] = useState<{ fromDay: string; toDay: string; routeName: string; prices: Record<string, string> }>({ fromDay: '', toDay: '', routeName: '', prices: {} });
  const [routeList, setRouteList] = useState<Route[]>([]);
  const [routeTab, setRouteTab] = useState<string>('chung');
  const [routeSearch, setRouteSearch] = useState('');

  // Phụ phí
  const [surcharges, setSurcharges] = useState<CustomerSurcharge[]>([]);
  const [surModal, setSurModal] = useState(false);
  const [surEditId, setSurEditId] = useState<number | null>(null);
  const [surForm, setSurForm] = useState({ name: '', calcType: 'add', value: '', fromDay: '', toDay: '', note: '' });

  // Lịch sử
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntity, setHistoryEntity] = useState<'price' | 'surcharge'>('price');
  const [history, setHistory] = useState<CustomerAuditLog[]>([]);

  // Kế hoạch đã hoàn thành
  const [plansOpen, setPlansOpen] = useState(false);
  const [completedPlans, setCompletedPlans] = useState<{ id: number; name: string; soChuyen: string; routeName: string; ngay: string; customerId: number | null; containers: number }[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [checkedPlanIds, setCheckedPlanIds] = useState<number[]>([]);
  const [planSearch, setPlanSearch] = useState('');
  const [savingPlans, setSavingPlans] = useState(false);

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

  const loadRoutes = useCallback(async () => {
    try {
      const res = await routesApi.getAll();
      setRouteList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRouteList([]);
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
    if (section === 'prices') {
      loadPrices(selected.id, month, year);
      loadRoutes();
    }
    if (section === 'surcharges') loadSurcharges(selected.id, month, year);
  }, [selected, section, month, year, loadStats, loadPrices, loadRoutes, loadSurcharges]);

  const loadDossierStatus = useCallback(async (id: number, m: number, y: number) => {
    try {
      const res = await customersApi.getDossierStatus(id, m, y);
      setDossierStatus(res.data);
    } catch {
      setDossierStatus(null);
    }
  }, []);

  useEffect(() => {
    if (selected && section === 'dossier') loadDossierStatus(selected.id, month, year);
  }, [selected, section, month, year, loadDossierStatus]);

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
      type: c.type || 'customer',
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

  const handleUploadFile = async (fileType: DossierFileType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(fileType);
    try {
      const res = await customersApi.uploadDossierFile(selected.id, month, year, fileType, file);
      toast(res.data.message, 'success');
      await loadDossierStatus(selected.id, month, year);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Upload thất bại', 'error');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const handleDownloadFile = async (fileType: DossierFileType, fallbackName: string) => {
    if (!selected) return;
    try {
      const res = await customersApi.downloadDossierFile(selected.id, month, year, fileType);
      downloadBlob(res, fallbackName);
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Chưa có file này', 'error');
    }
  };

  // ── Đơn giá ────────────────────────────────────────────────────
  const routeTabOf = useCallback((name: string): string => {
    if (!name) return 'chung';
    const r = routeList.find((x) => x.name === name);
    const t = r?.type || '';
    return ['XT', 'CB', 'ĐH'].includes(t) ? t : 'other';
  }, [routeList]);

  const openAddPrice = () => {
    setPriceEditId(null);
    setPriceForm({ fromDay: '', toDay: '', routeName: '', prices: {} });
    setRouteTab('chung');
    setRouteSearch('');
    if (routeList.length === 0) loadRoutes();
    setPriceModal(true);
  };

  const openEditPricePeriod = (group: CustomerPrice[]) => {
    if (!group.length) return;
    setPriceEditId(group[0].id);
    const prices: Record<string, string> = {};
    for (const p of group) prices[p.containerType] = String(p.unitPrice);
    setPriceForm({
      fromDay: String(group[0].fromDay),
      toDay: String(group[0].toDay),
      routeName: group[0].routeName || '',
      prices,
    });
    setRouteTab(routeTabOf(group[0].routeName || ''));
    setRouteSearch('');
    if (routeList.length === 0) loadRoutes();
    setPriceModal(true);
  };

  const savePrice = async () => {
    if (!selected) return;
    if (!priceForm.fromDay || !priceForm.toDay) {
      toast('Vui lòng nhập từ ngày và đến ngày', 'error');
      return;
    }
    const prices: Record<string, number> = {};
    for (const t of PRICE_TYPES) {
      const v = (priceForm.prices[t] || '').trim();
      if (v !== '') prices[t] = Number(v);
    }
    if (Object.keys(prices).length === 0) {
      toast('Vui lòng nhập ít nhất 1 đơn giá', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await customersApi.batchUpsertPrices(selected.id, {
        month,
        year,
        fromDay: Number(priceForm.fromDay),
        toDay: Number(priceForm.toDay),
        routeName: priceForm.routeName || '',
        prices,
      });
      toast(res.data.message, 'success');
      setPriceModal(false);
      await loadPrices(selected.id, month, year);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removePricePeriod = async (group: CustomerPrice[]) => {
    if (!selected || !group.length) return;
    const p = group[0];
    const rn = p.routeName || '';
    const rnLabel = rn ? `tuyến "${rn}" ` : '(mọi tuyến) ';
    if (!confirm(`Xóa toàn bộ đơn giá ${rnLabel}khoảng ${p.fromDay}-${p.toDay}/${p.month}/${p.year}?`)) return;
    try {
      await customersApi.deletePricesPeriod(selected.id, p.month, p.year, p.fromDay, p.toDay, rn);
      toast('Đã xóa khoảng đơn giá', 'success');
      await loadPrices(selected.id, month, year);
    } catch (err: any) {
      toast(err?.message || 'Xóa thất bại', 'error');
    }
  };

  const priceGroups = useMemo(() => {
    const map = new Map<string, CustomerPrice[]>();
    for (const p of prices) {
      const key = `${p.routeName || ''}|${p.fromDay}-${p.toDay}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.values()).sort((a, b) => {
      const ra = a[0].routeName || '';
      const rb = b[0].routeName || '';
      if (ra !== rb) {
        if (!ra) return -1;
        if (!rb) return 1;
        return ra.localeCompare(rb, 'vi');
      }
      return a[0].fromDay - b[0].fromDay;
    });
  }, [prices]);

  const filteredRoutes = useMemo(() => {
    const q = routeSearch.trim().toLowerCase();
    return routeList.filter((r) => {
      const type = ['XT', 'CB', 'ĐH'].includes(r.type) ? r.type : 'other';
      if (type !== routeTab) return false;
      if (q) return r.name.toLowerCase().includes(q);
      return true;
    });
  }, [routeList, routeTab, routeSearch]);

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

  const openCompletedPlans = async () => {
    if (!selected) return;
    setPlansOpen(true);
    setPlanSearch('');
    setLoadingPlans(true);
    try {
      const res = await customersApi.getAllCompletedPlans();
      const list = Array.isArray(res.data) ? res.data : [];
      setCompletedPlans(list);
      setCheckedPlanIds(list.filter(p => p.customerId === selected.id).map(p => p.id));
    } catch {
      setCompletedPlans([]);
      setCheckedPlanIds([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  const togglePlan = (id: number) => {
    setCheckedPlanIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const savePlans = async () => {
    if (!selected) return;
    setSavingPlans(true);
    try {
      const res = await customersApi.assignPlans(selected.id, checkedPlanIds);
      toast(res.data.message, 'success');
      setPlansOpen(false);
      onRefresh?.();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Lưu thất bại', 'error');
    } finally {
      setSavingPlans(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]";
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

  const filtered = useMemo(() => {
    let list = customers;
    if (typeFilter !== 'all') list = list.filter(c => c.type === typeFilter);
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter);
    const q = normalize(search.trim());
    if (q) {
      list = list.filter(c =>
        normalize(c.name).includes(q) ||
        normalize(c.mst || '').includes(q) ||
        normalize(c.email || '').includes(q) ||
        normalize(c.phone || '').includes(q) ||
        normalize(c.contactName || '').includes(q),
      );
    }
    return list;
  }, [customers, search, typeFilter, statusFilter]);

  const { page, pageSize, totalPages, totalItems, paged: pagedCustomers, setPage, setPageSize } = usePagination(filtered, 8);

  const filteredPlans = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    if (!q) return completedPlans;
    return completedPlans.filter(p =>
      `${p.name} ${p.soChuyen} ${p.routeName}`.toLowerCase().includes(q),
    );
  }, [completedPlans, planSearch]);

  const btnPrimary = "px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] disabled:opacity-50 cursor-pointer";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold">👥 Danh sách khách hàng
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(245,158,11,0.15)] text-[#d97706]">
              {filtered.length}{filtered.length !== customers.length ? ` / ${customers.length}` : ''}
            </span>
          </h3>
          <button onClick={openAdd} className={btnPrimary}>
            ➕ Thêm khách hàng
          </button>
        </div>

        <div className="mb-3 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="🔍 Tìm tên, MST, email, SĐT, liên hệ..."
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]"
          />
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'all' as const, label: 'Tất cả loại' },
              { key: 'subvendor' as const, label: '🚚 Sub vendor' },
              { key: 'customer' as const, label: '👥 Khách hàng' },
            ]).map((s) => (
              <button
                key={s.key}
                onClick={() => { setTypeFilter(s.key); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                  typeFilter === s.key
                    ? 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]'
                    : 'bg-[#ffffff] text-[#78716c] border-[#e7e5e4] hover:text-[#1c1917]'
                }`}
              >
                {s.label}
              </button>
            ))}
            <span className="w-px bg-[#e7e5e4] mx-0.5" />
            {([
              { key: 'all' as const, label: 'Mọi trạng thái' },
              { key: 'active' as const, label: 'Hoạt động' },
              { key: 'inactive' as const, label: 'Ngừng' },
            ]).map((s) => (
              <button
                key={s.key}
                onClick={() => { setStatusFilter(s.key); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                  statusFilter === s.key
                    ? 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]'
                    : 'bg-[#ffffff] text-[#78716c] border-[#e7e5e4] hover:text-[#1c1917]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#78716c] text-sm">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#78716c] text-sm">
            {search.trim() || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'Không tìm thấy khách hàng phù hợp'
              : 'Chưa có khách hàng. Bấm "Thêm khách hàng" để bắt đầu.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pagedCustomers.map(c => (
              <div key={c.id}
                onClick={() => setSelected(c)}
                className={`px-3.5 py-3 bg-[#f9f9f8] border rounded-lg text-xs cursor-pointer transition-all ${
                  selected?.id === c.id ? 'border-[#f59e0b] ring-1 ring-[#f59e0b]' : 'border-[#e7e5e4] hover:border-[#f59e0b]'
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-[#1c1917] truncate">{c.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                      c.type === 'subvendor'
                        ? 'bg-[rgba(139,92,246,0.15)] text-purple-700'
                        : 'bg-[rgba(26,86,219,0.12)] text-[#1a56db]'
                    }`}>{c.type === 'subvendor' ? '🚚 Sub vendor' : '👥 Khách hàng'}</span>
                    {c.status === 'inactive' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.15)] text-red-600 shrink-0">Ngừng</span>
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
        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[8, 20, 50]}
        />
      </div>

      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5 sticky top-20">
        {!selected ? (
          <div className="text-center py-16 text-[#78716c] text-sm">Chọn 1 khách hàng để xem hồ sơ.</div>
        ) : (
          <>
            <h3 className="text-base font-bold mb-1">📂 Khách hàng</h3>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-bold text-[#1c1917] truncate">{selected.name}</div>
              <button onClick={openCompletedPlans}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] hover:border-[#d4d4d0] transition-all cursor-pointer">
                📋 Gán kế hoạch đã hoàn thành
              </button>
            </div>

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
                {/* Stats */}
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

                {/* Hồ sơ 3 file */}
                {(() => {
                  const ACCEPT = '.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx';
                  const files: { key: DossierFileType; label: string; fallback: string }[] = [
                    { key: 'bangKe',  label: 'Bảng kê',              fallback: `BangKe_${selected.name}_T${String(month).padStart(2,'0')}.${year}` },
                    { key: 'invoice', label: 'Hoá đơn GTGT',         fallback: `HoaDon_${selected.name}_T${String(month).padStart(2,'0')}.${year}` },
                    { key: 'deNghi',  label: 'Đề nghị thanh toán',   fallback: `DeNghi_${selected.name}_T${String(month).padStart(2,'0')}.${year}` },
                  ];
                  const filled = dossierStatus
                    ? files.filter(f => dossierStatus[f.key].has).length
                    : 0;
                  const pct = Math.round(filled / files.length * 100);

                  return (
                    <div className="mb-4">
                      {/* Header + progress */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-[#1c1917]">Hồ sơ thanh toán T{month}/{year}</span>
                        <span className="text-[11px] font-bold" style={{ color: filled === files.length ? '#059669' : '#d97706' }}>
                          {filled}/{files.length}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#e7e5e4] mb-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: filled === files.length ? '#059669' : '#d97706' }}/>
                      </div>

                      {/* File rows */}
                      <div className="space-y-2">
                        {files.map(({ key, label, fallback }) => {
                          const info = dossierStatus?.[key];
                          const has  = info?.has ?? false;
                          const name = info?.fileName || '';
                          const isUp = uploading === key;
                          return (
                            <div key={key} className="rounded-lg border overflow-hidden"
                              style={{ borderColor: has ? '#bbf7d0' : '#e7e5e4', background: has ? '#f0fdf4' : '#fafaf9' }}>
                              <div className="flex items-center gap-2.5 px-3 py-2">
                                {/* Status dot */}
                                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[11px]"
                                  style={{ background: has ? '#dcfce7' : '#f5f5f4', border: `1.5px solid ${has ? '#86efac' : '#d6d3d1'}` }}>
                                  {has ? '✓' : '○'}
                                </div>
                                {/* Label + filename */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold" style={{ color: has ? '#15803d' : '#78716c' }}>{label}</p>
                                  {has && name && (
                                    <p className="text-[9px] truncate mt-0.5" style={{ color: '#78716c' }} title={name}>{name}</p>
                                  )}
                                  {!has && (
                                    <p className="text-[9px] mt-0.5" style={{ color: '#a8a29e' }}>Chưa upload</p>
                                  )}
                                </div>
                                {/* Actions */}
                                <div className="flex gap-1 flex-shrink-0">
                                  {has && (
                                    <button
                                      onClick={() => handleDownloadFile(key, fallback)}
                                      className="px-2 py-1 rounded text-[9px] font-medium cursor-pointer hover:brightness-95"
                                      style={{ background: '#dcfce7', color: '#15803d' }}
                                      title="Tải xuống">
                                      ⬇
                                    </button>
                                  )}
                                  <label
                                    className="px-2 py-1 rounded text-[9px] font-medium cursor-pointer hover:brightness-95"
                                    style={{ background: has ? '#fef3c7' : '#d97706', color: has ? '#92400e' : '#fff', opacity: isUp ? 0.6 : 1 }}
                                    title={has ? 'Đổi file' : 'Upload'}>
                                    {isUp ? '...' : has ? '🔄' : '📤'}
                                    <input type="file" accept={ACCEPT} className="hidden"
                                      onChange={e => handleUploadFile(key, e)}
                                      disabled={uploading !== null} />
                                  </label>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Xuất hồ sơ */}
                <button onClick={downloadDossier} disabled={exporting}
                  className="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer mb-4">
                  {exporting ? 'Đang xuất...' : '📥 Xuất hồ sơ thanh toán (.xlsx)'}
                </button>

                {/* Thông tin khách hàng */}
                <div className="pt-3 border-t border-[#e7e5e4] space-y-1 text-[10px] text-[#78716c]">
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
                      <button onClick={openAddPrice} className={btnPrimary}>➕ Thêm khoảng giá</button>
                    )}
                  </div>
                </div>
                {prices.length === 0 ? (
                  <div className="text-center py-8 text-[#78716c] text-sm">Chưa có đơn giá cho tháng này.</div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                    {priceGroups.map(g => (
                      <div key={g[0].id} className="border border-[#e7e5e4] rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
                          <span className="text-xs font-bold text-[#1c1917] flex items-center gap-1.5 flex-wrap">
                            {g[0].routeName ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">🛣 {g[0].routeName}</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#e7e5e4] text-[#57534e]">Mọi tuyến</span>
                            )}
                            <span>{g[0].fromDay} → {g[0].toDay} / {g[0].month}/{g[0].year}</span>
                          </span>
                          {canEdit && (
                            <div className="flex gap-1">
                              <button onClick={() => openEditPricePeriod(g)} title="Sửa cả khoảng"
                                className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white hover:brightness-105 cursor-pointer">✏️ Sửa khoảng</button>
                              <button onClick={() => removePricePeriod(g)} title="Xóa cả khoảng"
                                className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white hover:brightness-105 cursor-pointer">🗑 Xóa khoảng</button>
                            </div>
                          )}
                        </div>
                        <div className="p-2 flex flex-wrap gap-1.5">
                          {g.map(p => (
                            <span key={p.id} className="px-2 py-1 rounded bg-[#f9f9f8] border border-[#e7e5e4] text-[11px]">
                              <b className="text-[#1c1917]">{p.containerType}</b>{' '}
                              <span className="text-[#d97706] font-semibold">{Number(p.unitPrice).toLocaleString('vi-VN')} ₫</span>
                            </span>
                          ))}
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
        size="lg"
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
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Loại khách hàng <span className="text-[#ef4444]">*</span></label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'customer' | 'subvendor' }))} className={inputCls}>
              <option value="customer">👥 Khách hàng</option>
              <option value="subvendor">🚚 Sub vendor</option>
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
        title={priceEditId ? '✏️ Sửa khoảng đơn giá' : '➕ Thêm khoảng đơn giá'}
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
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tuyến đường áp dụng</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { key: 'chung', label: 'Mọi tuyến' },
                { key: 'XT', label: 'XT' },
                { key: 'CB', label: 'CB' },
                { key: 'ĐH', label: 'ĐH' },
                { key: 'other', label: 'Khác' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setRouteTab(tab.key); setRouteSearch(''); }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                    routeTab === tab.key
                      ? 'bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white border-transparent'
                      : 'bg-white text-[#78716c] border-[#e7e5e4] hover:text-[#1c1917]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {routeTab === 'chung' ? (
              <div className="px-3 py-2 rounded-lg bg-[#fafaf9] border border-[#e7e5e4] text-[11px] text-[#78716c]">
                Áp dụng cho <b className="text-[#1c1917]">mọi tuyến</b> — dùng khi tuyến không có đơn giá riêng.
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  placeholder="🔍 Tìm tuyến đường..."
                  className={`${inputCls} mb-2`}
                />
                <div className="max-h-36 overflow-y-auto border border-[#e7e5e4] rounded-lg divide-y divide-[#f5f5f4]">
                  {filteredRoutes.length === 0 ? (
                    <div className="px-3 py-3 text-[11px] text-[#a8a29e] text-center">Không có tuyến nào.</div>
                  ) : (
                    filteredRoutes.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setPriceForm((f) => ({ ...f, routeName: r.name }))}
                        className={`w-full text-left px-3 py-2 text-[11px] transition-all cursor-pointer ${
                          priceForm.routeName === r.name
                            ? 'bg-[#fef3c7] font-semibold text-[#92400e]'
                            : 'hover:bg-[#fafaf9] text-[#44403c]'
                        }`}
                      >
                        {priceForm.routeName === r.name ? '✓ ' : ''}{r.name}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
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
          <p className="text-[10px] text-[#a8a29e]">
            Nhập đơn giá cho từng loại container (bỏ trống = loại đó không áp dụng). Áp dụng tháng {month}/{year}
            {priceForm.routeName ? ` cho tuyến "${priceForm.routeName}"` : ' cho mọi tuyến'}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRICE_TYPES.map(t => (
              <div key={t}>
                <label className="block text-[10px] font-medium text-[#78716c] mb-1">{t}</label>
                <input type="number" min="0" value={priceForm.prices[t] || ''}
                  onChange={e => setPriceForm(f => ({ ...f, prices: { ...f.prices, [t]: e.target.value } }))}
                  placeholder="0" className={inputCls} />
              </div>
            ))}
          </div>
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

<Modal
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        size="lg"
        title={`📋 Gán kế hoạch đã hoàn thành — ${selected?.name || ''}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-[#78716c]">Đã chọn <b className="text-[#d97706]">{checkedPlanIds.length}</b> kế hoạch</span>
            <div className="flex gap-2">
              <button onClick={() => setPlansOpen(false)}
                className="px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
                Hủy
              </button>
              <button onClick={savePlans} disabled={savingPlans}
                className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white disabled:opacity-50 cursor-pointer">
                {savingPlans ? 'Đang lưu...' : '💾 Lưu'}
              </button>
            </div>
          </div>
        }
      >
        <div className="mb-3">
          <input
            type="text"
            value={planSearch}
            onChange={e => setPlanSearch(e.target.value)}
            placeholder="🔍 Tìm tàu / tuyến đường..."
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]"
          />
          <p className="text-[10px] text-[#a8a29e] mt-1">Tick những kế hoạch thuộc khách hàng này rồi bấm Lưu. Bỏ tick = gỡ khỏi khách hàng.</p>
        </div>
        {loadingPlans ? (
          <div className="text-center py-10 text-[#78716c] text-sm">Đang tải...</div>
        ) : filteredPlans.length === 0 ? (
          <div className="text-center py-10 text-[#78716c] text-sm">Không có kế hoạch đã hoàn thành.</div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto">
            {filteredPlans.map(p => {
              const checked = checkedPlanIds.includes(p.id);
              const belongsOther = p.customerId != null && p.customerId !== selected?.id;
              return (
                <label key={p.id}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 border rounded-lg text-xs cursor-pointer transition-all ${
                    checked ? 'border-[#f59e0b] bg-[#fef3c7] ring-1 ring-[#f59e0b]' : 'border-[#e7e5e4] bg-[#f9f9f8] hover:border-[#f59e0b]'
                  }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input type="checkbox" checked={checked} onChange={() => togglePlan(p.id)}
                      className="w-4 h-4 accent-[#f59e0b] cursor-pointer shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1c1917] truncate">{[p.name, p.soChuyen].filter(Boolean).join(' / ')}</span>
                        {belongsOther && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.12)] text-red-600 shrink-0">Thuộc KH khác</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#78716c] mt-0.5">
                        {[p.routeName, p.ngay ? String(p.ngay).split('-').reverse().join('-') : ''].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-[#d97706]">{p.containers}</div>
                    <div className="text-[9px] text-[#78716c] uppercase">Container</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
