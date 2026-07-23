import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface Props {
  message?: string;
}

export default function LoadingSpinner({ message }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1a56db" />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    minHeight: 300,
  },
  text: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
});
