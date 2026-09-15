'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Customer, CustomerPrice, CustomerSurcharge, CustomerAuditLog } from '@/types';
import { customersApi, DossierStatus, DossierFileType } from '@/lib/api-customers';
import { useAuth } from '@/providers/auth-provider';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/use-pagination';
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
  type: 'customer' as 'customer' | 'subvendor',
};

const PRICE_TYPES = ['H20', 'H40', 'V20', 'V40', 'V20FR', 'V40FR', 'VSL', 'TIP'];

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'â• Táº¡o má»›i',
  UPDATE: 'âœï¸ Sá»­a',
  DELETE: 'đŸ—‘ï¸ XĂ³a',
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
            return `${k}: ${(v as any).old} â†’ ${(v as any).new}`;
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

  // ÄÆ¡n giĂ¡
  const [prices, setPrices] = useState<CustomerPrice[]>([]);
  const [priceModal, setPriceModal] = useState(false);
  const [priceEditId, setPriceEditId] = useState<number | null>(null);
  const [priceForm, setPriceForm] = useState<{ fromDay: string; toDay: string; prices: Record<string, string> }>({ fromDay: '', toDay: '', prices: {} });

  // Phá»¥ phĂ­
  const [surcharges, setSurcharges] = useState<CustomerSurcharge[]>([]);
  const [surModal, setSurModal] = useState(false);
  const [surEditId, setSurEditId] = useState<number | null>(null);
  const [surForm, setSurForm] = useState({ name: '', calcType: 'add', value: '', fromDay: '', toDay: '', note: '' });

  // Lá»‹ch sá»­
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntity, setHistoryEntity] = useState<'price' | 'surcharge'>('price');
  const [history, setHistory] = useState<CustomerAuditLog[]>([]);

  // Káº¿ hoáº¡ch Ä‘Ă£ hoĂ n thĂ nh
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
      toast(err?.message || 'KhĂ´ng thá»ƒ táº£i danh sĂ¡ch khĂ¡ch hĂ ng', 'error');
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
    if (!form.name.trim()) { toast('Vui lĂ²ng nháº­p tĂªn khĂ¡ch hĂ ng', 'error'); return; }
    setSaving(true);
    try {
      if (editId) {
        await customersApi.update(editId, form);
        toast('ÄĂ£ cáº­p nháº­t khĂ¡ch hĂ ng', 'success');
      } else {
        await customersApi.create(form);
        toast('ÄĂ£ thĂªm khĂ¡ch hĂ ng', 'success');
      }
      setModalOpen(false);
      await load();
      if (selected && editId) {
        const updated = customers.find((c) => c.id === editId);
        if (updated) setSelected(updated);
      }
      onRefresh?.();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'LÆ°u tháº¥t báº¡i', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Customer) => {
    if (!confirm(`XĂ³a khĂ¡ch hĂ ng "${c.name}"?`)) return;
    try {
      const res = await customersApi.remove(c.id);
      toast(res.data.message, 'success');
      if (selected?.id === c.id) setSelected(null);
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'XĂ³a tháº¥t báº¡i', 'error');
    }
  };

  const setStatus = async (c: Customer, status: 'active' | 'inactive') => {
    try {
      await customersApi.update(c.id, { status });
      toast(status === 'inactive' ? 'ÄĂ£ ngá»«ng hoáº¡t Ä‘á»™ng' : 'ÄĂ£ kĂ­ch hoáº¡t', 'success');
      await load();
      if (selected?.id === c.id) setSelected({ ...selected, status });
    } catch (err: any) {
      toast(err?.message || 'Lá»—i', 'error');
    }
  };

  const downloadDossier = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      const res = await customersApi.downloadPaymentDossier(selected.id, month, year);
      downloadBlob(res, `ThanhToan_${selected.name}_T${String(month).padStart(2, '0')}.${year}.xlsx`);
      toast('ÄĂ£ xuáº¥t há»“ sÆ¡ thanh toĂ¡n', 'success');
    } catch (err: any) {
      toast(err?.message || 'Xuáº¥t tháº¥t báº¡i', 'error');
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
      toast(err?.response?.data?.message || err?.message || 'Upload tháº¥t báº¡i', 'error');
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
      toast(err?.response?.data?.message || 'ChÆ°a cĂ³ file nĂ y', 'error');
    }
  };

  // â”€â”€ ÄÆ¡n giĂ¡ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openAddPrice = () => {
    setPriceEditId(null);
    setPriceForm({ fromDay: '', toDay: '', prices: {} });
    setPriceModal(true);
  };

  const openEditPricePeriod = (group: CustomerPrice[]) => {
    if (!group.length) return;
    setPriceEditId(group[0].id);
    const prices: Record<string, string> = {};
    for (const p of group) prices[p.containerType] = String(p.unitPrice);
    setPriceForm({ fromDay: String(group[0].fromDay), toDay: String(group[0].toDay), prices });
    setPriceModal(true);
  };

  const savePrice = async () => {
    if (!selected) return;
    if (!priceForm.fromDay || !priceForm.toDay) {
      toast('Vui lĂ²ng nháº­p tá»« ngĂ y vĂ  Ä‘áº¿n ngĂ y', 'error');
      return;
    }
    const prices: Record<string, number> = {};
    for (const t of PRICE_TYPES) {
      const v = (priceForm.prices[t] || '').trim();
      if (v !== '') prices[t] = Number(v);
    }
    if (Object.keys(prices).length === 0) {
      toast('Vui lĂ²ng nháº­p Ă­t nháº¥t 1 Ä‘Æ¡n giĂ¡', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await customersApi.batchUpsertPrices(selected.id, {
        month,
        year,
        fromDay: Number(priceForm.fromDay),
        toDay: Number(priceForm.toDay),
        prices,
      });
      toast(res.data.message, 'success');
      setPriceModal(false);
      await loadPrices(selected.id, month, year);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'LÆ°u tháº¥t báº¡i', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removePricePeriod = async (group: CustomerPrice[]) => {
    if (!selected || !group.length) return;
    const p = group[0];
    if (!confirm(`XĂ³a toĂ n bá»™ Ä‘Æ¡n giĂ¡ khoáº£ng ${p.fromDay}-${p.toDay}/${p.month}/${p.year}?`)) return;
    try {
      await customersApi.deletePricesPeriod(selected.id, p.month, p.year, p.fromDay, p.toDay);
      toast('ÄĂ£ xĂ³a khoáº£ng Ä‘Æ¡n giĂ¡', 'success');
      await loadPrices(selected.id, month, year);
    } catch (err: any) {
      toast(err?.message || 'XĂ³a tháº¥t báº¡i', 'error');
    }
  };

  const priceGroups = useMemo(() => {
    const map = new Map<string, CustomerPrice[]>();
    for (const p of prices) {
      const key = `${p.fromDay}-${p.toDay}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a[0].fromDay - b[0].fromDay);
  }, [prices]);

  // â”€â”€ Phá»¥ phĂ­ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      toast('Vui lĂ²ng nháº­p tĂªn, giĂ¡ trá»‹ vĂ  khoáº£ng thá»i gian phá»¥ phĂ­', 'error');
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
        toast('ÄĂ£ cáº­p nháº­t phá»¥ phĂ­', 'success');
      } else {
        await customersApi.createSurcharge(selected.id, data);
        toast('ÄĂ£ thĂªm phá»¥ phĂ­', 'success');
      }
      setSurModal(false);
      await loadSurcharges(selected.id, month, year);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'LÆ°u tháº¥t báº¡i', 'error');
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
      toast(err?.message || 'Lá»—i', 'error');
    }
  };

  const removeSur = async (s: CustomerSurcharge) => {
    if (!selected) return;
    if (!confirm(`XĂ³a phá»¥ phĂ­ "${s.name}"?`)) return;
    try {
      await customersApi.deleteSurcharge(selected.id, s.id);
      toast('ÄĂ£ xĂ³a phá»¥ phĂ­', 'success');
      await loadSurcharges(selected.id, month, year);
    } catch (err: any) {
      toast(err?.message || 'XĂ³a tháº¥t báº¡i', 'error');
    }
  };

  // â”€â”€ Lá»‹ch sá»­ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      toast(err?.response?.data?.message || err?.message || 'LÆ°u tháº¥t báº¡i', 'error');
    } finally {
      setSavingPlans(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]";
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Ä‘/g, 'd');

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
          <h3 className="text-base font-bold">đŸ‘¥ Danh sĂ¡ch khĂ¡ch hĂ ng
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(245,158,11,0.15)] text-[#d97706]">
              {filtered.length}{filtered.length !== customers.length ? ` / ${customers.length}` : ''}
            </span>
          </h3>
          <button onClick={openAdd} className={btnPrimary}>
            â• ThĂªm khĂ¡ch hĂ ng
          </button>
        </div>

        <div className="mb-3 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="đŸ” TĂ¬m tĂªn, MST, email, SÄT, liĂªn há»‡..."
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]"
          />
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'all' as const, label: 'Táº¥t cáº£ loáº¡i' },
              { key: 'subvendor' as const, label: 'đŸ Sub vendor' },
              { key: 'customer' as const, label: 'đŸ‘¥ KhĂ¡ch hĂ ng' },
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
              { key: 'all' as const, label: 'Má»i tráº¡ng thĂ¡i' },
              { key: 'active' as const, label: 'Hoáº¡t Ä‘á»™ng' },
              { key: 'inactive' as const, label: 'Ngá»«ng' },
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
          <div className="text-center py-12 text-[#78716c] text-sm">Äang táº£i...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#78716c] text-sm">
            {search.trim() || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'KhĂ´ng tĂ¬m tháº¥y khĂ¡ch hĂ ng phĂ¹ há»£p'
              : 'ChÆ°a cĂ³ khĂ¡ch hĂ ng. Báº¥m "ThĂªm khĂ¡ch hĂ ng" Ä‘á»ƒ báº¯t Ä‘áº§u.'}
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
                    }`}>{c.type === 'subvendor' ? 'đŸ Sub vendor' : 'đŸ‘¥ KhĂ¡ch hĂ ng'}</span>
                    {c.status === 'inactive' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.15)] text-red-600 shrink-0">Ngá»«ng</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(c)}
                      title="Sá»­a thĂ´ng tin"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-sm hover:shadow-md hover:brightness-105 transition-all cursor-pointer">
                      âœï¸ Sá»­a
                    </button>
                    {c.status === 'active' ? (
                      <button onClick={() => setStatus(c, 'inactive')}
                        title="Ngá»«ng hoáº¡t Ä‘á»™ng"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#f5f5f4] border border-[#d4d4d0] text-[#57534e] hover:bg-[#e7e5e4] hover:border-[#a8a29e] transition-all cursor-pointer">
                        â¸ Ngá»«ng
                      </button>
                    ) : (
                      <button onClick={() => setStatus(c, 'active')}
                        title="KĂ­ch hoáº¡t trá»Ÿ láº¡i"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-sm hover:shadow-md hover:brightness-105 transition-all cursor-pointer">
                        â–¶ KĂ­ch hoáº¡t
                      </button>
                    )}
                    <button onClick={() => remove(c)}
                      title="XĂ³a khĂ¡ch hĂ ng"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white shadow-sm hover:shadow-md hover:brightness-105 transition-all cursor-pointer">
                      đŸ—‘ XĂ³a
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-[#78716c] mt-1">
                  <span>đŸ‘¤ TĂªn: <span className="font-medium text-[#1c1917]">{c.contactName || 'â€”'}</span></span>
                  <span className="ml-3">đŸ¦ MST: <span className="font-medium text-[#1c1917]">{c.mst || 'â€”'}</span></span>
                </div>
                <div className="text-[11px] text-[#78716c] mt-0.5">
                  <span>âœ‰ï¸ Email: <span className="font-medium text-[#1c1917]">{c.email || 'â€”'}</span></span>
                  <span className="ml-3">đŸ“ SÄT: <span className="font-medium text-[#1c1917]">{c.phone || 'â€”'}</span></span>
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
          <div className="text-center py-16 text-[#78716c] text-sm">Chá»n 1 khĂ¡ch hĂ ng Ä‘á»ƒ xem há»“ sÆ¡.</div>
        ) : (
          <>
            <h3 className="text-base font-bold mb-1">đŸ“‚ KhĂ¡ch hĂ ng</h3>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm font-bold text-[#1c1917] truncate">{selected.name}</div>
              <button onClick={openCompletedPlans}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] hover:border-[#d4d4d0] transition-all cursor-pointer">
                đŸ“‹ GĂ¡n káº¿ hoáº¡ch Ä‘Ă£ hoĂ n thĂ nh
              </button>
            </div>

            <div className="flex gap-1.5 mb-3">
              {([
                { key: 'dossier' as const, label: 'đŸ“‚ Há»“ sÆ¡' },
                { key: 'prices' as const, label: 'đŸ’µ ÄÆ¡n giĂ¡' },
                { key: 'surcharges' as const, label: 'â• Phá»¥ phĂ­' },
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
                    <div className="text-lg font-extrabold text-[#f59e0b]">{stats?.plans ?? 'â€”'}</div>
                    <div className="text-[9px] text-[#78716c] font-semibold uppercase">Káº¿ hoáº¡ch</div>
                  </div>
                  <div className="px-3 py-2.5 bg-[#f9f9f8] border border-[#e7e5e4] rounded-lg text-center">
                    <div className="text-lg font-extrabold text-[#d97706]">{stats?.soChuyen ?? 'â€”'}</div>
                    <div className="text-[9px] text-[#78716c] font-semibold uppercase">Chuyáº¿n</div>
                  </div>
                  <div className="px-3 py-2.5 bg-[#f9f9f8] border border-[#e7e5e4] rounded-lg text-center">
                    <div className="text-lg font-extrabold text-[#059669]">{stats?.containers ?? 'â€”'}</div>
                    <div className="text-[9px] text-[#78716c] font-semibold uppercase">Container</div>
                  </div>
                </div>

                {/* Há»“ sÆ¡ 3 file */}
                {(() => {
                  const ACCEPT = '.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx';
                  const files: { key: DossierFileType; label: string; fallback: string }[] = [
                    { key: 'bangKe',  label: 'Báº£ng kĂª',              fallback: `BangKe_${selected.name}_T${String(month).padStart(2,'0')}.${year}` },
                    { key: 'invoice', label: 'HoĂ¡ Ä‘Æ¡n GTGT',         fallback: `HoaDon_${selected.name}_T${String(month).padStart(2,'0')}.${year}` },
                    { key: 'deNghi',  label: 'Äá» nghá»‹ thanh toĂ¡n',   fallback: `DeNghi_${selected.name}_T${String(month).padStart(2,'0')}.${year}` },
                  ];
                  const filled = dossierStatus
                    ? files.filter(f => dossierStatus[f.key].has).length
                    : 0;
                  const pct = Math.round(filled / files.length * 100);

                  return (
                    <div className="mb-4">
                      {/* Header + progress */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-[#1c1917]">Há»“ sÆ¡ thanh toĂ¡n T{month}/{year}</span>
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
                                  {has ? 'âœ“' : 'â—‹'}
                                </div>
                                {/* Label + filename */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold" style={{ color: has ? '#15803d' : '#78716c' }}>{label}</p>
                                  {has && name && (
                                    <p className="text-[9px] truncate mt-0.5" style={{ color: '#78716c' }} title={name}>{name}</p>
                                  )}
                                  {!has && (
                                    <p className="text-[9px] mt-0.5" style={{ color: '#a8a29e' }}>ChÆ°a upload</p>
                                  )}
                                </div>
                                {/* Actions */}
                                <div className="flex gap-1 flex-shrink-0">
                                  {has && (
                                    <button
                                      onClick={() => handleDownloadFile(key, fallback)}
                                      className="px-2 py-1 rounded text-[9px] font-medium cursor-pointer hover:brightness-95"
                                      style={{ background: '#dcfce7', color: '#15803d' }}
                                      title="Táº£i xuá»‘ng">
                                      â¬‡
                                    </button>
                                  )}
                                  <label
                                    className="px-2 py-1 rounded text-[9px] font-medium cursor-pointer hover:brightness-95"
                                    style={{ background: has ? '#fef3c7' : '#d97706', color: has ? '#92400e' : '#fff', opacity: isUp ? 0.6 : 1 }}
                                    title={has ? 'Äá»•i file' : 'Upload'}>
                                    {isUp ? '...' : has ? 'đŸ”„' : 'đŸ“¤'}
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

                {/* Xuáº¥t há»“ sÆ¡ */}
                <button onClick={downloadDossier} disabled={exporting}
                  className="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer mb-4">
                  {exporting ? 'Äang xuáº¥t...' : 'đŸ“¥ Xuáº¥t há»“ sÆ¡ thanh toĂ¡n (.xlsx)'}
                </button>

                {/* ThĂ´ng tin khĂ¡ch hĂ ng */}
                <div className="pt-3 border-t border-[#e7e5e4] space-y-1 text-[10px] text-[#78716c]">
                  <div>MST: <span className="font-medium text-[#1c1917]">{selected.mst || 'â€”'}</span></div>
                  <div>NgĂ¢n hĂ ng: <span className="font-medium text-[#1c1917]">{selected.bankName || 'â€”'} {selected.bankAccount ? `- ${selected.bankAccount}` : ''}</span></div>
                  <div>Äá»‹a chá»‰: <span className="font-medium text-[#1c1917]">{selected.address || 'â€”'}</span></div>
                </div>
              </>
            )}

            {section === 'prices' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#1c1917]">đŸ’µ ÄÆ¡n giĂ¡ thĂ¡ng {month}/{year}</span>
                  <div className="flex gap-1.5">
                    {isAdmin && (
                      <button onClick={() => openHistory('price')}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">đŸ“œ Lá»‹ch sá»­</button>
                    )}
                    {canEdit && (
                      <button onClick={openAddPrice} className={btnPrimary}>â• ThĂªm khoáº£ng giĂ¡</button>
                    )}
                  </div>
                </div>
                {prices.length === 0 ? (
                  <div className="text-center py-8 text-[#78716c] text-sm">ChÆ°a cĂ³ Ä‘Æ¡n giĂ¡ cho thĂ¡ng nĂ y.</div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                    {priceGroups.map(g => (
                      <div key={g[0].id} className="border border-[#e7e5e4] rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
                          <span className="text-xs font-bold text-[#1c1917]">{g[0].fromDay} â†’ {g[0].toDay} / {g[0].month}/{g[0].year}</span>
                          {canEdit && (
                            <div className="flex gap-1">
                              <button onClick={() => openEditPricePeriod(g)} title="Sá»­a cáº£ khoáº£ng"
                                className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white hover:brightness-105 cursor-pointer">âœï¸ Sá»­a khoáº£ng</button>
                              <button onClick={() => removePricePeriod(g)} title="XĂ³a cáº£ khoáº£ng"
                                className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white hover:brightness-105 cursor-pointer">đŸ—‘ XĂ³a khoáº£ng</button>
                            </div>
                          )}
                        </div>
                        <div className="p-2 flex flex-wrap gap-1.5">
                          {g.map(p => (
                            <span key={p.id} className="px-2 py-1 rounded bg-[#f9f9f8] border border-[#e7e5e4] text-[11px]">
                              <b className="text-[#1c1917]">{p.containerType}</b>{' '}
                              <span className="text-[#d97706] font-semibold">{Number(p.unitPrice).toLocaleString('vi-VN')} â‚«</span>
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
                  <span className="text-xs font-bold text-[#1c1917]">â• Phá»¥ phĂ­ thĂ¡ng {month}/{year}</span>
                  <div className="flex gap-1.5">
                    {isAdmin && (
                      <button onClick={() => openHistory('surcharge')}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">đŸ“œ Lá»‹ch sá»­</button>
                    )}
                    {canEdit && (
                      <button onClick={openAddSur} className={btnPrimary}>â• ThĂªm</button>
                    )}
                  </div>
                </div>
                {surcharges.length === 0 ? (
                  <div className="text-center py-8 text-[#78716c] text-sm">ChÆ°a cĂ³ phá»¥ phĂ­ nĂ o.</div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
                    {surcharges.map(s => (
                      <div key={s.id} className="px-3 py-2.5 bg-[#f9f9f8] border border-[#e7e5e4] rounded-lg text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-[#1c1917]">{s.name}</span>
                            <span className="ml-2 text-[#78716c]">{s.fromDay} â†’ {s.toDay}/{s.month}/{s.year}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canEdit && (
                              <>
                                <button onClick={() => toggleSur(s)}
                                  title={s.active ? 'Táº¯t phá»¥ phĂ­' : 'Báº­t phá»¥ phĂ­'}
                                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                    s.active
                                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                      : 'bg-[#f0f0ee] border border-[#d4d4d0] text-[#78716c] hover:bg-[#e7e5e4]'
                                  }`}>
                                  {s.active ? 'đŸŸ¢ Báº­t' : 'âª Táº¯t'}
                                </button>
                                <button onClick={() => openEditSur(s)} title="Sá»­a phá»¥ phĂ­" className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white hover:brightness-105 cursor-pointer">âœï¸ Sá»­a</button>
                                <button onClick={() => removeSur(s)} title="XĂ³a phá»¥ phĂ­" className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white hover:brightness-105 cursor-pointer">đŸ—‘ XĂ³a</button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-[#78716c] mt-1">
                          {s.calcType === 'add'
                            ? <span className="px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.12)] text-emerald-700 font-semibold">Cá»™ng {Number(s.value).toLocaleString('vi-VN')} â‚«</span>
                            : <span className="px-1.5 py-0.5 rounded bg-[rgba(245,158,11,0.12)] text-[#d97706] font-semibold">{Number(s.value)}% ÄÆ¡n giĂ¡</span>}
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
        title={editId ? 'âœï¸ Sá»­a khĂ¡ch hĂ ng' : 'â• ThĂªm khĂ¡ch hĂ ng'}
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
              Há»§y
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white disabled:opacity-50 cursor-pointer">
              {saving ? 'Äang lÆ°u...' : 'đŸ’¾ LÆ°u'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">TĂªn khĂ¡ch hĂ ng <span className="text-[#ef4444]">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="vd: CĂ´ng ty ABC" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Loáº¡i khĂ¡ch hĂ ng <span className="text-[#ef4444]">*</span></label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'customer' | 'subvendor' }))} className={inputCls}>
              <option value="customer">đŸ‘¥ KhĂ¡ch hĂ ng</option>
              <option value="subvendor">đŸ Sub vendor</option>
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Äiá»‡n thoáº¡i</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Email</label>
              <input type="text" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">NgÆ°á»i liĂªn há»‡</label>
              <input type="text" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">MST</label>
              <input type="text" value={form.mst} onChange={e => setForm(f => ({ ...f, mst: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">NgĂ¢n hĂ ng</label>
              <input type="text" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Sá»‘ tĂ i khoáº£n</label>
              <input type="text" value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Äá»‹a chá»‰</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Ghi chĂº</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
      </Modal>

      <Modal
        open={priceModal}
        onClose={() => setPriceModal(false)}
        title={priceEditId ? 'âœï¸ Sá»­a khoáº£ng Ä‘Æ¡n giĂ¡' : 'â• ThĂªm khoáº£ng Ä‘Æ¡n giĂ¡'}
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setPriceModal(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
              Há»§y
            </button>
            <button onClick={savePrice} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">
              {saving ? 'Äang lÆ°u...' : 'đŸ’¾ LÆ°u'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tá»« ngĂ y <span className="text-[#ef4444]">*</span></label>
              <input type="number" min="1" max="31" value={priceForm.fromDay} onChange={e => setPriceForm(f => ({ ...f, fromDay: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Äáº¿n ngĂ y <span className="text-[#ef4444]">*</span></label>
              <input type="number" min="1" max="31" value={priceForm.toDay} onChange={e => setPriceForm(f => ({ ...f, toDay: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <p className="text-[10px] text-[#a8a29e]">
            Nháº­p Ä‘Æ¡n giĂ¡ cho tá»«ng loáº¡i container (bá» trá»‘ng = loáº¡i Ä‘Ă³ khĂ´ng Ă¡p dá»¥ng). Ăp dá»¥ng thĂ¡ng {month}/{year}.
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
        title={surEditId ? 'âœï¸ Sá»­a phá»¥ phĂ­' : 'â• ThĂªm phá»¥ phĂ­'}
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setSurModal(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
              Há»§y
            </button>
            <button onClick={saveSur} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">
              {saving ? 'Äang lÆ°u...' : 'đŸ’¾ LÆ°u'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">TĂªn phá»¥ phĂ­ <span className="text-[#ef4444]">*</span></label>
            <input type="text" value={surForm.name} onChange={e => setSurForm(f => ({ ...f, name: e.target.value }))} placeholder="vd: Phá»¥ phĂ­ háº¡ container" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">PhÆ°Æ¡ng phĂ¡p tĂ­nh</label>
            <select value={surForm.calcType} onChange={e => setSurForm(f => ({ ...f, calcType: e.target.value }))} className={inputCls}>
              <option value="add">â• Cá»™ng thĂªm (sá»‘ tiá»n cá»‘ Ä‘á»‹nh)</option>
              <option value="percent">% ÄÆ¡n giĂ¡ gá»‘c (theo loáº¡i container)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tá»« ngĂ y <span className="text-[#ef4444]">*</span></label>
              <input type="number" min="1" max="31" value={surForm.fromDay} onChange={e => setSurForm(f => ({ ...f, fromDay: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1.5">Äáº¿n ngĂ y <span className="text-[#ef4444]">*</span></label>
              <input type="number" min="1" max="31" value={surForm.toDay} onChange={e => setSurForm(f => ({ ...f, toDay: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">{surForm.calcType === 'add' ? 'GiĂ¡ trá»‹ (VNÄ)' : 'Pháº§n trÄƒm (%)'} <span className="text-[#ef4444]">*</span></label>
            <input type="number" min="0" value={surForm.value} onChange={e => setSurForm(f => ({ ...f, value: e.target.value }))}
              placeholder={surForm.calcType === 'add' ? 'vd: 50000' : 'vd: 5'} className={inputCls} />
            {surForm.calcType === 'percent' && (
              <p className="text-[10px] text-[#a8a29e] mt-1">TĂ­nh trĂªn Ä‘Æ¡n giĂ¡ Ä‘Ăºng loáº¡i container (vd V40 = 500.000 â†’ 5% = 25.000).</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Ghi chĂº</label>
            <input type="text" value={surForm.note} onChange={e => setSurForm(f => ({ ...f, note: e.target.value }))} className={inputCls} />
          </div>
        </div>
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={historyEntity === 'price' ? 'đŸ“œ Lá»‹ch sá»­ Ä‘Æ¡n giĂ¡' : 'đŸ“œ Lá»‹ch sá»­ phá»¥ phĂ­'}
        footer={
          <button onClick={() => setHistoryOpen(false)}
            className="px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
            ÄĂ³ng
          </button>
        }
      >
        {history.length === 0 ? (
          <div className="text-center py-8 text-[#78716c] text-sm">ChÆ°a cĂ³ lá»‹ch sá»­.</div>
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
                <div className="mt-1 text-[#1c1917] font-medium">đŸ‘¤ {h.performedByName || 'â€”'}</div>
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
        title={`đŸ“‹ GĂ¡n káº¿ hoáº¡ch Ä‘Ă£ hoĂ n thĂ nh â€” ${selected?.name || ''}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-[#78716c]">ÄĂ£ chá»n <b className="text-[#d97706]">{checkedPlanIds.length}</b> káº¿ hoáº¡ch</span>
            <div className="flex gap-2">
              <button onClick={() => setPlansOpen(false)}
                className="px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
                Há»§y
              </button>
              <button onClick={savePlans} disabled={savingPlans}
                className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white disabled:opacity-50 cursor-pointer">
                {savingPlans ? 'Äang lÆ°u...' : 'đŸ’¾ LÆ°u'}
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
            placeholder="đŸ” TĂ¬m tĂ u / tuyáº¿n Ä‘Æ°á»ng..."
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]"
          />
          <p className="text-[10px] text-[#a8a29e] mt-1">Tick nhá»¯ng káº¿ hoáº¡ch thuá»™c khĂ¡ch hĂ ng nĂ y rá»“i báº¥m LÆ°u. Bá» tick = gá»¡ khá»i khĂ¡ch hĂ ng.</p>
        </div>
        {loadingPlans ? (
          <div className="text-center py-10 text-[#78716c] text-sm">Äang táº£i...</div>
        ) : filteredPlans.length === 0 ? (
          <div className="text-center py-10 text-[#78716c] text-sm">KhĂ´ng cĂ³ káº¿ hoáº¡ch Ä‘Ă£ hoĂ n thĂ nh.</div>
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
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.12)] text-red-600 shrink-0">Thuá»™c KH khĂ¡c</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#78716c] mt-0.5">
                        {[p.routeName, p.ngay ? String(p.ngay).split('-').reverse().join('-') : ''].filter(Boolean).join(' Â· ')}
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
