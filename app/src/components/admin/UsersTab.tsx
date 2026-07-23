import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert,
} from 'react-native';
import Modal from '../Modal';
import Pagination from '../Pagination';
import { usersApi } from '../../api/users';
import { ROLE_LABELS } from '../../utils';
import type { User } from '../../types';

interface Props {
  currentUser: User;
  allUsers: User[];
  onRefresh: () => void;
}

function roleBadgeColor(role: string) {
  switch (role) {
    case 'supper_admin': return { bg: 'rgba(239,68,68,0.15)', color: '#dc2626' };
    case 'admin': return { bg: 'rgba(245,158,11,0.15)', color: '#d97706' };
    case 'ops': return { bg: 'rgba(147,51,234,0.15)', color: '#7c3aed' };
    case 'hr': return { bg: 'rgba(16,185,129,0.15)', color: '#059669' };
    default: return { bg: 'rgba(37,99,235,0.15)', color: '#2563eb' };
  }
}

function canManageUser(currentRole: string, targetRole: string) {
  if (currentRole === 'supper_admin') return true;
  if (currentRole === 'admin') return targetRole !== 'supper_admin';
  if (currentRole === 'ops') return targetRole === 'laixe';
  return false;
}

function roleOptionsFor(currentRole: string) {
  if (currentRole === 'supper_admin') return ['laixe', 'ops', 'admin', 'supper_admin', 'hr'];
  if (currentRole === 'admin') return ['laixe', 'ops', 'hr'];
  return ['laixe'];
}

