import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';
import { submissionsApi } from '../../src/api/submissions';
import { usersApi } from '../../src/api/users';
import { shippingLinesApi } from '../../src/api/shipping-lines';
import { ROLE_LABELS } from '../../src/utils';

export default function AdminScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  const isAdmin = user?.role === 'admin' || user?.role === 'supper_admin' || user?.role === 'ops' || user?.role === 'hr';
  if (!user || !isAdmin) return <Redirect href="/(tabs)/my-data" />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>⚙️ Admin Dashboard</Text>
      <Text style={styles.subtitle}>
        Đăng nhập với vai trò: {ROLE_LABELS[user.role] || user.role}
      </Text>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Thông báo', 'Chức năng đang phát triển')}>
          <Text style={styles.cardIcon}>📊</Text>
          <Text style={styles.cardTitle}>Tất cả dữ liệu</Text>
          <Text style={styles.cardDesc}>Xem, lọc, xuất Excel</Text>
        </TouchableOpacity>

        {user.role !== 'ops' && (
          <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Thông báo', 'Chức năng đang phát triển')}>
            <Text style={styles.cardIcon}>👥</Text>
            <Text style={styles.cardTitle}>Quản lý tài khoản</Text>
            <Text style={styles.cardDesc}>CRUD users</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Thông báo', 'Chức năng đang phát triển')}>
          <Text style={styles.cardIcon}>🚢</Text>
          <Text style={styles.cardTitle}>Quản lý kế hoạch</Text>
          <Text style={styles.cardDesc}>Tạo, sửa, xoá kế hoạch</Text>
        </TouchableOpacity>

        {user.role !== 'ops' && (
          <>
            <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Thông báo', 'Chức năng đang phát triển')}>
              <Text style={styles.cardIcon}>📅</Text>
              <Text style={styles.cardTitle}>Kế hoạch theo tháng</Text>
              <Text style={styles.cardDesc}>Xem theo tháng</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Thông báo', 'Chức năng đang phát triển')}>
              <Text style={styles.cardIcon}>🛤️</Text>
              <Text style={styles.cardTitle}>Quản lý tuyến đường</Text>
              <Text style={styles.cardDesc}>CRUD routes</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#64748b', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  cardDesc: { fontSize: 11, color: '#64748b' },
});
