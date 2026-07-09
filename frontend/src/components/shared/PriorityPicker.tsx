import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { useTheme } from '@/hooks/useTheme';
import type { Priority } from '@/types';

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

export function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
}) {
  const { PriorityColors } = useTheme();
  return (
    <View style={styles.row}>
      {PRIORITIES.map((p) => (
        <Chip
          key={p}
          label={p}
          active={value === p}
          onPress={() => onChange(p)}
          color={PriorityColors[p].text}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
