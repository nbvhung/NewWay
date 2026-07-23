import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, totalItems, onPageChange }: Props) {
  if (totalItems === 0) return null;

  const buildPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      if (!pages.includes(i)) pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    if (!pages.includes(totalPages)) pages.push(totalPages);
    return pages;
  };

  const pages = buildPages();

  return (
    <View style={styles.container}>
      <Text style={styles.summary}>
        {totalItems} bản ghi
      </Text>
      {totalPages > 1 && (
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, page === 1 && styles.btnDisabled]}
            onPress={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            <Text style={[styles.btnText, page === 1 && styles.btnTextDisabled]}>‹</Text>
          </TouchableOpacity>
          {pages.map((p, i) =>
            p === '...' ? (
              <Text key={`e${i}`} style={styles.ellipsis}>…</Text>
            ) : (
              <TouchableOpacity
                key={p}
                style={[styles.btn, p === page && styles.btnActive]}
                onPress={() => onPageChange(p as number)}
              >
                <Text style={[styles.btnText, p === page && styles.btnTextActive]}>{p}</Text>
              </TouchableOpacity>
            )
          )}
          <TouchableOpacity
            style={[styles.btn, page === totalPages && styles.btnDisabled]}
            onPress={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            <Text style={[styles.btnText, page === totalPages && styles.btnTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  summary: { fontSize: 11, color: '#64748b' },
  buttons: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  btn: {
    minWidth: 30, height: 30, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  btnActive: {
    backgroundColor: '#1a56db', borderColor: '#1a56db',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  btnTextActive: { color: '#fff' },
  btnTextDisabled: { color: '#94a3b8' },
  ellipsis: { minWidth: 30, textAlign: 'center', fontSize: 12, color: '#64748b' },
});
