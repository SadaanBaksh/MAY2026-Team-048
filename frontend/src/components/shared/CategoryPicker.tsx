import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { CATEGORIES } from '@/data/categories';

export function CategoryPicker({ value, onChange }: { value: string; onChange: (categoryId: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {CATEGORIES.map((cat) => (
        <Chip
          key={cat.categoryId}
          label={cat.categoryName}
          icon={cat.icon}
          active={value === cat.categoryId}
          onPress={() => onChange(cat.categoryId)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
});
