import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';

export default function TabLayout() {
  const { user } = useAuthStore();
  if (!user) return <Redirect href="/(auth)/login" />;
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Nhập liệu' }} />
      <Tabs.Screen name="my-data" options={{ title: 'Dữ liệu' }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin' }} />
    </Tabs>
  );
}
