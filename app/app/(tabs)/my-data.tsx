import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';
import { submissionsApi } from '../../src/api/submissions';
import { shippingLinesApi } from '../../src/api/shipping-lines';
import Modal from '../../src/components/Modal';
import StatsCard from '../../src/components/StatsCard';
import LoadingSpinner from '../../src/components/LoadingSpinner';
import NumericInput from '../../src/components/NumericInput';
import { fmtDate, fmtNgay, formatMoney, FIELD_LABELS, MONTHS_VI } from '../../src/utils';
import type { ShippingLine, Submission, EditHistory } from '../../src/types';

interface EditFormData {
  shippingLine: string;
  shippingLineId?: number;
  route: string;
  hang20: string;
  hang40: string;
  vo20: string;
  vo40: string;
  vo20fr: string;
  vo40fr: string;
  veSinhLai: string;
  keoVe: string;
  tip: string;
}

const planDisplayName = (sl: ShippingLine) =>
  [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ');

export default function MyDataScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [data, setData] = useState<Submission[]>([]);
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editSub, setEditSub] = useState<Submission | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    shippingLine: '', route: '', hang20: '', hang40: '', vo20: '', vo40: '',
    vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '',
  });
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [salarySummary, setSalarySummary] = useState<{ totalSalary: number; count: number } | null>(null);
  const [salaryMonth, setSalaryMonth] = useState(now.getMonth() + 1);
  const [salaryYear, setSalaryYear] = useState(now.getFullYear());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [subRes, slRes] = await Promise.all([
        submissionsApi.getMy(),
        shippingLinesApi.getAll(),
      ]);
      const sd = subRes.data as any;
      setData(Array.isArray(sd) ? sd : sd.data || []);
      const sld = slRes.data as any;
      setShippingLines(Array.isArray(sld) ? sld : sld.data || []);
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalarySummary = useCallback(async (month: number, year: number) => {
    try {
      const res = await submissionsApi.getSalarySummary(month, year);
      const d = res.data as any;
      return d?.data || d || { totalSalary: 0, count: 0 };
    } catch {
      return { totalSalary: 0, count: 0 };
    }
  }, []);

  useEffect(() => {
    if (!loading) fetchSalarySummary(salaryMonth, salaryYear).then(setSalarySummary);
  }, [loading]);

  useEffect(() => {
    fetchSalarySummary(salaryMonth, salaryYear).then(setSalarySummary);
  }, [salaryMonth, salaryYear]);

  const updateField = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const openEdit = (sub: Submission) => {
    setEditSub(sub);
    const matchedPlanId = sub.shippingLineId || shippingLines.find(sl => sl.name === sub.shippingLine)?.id;
    setEditForm({
      shippingLine: sub.shippingLine,
      shippingLineId: matchedPlanId,
      route: sub.route,
      hang20: sub.hang20 || '', hang40: sub.hang40 || '', vo20: sub.vo20 || '', vo40: sub.vo40 || '',
      vo20fr: sub.vo20fr || '', vo40fr: sub.vo40fr || '', veSinhLai: sub.veSinhLai || '',
      keoVe: sub.keoVe || '', tip: sub.tip || '',
    });
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editSub) return;
    if (!editForm.shippingLineId && !editForm.shippingLine) {
      Alert.alert('Lỗi', 'Vui lòng chọn kế hoạch');
      return;
    }
    setSaving(true);
    try {
      await submissionsApi.update(editSub.id, editForm as unknown as Record<string, unknown>);
      Alert.alert('Thành công', 'Đã lưu thay đổi!');
      setEditModal(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || err.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const filteredData = data
    .filter((s) => {
      const dateStr = (s as any).planDate || s.createdAt;
      const d = new Date(dateStr);
      return d.getMonth() + 1 === viewMonth && d.getFullYear() === viewYear;
    })
    .sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return 0;
    });

  const incompleteData = filteredData.filter((s) => !s.completed);
  const completedData = filteredData.filter((s) => s.completed);

  const stats = {
    total: filteredData.length,
    edits: filteredData.reduce((sum, s) => sum + (s.editCount || 0), 0),
    todayCount: filteredData.filter((s) => (s.createdAt || '').slice(0, 10) === today).length,
  };

  const prevMonth = () => {
    const newM = viewMonth === 1 ? 12 : viewMonth - 1;
    const newY = viewMonth === 1 ? viewYear - 1 : viewYear;
    setViewMonth(newM);
    setViewYear(newY);
  };

  const nextMonth = () => {
    const newM = viewMonth === 12 ? 1 : viewMonth + 1;
    const newY = viewMonth === 12 ? viewYear + 1 : viewYear;
    if (newY > now.getFullYear() || (newY === now.getFullYear() && newM > now.getMonth() + 1)) return;
    setViewMonth(newM);
    setViewYear(newY);
  };

  const prevSalaryMonth = () => {
    const newM = salaryMonth === 1 ? 12 : salaryMonth - 1;
    const newY = salaryMonth === 1 ? salaryYear - 1 : salaryYear;
    setSalaryMonth(newM);
    setSalaryYear(newY);
  };

  const nextSalaryMonth = () => {
    const newM = salaryMonth === 12 ? 1 : salaryMonth + 1;
    const newY = salaryMonth === 12 ? salaryYear + 1 : salaryYear;
    if (newY > now.getFullYear() || (newY === now.getFullYear() && newM > now.getMonth() + 1)) return;
    setSalaryMonth(newM);
    setSalaryYear(newY);
  };

  const renderSubmission = (s: Submission, index: number, showEdit?: boolean) => (
    <View key={s.id} style={styles.subRow}>
      <View style={styles.subRowMain}>
        <View style={styles.subInfo}>
          <Text style={styles.planName}>{s.planDisplayName || s.shippingLine}</Text>
          <View style={styles.subValues}>
            <Text style={styles.subValue}>H20: {s.hang20 || '—'}</Text>
            <Text style={styles.subValue}>H40: {s.hang40 || '—'}</Text>
            <Text style={styles.subValue}>V20: {s.vo20 || '—'}</Text>
            <Text style={styles.subValue}>V40: {s.vo40 || '—'}</Text>
            <Text style={styles.subValue}>V20FR: {s.vo20fr || '—'}</Text>
            <Text style={styles.subValue}>V40FR: {s.vo40fr || '—'}</Text>
            <Text style={styles.subValue}>VSL: {s.veSinhLai || '—'}</Text>
            <Text style={styles.subValue}>KV: {s.keoVe || '—'}</Text>
            <Text style={styles.subValue}>TIP: {s.tip || '—'}</Text>
          </View>
          <View style={styles.subMeta}>
            <Text style={styles.editCount}>
              {s.editCount > 0 ? `✏️ ${s.editCount} lần sửa` : 'Chưa sửa'}
            </Text>
            {s.salary != null && user?.role !== 'ops' && (
              <Text style={styles.salary}>{formatMoney(s.salary)}</Text>
            )}
          </View>
        </View>
        {showEdit && !s.completed && (
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(s)} activeOpacity={0.7}>
            <Text style={styles.editBtnText}>✏️ Sửa</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* History for admins */}
      {editModal && editSub?.id === s.id && user?.role === 'admin' && s.history && s.history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>📜 Lịch sử chỉnh sửa ({s.history.length} lần)</Text>
          {s.history.map((h) => (
            <HistoryItem key={h.id} history={h} />
          ))}
        </View>
      )}
    </View>
  );

  const renderSection = (title: string, data: Submission[], showEdit?: boolean) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.dot, showEdit ? styles.dotAmber : styles.dotGreen]} />
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
      {data.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Chưa có bản ghi nào.</Text>
        </View>
      ) : (
        data.map((s, i) => renderSubmission(s, i, showEdit))
      )}
    </View>
  );

  if (loading) return <LoadingSpinner />;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Sản lượng của tôi</Text>
          <Text style={styles.headerSub}>Xem và chỉnh sửa các bản ghi đã nhập</Text>
        </View>
        <TouchableOpacity style={styles.newEntryBtn} onPress={() => router.push('/(tabs)')}>
          <Text style={styles.newEntryBtnText}>+ Nhập mới</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatsCard icon="📋" value={stats.total} label="Tổng kế hoạch" />
        <StatsCard icon="✏️" value={stats.edits} label="Tổng lần sửa" />
        <StatsCard icon="📅" value={stats.todayCount} label="Hôm nay" />
      </View>

      {/* Month navigator */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>
          Danh sách nhập sản lượng — {MONTHS_VI[viewMonth]}/{viewYear}
        </Text>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Text style={styles.navBtnText}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTHS_VI[viewMonth]}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Text style={styles.navBtnText}>▶</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {user?.role === 'laixe' ? (
        <>
          {renderSection('Chưa hoàn thành', incompleteData, true)}
          {renderSection('Đã hoàn thành', completedData, false)}
        </>
      ) : filteredData.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Chưa có bản ghi nào trong {MONTHS_VI[viewMonth]}/{viewYear}.</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {filteredData.map((s, i) => renderSubmission(s, i, false))}
        </View>
      )}

      {/* Salary Summary */}
      {user?.role !== 'ops' && (
        <View style={styles.salaryCard}>
          <View style={styles.salaryHeader}>
            <Text style={styles.salaryTitle}>💰 Thu nhập của bạn là:</Text>
            <View style={styles.salaryNav}>
              <TouchableOpacity onPress={prevSalaryMonth} style={styles.navBtn}>
                <Text style={styles.navBtnText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{MONTHS_VI[salaryMonth]}</Text>
              <TouchableOpacity onPress={nextSalaryMonth} style={styles.navBtn}>
                <Text style={styles.navBtnText}>▶</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.salaryAmount}>
            {formatMoney(salarySummary?.totalSalary)}
          </Text>
          <Text style={styles.salaryNote}>
            {salarySummary?.count ?? 0} bản ghi — Chưa bao gồm lương cứng, hỗ trợ,...
          </Text>
        </View>
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModal}
        onClose={() => setEditModal(false)}
        title="✏️ Chỉnh sửa bản ghi"
        footer={
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveEdit}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        {/* Plan selector */}
        <View style={styles.modalField}>
          <Text style={styles.fieldLabel}>Kế hoạch</Text>
          {user?.role === 'laixe' ? (
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyText}>
                {editForm.route ? `${editForm.shippingLine} - ${editForm.route}` : editForm.shippingLine}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.planSelectList} nestedScrollEnabled>
              {shippingLines.map((sl) => {
                const sel = editForm.shippingLineId === sl.id;
                return (
                  <TouchableOpacity
                    key={sl.id}
                    style={[styles.planSelectItem, sel && styles.planSelectItemSelected]}
                    onPress={() => setEditForm((prev) => ({
                      ...prev,
                      shippingLine: sl.name,
                      shippingLineId: sl.id,
                      route: sl.routeName || '',
                    }))}
                  >
                    <View style={[styles.radio, sel && styles.radioSelected]}>
                      {sel && <View style={styles.radioDot} />}
                    </View>
                    <Text style={styles.planSelectText} numberOfLines={2}>
                      {planDisplayName(sl)}
                      {sl.leTet ? ' x3' : sl.tangCuong ? ' +15%' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.divider} />

        {/* Fields grid */}
        <View style={styles.editFieldsGrid}>
          {([
            ['hang20', 'Tổng số hàng 20'],
            ['hang40', 'Tổng số hàng 40'],
            ['vo20', 'Tổng số vỏ 20'],
            ['vo40', 'Tổng số vỏ 40'],
            ['vo20fr', 'Tổng số vỏ 20FR'],
            ['vo40fr', 'Tổng số vỏ 40FR'],
            ['veSinhLai', 'Vệ sinh lại'],
            ['keoVe', 'Kéo về'],
            ['tip', 'TIP (x 1.000đ)'],
          ] as const).map(([field, label]) => (
            <NumericInput
              key={field}
              label={label}
              value={(editForm as any)[field] || ''}
              onChange={(v) => updateField(field, v)}
            />
          ))}
        </View>

        {/* Edit History */}
        {editSub && editSub.history && editSub.history.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>
              📜 Lịch sử chỉnh sửa ({editSub.history.length} lần)
            </Text>
            {editSub.history.map((h) => (
              <HistoryItem key={h.id} history={h} />
            ))}
          </View>
        )}
      </Modal>
    </ScrollView>
  );
}

function HistoryItem({ history }: { history: EditHistory }) {
  let changes: Record<string, { old: string; new: string }> = {};
  try {
    changes = JSON.parse(history.changes);
  } catch {
    return (
      <View style={styles.historyItem}>
        <Text style={styles.historyTime}>
          🕐 {fmtDate(history.editedAt)} — bởi {history.editedByName}
        </Text>
        <Text style={styles.historyChanges}>{history.changes}</Text>
      </View>
    );
  }

  return (
    <View style={styles.historyItem}>
      <Text style={styles.historyTime}>
        🕐 {fmtDate(history.editedAt)} — bởi {history.editedByName}
      </Text>
      {Object.entries(changes).map(([k, v]) => (
        <Text key={k} style={styles.historyChange}>
          {FIELD_LABELS[k] || k}: "<Text style={styles.oldValue}>{v.old || '(trống)'}</Text>" → "<Text style={styles.newValue}>{v.new || '(trống)'}</Text>"
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  newEntryBtn: {
    backgroundColor: '#1a56db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: '#1a56db', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  newEntryBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  section: { paddingHorizontal: 16, marginBottom: 12 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8,
  },
  sectionHeaderText: { fontSize: 13, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  dotAmber: { backgroundColor: '#f59e0b' },
  dotGreen: { backgroundColor: '#10b981' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  navBtnText: { fontSize: 12, color: '#64748b' },
  monthLabel: { fontSize: 12, fontWeight: '600', color: '#0f172a', minWidth: 60, textAlign: 'center' },
  refreshBtn: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginLeft: 4,
  },
  refreshBtnText: { fontSize: 12 },
  listContainer: { paddingHorizontal: 16, gap: 6 },
  subRow: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)', marginBottom: 6, padding: 12,
  },
  subRowMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  subInfo: { flex: 1 },
  planName: { fontSize: 14, fontWeight: '700', color: '#1a56db', marginBottom: 4 },
  subValues: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  subValue: { fontSize: 11, color: '#475569', backgroundColor: '#f8fafc', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  subMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  editCount: { fontSize: 10, color: '#64748b', backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  salary: { fontSize: 11, fontWeight: '700', color: '#10b981' },
  editBtn: {
    backgroundColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#64748b' },
  salaryCard: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 24,
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  salaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  salaryTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  salaryNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  salaryAmount: { fontSize: 26, fontWeight: '800', color: '#10b981' },
  salaryNote: { fontSize: 11, color: '#64748b', marginTop: 4 },
  modalFooter: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#1a56db',
    shadowColor: '#1a56db', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  modalField: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  readonlyField: {
    padding: 12, backgroundColor: 'rgba(148,163,184,0.1)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  readonlyText: { fontSize: 13, color: '#64748b' },
  planSelectList: { maxHeight: 200 },
  planSelectItem: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8, marginBottom: 4,
  },
  planSelectItemSelected: {
    borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.08)',
  },
  planSelectText: { fontSize: 13, color: '#0f172a', flex: 1 },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#cbd5e1',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  radioSelected: { borderColor: '#1a56db' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a56db' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 12 },
  editFieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  editInput: {
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8,
    padding: 10, fontSize: 14, backgroundColor: '#fff', color: '#0f172a',
  },
  historyContainer: { marginTop: 16 },
  historyTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  historyItem: {
    backgroundColor: '#f8fafc', borderRadius: 8, padding: 10,
    borderLeftWidth: 3, borderLeftColor: '#f59e0b', marginBottom: 6,
  },
  historyTime: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  historyChanges: { fontSize: 11, color: '#0f172a' },
  historyChange: { fontSize: 11, color: '#475569' },
  oldValue: { color: '#ef4444' },
  newValue: { color: '#10b981' },
  historySection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
});