import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { PriorityColors } from '@/constants/theme';
import type { Priority } from '@/types';

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (priority: Priority) => void }) {
  return (
    <View style={styles.row}>
      {PRIORITIES.map((p) => (
        <Chip key={p} label={p} active={value === p} onPress={() => onChange(p)} color={PriorityColors[p].text} />
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
