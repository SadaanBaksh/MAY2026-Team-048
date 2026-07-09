import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  secure?: boolean;
}

export function TextField({ label, error, icon, secure, style, ...rest }: TextFieldProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          !!error && styles.inputRowError,
        ]}
      >
        {icon && <Ionicons name={icon} size={18} color={Colors.inkTertiary} style={styles.icon} />}
        <TextInput
          placeholderTextColor={Colors.inkTertiary}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, style]}
          {...rest}
        />
        {secure && (
          <Ionicons
            name={hidden ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={Colors.inkTertiary}
            onPress={() => setHidden((h) => !h)}
            suppressHighlighting
          />
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      gap: 6,
    },
    label: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      backgroundColor: Colors.surfaceMuted,
      paddingHorizontal: Spacing.sm,
      gap: Spacing.xs,
    },
    inputRowFocused: {
      borderColor: Colors.primary,
      backgroundColor: Colors.surface,
    },
    inputRowError: {
      borderColor: Colors.danger,
    },
    icon: {
      marginRight: 2,
    },
    input: {
      flex: 1,
      paddingVertical: 13,
      fontSize: 15,
      color: Colors.ink,
    },
    error: {
      ...Type.caption,
      color: Colors.danger,
    },
  });
