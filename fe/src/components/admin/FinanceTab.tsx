'use client';

import { useState, useEffect, useCallback } from 'react';
import { financeApi, FinanceEntry, FinanceAdmin, FinanceAuditLog } from '@/lib/api-finance';
import { useAuth } from '@/providers/auth-provider';

interface Props { user?: any; }

const MONTHS_VI = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN');

const COST_FIELDS = ['suaChua', 'nhienLieu', 'cpKhac'] as const;
const FIELD_LABEL: Record<string, string> = {
  suaChua: 'Sửa chữa',
  nhienLieu: 'Nhiên liệu',
  cpKhac: 'CP Khác',
  vonXe: 'Vốn xe',
  vonMooc: 'Vốn mooc',
  vonKhac: 'Vốn khác',
  note: 'Ghi chú',
};

function NumInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[#78716c] mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number" min="0" value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '0'}
          className="w-full px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#d97706] placeholder:text-[#c4c0bb]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#a8a29e]">₫</span>
      </div>
      {value && Number(value) > 0 && (
        <p className="text-[10px] text-[#a8a29e] mt-0.5">{fmt(Number(value))} ₫</p>
      )}
    </div>
  );
}

export function FinanceTab(_props: Props) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'supper_admin';

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // ── Mật khẩu xem chi phí ─────────────────────────────
  const [costPassword, setCostPassword] = useState('');   // đã xác thực, dùng gửi kèm request
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwChecking, setPwChecking] = useState(false);
  const unlocked = costPassword !== '';

  // ── Ô lọc admin (chỉ supper_admin) ────────────────────
  const [admins, setAdmins] = useState<FinanceAdmin[]>([]);
  const [targetUserId, setTargetUserId] = useState<number | ''>('');

  const [form, setForm] = useState({
    suaChua: '', nhienLieu: '', cpKhac: '',
    vonXe: '', vonMooc: '', vonKhac: '',
    note: '',
  });

  const [history, setHistory] = useState<FinanceAuditLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await financeApi.get(month, year, {
        password: unlocked ? costPassword : undefined,
        targetUserId: isSuperAdmin && targetUserId ? Number(targetUserId) : undefined,
      });
      const d: FinanceEntry = res.data as any;
      setForm({
        suaChua:   String(d.suaChua   || ''),
        nhienLieu: String(d.nhienLieu || ''),
        cpKhac:    String(d.cpKhac    || ''),
        vonXe:     String(d.vonXe     || ''),
        vonMooc:   String(d.vonMooc   || ''),
        vonKhac:   String(d.vonKhac   || ''),
        note:      d.note ?? '',
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Không tải được dữ liệu');
    } finally { setLoading(false); }
  }, [month, year, costPassword, unlocked, targetUserId, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  // Nạp danh sách admin cho ô lọc (chỉ supper_admin)
  useEffect(() => {
    if (!isSuperAdmin) return;
    financeApi.listAdmins()
      .then(r => setAdmins(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAdmins([]));
  }, [isSuperAdmin]);

  const loadHistory = useCallback(async () => {
    if (!unlocked) return;
    try {
      const r = await financeApi.getHistory(month, year, {
        password: costPassword,
        targetUserId: isSuperAdmin && targetUserId ? Number(targetUserId) : undefined,
      });
      setHistory(Array.isArray(r.data) ? r.data : []);
    } catch { setHistory([]); }
  }, [month, year, costPassword, unlocked, targetUserId, isSuperAdmin]);

  const unlock = async () => {
    setPwChecking(true); setPwError('');
    try {
      const r = await financeApi.verifyPassword(pwInput);
      if (r.data?.ok) {
        setCostPassword(pwInput);
        setPwInput('');
      } else {
        setPwError('Mật khẩu không đúng');
      }
    } catch {
      setPwError('Mật khẩu không đúng');
    } finally { setPwChecking(false); }
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await financeApi.upsert(month, year, {
        suaChua:   unlocked ? Number(form.suaChua   || 0) : undefined,
        nhienLieu: unlocked ? Number(form.nhienLieu || 0) : undefined,
        cpKhac:    unlocked ? Number(form.cpKhac    || 0) : undefined,
        vonXe:     isSuperAdmin ? Number(form.vonXe   || 0) : undefined,
        vonMooc:   isSuperAdmin ? Number(form.vonMooc || 0) : undefined,
        vonKhac:   isSuperAdmin ? Number(form.vonKhac || 0) : undefined,
        note:      form.note || null,
        ...(isSuperAdmin && targetUserId ? { targetUserId: Number(targetUserId) } : {}),
      }, { password: unlocked ? costPassword : undefined });
      setSaved(true);
      if (showHistory) loadHistory();
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Lỗi lưu dữ liệu');
    } finally { setSaving(false); }
  };

  const setF = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const totalChiPhi = COST_FIELDS.reduce((s, k) => s + Number((form as any)[k] || 0), 0);
  const totalVon    = ['vonXe', 'vonMooc', 'vonKhac'].reduce((s, k) => s + Number((form as any)[k] || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-[#1c1917]">💰 Tài Chính</h2>
          <p className="text-[11px] text-[#78716c] mt-0.5">Nhập chi phí & vốn đầu tư theo tháng</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {isSuperAdmin && (
            <select value={targetUserId} onChange={e => setTargetUserId(e.target.value ? +e.target.value : '')}
              className="px-3 py-2 text-[12px] bg-white border border-[#e7e5e4] rounded-lg outline-none cursor-pointer"
              title="Nhập/xem vốn cho admin nào">
              <option value="">— Của tôi —</option>
              {admins.map(a => (
                <option key={a.id} value={a.id}>{a.fullName} (@{a.username})</option>
              ))}
            </select>
          )}
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="px-3 py-2 text-[12px] bg-white border border-[#e7e5e4] rounded-lg outline-none cursor-pointer">
            {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{MONTHS_VI[m]}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="px-3 py-2 text-[12px] bg-white border border-[#e7e5e4] rounded-lg outline-none cursor-pointer">
            {[year+1,year,year-1,year-2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
      )}

      {/* ── Khoá chi phí: yêu cầu mật khẩu ────────────────── */}
      {!unlocked && (
        <div className="bg-white border border-[#e7e5e4] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-[16px]">🔒</div>
            <div>
              <p className="text-[13px] font-bold text-[#1c1917]">Xem chi phí</p>
              <p className="text-[10px] text-[#78716c]">Nhập mật khẩu để xem và chỉnh sửa phần chi phí</p>
            </div>
          </div>
          <div className="flex gap-2 max-w-sm">
            <input
              type="password" value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') unlock(); }}
              placeholder="Mật khẩu..."
              className="flex-1 px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-sm outline-none focus:border-[#d97706]"
            />
            <button onClick={unlock} disabled={pwChecking || !pwInput}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white bg-[#d97706] disabled:opacity-50 cursor-pointer">
              {pwChecking ? '...' : 'Mở khoá'}
            </button>
          </div>
          {pwError && <p className="text-[11px] text-red-600 mt-2">{pwError}</p>}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[#78716c] text-sm">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chi phí */}
          <div className="bg-white border border-[#e7e5e4] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-[16px]">💸</div>
              <div>
                <p className="text-[13px] font-bold text-[#1c1917]">Chi Phí</p>
                <p className="text-[10px] text-[#78716c]">Sửa chữa, nhiên liệu, chi phí khác</p>
              </div>
              {unlocked && (
                <span className="ml-auto text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">Đã mở khoá</span>
              )}
            </div>

            {!unlocked ? (
              <div className="py-8 text-center text-[12px] text-[#a8a29e]">
                🔒 Nhập mật khẩu phía trên để xem chi phí
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <NumInput label="Sửa chữa"    value={form.suaChua}   onChange={setF('suaChua')} />
                  <NumInput label="Nhiên liệu"  value={form.nhienLieu} onChange={setF('nhienLieu')} />
                  <NumInput label="CP Khác"     value={form.cpKhac}    onChange={setF('cpKhac')} />
                </div>
                {totalChiPhi > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#f5f5f4] flex justify-between">
                    <span className="text-[12px] font-semibold text-[#78716c]">Tổng chi phí</span>
                    <span className="text-[14px] font-bold text-red-600">{fmt(totalChiPhi)} ₫</span>
                  </div>
                )}
                <button onClick={() => { setShowHistory(s => { const n = !s; if (n) loadHistory(); return n; }); }}
                  className="mt-3 text-[11px] font-medium text-[#d97706] hover:underline cursor-pointer">
                  {showHistory ? '▾ Ẩn lịch sử chỉnh sửa' : '▸ Xem lịch sử chỉnh sửa'}
                </button>
              </>
            )}
          </div>

          {/* Vốn đầu tư — chỉ supper_admin */}
          <div className="bg-white border border-[#e7e5e4] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[16px]">🏗️</div>
              <div>
                <p className="text-[13px] font-bold text-[#1c1917]">Vốn Đầu Tư</p>
                <p className="text-[10px] text-[#78716c]">Xe, mooc và tài sản khác</p>
              </div>
              {!isSuperAdmin && (
                <span className="ml-auto text-[10px] text-[#a8a29e]">chỉ đọc</span>
              )}
            </div>
            {isSuperAdmin ? (
              <>
                {targetUserId && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3">
                    Đang nhập vốn cho: <strong>{admins.find(a => a.id === targetUserId)?.fullName}</strong>
                  </p>
                )}
                <div className="space-y-3">
                  <NumInput label="Xe"    value={form.vonXe}    onChange={setF('vonXe')} />
                  <NumInput label="Mooc"  value={form.vonMooc}  onChange={setF('vonMooc')} />
                  <NumInput label="Khác"  value={form.vonKhac}  onChange={setF('vonKhac')} />
                </div>
                {totalVon > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#f5f5f4] flex justify-between">
                    <span className="text-[12px] font-semibold text-[#78716c]">Tổng vốn</span>
                    <span className="text-[14px] font-bold text-blue-600">{fmt(totalVon)} ₫</span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3 opacity-80">
                {([['Xe', form.vonXe], ['Mooc', form.vonMooc], ['Khác', form.vonKhac]] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="flex justify-between px-3 py-2 bg-[#faf9f7] rounded-lg">
                    <span className="text-[12px] text-[#78716c]">{l}</span>
                    <span className="text-[12px] font-semibold text-[#1c1917]">{fmt(Number(v || 0))} ₫</span>
                  </div>
                ))}
                <p className="text-[10px] text-[#a8a29e]">* Chỉ supper_admin được chỉnh sửa vốn đầu tư.</p>
              </div>
            )}
          </div>

          {/* Lịch sử chỉnh sửa chi phí */}
          {unlocked && showHistory && (
            <div className="lg:col-span-2 bg-white border border-[#e7e5e4] rounded-xl p-5">
              <p className="text-[13px] font-bold text-[#1c1917] mb-3">🕘 Lịch sử chỉnh sửa chi phí — {MONTHS_VI[month]}/{year}</p>
              {history.length === 0 ? (
                <p className="text-[12px] text-[#a8a29e] py-4 text-center">Chưa có lịch sử chỉnh sửa</p>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {history.map(h => {
                    let changes: Record<string, { old: number; new: number }> = {};
                    try { changes = JSON.parse(h.changes); } catch {}
                    return (
                      <div key={h.id} className="rounded-lg border border-[#f5f5f4] px-4 py-2.5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[12px] font-semibold text-[#1c1917]">{h.editedByName || `User#${h.editedById}`}</span>
                          <span className="text-[10px] text-[#a8a29e]">{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {Object.entries(changes).map(([f, c]) => (
                            <span key={f} className="text-[11px] text-[#78716c]">
                              <strong className="text-[#1c1917]">{FIELD_LABEL[f] || f}</strong>: {fmt(c.old)} → <span className="text-[#d97706] font-semibold">{fmt(c.new)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving || (!unlocked && !isSuperAdmin)}
          title={!unlocked && !isSuperAdmin ? 'Nhập mật khẩu để chỉnh sửa chi phí' : undefined}
          className="px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-[#f59e0b] to-[#d97706] shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_20px_rgba(245,158,11,0.5)] transition-shadow disabled:opacity-50 cursor-pointer">
          {saving ? 'Đang lưu...' : saved ? '✅ Đã lưu!' : '💾 Lưu tháng này'}
        </button>
      </div>
    </div>
  );
}
