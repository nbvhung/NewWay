import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, Switch,
} from 'react-native';
import Modal from '../Modal';
import Pagination from '../Pagination';
import { shippingLinesApi } from '../../api/shipping-lines';
import { fmtNgay } from '../../utils';
import type { ShippingLine, Route, User } from '../../types';

interface Props {
  user?: any;
  allShippingLines: ShippingLine[];
  allRoutes: Route[];
  allUsers?: User[];
  onRefresh: () => void;
}

const planDisplayName = (p: ShippingLine) =>
  [p.name, p.soChuyen, p.routeName, fmtNgay(p.ngay)].filter(Boolean).join(' / ');

export default function ShippingLinesTab({ user, allShippingLines, allRoutes, allUsers, onRefresh }: Props) {
  const drivers = (allUsers || []).filter(u => u.role === 'laixe').sort((a, b) => {
    const aStt = parseInt(a.stt || '999999', 10);
    const bStt = parseInt(b.stt || '999999', 10);
    return aStt - bStt;
  });

  const [name, setName] = useState('');
  const [soChuyen, setSoChuyen] = useState('');
  const [routeName, setRouteName] = useState('');
  const [ngay, setNgay] = useState('');
  const [tangCuong, setTangCuong] = useState(false);
  const [leTet, setLeTet] = useState(false);
  const [driverIds, setDriverIds] = useState<number[]>([]);
  const [allDrivers, setAllDrivers] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ShippingLine | null>(null);
  const [editName, setEditName] = useState('');
  const [editSoChuyen, setEditSoChuyen] = useState('');
  const [editRouteName, setEditRouteName] = useState('');
  const [editNgay, setEditNgay] = useState('');
  const [editTangCuong, setEditTangCuong] = useState(false);
  const [editLeTet, setEditLeTet] = useState(false);
  const [editDriverIds, setEditDriverIds] = useState<number[]>([]);
  const [editAllDrivers, setEditAllDrivers] = useState(true);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const activePlans = allShippingLines.filter(p => !p.completed);
  const pagedLines = activePlans.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(activePlans.length / pageSize));

  const resetForm = () => { setName(''); setSoChuyen(''); setRouteName(''); setNgay(''); setTangCuong(false); setLeTet(false); setDriverIds([]); setAllDrivers(true); };

  const addPlan = async () => {
    if (!name.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập tên kế hoạch'); return; }
    setSaving(true);
    try {
      await shippingLinesApi.create({ name: name.trim(), soChuyen: soChuyen.trim(), routeName: routeName.trim(), ngay: ngay || undefined, tangCuong, leTet, driverIds: allDrivers ? [] : driverIds, allDrivers });
      Alert.alert('Thành công', `Đã thêm: ${name.trim()}`);
      resetForm(); onRefresh();
    } catch (err: any) { Alert.alert('Lỗi', err.message || 'Thêm thất bại'); }
    finally { setSaving(false); }
  };

  const openEdit = (p: ShippingLine) => {
    setEditTarget(p);
    setEditName(p.name); setEditSoChuyen(p.soChuyen); setEditRouteName(p.routeName);
    setEditNgay(p.ngay); setEditTangCuong(p.tangCuong); setEditLeTet(p.leTet);
    try { setEditDriverIds(JSON.parse(p.driverIds || '[]')); } catch { setEditDriverIds([]); }
    setEditAllDrivers(p.allDrivers ?? true);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTarget || !editName.trim()) { Alert.alert('Lỗi', 'Tên không được để trống'); return; }
    setSaving(true);
    try {
      await shippingLinesApi.update(editTarget.id, { name: editName.trim(), soChuyen: editSoChuyen.trim(), routeName: editRouteName.trim(), ngay: editNgay || undefined, tangCuong: editTangCuong, leTet: editLeTet, driverIds: editAllDrivers ? [] : editDriverIds, allDrivers: editAllDrivers });
      Alert.alert('Thành công', 'Đã cập nhật');
      setEditOpen(false); onRefresh();
    } catch (err: any) { Alert.alert('Lỗi', err.message); }
    finally { setSaving(false); }
  };

  const completePlan = (id: number, display: string) => {
    Alert.alert('Xác nhận', `Hoàn thành kế hoạch "${display}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: '✅ OK', onPress: async () => {
        try { await shippingLinesApi.update(id, { completed: true }); onRefresh(); }
        catch (err: any) { Alert.alert('Lỗi', err.message); }
      }},
    ]);
  };

  const deletePlan = (id: number, display: string) => {
    Alert.alert('Xác nhận', `Xóa kế hoạch "${display}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
        try { await shippingLinesApi.delete(id); onRefresh(); }
        catch (err: any) { Alert.alert('Lỗi', err.message); }
      }},
    ]);
  };

  const driversText = (p: ShippingLine) => {
    if (p.allDrivers ?? false) return 'Tất cả';
    try {
      const ids = JSON.parse(p.driverIds || '[]') as number[];
      return ids.map(id => drivers.find(d => d.id === id)?.stt || `#${id}`).join(', ') || 'Không có';
    } catch { return 'Không có'; }
  };

  const renderDriverChips = (selected: number[], onChange: (ids: number[]) => void) => (
    <View style={styles.driverChipsContainer}>
      {drivers.length > 0 ? drivers.map(d => {
        const sel = selected.includes(d.id);
        return (
          <TouchableOpacity
            key={d.id}
            style={[styles.driverChip, sel && styles.driverChipSel]}
            onPress={() => onChange(sel ? selected.filter(id => id !== d.id) : [...selected, d.id])}
          >
            <Text style={[styles.driverChipText, sel && styles.driverChipTextSel]}>
              {d.stt || d.fullName || d.username}
            </Text>
          </TouchableOpacity>
        );
      }) : <Text style={{ fontSize: 10, color: '#64748b' }}>Chưa có tài khoản lái xe</Text>}
    </View>
  );

  const isAdmin = user?.role === 'admin' || user?.role === 'supper_admin';
  const isOps = user?.role === 'ops';

  return (
    <View style={styles.container}>
      {/* List */}
      <View style={styles.listCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🚢 Danh sách kế hoạch</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={{ fontSize: 16 }}>🔄</Text></TouchableOpacity>
        </View>
        {pagedLines.map(p => {
          const display = planDisplayName(p);
          return (
            <View key={p.id} style={styles.planRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName} numberOfLines={2}>
                  {display}
                  {p.leTet ? <Text style={styles.badgeRed}> x3</Text> : p.tangCuong ? <Text style={styles.badgeAmber}> +15%</Text> : null}
                </Text>
                <Text style={styles.driverAssignText}>Lái xe: {driversText(p)}</Text>
              </View>
              <View style={styles.planActions}>
                <TouchableOpacity style={styles.editPlanBtn} onPress={() => openEdit(p)}>
                  <Text style={styles.actionBtnText}>✏️</Text>
                </TouchableOpacity>
                {(isOps || isAdmin) && (
                  <TouchableOpacity style={styles.completeBtn} onPress={() => completePlan(p.id, display)}>
                    <Text style={styles.actionBtnText}>✅</Text>
                  </TouchableOpacity>
                )}
                {isAdmin && (
                  <TouchableOpacity style={styles.delPlanBtn} onPress={() => deletePlan(p.id, display)}>
                    <Text style={styles.actionBtnTextDel}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        {allShippingLines.length === 0 && <Text style={styles.emptyText}>Chưa có kế hoạch</Text>}
        <Pagination page={page} totalPages={totalPages} totalItems={activePlans.length} onPageChange={setPage} />
      </View>

      {/* Add form */}
      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>➕ Thêm kế hoạch</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tên kế hoạch/Tên Tàu *" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={soChuyen} onChangeText={setSoChuyen} placeholder="Số chuyến" placeholderTextColor="#94a3b8" />
        <Text style={styles.fieldLabel}>Tuyến đường</Text>
        <View style={styles.routeRow}>
          {allRoutes.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.routeChip, routeName === r.name && styles.routeChipSel]}
              onPress={() => setRouteName(routeName === r.name ? '' : r.name)}
            >
              <Text style={[styles.routeChipText, routeName === r.name && styles.routeChipTextSel]}>🛤️ {r.name}</Text>
            </TouchableOpacity>
          ))}
          {allRoutes.length === 0 && <Text style={{ fontSize: 10, color: '#64748b' }}>Chưa có tuyến đường</Text>}
        </View>
        <TextInput style={styles.input} value={ngay} onChangeText={setNgay} placeholder="Ngày (YYYY-MM-DD)" placeholderTextColor="#94a3b8" />
        <View style={styles.switchRow}>
          <Switch value={tangCuong} onValueChange={setTangCuong} trackColor={{ false: '#e2e8f0', true: 'rgba(245,158,11,0.3)' }} thumbColor={tangCuong ? '#d97706' : '#cbd5e1'} />
          <Text style={styles.switchLabel}>🚢 Tàu Tăng Cường <Text style={{ color: '#d97706', fontWeight: '700' }}>+15%</Text></Text>
        </View>
        <View style={styles.switchRow}>
          <Switch value={leTet} onValueChange={setLeTet} trackColor={{ false: '#e2e8f0', true: 'rgba(239,68,68,0.3)' }} thumbColor={leTet ? '#dc2626' : '#cbd5e1'} />
          <Text style={styles.switchLabel}>🎉 Tàu Lễ, Tết <Text style={{ color: '#dc2626', fontWeight: '700' }}>x3</Text></Text>
        </View>
        <Text style={styles.fieldLabel}>Phân công lái xe</Text>
        <View style={styles.switchRow}>
          <Switch value={allDrivers} onValueChange={setAllDrivers} trackColor={{ false: '#e2e8f0', true: 'rgba(26,86,219,0.3)' }} thumbColor={allDrivers ? '#1a56db' : '#cbd5e1'} />
          <Text style={styles.switchLabel}>Tất cả lái xe</Text>
        </View>
        {!allDrivers && renderDriverChips(driverIds, setDriverIds)}
        <TouchableOpacity style={[styles.addBtn, saving && { opacity: 0.5 }]} onPress={addPlan} disabled={saving}>
          <Text style={styles.addBtnText}>➕ Thêm kế hoạch</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="✏️ Sửa kế hoạch"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditOpen(false)}><Text style={styles.cancelBtnText}>Hủy</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={saveEdit} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Đang lưu...' : '💾 Lưu'}</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Tên kế hoạch *" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={editSoChuyen} onChangeText={setEditSoChuyen} placeholder="Số chuyến" placeholderTextColor="#94a3b8" />
        <Text style={styles.fieldLabel}>Tuyến đường</Text>
        <View style={styles.routeRow}>
          {allRoutes.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[styles.routeChip, editRouteName === r.name && styles.routeChipSel]}
              onPress={() => setEditRouteName(editRouteName === r.name ? '' : r.name)}
            >
              <Text style={[styles.routeChipText, editRouteName === r.name && styles.routeChipTextSel]}>🛤️ {r.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} value={editNgay} onChangeText={setEditNgay} placeholder="Ngày (YYYY-MM-DD)" placeholderTextColor="#94a3b8" />
        <View style={styles.switchRow}>
          <Switch value={editTangCuong} onValueChange={setEditTangCuong} trackColor={{ false: '#e2e8f0', true: 'rgba(245,158,11,0.3)' }} thumbColor={editTangCuong ? '#d97706' : '#cbd5e1'} />
          <Text style={styles.switchLabel}>🚢 Tăng Cường +15%</Text>
        </View>
        <View style={styles.switchRow}>
          <Switch value={editLeTet} onValueChange={setEditLeTet} trackColor={{ false: '#e2e8f0', true: 'rgba(239,68,68,0.3)' }} thumbColor={editLeTet ? '#dc2626' : '#cbd5e1'} />
          <Text style={styles.switchLabel}>🎉 Lễ, Tết x3</Text>
        </View>
        <Text style={styles.fieldLabel}>Phân công lái xe</Text>
        <View style={styles.switchRow}>
          <Switch value={editAllDrivers} onValueChange={setEditAllDrivers} trackColor={{ false: '#e2e8f0', true: 'rgba(26,86,219,0.3)' }} thumbColor={editAllDrivers ? '#1a56db' : '#cbd5e1'} />
          <Text style={styles.switchLabel}>Tất cả lái xe</Text>
        </View>
        {!editAllDrivers && renderDriverChips(editDriverIds, setEditDriverIds)}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  listCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 12 },
  formCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginBottom: 6 },
  planName: { fontSize: 12, color: '#0f172a' },
  driverAssignText: { fontSize: 9, color: '#64748b', marginTop: 2 },
  driverChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10, padding: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, maxHeight: 120 },
  driverChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  driverChipSel: { borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.1)' },
  driverChipText: { fontSize: 10, color: '#64748b' },
  driverChipTextSel: { color: '#1a56db', fontWeight: '700' },
  badgeRed: { color: '#dc2626', fontWeight: '700' },
  badgeAmber: { color: '#d97706', fontWeight: '700' },
  planActions: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  editPlanBtn: { padding: 4, borderRadius: 4, backgroundColor: '#f59e0b' },
  completeBtn: { padding: 4, borderRadius: 4, backgroundColor: '#10b981' },
  delPlanBtn: { padding: 4, borderRadius: 4, backgroundColor: '#ef4444' },
  actionBtnText: { fontSize: 11 },
  actionBtnTextDel: { fontSize: 11, color: '#fff' },
  emptyText: { textAlign: 'center', paddingVertical: 24, fontSize: 13, color: '#64748b' },
  input: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 10, fontSize: 12, color: '#0f172a', marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  routeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  routeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  routeChipSel: { borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.1)' },
  routeChipText: { fontSize: 10, color: '#64748b' },
  routeChipTextSel: { color: '#1a56db', fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  switchLabel: { fontSize: 12, color: '#475569' },
  addBtn: { backgroundColor: '#1a56db', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1a56db' },
  saveBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
});
