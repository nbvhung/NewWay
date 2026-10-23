'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShippingLine, Route, User, Customer, CustomerPrice } from '@/types';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { submissionsApi } from '@/lib/api-submissions';
import { customersApi } from '@/lib/api-customers';
import { fmtNgay } from '@/lib/utils';
import { hasPerm } from '@/lib/permissions';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { confirmDelete } from '@/lib/delete-guard';

interface Props {
  user?: any;
  allShippingLines: ShippingLine[];
  allRoutes: Route[];
  allUsers: User[];
  /** Danh sách lái xe đầy đủ để phân công kế hoạch (không giới hạn visibleDriverIds). */
  assignmentUsers?: User[];
  allCustomers?: Customer[];
  onRefresh: () => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function ShippingLinesTab({ user, allShippingLines, allRoutes, allUsers, assignmentUsers, allCustomers, onRefresh, toast }: Props) {
  // Ưu tiên danh sách đầy đủ (phân công kế hoạch); fallback về allUsers nếu không có.
  const driverPool = assignmentUsers && assignmentUsers.length > 0 ? assignmentUsers : allUsers;
  const drivers = driverPool.filter(u => u.role === 'laixe').sort((a, b) => {
    const aStt = a.stt ? parseInt(String(a.stt), 10) : 999999;
    const bStt = b.stt ? parseInt(String(b.stt), 10) : 999999;
    return aStt - bStt;
  });
  const activeCustomers = (allCustomers || []).filter(c => c.status === 'active');
  const [name, setName] = useState('');
  const [soChuyen, setSoChuyen] = useState('');
  const [routeName, setRouteName] = useState('');
  const [ngay, setNgay] = useState('');
  const [tangCuong, setTangCuong] = useState(false);
  const [leTet, setLeTet] = useState(false);
  const [driverIds, setDriverIds] = useState<number[]>([]);
  const [allDrivers, setAllDrivers] = useState(true);
  const [customerId, setCustomerId] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addVendorKhac, setAddVendorKhac] = useState('');
  const [addTenNguoiNhap, setAddTenNguoiNhap] = useState('');
  const [totalShipOpen, setTotalShipOpen] = useState(false);
  const [totalShipPlan, setTotalShipPlan] = useState<ShippingLine | null>(null);
  const [totalShipForm, setTotalShipForm] = useState({
    hang20: '', hang40: '', vo20: '', vo40: '', vo20fr: '', vo40fr: '',
    veSinhLai: '', keoVe: '', tip: '',
  });
  const [editTarget, setEditTarget] = useState<ShippingLine | null>(null);
  const [editName, setEditName] = useState('');
  const [editSoChuyen, setEditSoChuyen] = useState('');
  const [editRouteName, setEditRouteName] = useState('');
  const [editNgay, setEditNgay] = useState('');
  const [editTangCuong, setEditTangCuong] = useState(false);
  const [editLeTet, setEditLeTet] = useState(false);
  const [editDriverIds, setEditDriverIds] = useState<number[]>([]);
  const [editAllDrivers, setEditAllDrivers] = useState(true);
  const [editCustomerId, setEditCustomerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [routeTypeFilter, setRouteTypeFilter] = useState('Tất cả');
  const [editRouteTypeFilter, setEditRouteTypeFilter] = useState('Tất cả');
  const ROUTE_TYPES = ['Tất cả', 'XT', 'CB', 'ĐH'];
  const PRICE_TYPES = ['H20', 'H40', 'V20', 'V40', 'V20FR', 'V40FR', 'KV20', 'KV20FR', 'VSL', 'TIP'];
  const PRICE_LABELS: Record<string, string> = { KV20: 'Kẹp V20', KV20FR: 'Kẹp V20FR' };
  const priceLabel = (t: string) => PRICE_LABELS[t] ?? t;

  const emptyPrices = () => Object.fromEntries(PRICE_TYPES.map(t => [t, ''])) as Record<string, string>;
  const [prices, setPrices] = useState<Record<string, string>>(emptyPrices());
  const [editPrices, setEditPrices] = useState<Record<string, string>>(emptyPrices());
  const [approveOpen, setApproveOpen] = useState(false);
  const [approvePlan, setApprovePlan] = useState<ShippingLine | null>(null);
  const [approvePrices, setApprovePrices] = useState<Record<string, string>>(emptyPrices());

  // ── Tra giá khách hàng theo tuyến (khi chọn khách + tuyến) ──
  const [custPrices, setCustPrices] = useState<CustomerPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

  const fetchCustomerPrices = useCallback(async (cid: string) => {
    if (!cid) { setCustPrices([]); return; }
    setLoadingPrices(true);
    try {
      // Kế hoạch có ngày → dùng tháng/năm của ngày; không có → tháng/năm hiện tại
      const d = ngay ? new Date(ngay) : new Date();
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const res = await customersApi.getPrices(Number(cid), m, y);
      setCustPrices(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCustPrices([]);
    } finally { setLoadingPrices(false); }
  }, [ngay]);

  useEffect(() => { fetchCustomerPrices(customerId); }, [customerId, fetchCustomerPrices]);

  /** Giá của 1 loại container khớp routeName đã chọn (và ngày kế hoạch nằm trong from→to). */
  const priceForType = (type: string): number | null => {
    if (!routeName) return null;
    const day = ngay ? new Date(ngay).getDate() : null;
    const matches = custPrices.filter(
      p => p.containerType === type && (p.routeName || '') === routeName,
    );
    const narrowed = day !== null
      ? matches.filter(p => day >= p.fromDay && day <= p.toDay)
      : matches;
    const list = narrowed.length > 0 ? narrowed : matches;
    if (list.length === 0) return null;
    return Number(list[0].unitPrice) || 0;
  };

  /** Áp toàn bộ giá tra được vào form đơn giá deal. */
  const applySuggestedPrice = () => {
    const next: Record<string, string> = { ...prices };
    let applied = 0;
    PRICE_TYPES.forEach(t => {
      const v = priceForType(t);
      if (v !== null) { next[t] = String(v); applied++; }
    });
    setPrices(next);
    if (applied > 0) toast(`Đã điền ${applied} đơn giá từ bảng giá khách hàng`, 'success');
    else toast('Không tìm thấy giá phù hợp cho tuyến này', 'info');
  };

  const hasSuggested = !!customerId && !!routeName && custPrices.some(
    p => (p.routeName || '') === routeName,
  );

  const isOps = hasPerm(user, 'plan.create') || hasPerm(user, 'plan.edit') || hasPerm(user, 'plan.complete') || hasPerm(user, 'plan.delete');
  const canCreate = hasPerm(user, 'plan.create');
  const canEdit = hasPerm(user, 'plan.edit');
  const canComplete = hasPerm(user, 'plan.complete');
  const isApprover = hasPerm(user, 'plan.approve_price');
  const canDelete = hasPerm(user, 'plan.delete');

  const priceStatusBadge = (p: ShippingLine) => {
    if (p.completed) return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(16,185,129,0.15)] text-emerald-600">✅ Đã hoàn thành</span>;
    switch (p.priceStatus) {
      case 'approved':
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(16,185,129,0.15)] text-emerald-600">✅ Giá đã duyệt</span>;
      case 'pending':
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(245,158,11,0.15)] text-amber-600">⏳ Chờ duyệt giá</span>;
      case 'rejected':
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(239,68,68,0.15)] text-red-600">❌ Giá bị từ chối</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(148,163,184,0.15)] text-[#78716c]">— Chưa nhập giá</span>;
    }
  };

  const activePlans = allShippingLines.filter(p => !p.completed);

  const { page, pageSize, totalPages, totalItems, paged: pagedLines, setPage, setPageSize } = usePagination(activePlans, 10);

  const resetForm = () => {
    setName('');
    setSoChuyen('');
    setRouteName('');
    setNgay('');
    setTangCuong(false);
    setLeTet(false);
    setDriverIds([]);
    setAllDrivers(true);
    setCustomerId('');
    setPrices(emptyPrices());
  };

  const createPlan = async (): Promise<ShippingLine | null> => {
    if (!name.trim()) { toast('Vui lòng nhập tên kế hoạch', 'error'); return null; }
    if (!customerId) { toast('Vui lòng chọn khách hàng', 'error'); return null; }
    const dealedPrices: Record<string, number> = {};
    PRICE_TYPES.forEach(t => { const v = Number(prices[t]); if (!isNaN(v) && v > 0) dealedPrices[t] = v; });
    if (Object.keys(dealedPrices).length === 0) { toast('Vui lòng nhập ít nhất 1 đơn giá deal với khách hàng', 'error'); return null; }
    const res = await shippingLinesApi.create({
      name: name.trim(),
      soChuyen: soChuyen.trim(),
      routeName: routeName.trim(),
      ngay: ngay || undefined,
      customerId: Number(customerId),
      tangCuong,
      leTet,
      vendorKhac: addVendorKhac.trim(),
      tenNguoiNhap: addTenNguoiNhap.trim(),
      driverIds: allDrivers ? [] : driverIds,
      allDrivers,
      dealedPrices,
    });
    return res.data;
  };

  const addPlan = async () => {
    setSaving(true);
    try {
      const created = await createPlan();
      if (!created) return;
      toast(`Đã thêm kế hoạch: ${created.name}`, 'success');
      resetForm();
      setAddOpen(false);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const addPlanThenTotalShip = async () => {
    setSaving(true);
    try {
      const created = await createPlan();
      if (!created) return;
      resetForm();
      setAddOpen(false);
      setTotalShipPlan(created);
      setTotalShipForm({ hang20: '', hang40: '', vo20: '', vo40: '', vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '' });
      setTotalShipOpen(true);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const saveTotalShip = async () => {
    if (!totalShipPlan) return;
    setSaving(true);
    try {
      await submissionsApi.create({
        shippingLine: totalShipPlan.name,
        shippingLineId: totalShipPlan.id,
        route: totalShipPlan.routeName || '',
        hang20: totalShipForm.hang20,
        hang40: totalShipForm.hang40,
        vo20: totalShipForm.vo20,
        vo40: totalShipForm.vo40,
        vo20fr: totalShipForm.vo20fr,
        vo40fr: totalShipForm.vo40fr,
        veSinhLai: totalShipForm.veSinhLai,
        keoVe: totalShipForm.keoVe,
        tip: totalShipForm.tip,
      });
      setTotalShipOpen(false);
      toast('Đã lưu SL Tổng Tàu', 'success');
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const openEdit = (p: ShippingLine) => {
    setEditTarget(p);
    setEditName(p.name);
    setEditSoChuyen(p.soChuyen);
    setEditRouteName(p.routeName);
    setEditNgay(p.ngay);
    setEditTangCuong(p.tangCuong);
    setEditLeTet(p.leTet);
    try { setEditDriverIds(JSON.parse(p.driverIds || '[]')); } catch { setEditDriverIds([]); }
    setEditAllDrivers(p.allDrivers);
    setEditCustomerId(p.customerId ? String(p.customerId) : '');
    setEditPrices(emptyPrices());
    if (p.dealedPrices) {
      PRICE_TYPES.forEach(t => { setEditPrices(prev => ({ ...prev, [t]: String(p.dealedPrices![t] ?? '') })); });
    }
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) { toast('Tên kế hoạch/Tên Tàu không được để trống', 'error'); return; }
    const dealedPrices: Record<string, number> = {};
    PRICE_TYPES.forEach(t => { const v = Number(editPrices[t]); if (!isNaN(v) && v > 0) dealedPrices[t] = v; });
    if (Object.keys(dealedPrices).length === 0) { toast('Vui lòng nhập ít nhất 1 đơn giá deal với khách hàng', 'error'); return; }
    setSaving(true);
    try {
      await shippingLinesApi.update(editTarget.id, {
        name: editName.trim(),
        soChuyen: editSoChuyen.trim(),
        routeName: editRouteName.trim(),
        ngay: editNgay || undefined,
        customerId: editCustomerId ? Number(editCustomerId) : null,
        tangCuong: editTangCuong,
        leTet: editLeTet,
        driverIds: editAllDrivers ? [] : editDriverIds,
        allDrivers: editAllDrivers,
        dealedPrices,
      });
      toast('Đã cập nhật kế hoạch', 'success');
      setEditOpen(false);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const completePlan = async (id: number, displayName: string) => {
    if (!confirm(`Hoàn thành kế hoạch "${displayName}"?`)) return;
    try {
      await shippingLinesApi.update(id, { completed: true });
      toast(`Đã hoàn thành: ${displayName}`, 'success');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const ketThuc = async (id: number, displayName: string) => {
    if (!confirm(`Gửi tin rà soát cho lái xe của kế hoạch "${displayName}"?`)) return;
    try {
      const res = await shippingLinesApi.ketThuc(id);
      toast(res.data?.message || 'Đã gửi tin rà soát', 'success');
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const submitApprove = async (action: 'approve' | 'reject') => {
    if (!approvePlan) return;
    setSaving(true);
    try {
      // Thu thập giá đã sửa (bỏ qua trường trống / 0)
      const dealedPrices: Record<string, number> = {};
      PRICE_TYPES.forEach(t => { const v = Number(approvePrices[t]); if (!isNaN(v) && v > 0) dealedPrices[t] = v; });
      await shippingLinesApi.approvePrice(
        approvePlan.id,
        action,
        Object.keys(dealedPrices).length > 0 ? dealedPrices : undefined,
      );
      toast(action === 'approve' ? 'Đã duyệt đơn giá' : 'Đã từ chối đơn giá', 'success');
      setApproveOpen(false);
      setApprovePlan(null);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const deletePlan = async (id: number, displayName: string) => {
    // Xoá luôn phải nhập mật khẩu 348 (popup của <DeleteGuardHost />).
    const res = await confirmDelete({
      message: `Xóa kế hoạch "${displayName}"?`,
      action: () => shippingLinesApi.delete(id),
    });
    if (res === undefined) return;
    toast(`Đã xóa: ${displayName}`, 'success');
    onRefresh();
  };

  const planDisplayName = (p: ShippingLine) => {
    return [p.name, p.soChuyen, p.routeName, fmtNgay(p.ngay)].filter(Boolean).join(' / ');
  };

  const driversText = (p: ShippingLine) => {
    if (p.allDrivers) return 'Tất cả';
    try {
      const ids = JSON.parse(p.driverIds || '[]') as number[];
      return ids.map(id => drivers.find(d => d.id === id)?.stt || `#${id}`).join(', ') || 'Không có';
    } catch { return 'Không có'; }
  };

  const renderDriverChips = (selected: number[], onChange: (ids: number[]) => void) => (
    <div className="flex flex-wrap gap-1 p-2 border border-[#e7e5e4] rounded-lg max-h-[140px] overflow-y-auto">
      {drivers.length > 0 ? drivers.map(d => {
        const sel = selected.includes(d.id);
        return (
          <label key={d.id}
            className={`px-2 py-1 rounded text-[10px] border cursor-pointer ${
              sel
                ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.15)]'
                : 'border-[#e7e5e4] hover:border-[#f59e0b]'
            }`}
            onClick={() => onChange(sel ? selected.filter(id => id !== d.id) : [...selected, d.id])}>
            {d.stt || d.fullName || d.username}
          </label>
        );
      }) : <span className="text-[10px] text-[#78716c]">Chưa có tài khoản lái xe</span>}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* ── Danh sách kế hoạch ── */}
      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">🚢 Danh sách kế hoạch
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(245,158,11,0.15)] text-[#d97706]">
              {activePlans.length} đang mở
            </span>
          </h3>
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] hover:border-[#d4d4d0] transition-all cursor-pointer">🔄</button>
        </div>
        <div className="flex flex-col gap-1.5">
          {pagedLines.map(p => {
            const display = planDisplayName(p);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3.5 py-3 bg-[#f9f9f8] border border-[#e7e5e4] rounded-xl hover:border-[#f59e0b] hover:bg-[rgba(245,158,11,0.04)] transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-[#1c1917]">{display}</span>
                    {p.leTet
                      ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(239,68,68,0.12)] text-red-600">🎉 x3 Lễ/Tết</span>
                      : p.tangCuong
                        ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[rgba(245,158,11,0.12)] text-amber-600">⚡ +15%</span>
                        : null}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {priceStatusBadge(p)}
                    <span className="text-[10px] text-[#a8a29e]">👷 {driversText(p)}</span>
                  </div>
                  {Array.isArray(p.vehicleTags) && p.vehicleTags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {p.vehicleTags.map(v => (
                        <span key={v}
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(59,130,246,0.12)] text-[#2563eb]">
                          🚛 {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {canEdit && (
                    <button onClick={() => openEdit(p)} title="Sửa"
                      className="px-2 py-1 rounded-lg text-[10px] font-medium border border-[#e7e5e4] text-[#78716c] hover:text-[#1c1917] hover:border-[#d4d4d0] cursor-pointer">✏️</button>
                  )}
                  {canComplete && (
                    <button onClick={() => ketThuc(p.id, display)} title="Kết thúc — gửi tin rà soát cho lái xe"
                      className="px-2 py-1 rounded-lg text-[10px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer">🏁</button>
                  )}
                  {canComplete && (
                    <button
                      onClick={() => p.priceStatus === 'approved' && completePlan(p.id, display)}
                      title={p.priceStatus === 'approved' ? 'Hoàn thành kế hoạch' : 'Chờ HR/Admin duyệt đơn giá mới hoàn thành được'}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white ${p.priceStatus === 'approved' ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}>✅</button>
                  )}
                  {isApprover && (p.priceStatus === 'pending' || p.priceStatus === 'rejected') && (
                    <button onClick={() => {
                      setApprovePlan(p);
                      // Pre-populate giá hiện tại để người duyệt có thể sửa ngay
                      const preloaded = emptyPrices();
                      PRICE_TYPES.forEach(t => { preloaded[t] = String(p.dealedPrices?.[t] ?? ''); });
                      setApprovePrices(preloaded);
                      setApproveOpen(true);
                    }} title="Duyệt / từ chối đơn giá"
                      className="px-2 py-1 rounded-lg text-[10px] font-medium bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white cursor-pointer">🛡️</button>
                  )}
                  {canDelete && (
                    <button onClick={() => deletePlan(p.id, display)} title="Xóa"
                      className="px-2 py-1 rounded-lg text-[10px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">✕</button>
                  )}
                </div>
              </div>
            );
          })}
          {allShippingLines.length === 0 && <div className="text-center w-full py-10 text-[#78716c] text-sm">Chưa có kế hoạch</div>}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* ── Form thêm kế hoạch ── */}
      {canCreate && (
      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl overflow-hidden sticky top-20">
        <div className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-5 py-3.5">
          <h3 className="text-sm font-bold text-white">➕ Thêm kế hoạch mới</h3>
          <p className="text-white/70 text-[10px] mt-0.5">Tàu, tuyến đường và phân công lái xe</p>
        </div>
        <div className="p-5 space-y-3">
          {/* Thông tin cơ bản */}
          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
              <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">Thông tin kế hoạch <span className="text-red-400">*</span></span>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Tên kế hoạch / Tên Tàu</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="vd: Kế hoạch A"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Số chuyến</label>
                  <input type="text" value={soChuyen} onChange={e => setSoChuyen(e.target.value)} placeholder="CH01"
                    className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Ngày</label>
                  <input type="date" value={ngay} onChange={e => setNgay(e.target.value)}
                    className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Khách hàng <span className="text-red-400">*</span></label>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] cursor-pointer">
                  <option value="">-- Chọn khách hàng --</option>
                  {activeCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.mst ? ` (MST: ${c.mst})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tuyến đường */}
          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
              <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">Tuyến đường</span>
            </div>
            <div className="p-3">
              <div className="flex gap-1 mb-2">
                {ROUTE_TYPES.map(t => (
                  <label key={t}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                      routeTypeFilter === t
                        ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.15)] text-[#f59e0b]'
                        : 'border-[#e7e5e4] text-[#78716c] hover:border-[#f59e0b]'
                    }`}
                    onClick={() => setRouteTypeFilter(t)}>
                    {t}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 p-2 border border-[#e7e5e4] rounded-lg max-h-[120px] overflow-y-auto bg-[#f9f9f8]">
                {(routeTypeFilter === 'Tất cả' ? allRoutes : allRoutes.filter(r => r.type === routeTypeFilter)).length > 0
                  ? (routeTypeFilter === 'Tất cả' ? allRoutes : allRoutes.filter(r => r.type === routeTypeFilter)).map(r => (
                  <label key={r.id}
                    className={`px-2 py-1 rounded-lg text-[10px] border cursor-pointer transition-all ${
                      routeName === r.name
                        ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.15)] font-semibold text-[#d97706]'
                        : 'border-[#e7e5e4] hover:border-[#f59e0b] text-[#78716c]'
                    }`}
                    onClick={() => setRouteName(routeName === r.name ? '' : r.name)}>
                    🛤️ {r.name}
                  </label>
                )) : <span className="text-[10px] text-[#a8a29e]">Chưa có tuyến đường</span>}
              </div>
            </div>
          </div>

          {/* Lái xe */}
          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
              <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">Phân công lái xe</span>
            </div>
            <div className="p-3">
              <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
                <input type="checkbox" checked={allDrivers} onChange={e => setAllDrivers(e.target.checked)}
                  className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
                <span className="text-xs font-medium text-[#78716c]">Tất cả lái xe</span>
              </label>
              {!allDrivers && renderDriverChips(driverIds, setDriverIds)}
            </div>
          </div>

          {/* Loại tàu */}
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none flex-1 px-3 py-2 border border-[#e7e5e4] rounded-lg hover:border-[#f59e0b] transition-all">
              <input type="checkbox" checked={tangCuong} onChange={e => setTangCuong(e.target.checked)}
                className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
              <span className="text-xs font-medium text-[#78716c]">⚡ Tăng Cường <span className="text-amber-600 font-bold">+15%</span></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none flex-1 px-3 py-2 border border-[#e7e5e4] rounded-lg hover:border-[#f59e0b] transition-all">
              <input type="checkbox" checked={leTet} onChange={e => setLeTet(e.target.checked)}
                className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
              <span className="text-xs font-medium text-[#78716c]">🎉 Lễ / Tết <span className="text-red-600 font-bold">x3</span></span>
            </label>
          </div>

          {/* Đơn giá deal */}
          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4] flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">💵 Đơn giá deal với khách hàng <span className="text-red-400">*</span></span>
              {hasSuggested && (
                <button onClick={applySuggestedPrice}
                  className="text-[10px] font-semibold text-[#d97706] hover:underline cursor-pointer">
                  ⤓ Điền giá đã set
                </button>
              )}
            </div>
            <div className="p-3">
              {/* Gợi ý giá từ bảng giá khách hàng */}
              {customerId && routeName && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                  <p className="text-[10px] font-bold text-amber-800 mb-1.5">
                    💡 Giá đã set cho khách + tuyến «{routeName}»
                    {loadingPrices && <span className="ml-1 font-normal text-amber-600">(đang tải...)</span>}
                  </p>
                  {!loadingPrices && !hasSuggested ? (
                    <p className="text-[10px] text-amber-700/80">Chưa có bảng giá cho tuyến này ở tháng tương ứng.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {PRICE_TYPES.map(t => {
                        const v = priceForType(t);
                        if (v === null) return null;
                        return (
                          <button key={t} type="button"
                            onClick={() => setPrices(prev => ({ ...prev, [t]: String(v) }))}
                            title={`Chạm để điền ${priceLabel(t)}`}
                            className="px-2 py-1 rounded-md bg-white border border-amber-200 hover:border-[#f59e0b] hover:bg-amber-100 transition-colors cursor-pointer">
                            <span className="text-[9px] text-amber-700 font-semibold">{priceLabel(t)}</span>
                            <span className="text-[10px] text-[#1c1917] font-bold ml-1">{v.toLocaleString('vi-VN')}₫</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {PRICE_TYPES.map(t => (
                  <div key={t}>
                    <label className="text-[10px] font-medium text-[#78716c] mb-1 block">{priceLabel(t)}</label>
                    <input type="number" min="0" value={prices[t] ?? ''} onChange={e => setPrices(prev => ({ ...prev, [t]: e.target.value }))} placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#a8a29e] mt-2">Đơn giá (₫/container) đã deal với khách hàng. Lưu để HR/Admin duyệt — sau khi duyệt mới hoàn thành kế hoạch được.</p>
            </div>
          </div>

          <button onClick={() => { setAddVendorKhac(''); setAddTenNguoiNhap(''); setAddOpen(true); }}
            className="w-full py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] cursor-pointer">
            ➕ Thêm kế hoạch
          </button>
        </div>
      </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="📋 Xác nhận thêm kế hoạch"
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={addPlanThenTotalShip} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.3)] disabled:opacity-50 cursor-pointer">
              📊 Tổng SL Tàu
            </button>
            <button onClick={addPlan} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang thêm...' : '✅ Xong'}
            </button>
          </div>
        }
      >
        <div className="mb-4">
          <label className="text-xs font-medium text-[#78716c] mb-1.5 block">Vendor khác (nếu có)</label>
          <input type="text" value={addVendorKhac} onChange={e => setAddVendorKhac(e.target.value)} placeholder="Nhập vendor khác..."
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
        </div>
        <div className="mb-2">
          <label className="text-xs font-medium text-[#78716c] mb-1.5 block">Tên người nhập</label>
          <input type="text" value={addTenNguoiNhap} onChange={e => setAddTenNguoiNhap(e.target.value)} placeholder="Nhập tên người nhập..."
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
        </div>
      </Modal>

      <Modal
        open={totalShipOpen}
        onClose={() => setTotalShipOpen(false)}
        title="📊 Nhập SL Tổng Tàu"
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setTotalShipOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
              Đóng
            </button>
            <button onClick={saveTotalShip} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </div>
        }
      >
        <div className="mb-4">
          <label className="text-xs font-medium text-[#78716c] mb-1.5 block">Kế hoạch</label>
          <div className="px-3.5 py-2.5 bg-[#f5f5f4] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917]">
            {totalShipPlan
              ? [totalShipPlan.name, totalShipPlan.soChuyen, totalShipPlan.routeName, fmtNgay(totalShipPlan.ngay)].filter(Boolean).join(' / ')
              : '—'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số hàng 20</label>
            <input type="number" min="0" value={totalShipForm.hang20} onChange={e => setTotalShipForm(f => ({ ...f, hang20: e.target.value }))} placeholder="0"
              className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số hàng 40</label>
            <input type="number" min="0" value={totalShipForm.hang40} onChange={e => setTotalShipForm(f => ({ ...f, hang40: e.target.value }))} placeholder="0"
              className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số vỏ 20</label>
            <input type="number" min="0" value={totalShipForm.vo20} onChange={e => setTotalShipForm(f => ({ ...f, vo20: e.target.value }))} placeholder="0"
              className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số vỏ 40</label>
            <input type="number" min="0" value={totalShipForm.vo40} onChange={e => setTotalShipForm(f => ({ ...f, vo40: e.target.value }))} placeholder="0"
              className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số vỏ 20FR <span className="text-[10px] text-[#a8a29e] font-normal">(1 bó = 4 cái)</span></label>
            <input type="number" min="0" value={totalShipForm.vo20fr} onChange={e => setTotalShipForm(f => ({ ...f, vo20fr: e.target.value }))} placeholder="0"
              className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Tổng số vỏ 40FR <span className="text-[10px] text-[#a8a29e] font-normal">(1 bó = 4 cái)</span></label>
            <input type="number" min="0" value={totalShipForm.vo40fr} onChange={e => setTotalShipForm(f => ({ ...f, vo40fr: e.target.value }))} placeholder="0"
              className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Vệ sinh lại <span className="text-[10px] text-[#a8a29e] font-normal">(Chuyến)</span></label>
            <input type="number" min="0" value={totalShipForm.veSinhLai} onChange={e => setTotalShipForm(f => ({ ...f, veSinhLai: e.target.value }))} placeholder="0"
              className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">Kéo về <span className="text-[10px] text-[#a8a29e] font-normal">(Chuyến)</span></label>
            <input type="number" min="0" value={totalShipForm.keoVe} onChange={e => setTotalShipForm(f => ({ ...f, keoVe: e.target.value }))} placeholder="0"
              className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1.5">TIP (x 1.000đ)</label>
            <input type="number" min="0" value={totalShipForm.tip} onChange={e => setTotalShipForm(f => ({ ...f, tip: e.target.value }))} placeholder="0"
              className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
          </div>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="✏️ Sửa kế hoạch"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">Hủy</button>
            <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          </>
        }
      >
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Tên kế hoạch/Tên Tàu <span className="text-red-500">*</span></label>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Số chuyến</label>
          <input type="text" value={editSoChuyen} onChange={e => setEditSoChuyen(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Tuyến đường</label>
          <div className="flex gap-1 mb-2">
            {ROUTE_TYPES.map(t => (
              <label key={t}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                  editRouteTypeFilter === t
                    ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.15)] text-[#f59e0b]'
                    : 'border-[#e7e5e4] text-[#78716c] hover:border-[#f59e0b]'
                }`}
                onClick={() => setEditRouteTypeFilter(t)}>
                {t}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 p-2 border border-[#e7e5e4] rounded-lg max-h-[140px] overflow-y-auto">
            {(editRouteTypeFilter === 'Tất cả' ? allRoutes : allRoutes.filter(r => r.type === editRouteTypeFilter)).length > 0
              ? (editRouteTypeFilter === 'Tất cả' ? allRoutes : allRoutes.filter(r => r.type === editRouteTypeFilter)).map(r => (
              <label key={r.id}
                className={`px-2 py-1 rounded text-[10px] border cursor-pointer ${
                  editRouteName === r.name
                    ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.15)]'
                    : 'border-[#e7e5e4] hover:border-[#f59e0b]'
                }`}
                onClick={() => setEditRouteName(editRouteName === r.name ? '' : r.name)}>
                🛤️ {r.name}
              </label>
            )) : <span className="text-[10px] text-[#78716c]">Chưa có tuyến đường</span>}
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Phân công lái xe</label>
          <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
            <input type="checkbox" checked={editAllDrivers} onChange={e => setEditAllDrivers(e.target.checked)}
              className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
            <span className="text-xs font-medium text-[#78716c]">Tất cả lái xe</span>
          </label>
          {!editAllDrivers && renderDriverChips(editDriverIds, setEditDriverIds)}
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Ngày</label>
          <input type="date" value={editNgay} onChange={e => setEditNgay(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Khách hàng</label>
          <select value={editCustomerId} onChange={e => setEditCustomerId(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] cursor-pointer">
            <option value="">-- Chọn khách hàng --</option>
            {activeCustomers.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.mst ? ` (MST: ${c.mst})` : ''}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
          <input type="checkbox" checked={editTangCuong} onChange={e => setEditTangCuong(e.target.checked)}
            className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
          <span className="text-xs font-medium text-[#78716c]">🚢 Tàu Tăng Cường <span className="text-amber-600 font-bold">+15%</span></span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={editLeTet} onChange={e => setEditLeTet(e.target.checked)}
            className="w-4 h-4 accent-[#f59e0b] cursor-pointer" />
          <span className="text-xs font-medium text-[#78716c]">🎉 Tàu Lễ, Tết <span className="text-red-600 font-bold">x3</span></span>
        </label>
        <div className="mt-4 pt-3 border-t border-[#e7e5e4]">
          <p className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide mb-2">💵 Đơn giá deal với khách hàng</p>
          <div className="grid grid-cols-2 gap-2">
            {PRICE_TYPES.map(t => (
              <div key={t}>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">{priceLabel(t)}</label>
                <input type="number" min="0" value={editPrices[t] ?? ''} onChange={e => setEditPrices(prev => ({ ...prev, [t]: e.target.value }))} placeholder="0"
                  className="w-full px-2.5 py-1.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#a8a29e] mt-2">Sửa đơn giá → kế hoạch trở về trạng thái chờ duyệt.</p>
        </div>
      </Modal>

      <Modal
        open={approveOpen}
        onClose={() => { setApproveOpen(false); setApprovePlan(null); }}
        title="🛡️ Duyệt đơn giá kế hoạch"
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => { setApproveOpen(false); setApprovePlan(null); }}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">
              Đóng
            </button>
            <button onClick={() => submitApprove('reject')} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white disabled:opacity-50 cursor-pointer">
              ❌ Từ chối
            </button>
            <button onClick={() => submitApprove('approve')} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang duyệt...' : '✅ Duyệt'}
            </button>
          </div>
        }
      >
        <div className="mb-3">
          <label className="text-xs font-medium text-[#78716c] mb-1.5 block">Kế hoạch</label>
          <div className="px-3.5 py-2.5 bg-[#f5f5f4] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917]">
            {approvePlan
              ? [approvePlan.name, approvePlan.soChuyen, approvePlan.routeName, fmtNgay(approvePlan.ngay)].filter(Boolean).join(' / ')
              : '—'}
          </div>
        </div>
        <p className="text-[11px] font-semibold text-[#1c1917] mb-2">✏️ Xem / Sửa đơn giá</p>
        <div className="grid grid-cols-2 gap-2">
          {PRICE_TYPES.map(t => (
            <div key={t}>
              <label className="text-[10px] font-medium text-[#78716c] mb-1 block">{priceLabel(t)}</label>
              <input
                type="number" min="0"
                value={approvePrices[t] ?? ''}
                onChange={e => setApprovePrices(prev => ({ ...prev, [t]: e.target.value }))}
                placeholder="0"
                className="w-full px-2.5 py-1.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#3b82f6] placeholder:text-[#a8a29e]"
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#a8a29e] mt-2">Sau khi duyệt, kế hoạch mới được phép hoàn thành. Nếu bạn sửa giá ở đây, đơn giá sẽ được cập nhật đồng thời.</p>
      </Modal>

    </div>
  );
}
