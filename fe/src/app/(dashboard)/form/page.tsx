'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { submissionsApi } from '@/lib/api-submissions';
import { ShippingLine } from '@/types';
import { fmtNgay } from '@/lib/utils';

export default function FormPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([]);
  const [selectedShippingLineId, setSelectedShippingLineId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [hang20, setHang20] = useState('');
  const [hang40, setHang40] = useState('');
  const [vo20, setVo20] = useState('');
  const [vo40, setVo40] = useState('');
  const [vo20fr, setVo20fr] = useState('');
  const [vo40fr, setVo40fr] = useState('');
  const [veSinhLai, setVeSinhLai] = useState('');
  const [keoVe, setKeoVe] = useState('');
  const [tip, setTip] = useState('');

  const [mySubmissions, setMySubmissions] = useState<Map<number, any>>(new Map());
  const [duplicatePlan, setDuplicatePlan] = useState<ShippingLine | null>(null);

  useEffect(() => {
    loadShippingLines();
    loadMySubmissions();
  }, []);

  const loadMySubmissions = async () => {
    try {
      const res = await submissionsApi.getMy();
      const list = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
      const map = new Map<number, any>();
      list.forEach((s: any) => { if (s.shippingLineId) map.set(s.shippingLineId, s); });
      setMySubmissions(map);
    } catch {}
  };

  const loadShippingLines = async () => {
    try {
      const { data } = await shippingLinesApi.getAll();
      setShippingLines(Array.isArray(data) ? data : (data as any).data || []);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanClick = (sl: ShippingLine) => {
    if (mySubmissions.has(sl.id)) {
      setDuplicatePlan(sl);
    } else {
      setSelectedShippingLineId(sl.id);
    }
  };

  const selectedLine = shippingLines.find((sl) => sl.id === selectedShippingLineId);

  const planDisplayName = (sl: ShippingLine) => {
    return [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedShippingLineId) {
      toast('Vui lòng chọn kế hoạch', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submissionsApi.create({
        shippingLine: selectedLine?.name || '',
        shippingLineId: selectedLine?.id || undefined,
        route: selectedLine?.routeName || '',
        hang20,
        hang40,
        vo20,
        vo40,
        vo20fr,
        vo40fr,
        veSinhLai,
        keoVe,
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
    setSelectedShippingLineId('');
    setHang20('');
    setHang40('');
    setVo20('');
    setVo40('');
    setVo20fr('');
    setVo40fr('');
    setVeSinhLai('');
    setKeoVe('');
    setTip('');
    Object.values(inputRefs.current).forEach(el => {
      if (el) el.value = '';
    });
  };

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const NumCell = ({
    id,
    label,
    value,
    onChange,
    labelColor = '#111827',
    borderColor = '#d1d5db',
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    labelColor?: string;
    borderColor?: string;
  }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: labelColor, lineHeight: 1.2 }}>{label}</label>
      <input
        ref={(el) => { inputRefs.current[id] = el; }}
        type="text"
        inputMode="numeric"
        defaultValue={value}
        placeholder="0"
        onBlur={(e) => {
          const v = e.target.value.replace(/\D/g, '');
          onChange(v);
        }}
        style={{
          width: '100%',
          padding: '10px 8px',
          fontSize: 26,
          fontWeight: 700,
          textAlign: 'center',
          border: `2px solid ${borderColor}`,
          borderRadius: 10,
          outline: 'none',
          background: '#fff',
          color: '#111',
          boxSizing: 'border-box',
        } as React.CSSProperties}
      />
    </div>
  );

  return (
    <>
      {/* Hide number input spinners */}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div style={{ maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* ── Sticky blue header ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'linear-gradient(135deg,#1155cc,#1976d2)',
          borderRadius: 12,
          marginBottom: 18,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px' }}>
            <h1 style={{
              margin: 0, textAlign: 'center', color: '#fff',
              fontSize: 18, fontWeight: 900, letterSpacing: 0.8,
            }}>
              BÁO SẢN LƯỢNG
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── 1. Chọn kế hoạch ── */}
          <section>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#1155cc', marginBottom: 8 }}>1. Chọn kế hoạch</p>
            {loading ? (
              <div style={{
                padding: 14, background: '#fff', borderRadius: 10,
                border: '2px solid #c7d9f9', textAlign: 'center', color: '#888', fontSize: 14,
              }}>
                ⏳ Đang tải danh sách kế hoạch...
              </div>
            ) : selectedShippingLineId !== '' ? (
              <div style={{
                background: '#fffbeb', border: '2px solid #f59e0b',
                borderRadius: 10, padding: '12px 16px', textAlign: 'center',
              }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#d97706', letterSpacing: 0.5 }}>
                  {planDisplayName(shippingLines.find(sl => sl.id === selectedShippingLineId)!)}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {shippingLines.map((sl) => {
                  return (
                    <div
                      key={sl.id}
                      onClick={() => handlePlanClick(sl)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px',
                        border: '2px solid #e2e8f0',
                        borderRadius: 10,
                        background: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        border: '2px solid #cbd5e1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>
                        {planDisplayName(sl)}
                      </span>
                      {sl.leTet ? <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>x3</span> : sl.tangCuong ? <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>+15%</span> : null}
                    </div>
                  );
                })}
                {shippingLines.length === 0 && (
                  <div style={{ padding: 14, textAlign: 'center', color: '#888', fontSize: 14 }}>Chưa có kế hoạch nào.</div>
                )}
              </div>
            )}
          </section>

          {selectedShippingLineId !== '' && (
          <>
          {/* ── 2. Lái xe NW ── */}
          <section>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#1155cc', marginBottom: 8 }}>2. Lái Xe NW</p>
            <div style={{
              background: '#e8f0fe', border: '2px solid #1976d2',
              borderRadius: 10, padding: '14px 16px', textAlign: 'center',
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#1976d2', letterSpacing: 1 }}>
                {user?.fullName || user?.username || '—'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#eab308', fontWeight: 700, marginTop: 6 }}>
              * Dữ liệu sẽ được ghi nhận vào tài khoản này.
            </p>
          </section>

          {/* ── 3. Nhập Sản Lượng Đã Chạy ── */}
          <section>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#1155cc', marginBottom: 10 }}>3. Nhập Sản Lượng Đã Chạy</p>

            {/* Green box – Standard containers */}
            <div style={{
              border: '2px solid #22c55e', borderRadius: 12,
              padding: '14px 12px', background: '#fff',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              marginBottom: 10,
            }}>
              <NumCell id="hang20" label="Hàng 20'" value={hang20} onChange={setHang20} borderColor="#d1d5db" />
              <NumCell id="hang40" label="Hàng 40'" value={hang40} onChange={setHang40} borderColor="#d1d5db" />
              <NumCell id="vo20"  label="Vỏ 20'"  value={vo20}  onChange={setVo20}  borderColor="#d1d5db" />
              <NumCell id="vo40"  label="Vỏ 40'"  value={vo40}  onChange={setVo40}  borderColor="#d1d5db" />
            </div>

            {/* Red box – FR containers */}
            <div style={{
              border: '2px solid #ef4444', borderRadius: 12,
              padding: '14px 12px', background: '#fff',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              marginBottom: 10,
            }}>
              <NumCell id="vo20fr" label="20FR (1 bó = 4 cái)" value={vo20fr} onChange={setVo20fr}
                labelColor="#dc2626" borderColor="#fca5a5" />
              <NumCell id="vo40fr" label="40FR (1 bó = 4 cái)" value={vo40fr} onChange={setVo40fr}
                labelColor="#dc2626" borderColor="#fca5a5" />
            </div>

            {/* Yellow box – Extra trip services */}
            <div style={{
              border: '2px solid #fbbf24', borderRadius: 12,
              padding: '14px 12px', background: '#fff',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              marginBottom: 10,
            }}>
              <NumCell id="veSinhLai" label="Vệ sinh lại (chuyến)" value={veSinhLai} onChange={setVeSinhLai}
                labelColor="#d97706" borderColor="#fcd34d" />
              <NumCell id="keoVe" label="Kéo về (chuyến)" value={keoVe} onChange={setKeoVe}
                labelColor="#d97706" borderColor="#fcd34d" />
            </div>

            {/* TIP */}
            <div style={{
              border: '2px solid #e2e8f0', borderRadius: 12,
              padding: '14px 12px', background: '#fff',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <NumCell id="tip" label="TIP (×1.000đ)" value={tip} onChange={setTip} borderColor="#d1d5db" />
            </div>
          </section>
          </>
          )}

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '16px',
              background: submitting
                ? '#93c5fd'
                : 'linear-gradient(135deg,#1155cc,#1976d2)',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 900, letterSpacing: 0.5,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: submitting ? 'none' : '0 4px 16px rgba(21,101,192,0.4)',
            }}
          >
            {submitting ? '⏳ Đang xử lý...' : '✅ GỬI XÁC NHẬN'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/my-data')}
            style={{
              width: '100%', padding: '13px',
              background: 'transparent', color: '#1155cc',
              border: '2px solid #1155cc', borderRadius: 12,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              marginBottom: 24,
            }}
          >
            📊 Xem dữ liệu của tôi
          </button>
        </form>
      </div>

      {duplicatePlan && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, maxWidth: 340, width: '100%',
            padding: '24px 20px 20px', position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <button onClick={() => setDuplicatePlan(null)}
              style={{
                position: 'absolute', top: 12, right: 14, background: 'none', border: 'none',
                fontSize: 20, color: '#94a3b8', cursor: 'pointer', lineHeight: 1, padding: 0,
              }}>✕</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
                Kế hoạch này bạn đã điền rồi
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
                {planDisplayName(duplicatePlan)}
              </p>
              <button onClick={() => {
                const sub = mySubmissions.get(duplicatePlan.id);
                router.push(sub ? `/my-data?editId=${sub.id}` : '/my-data');
              }}
                style={{
                  width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                }}>
                ✏️ Sửa sản lượng
              </button>
              <button onClick={() => setDuplicatePlan(null)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: '2px solid #e2e8f0',
                  background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', marginTop: 8,
                }}>
                Chọn tàu khác
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
