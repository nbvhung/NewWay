import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import StatsCard from '../StatsCard';
import { submissionsApi } from '../../api/submissions';
import type { Submission } from '../../types';

interface Props {
  user: any;
}

const MONTHS_VI = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

export default function MonthlyPlansTab({ user }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const toDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
      const res = await submissionsApi.getAll({ from_date: fromDate, to_date: toDate });
      const d = res.data as any;
      setSubmissions(Array.isArray(d) ? d : d.data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [month, year]);

  const exportExcel = async () => {
    try {
      await submissionsApi.exportExcel({ mode: 'monthly', month: String(month), year: String(year) });
      Alert.alert('Thành công', 'Đã xuất Excel');
    } catch {}
  };

  const driverDataMap = new Map<number, any>();
  for (const sub of submissions as any[]) {
    const uid = sub.userId;
    if (!driverDataMap.has(uid)) {
      driverDataMap.set(uid, {
        fullName: sub.user?.fullName || sub.driverName || '',
        username: sub.user?.username || '',
        stt: sub.user?.stt || '',
        soXe: sub.user?.soXe || '',
        h20: 0, h40: 0, v20: 0, v40: 0, v20fr: 0, v40fr: 0, vsl: 0, tip: 0, kv: 0,
      });
    }
    const d = driverDataMap.get(uid)!;
    d.h20 += parseFloat(sub.hang20) || 0;
    d.h40 += parseFloat(sub.hang40) || 0;
    d.v20 += parseFloat(sub.vo20) || 0;
    d.v40 += parseFloat(sub.vo40) || 0;
    d.v20fr += parseFloat(sub.vo20fr) || 0;
    d.v40fr += parseFloat(sub.vo40fr) || 0;
    d.vsl += parseFloat(sub.veSinhLai) || 0;
    d.tip += parseFloat(sub.tip) || 0;
    d.kv += parseFloat(sub.keoVe) || 0;
  }

  const drivers = Array.from(driverDataMap.entries()).map(([id, d]) => ({ id, ...d }));
  drivers.sort((a, b) => (parseInt(a.stt) || 0) - (parseInt(b.stt) || 0) || a.fullName.localeCompare(b.fullName));

  let sumH20 = 0, sumH40 = 0, sumV20 = 0, sumV40 = 0, sumV20fr = 0, sumV40fr = 0, sumVsl = 0, sumKv = 0, sumTip = 0;

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <StatsCard icon="📋" value={submissions.length} label="Tổng bản ghi" />
        <StatsCard icon="🚢" value={drivers.length} label="Lái xe" />
      </View>

      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Tháng</Text>
            <View style={styles.picker}>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                Alert.alert('Chọn tháng', '', [
                  ...Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ text: `Tháng ${m}`, onPress: () => setMonth(m) })),
                  { text: 'Hủy', style: 'cancel' as const },
                ]);
              }}>
                <Text style={styles.pickerText}>{MONTHS_VI[month]}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Năm</Text>
            <View style={styles.picker}>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                Alert.alert('Chọn năm', '', [
                  ...Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => ({ text: String(y), onPress: () => setYear(y) })),
                  { text: 'Hủy', style: 'cancel' as const },
                ]);
              }}>
                <Text style={styles.pickerText}>{year}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={exportExcel}>
            <Text style={styles.exportBtnText}>📥 Xuất Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
            <Text style={styles.refreshBtnText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tableContainer}>
        {loading ? (
          <Text style={styles.emptyText}>Đang tải...</Text>
        ) : drivers.length === 0 ? (
          <Text style={styles.emptyText}>📭 Không có dữ liệu tháng {month}/{year}</Text>
        ) : (
          <ScrollView horizontal>
            <View>
              <View style={styles.tableHeader}>
                {['Xe', 'BKS', 'Lái xe', 'H20', 'H40', 'V20', 'V40', 'V20FR', 'V40FR', 'VSL', 'KV', 'TIP'].map(h => (
                  <Text key={h} style={styles.th}>{h}</Text>
                ))}
              </View>
              <ScrollView style={{ maxHeight: 350 }}>
                {drivers.map((d) => {
                  sumH20 += d.h20; sumH40 += d.h40; sumV20 += d.v20; sumV40 += d.v40;
                  sumV20fr += d.v20fr; sumV40fr += d.v40fr; sumVsl += d.vsl; sumKv += d.kv; sumTip += d.tip;
                  return (
                    <View key={d.id} style={styles.tableRow}>
                      <Text style={styles.td}>{d.stt || '—'}</Text>
                      <Text style={styles.td}>{d.soXe || '—'}</Text>
                      <Text style={styles.td}>{d.fullName}</Text>
                      <Text style={styles.td}>{d.h20 || '—'}</Text>
                      <Text style={styles.td}>{d.h40 || '—'}</Text>
                      <Text style={styles.td}>{d.v20 || '—'}</Text>
                      <Text style={styles.td}>{d.v40 || '—'}</Text>
                      <Text style={styles.td}>{d.v20fr || '—'}</Text>
                      <Text style={styles.td}>{d.v40fr || '—'}</Text>
                      <Text style={styles.td}>{d.vsl || '—'}</Text>
                      <Text style={styles.td}>{d.kv || '—'}</Text>
                      <Text style={styles.td}>{d.tip || '—'}</Text>
                    </View>
                  );
                })}
              </ScrollView>
              {/* Total row */}
              <View style={[styles.tableRow, { backgroundColor: 'rgba(26,86,219,0.08)' }]}>
                <Text style={[styles.td, { fontWeight: '700' }]}>Tổng</Text>
                <Text style={styles.td} />
                <Text style={styles.td} />
                <Text style={styles.td}>{sumH20 || ''}</Text>
                <Text style={styles.td}>{sumH40 || ''}</Text>
                <Text style={styles.td}>{sumV20 || ''}</Text>
                <Text style={styles.td}>{sumV40 || ''}</Text>
                <Text style={styles.td}>{sumV20fr || ''}</Text>
                <Text style={styles.td}>{sumV40fr || ''}</Text>
                <Text style={styles.td}>{sumVsl || ''}</Text>
                <Text style={styles.td}>{sumKv || ''}</Text>
                <Text style={styles.td}>{sumTip || ''}</Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filters: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  filterItem: { flex: 1 },
  filterLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  picker: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' },
  pickerBtn: { padding: 10, backgroundColor: '#fff' },
  pickerText: { fontSize: 12, color: '#0f172a' },
  exportBtn: { backgroundColor: '#10b981', borderRadius: 8, padding: 10, paddingHorizontal: 14 },
  exportBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  refreshBtn: { backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  refreshBtnText: { fontSize: 14 },
  tableContainer: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 4 },
  th: { minWidth: 50, paddingHorizontal: 6, fontSize: 9, fontWeight: '700', color: '#334155' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', alignItems: 'center' },
  td: { minWidth: 50, paddingHorizontal: 6, fontSize: 11, color: '#0f172a' },
  emptyText: { textAlign: 'center', paddingVertical: 40, fontSize: 13, color: '#64748b' },
});