export default function UsersTab({ currentUser, allUsers, onRefresh }: Props) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pagedUsers = allUsers.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(allUsers.length / pageSize));

  const [newUser, setNewUser] = useState({ username: '', fullName: '', password: '', role: 'laixe', soXe: '', stt: '', sdt: '' });
  const [editModal, setEditModal] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const addUser = async () => {
    if (!newUser.username.trim() || !newUser.fullName.trim() || !newUser.password) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }
    try {
      await usersApi.create(newUser);
      Alert.alert('Thành công', `Đã thêm: ${newUser.username}`);
      setNewUser({ username: '', fullName: '', password: '', role: 'laixe', soXe: '', stt: '', sdt: '' });
      onRefresh();
    } catch (err: any) { Alert.alert('Lỗi', err.message || 'Thêm thất bại'); }
  };

  const openEdit = (u: User) => {
    setEditData({ id: u.id, fullName: u.fullName, role: u.role, soXe: u.soXe || '', stt: u.stt || '', sdt: u.sdt || '', password: '' });
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editData) return;
    try {
      const payload: Record<string, unknown> = { fullName: editData.fullName, role: editData.role, soXe: editData.soXe, stt: editData.stt, sdt: editData.sdt };
      if (editData.password) payload.password = editData.password;
      await usersApi.update(editData.id, payload);
      Alert.alert('Thành công', 'Đã cập nhật tài khoản');
      setEditModal(false);
      onRefresh();
    } catch (err: any) { Alert.alert('Lỗi', err.message || 'Cập nhật thất bại'); }
  };

  const deleteUser = (id: number) => {
    Alert.alert('Xác nhận', 'Bạn chắc chắn muốn XÓA tài khoản này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
        try { await usersApi.delete(id); onRefresh(); } catch (err: any) { Alert.alert('Lỗi', err.message); }
      }},
    ]);
  };

  const roleOptions = roleOptionsFor(currentUser.role);

  return (
    <View style={styles.container}>
      {/* Left: User list */}
      <View style={styles.listCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>👥 Danh sách tài khoản</Text>
          <TouchableOpacity onPress={onRefresh}><Text style={styles.refreshBtn}>🔄</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 400 }}>
          {pagedUsers.map(u => {
            const badge = roleBadgeColor(u.role);
            const canManage = canManageUser(currentUser.role, u.role);
            return (
              <View key={u.id} style={styles.userRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(u.fullName || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName}>{u.fullName}</Text>
                    <Text style={[styles.roleBadge, { backgroundColor: badge.bg, color: badge.color }]}>
                      {ROLE_LABELS[u.role] || u.role}
                    </Text>
                  </View>
                  <Text style={styles.userUsername}>@{u.username}</Text>
                </View>
                {canManage && (
                  <View style={styles.userActions}>
                    <TouchableOpacity style={styles.editUserBtn} onPress={() => openEdit(u)}>
                      <Text style={styles.editUserBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.delUserBtn} onPress={() => deleteUser(u.id)}>
                      <Text style={styles.delUserBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
          {allUsers.length === 0 && <Text style={styles.emptyText}>Chưa có người dùng</Text>}
        </ScrollView>
        <Pagination page={page} totalPages={totalPages} totalItems={allUsers.length} onPageChange={setPage} />
      </View>

      {/* Right: Add user form */}
      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>➕ Thêm tài khoản</Text>
        <TextInput style={styles.input} value={newUser.username} onChangeText={(t) => setNewUser({ ...newUser, username: t })} placeholder="Tên đăng nhập *" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={newUser.fullName} onChangeText={(t) => setNewUser({ ...newUser, fullName: t })} placeholder="Họ tên *" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={newUser.password} onChangeText={(t) => setNewUser({ ...newUser, password: t })} placeholder="Mật khẩu *" placeholderTextColor="#94a3b8" secureTextEntry />
        <TextInput style={styles.input} value={newUser.soXe} onChangeText={(t) => setNewUser({ ...newUser, soXe: t })} placeholder="Biển số xe" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={newUser.stt} onChangeText={(t) => setNewUser({ ...newUser, stt: t })} placeholder="STT" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={newUser.sdt} onChangeText={(t) => setNewUser({ ...newUser, sdt: t })} placeholder="Số điện thoại" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
        <Text style={styles.fieldLabel}>Vai trò</Text>
        <View style={styles.roleRow}>
          {roleOptions.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.roleChip, newUser.role === r && styles.roleChipSel]}
              onPress={() => setNewUser({ ...newUser, role: r })}
            >
              <Text style={[styles.roleChipText, newUser.role === r && styles.roleChipTextSel]}>
                {ROLE_LABELS[r] || r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={addUser}>
          <Text style={styles.addBtnText}>➕ Thêm tài khoản</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editModal}
        onClose={() => setEditModal(false)}
        title="✏️ Chỉnh sửa tài khoản"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
              <Text style={styles.saveBtnText}>💾 Lưu</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <TextInput style={styles.input} value={editData?.fullName || ''} onChangeText={(t) => setEditData({ ...editData, fullName: t })} placeholder="Họ tên" placeholderTextColor="#94a3b8" />
        <Text style={styles.fieldLabel}>Vai trò</Text>
        <View style={styles.roleRow}>
          {roleOptions.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.roleChip, editData?.role === r && styles.roleChipSel]}
              onPress={() => setEditData({ ...editData, role: r })}
            >
              <Text style={[styles.roleChipText, editData?.role === r && styles.roleChipTextSel]}>
                {ROLE_LABELS[r] || r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} value={editData?.soXe || ''} onChangeText={(t) => setEditData({ ...editData, soXe: t })} placeholder="Số xe" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={editData?.stt || ''} onChangeText={(t) => setEditData({ ...editData, stt: t })} placeholder="STT" placeholderTextColor="#94a3b8" />
        <TextInput style={styles.input} value={editData?.sdt || ''} onChangeText={(t) => setEditData({ ...editData, sdt: t })} placeholder="SĐT" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
        <TextInput style={styles.input} value={editData?.password || ''} onChangeText={(t) => setEditData({ ...editData, password: t })} placeholder="Mật khẩu mới (để trống = không đổi)" placeholderTextColor="#94a3b8" secureTextEntry />
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
  refreshBtn: { fontSize: 16 },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginBottom: 6 },
  avatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a56db', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  roleBadge: { fontSize: 9, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  userUsername: { fontSize: 10, color: '#64748b', marginTop: 2 },
  userActions: { flexDirection: 'row', gap: 4 },
  editUserBtn: { padding: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  editUserBtnText: { fontSize: 11 },
  delUserBtn: { padding: 4, borderRadius: 4, backgroundColor: '#ef4444' },
  delUserBtnText: { fontSize: 11, color: '#fff' },
  emptyText: { textAlign: 'center', paddingVertical: 24, fontSize: 13, color: '#64748b' },
  input: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 10, fontSize: 12, color: '#0f172a', marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  roleChipSel: { borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.1)' },
  roleChipText: { fontSize: 11, color: '#64748b' },
  roleChipTextSel: { color: '#1a56db', fontWeight: '700' },
  addBtn: { backgroundColor: '#1a56db', borderRadius: 8, padding: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1a56db' },
  saveBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
});
