import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  labelColor?: string;
  borderColor?: string;
}

function NumericInput({ label, value, onChange, labelColor = '#111827', borderColor = '#d1d5db' }: Props) {
  return (
    <View style={styles.cell}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor }]}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, ''))}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { width: '46%', flexGrow: 1 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 4, lineHeight: 16 },
  input: {
    borderWidth: 2, borderRadius: 10, padding: 10,
    fontSize: 24, fontWeight: '700', textAlign: 'center',
    backgroundColor: '#fff', color: '#111',
  },
});

export default React.memo(NumericInput);
