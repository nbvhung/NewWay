import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert,
} from 'react-native';
import Modal from '../Modal';
import Pagination from '../Pagination';
import { routesApi } from '../../api/routes';
import type { Route } from '../../types';

interface Props {
  allRoutes: Route[];
  onRefresh: () => void;
}

export default function RoutesTab({ allRoutes, onRefresh }: Props) {
  const [name, setName] = useState('');
  const [money, setMoney] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Route | null>(null);
  const [editName, setEditName] = useState('');
  const [editMoney, setEditMoney] = useState('');
  const [editEffectiveDate, setEditEffectiveDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pagedRoutes = allRoutes.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(allRoutes.length / pageSize));

  const addRoute = async () => {
    if (!name.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập tên tuyến đường'); return; }
    setSaving(true);
    try {
      await routesApi.create({ name: name.trim(), money: money ? Number(money) : undefined, effectiveDate: effectiveDate || undefined });
      Alert.alert('Thành công', `Đã thêm: ${name.trim()}`);
      setName(''); setMoney(''); setEffectiveDate(''); onRefresh();
    } catch (err: any) { Alert.alert('Lỗi', err.message || 'Thêm thất bại'); }
    finally { setSaving(false); }
  };

  const openEdit = (r: Route) => {
    setEditTarget(r);
    setEditName(r.name);
    setEditMoney(String(r.money || ''));
    setEditEffectiveDate(r.effectiveDate || '');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTarget || !editName.trim()) { Alert.alert('Lỗi', 'Tên không được để trống'); return; }
    setSaving(true);
    try {
      await routesApi.update(editTarget.id, { name: editName.trim(), money: editMoney ? Number(editMoney) : undefined, effectiveDate: editEffectiveDate || undefined });
      Alert.alert('Thành công', 'Đã cập nhật');
      setEditOpen(false); onRefresh();
    } catch (err: any) { Alert.alert('Lỗi', err.message); }
    finally { setSaving(false); }
  };

  const deleteRoute = (id: number, name: string) => {
    Alert.alert('Xác nhận', `Xóa tuyến đường "${name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
        try { await routesApi.delete(id); onRefresh(); }
        catch (err: any) { Alert.alert('Lỗi', err.message); }
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      {/* List */}
      <View style={styles.listCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🛤️ Danh sách tuyến đường</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={{ fontSize: 16 }}>🔄</Text></TouchableOpacity>
        </View>
        {pagedRoutes.map(r => (
          <View key={r.id} style={styles.routeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeName}>{r.name}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                {r.money ? <Text style={styles.routeMoney}>{r.money.toLocaleString('vi-VN')} ₫</Text> : null}
                {r.effectiveDate ? <Text style={styles.routeDate}>📅 {r.effectiveDate}</Text> : null}
              </View>
            </View>
            <View style={styles.routeActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(r)}>
                <Text style={styles.editBtnText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.delBtn} onPress={() => deleteRoute(r.id, r.name)}>
                <Text style={styles.delBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {allRoutes.length === 0 && <Text style={styles.emptyText}>Chưa có tuyến đường nào</Text>}
        <Pagination page={page} totalPages={totalPages} totalItems={allRoutes.length} onPageChange={setPage} />
      </View>

      {/* Add form */}
      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>➕ Thêm tuyến đường</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tên tuyến đường *" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={money} onChangeText={setMoney} placeholder="Tiền (VNĐ)" placeholderTextColor="#94a3b8" keyboardType="numeric" />
        <TextInput style={styles.input} value={effectiveDate} onChangeText={setEffectiveDate} placeholder="Ngày hiệu lực (YYYY-MM-DD)" placeholderTextColor="#94a3b8" />
        <TouchableOpacity style={[styles.addBtn, saving && { opacity: 0.5 }]} onPress={addRoute} disabled={saving}>
          <Text style={styles.addBtnText}>➕ Thêm tuyến đường</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="✏️ Sửa tuyến đường"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditOpen(false)}><Text style={styles.cancelBtnText}>Hủy</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={saveEdit} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Đang lưu...' : '💾 Lưu'}</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Tên tuyến đường *" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={editMoney} onChangeText={setEditMoney} placeholder="Tiền (VNĐ)" placeholderTextColor="#94a3b8" keyboardType="numeric" />
        <TextInput style={styles.input} value={editEffectiveDate} onChangeText={setEditEffectiveDate} placeholder="Ngày hiệu lực (YYYY-MM-DD)" placeholderTextColor="#94a3b8" />
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
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginBottom: 6 },
  routeName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  routeMoney: { fontSize: 11, color: '#10b981', fontWeight: '600' },
  routeDate: { fontSize: 10, color: '#1a56db', fontWeight: '600', backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  routeActions: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  editBtn: { padding: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  editBtnText: { fontSize: 11 },
  delBtn: { padding: 4, borderRadius: 4, backgroundColor: '#ef4444' },
  delBtnText: { fontSize: 11, color: '#fff' },
  emptyText: { textAlign: 'center', paddingVertical: 24, fontSize: 13, color: '#64748b' },
  input: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 10, fontSize: 12, color: '#0f172a', marginBottom: 10 },
  addBtn: { backgroundColor: '#1a56db', borderRadius: 8, padding: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1a56db' },
  saveBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
});
