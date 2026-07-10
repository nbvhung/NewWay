'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { ShippingLine } from '@/types';

export default function FormPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([]);
  const [selectedShippingLine, setSelectedShippingLine] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [hang20, setHang20] = useState('');
  const [hang40, setHang40] = useState('');
  const [vo20, setVo20] = useState('');
  const [vo40, setVo40] = useState('');
  const [vo20fr, setVo20fr] = useState('');
  const [vo40fr, setVo40fr] = useState('');
  const [veSinhLai, setVeSinhLai] = useState('');
  const [tip, setTip] = useState('');

  useEffect(() => {
    loadShippingLines();
  }, []);

  const loadShippingLines = async () => {
    try {
      const data = await api.get<ShippingLine[]>('/shipping-lines');
      setShippingLines(Array.isArray(data) ? data : (data as any).data || []);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedLine = shippingLines.find((sl) => sl.name === selectedShippingLine);

  const planDisplayName = (sl: ShippingLine) => {
    return [sl.name, sl.soChuyen, sl.routeName, sl.ngay, sl.vendor].filter(Boolean).join(' / ');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedShippingLine) {
      toast('Vui lòng chọn kế hoạch', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/submissions', {
        shippingLine: selectedShippingLine,
        route: selectedLine?.routeName || '',
        hang20,
        hang40,
        vo20,
        vo40,
        vo20fr,
        vo40fr,
        veSinhLai,
        tip,
      });
      toast('Đã gửi xác nhận thành công!', 'success');
      resetForm();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedShippingLine('');
    setHang20('');
    setHang40('');
    setVo20('');
    setVo40('');
    setVo20fr('');
    setVo40fr('');
    setVeSinhLai('');
    setTip('');
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold">📝 Nhập liệu sản lượng</h1>
        <p className="text-xs text-[#94a3b8] mt-1">Điền đầy đủ thông tin bên dưới và nhấn Gửi xác nhận</p>
      </div>

      <div className="max-w-[680px] mx-auto bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 sm:p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
              Kế hoạch <span className="text-[#ef4444]">*</span>
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-[#64748b] py-2">
                <span className="animate-spin w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full" />
                Đang tải...
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                {shippingLines.map((sl) => (
                  <label
                    key={sl.id}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 bg-[#1e293b] border rounded-lg cursor-pointer transition-all select-none hover:border-[#1a56db] hover:bg-[rgba(26,86,219,0.08)] ${
                      selectedShippingLine === sl.name
                        ? 'border-[#1a56db] bg-[rgba(26,86,219,0.12)]'
                        : 'border-[rgba(255,255,255,0.08)]'
                    }`}
                    onClick={() => {
                      setSelectedShippingLine(sl.name);
                    }}
                  >
                    <div className={`w-[18px] h-[18px] border-2 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      selectedShippingLine === sl.name ? 'border-[#1a56db]' : 'border-[rgba(255,255,255,0.08)]'
                    }`}>
                      {selectedShippingLine === sl.name && (
                        <div className="w-2 h-2 rounded-full bg-[#1a56db]" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{planDisplayName(sl)}</span>
                  </label>
                ))}
                {shippingLines.length === 0 && (
                  <p className="text-xs text-[#64748b] py-2">Chưa có kế hoạch nào. Vui lòng liên hệ admin.</p>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-[rgba(255,255,255,0.08)] my-5" />

          <div className="mb-4">
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Lái xe NW</label>
            <input
              type="text"
              value={user?.fullName || ''}
              readOnly
              className="w-full px-3.5 py-2.5 bg-[rgba(26,86,219,0.08)] border border-[rgba(26,86,219,0.3)] rounded-lg text-sm text-[#f1f5f9] cursor-default"
            />
            <small className="text-[#64748b] mt-1 block">ℹ️ Thông tin này được lấy tự động từ tài khoản đăng nhập</small>
          </div>

          <div className="h-px bg-[rgba(255,255,255,0.08)] my-5" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="mb-4 sm:mb-0">
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Tổng số hàng 20</label>
              <input type="number" min="0" value={hang20} onChange={(e) => setHang20(e.target.value)} placeholder="0"
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]" />
            </div>
            <div className="mb-4 sm:mb-0">
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Tổng số hàng 40</label>
              <input type="number" min="0" value={hang40} onChange={(e) => setHang40(e.target.value)} placeholder="0"
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]" />
            </div>
            <div className="mb-4 sm:mb-0">
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Tổng số vỏ 20</label>
              <input type="number" min="0" value={vo20} onChange={(e) => setVo20(e.target.value)} placeholder="0"
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]" />
            </div>
            <div className="mb-4 sm:mb-0">
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Tổng số vỏ 40</label>
              <input type="number" min="0" value={vo40} onChange={(e) => setVo40(e.target.value)} placeholder="0"
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]" />
            </div>
            <div className="mb-4 sm:mb-0">
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Tổng số vỏ 20FR</label>
              <input type="number" min="0" value={vo20fr} onChange={(e) => setVo20fr(e.target.value)} placeholder="0"
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]" />
            </div>
            <div className="mb-4 sm:mb-0">
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Tổng số vỏ 40FR</label>
              <input type="number" min="0" value={vo40fr} onChange={(e) => setVo40fr(e.target.value)} placeholder="0"
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Vệ sinh lại</label>
              <input type="text" value={veSinhLai} onChange={(e) => setVeSinhLai(e.target.value)} placeholder="Nhập thông tin vệ sinh lại..."
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">TIP</label>
              <input type="text" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="Nhập TIP..."
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#f1f5f9] outline-none focus:border-[#1a56db] focus:shadow-[0_0_0_3px_rgba(26,86,219,0.2)] placeholder:text-[#64748b]" />
            </div>
          </div>

          <div className="h-px bg-[rgba(255,255,255,0.08)] my-5" />

          <div className="flex items-center justify-between flex-wrap gap-3">
            <Link href="/my-data" className="text-xs font-medium text-[#94a3b8] px-3.5 py-2 rounded-lg border border-[rgba(255,255,255,0.08)] hover:text-[#f1f5f9] transition-all">
              📊 Xem dữ liệu của tôi
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3 rounded-lg bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white font-semibold text-sm shadow-[0_4px_15px_rgba(26,86,219,0.4)] transition-all hover:shadow-[0_6px_20px_rgba(26,86,219,0.5)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Đang xử lý...
                </span>
              ) : (
                '✅ Gửi xác nhận'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
