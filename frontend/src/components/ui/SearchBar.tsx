import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search' }: SearchBarProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrapper, focused && styles.wrapperFocused]}>
      <Ionicons name="search-outline" size={18} color={Colors.inkTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.inkTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={Colors.inkTertiary} />
        </Pressable>
      )}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: Colors.surfaceSunken,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.sm,
      height: 42,
    },
    wrapperFocused: {
      borderColor: Colors.teal,
      backgroundColor: Colors.surface,
    },
    input: {
      flex: 1,
      borderWidth: 0,
      fontSize: 15,
      color: Colors.ink,
    },
  });
