import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';
import { shippingLinesApi } from '../../src/api/shipping-lines';
import { submissionsApi } from '../../src/api/submissions';
import NumericInput from '../../src/components/NumericInput';
import Modal from '../../src/components/Modal';
import { fmtNgay } from '../../src/utils';
import type { ShippingLine } from '../../src/types';

const planDisplayName = (sl: ShippingLine) =>
  [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ');

export default function EntryForm() {
  const { user } = useAuthStore();
  const router = useRouter();

  // Chỉ laixe mới được vào trang nhập liệu
  if (user && user.role !== 'laixe') return <Redirect href="/(tabs)/admin" />;

  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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

  // Duplicate detection
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
      const res = await shippingLinesApi.getAll();
      const d = res.data as any;
      setShippingLines(Array.isArray(d) ? d : d.data || []);
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || err.message || 'Không thể tải danh sách kế hoạch');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanClick = (sl: ShippingLine) => {
    if (mySubmissions.has(sl.id)) {
      setDuplicatePlan(sl);
    } else {
      setSelectedId(sl.id);
    }
  };

  const selectedLine = shippingLines.find((sl) => sl.id === selectedId);

  const handleSubmit = async () => {
    if (!selectedId || !selectedLine) {
      Alert.alert('Lỗi', 'Vui lòng chọn kế hoạch');
      return;
    }
    setSubmitting(true);
    try {
      await submissionsApi.create({
        shippingLine: selectedLine.name,
        shippingLineId: selectedLine.id,
        route: selectedLine.routeName || '',
        hang20, hang40, vo20, vo40, vo20fr, vo40fr,
        veSinhLai, keoVe, tip,
      });
      Alert.alert('Thành công', 'Đã gửi xác nhận thành công!');
      resetForm();
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || err.message || 'Gửi thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedId(null);
    setHang20(''); setHang40(''); setVo20(''); setVo40('');
    setVo20fr(''); setVo40fr(''); setVeSinhLai(''); setKeoVe(''); setTip('');
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Sticky blue header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>BÁO SẢN LƯỢNG</Text>
      </View>

      {/* 1. Chọn kế hoạch */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Chọn kế hoạch</Text>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#1a56db" />
            <Text style={styles.loadingText}> Đang tải danh sách kế hoạch...</Text>
          </View>
        ) : shippingLines.length === 0 ? (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Chưa có kế hoạch nào.</Text>
          </View>
        ) : (
          <ScrollView style={styles.planList} nestedScrollEnabled>
            {shippingLines.map((sl) => {
              const sel = selectedId === sl.id;
              return (
                <TouchableOpacity
                  key={sl.id}
                  style={[styles.planItem, sel && styles.planItemSelected]}
                  onPress={() => handlePlanClick(sl)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, sel && styles.radioSelected]}>
                    {sel && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.planText, sel && styles.planTextSelected]} numberOfLines={2}>
                    {planDisplayName(sl)}
                  </Text>
                  {sl.leTet ? (
                    <View style={styles.badgeRed}><Text style={styles.badgeRedText}>x3</Text></View>
                  ) : sl.tangCuong ? (
                    <View style={styles.badgeAmber}><Text style={styles.badgeAmberText}>+15%</Text></View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* 2. Lái Xe NW */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Lái Xe NW</Text>
          <View style={styles.driverBox}>
            <Text style={styles.driverName}>{user?.fullName || user?.username || '—'}</Text>
          </View>
          <Text style={styles.note}>* Dữ liệu sẽ được ghi nhận vào tài khoản này.</Text>
        </View>

        {/* 3. Nhập Sản Lượng Đã Chạy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Nhập Sản Lượng Đã Chạy</Text>

          {/* Green box */}
          <View style={[styles.fieldGroup, styles.greenBorder]}>
            <View style={styles.fieldGrid}>
              <NumericInput label="Hàng 20'" value={hang20} onChange={setHang20} />
              <NumericInput label="Hàng 40'" value={hang40} onChange={setHang40} />
              <NumericInput label="Vỏ 20'" value={vo20} onChange={setVo20} />
              <NumericInput label="Vỏ 40'" value={vo40} onChange={setVo40} />
            </View>
          </View>

          {/* Red box */}
          <View style={[styles.fieldGroup, styles.redBorder]}>
            <View style={styles.fieldGrid}>
              <NumericInput label="Hàng 20' FR" value={vo20fr} onChange={setVo20fr} labelColor="#dc2626" borderColor="#fca5a5" />
              <NumericInput label="Hàng 40' FR" value={vo40fr} onChange={setVo40fr} labelColor="#dc2626" borderColor="#fca5a5" />
            </View>
          </View>

          {/* Yellow box */}
          <View style={[styles.fieldGroup, styles.yellowBorder]}>
            <View style={styles.fieldGrid}>
              <NumericInput label="Vệ sinh lại" value={veSinhLai} onChange={setVeSinhLai} labelColor="#d97706" borderColor="#fcd34d" />
              <NumericInput label="Kéo về" value={keoVe} onChange={setKeoVe} labelColor="#d97706" borderColor="#fcd34d" />
            </View>
          </View>

          {/* TIP */}
          <View style={[styles.fieldGroup, styles.grayBorder]}>
            <View style={styles.fieldGrid}>
              <NumericInput label="TIP (×1.000đ)" value={tip} onChange={setTip} />
            </View>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? '⏳ Đang xử lý...' : '✅ GỬI XÁC NHẬN'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.viewDataBtn} onPress={() => router.push('/(tabs)/my-data')}>
          <Text style={styles.viewDataBtnText}>📊 Xem dữ liệu của tôi</Text>
        </TouchableOpacity>
      </View>

      {/* Duplicate Plan Modal */}
      <Modal
        visible={!!duplicatePlan}
        onClose={() => setDuplicatePlan(null)}
        title="⚠️ Kế hoạch đã tồn tại"
        footer={
          <View style={{ flexDirection: 'column', gap: 8 }}>
            <TouchableOpacity
              style={styles.editDupeBtn}
              onPress={() => {
                const sub = duplicatePlan ? mySubmissions.get(duplicatePlan.id) : null;
                setDuplicatePlan(null);
                if (sub) router.push(`/(tabs)/my-data?editId=${sub.id}`);
                else router.push('/(tabs)/my-data');
              }}
            >
              <Text style={styles.editDupeBtnText}>✏️ Sửa sản lượng</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelDupeBtn} onPress={() => setDuplicatePlan(null)}>
              <Text style={styles.cancelDupeBtnText}>Chọn tàu khác</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 4 }}>
          Kế hoạch này bạn đã điền rồi
        </Text>
        {duplicatePlan && (
          <Text style={{ fontSize: 12, color: '#0f172a', fontWeight: '600', textAlign: 'center' }}>
            {[duplicatePlan.name, duplicatePlan.soChuyen, duplicatePlan.routeName, fmtNgay(duplicatePlan.ngay)].filter(Boolean).join(' / ')}
          </Text>
        )}
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: '#1155cc',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1155cc',
    marginBottom: 8,
  },
  loadingBox: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#c7d9f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
  },
  planList: {
    maxHeight: 240,
  },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  planItemSelected: {
    borderColor: '#1976d2',
    backgroundColor: 'rgba(25,118,210,0.08)',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioSelected: {
    borderColor: '#1976d2',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1976d2',
  },
  planText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    flex: 1,
  },
  planTextSelected: {
    fontWeight: '700',
  },
  badgeRed: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  badgeRedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },
  badgeAmber: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  badgeAmberText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
  },
  driverBox: {
    backgroundColor: '#e8f0fe',
    borderWidth: 2,
    borderColor: '#1976d2',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  driverName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1976d2',
    letterSpacing: 1,
  },
  note: {
    fontSize: 12,
    color: '#eab308',
    fontWeight: '700',
    marginTop: 6,
  },
  fieldGroup: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  greenBorder: { borderColor: '#22c55e' },
  redBorder: { borderColor: '#ef4444' },
  yellowBorder: { borderColor: '#fbbf24' },
  grayBorder: { borderColor: '#e2e8f0' },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  submitBtn: {
    backgroundColor: '#1155cc',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#1565c0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#93c5fd',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  viewDataBtn: {
    borderWidth: 2,
    borderColor: '#1155cc',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  viewDataBtnText: {
    color: '#1155cc',
    fontSize: 14,
    fontWeight: '700',
  },
  editDupeBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  editDupeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelDupeBtn: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 11,
    alignItems: 'center',
  },
  cancelDupeBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});
