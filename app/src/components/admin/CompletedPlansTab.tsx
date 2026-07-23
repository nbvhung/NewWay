import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { shippingLinesApi } from '../../api/shipping-lines';
import { submissionsApi } from '../../api/submissions';
import { fmtNgay } from '../../utils';
import type { ShippingLine } from '../../types';

interface Props {
  user?: any;
  onRefresh?: () => void;
}

const planDisplayName = (p: ShippingLine) =>
  [p.name, p.soChuyen, p.routeName, fmtNgay(p.ngay)].filter(Boolean).join(' / ');

export default function CompletedPlansTab({ user, onRefresh }: Props) {
  const [completedPlans, setCompletedPlans] = useState<ShippingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const loadCompleted = async () => {
    setLoading(true);
    try {
      const res = await shippingLinesApi.getAllAdmin();
      const d = res.data as any;
      const all = Array.isArray(d) ? d : d.data || [];
      setCompletedPlans(all.filter((p: ShippingLine) => p.completed));
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadCompleted(); }, []);

  const exportPlan = async (p: ShippingLine) => {
    try {
      const params: Record<string, string> = { shippingLineId: String(p.id), done: 'true' };
      await submissionsApi.exportExcel(params);
      Alert.alert('Thành công', 'Đã xuất Excel');
    } catch {}
  };

  const revertPlan = (p: ShippingLine) => {
    Alert.alert('Xác nhận', `Chuyển "${planDisplayName(p)}" về chưa hoàn thành?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'OK', onPress: async () => {
        try {
          await shippingLinesApi.update(p.id, { completed: false });
          setCompletedPlans(prev => prev.filter(x => x.id !== p.id));
          onRefresh?.();
        } catch {}
      }},
    ]);
  };

  const deletePlan = (p: ShippingLine) => {
    Alert.alert('Xác nhận', `Xoá kế hoạch "${planDisplayName(p)}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
        try {
          await shippingLinesApi.delete(p.id);
          setCompletedPlans(prev => prev.filter(x => x.id !== p.id));
          onRefresh?.();
        } catch {}
      }},
    ]);
  };

  const filteredPlans = completedPlans.filter(p => {
    if (!p.ngay) return false;
    const d = new Date(p.ngay);
    return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>✅ Kế hoạch đã hoàn thành</Text>
          <TouchableOpacity onPress={loadCompleted}><Text style={{ fontSize: 16 }}>🔄</Text></TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Tháng</Text>
            <View style={styles.picker}>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                Alert.alert('Chọn tháng', '', [
                  ...Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ text: `Tháng ${m}`, onPress: () => setFilterMonth(m) })),
                  { text: 'Hủy', style: 'cancel' as const },
                ]);
              }}>
                <Text style={styles.pickerText}>Tháng {filterMonth}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Năm</Text>
            <View style={styles.picker}>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                Alert.alert('Chọn năm', '', [
                  ...Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => ({ text: String(y), onPress: () => setFilterYear(y) })),
                  { text: 'Hủy', style: 'cancel' as const },
                ]);
              }}>
                <Text style={styles.pickerText}>{filterYear}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Đang tải...</Text>
        ) : filteredPlans.length === 0 ? (
          <Text style={styles.emptyText}>Không có kế hoạch hoàn thành trong tháng này</Text>
        ) : (
          filteredPlans.map(p => {
            const display = planDisplayName(p);
            return (
              <View key={p.id} style={styles.planRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
                  <Text style={{ color: '#34d399' }}>✅</Text>
                  <Text style={styles.planName}>{display}</Text>
                </View>
                <View style={styles.planActions}>
                  <TouchableOpacity style={styles.exportPlanBtn} onPress={() => exportPlan(p)}>
                    <Text style={styles.actionText}>📥</Text>
                  </TouchableOpacity>
                  {(user?.role === 'admin' || user?.role === 'supper_admin') && (
                    <TouchableOpacity style={styles.revertBtn} onPress={() => revertPlan(p)}>
                      <Text style={styles.actionText}>↩️</Text>
                    </TouchableOpacity>
                  )}
                  {user?.role === 'supper_admin' && (
                    <TouchableOpacity style={styles.delPlanBtn} onPress={() => deletePlan(p)}>
                      <Text style={[styles.actionText, { color: '#fff' }]}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterItem: { flex: 1 },
  filterLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  picker: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' },
  pickerBtn: { padding: 10, backgroundColor: '#fff' },
  pickerText: { fontSize: 12, color: '#0f172a' },
  emptyText: { textAlign: 'center', paddingVertical: 32, fontSize: 13, color: '#64748b' },
  planRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 10, backgroundColor: '#f8fafc', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginBottom: 6,
  },
  planName: { fontSize: 12, color: '#0f172a', flex: 1 },
  planActions: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  exportPlanBtn: { padding: 4, borderRadius: 4, backgroundColor: '#10b981' },
  revertBtn: { padding: 4, borderRadius: 4, backgroundColor: '#f59e0b' },
  delPlanBtn: { padding: 4, borderRadius: 4, backgroundColor: '#ef4444' },
  actionText: { fontSize: 11 },
});
