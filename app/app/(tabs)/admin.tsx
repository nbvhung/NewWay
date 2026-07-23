import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';
import DataTab from '../../src/components/admin/DataTab';
import UsersTab from '../../src/components/admin/UsersTab';
import ShippingLinesTab from '../../src/components/admin/ShippingLinesTab';
import RoutesTab from '../../src/components/admin/RoutesTab';
import MonthlyPlansTab from '../../src/components/admin/MonthlyPlansTab';
import CompletedPlansTab from '../../src/components/admin/CompletedPlansTab';
import LoadingSpinner from '../../src/components/LoadingSpinner';
import { usersApi } from '../../src/api/users';
import { shippingLinesApi } from '../../src/api/shipping-lines';
import { routesApi } from '../../src/api/routes';
import { ROLE_LABELS } from '../../src/utils';
import type { User, ShippingLine, Route } from '../../src/types';

type Tab = 'data' | 'users' | 'shipping-lines' | 'routes' | 'monthly-plans' | 'completed-plans';

function getTabs(role?: string): { key: Tab; label: string; icon: string }[] {
  // hr: chỉ có Lương chuyến (data) và Tuyến đường (routes)
  if (role === 'hr') {
    return [
      { key: 'data', label: 'Lương chuyến', icon: '📊' },
      { key: 'routes', label: 'Tuyến đường', icon: '🛤️' },
    ];
  }


  const label = role === 'ops' ? 'Thống kê' : 'Tất cả dữ liệu';
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'data', label, icon: '📊' },
  ];
  if (role === 'ops' || role === 'admin' || role === 'supper_admin') {
    tabs.push({ key: 'shipping-lines', label: role === 'ops' ? 'Tạo kế hoạch' : 'Kế hoạch', icon: '🚢' });
  }
  if (role === 'ops' || role === 'admin' || role === 'supper_admin') {
    tabs.push({ key: 'monthly-plans', label: 'Theo tháng', icon: '📅' });
  }
  if (role === 'ops' || role === 'admin' || role === 'supper_admin') {
    tabs.push({ key: 'completed-plans', label: 'Đã hoàn thành', icon: '✅' });
  }
  if (role === 'admin' || role === 'supper_admin') {
    tabs.push({ key: 'users', label: 'Tài khoản', icon: '👥' });
  }
  if (role !== 'ops') {
    tabs.push({ key: 'routes', label: 'Tuyến đường', icon: '🛤️' });
  }
  return tabs;
}

export default function AdminScreen() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'supper_admin' || user?.role === 'ops' || user?.role === 'hr';
  if (!user || !isAdmin) return <Redirect href="/(tabs)/my-data" />;

  const TABS = getTabs(user.role);
  const [activeTab, setActiveTab] = useState<Tab>('data');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allShippingLines, setAllShippingLines] = useState<ShippingLine[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadUsers(), loadShippingLines(), loadRoutes()]).finally(() => setLoading(false));
  }, []);

  const loadUsers = async () => {
    try { const res = await usersApi.getAll(); const d = res.data as any; setAllUsers(Array.isArray(d) ? d : d.data || []); } catch {}
  };
  const loadShippingLines = async () => {
    try { const res = await shippingLinesApi.getAllAdmin(); const d = res.data as any; setAllShippingLines(Array.isArray(d) ? d : d.data || []); } catch {}
  };
  const loadRoutes = async () => {
    try { const res = await routesApi.getAll(); const d = res.data as any; setAllRoutes(Array.isArray(d) ? d : d.data || []); } catch {}
  };

  const refreshAll = () => { loadUsers(); loadShippingLines(); loadRoutes(); };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Quản lý</Text>
        <Text style={styles.subtitle}>{ROLE_LABELS[user.role] || user.role}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.icon} {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
        {activeTab === 'data' && (
          <DataTab user={user} allUsers={allUsers} allShippingLines={allShippingLines} onRefresh={refreshAll} />
        )}
        {activeTab === 'users' && (
          <UsersTab currentUser={user} allUsers={allUsers} onRefresh={loadUsers} />
        )}
        {activeTab === 'shipping-lines' && (
          <ShippingLinesTab user={user} allShippingLines={allShippingLines} allRoutes={allRoutes} onRefresh={() => { loadShippingLines(); loadRoutes(); }} />
        )}
        {activeTab === 'monthly-plans' && (
          <MonthlyPlansTab user={user} />
        )}
        {activeTab === 'completed-plans' && (
          <CompletedPlansTab user={user} onRefresh={loadShippingLines} />
        )}
        {activeTab === 'routes' && (
          <RoutesTab allRoutes={allRoutes} onRefresh={loadRoutes} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
  },
  title: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 11, color: '#64748b' },
  tabBar: {
    height: 40,
    flexDirection: 'row', paddingHorizontal: 12, marginBottom: 6,
  },
  tab: {
    height: 28,
    paddingHorizontal: 10, borderRadius: 6,
    marginRight: 4, backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center',
  },
  tabActive: {
    backgroundColor: '#1a56db', borderColor: '#1a56db',
  },
  tabText: { fontSize: 11, fontWeight: '600', color: '#64748b', lineHeight: 14 },
  tabTextActive: { color: '#fff' },
  tabContent: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 },
});
