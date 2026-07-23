import { View, Text, StyleSheet } from 'react-native';

interface Props {
  icon: string;
  value: number | string;
  label: string;
}

export default function StatsCard({ icon, value, label }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  icon: {
    fontSize: 20,
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
});
