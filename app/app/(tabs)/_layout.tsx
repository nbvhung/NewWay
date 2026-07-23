import { Redirect, Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '../../src/store/auth-store';

function LogoutButton() {
  const { logout, user } = useAuthStore();
  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };
  if (!user) return null;
  return (
    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
      <Text style={styles.logoutText}>🚪</Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { user } = useAuthStore();
  if (!user) return <Redirect href="/(auth)/login" />;

  const isAdmin = user.role === 'admin' || user.role === 'supper_admin' || user.role === 'ops' || user.role === 'hr';
  const isLaixe = user.role === 'laixe';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#f1f5f9' },
        headerTitleStyle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
        tabBarActiveTintColor: '#1a56db',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: 'rgba(0,0,0,0.06)' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerRight: () => <LogoutButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Nhập liệu',
          href: isLaixe ? undefined : null,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📝</Text>,
        }}
      />
      <Tabs.Screen
        name="my-data"
        options={{
          title: isLaixe ? 'Dữ liệu của tôi' : 'Sản lượng',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Quản lý',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logoutBtn: {
    marginRight: 12,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  logoutText: { fontSize: 14 },
});
