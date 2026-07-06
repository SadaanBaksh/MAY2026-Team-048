import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

export interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
}

export function RatingStars({ value, onChange, size = 22, readOnly }: RatingStarsProps) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={styles.row}>
      {stars.map((star) => {
        const filled = star <= value;
        if (readOnly) {
          return (
            <Ionicons
              key={star}
              name={filled ? 'star' : 'star-outline'}
              size={size}
              color={filled ? Colors.accent : Colors.borderStrong}
            />
          );
        }
        return (
          <Pressable
            key={star}
            hitSlop={6}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              onChange?.(star);
            }}>
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={size}
              color={filled ? Colors.accent : Colors.borderStrong}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
});
