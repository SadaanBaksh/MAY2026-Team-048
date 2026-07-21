import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ComponentProps, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'sm';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}

const getVariantStyles = (
  Colors: ThemeColors,
): Record<Variant, { bg: string; text: string; border?: string }> => ({
  primary: { bg: Colors.primary, text: Colors.white },
  secondary: { bg: Colors.primarySoft, text: Colors.primary },
  outline: { bg: 'transparent', text: Colors.ink, border: Colors.borderStrong },
  ghost: { bg: 'transparent', text: Colors.primary },
  danger: { bg: Colors.danger, text: Colors.white },
});

const SIZE_STYLES: Record<
  Size,
  { paddingVertical: number; paddingHorizontal: number; fontSize: number }
> = {
  sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13 },
  md: { paddingVertical: 13, paddingHorizontal: 18, fontSize: 15 },
  lg: { paddingVertical: 16, paddingHorizontal: 22, fontSize: 16 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  iconPosition = 'left',
  fullWidth,
  style,
  textColor,
}: ButtonProps) {
  const { Colors } = useTheme();
  const VARIANT_STYLES = useMemo(() => getVariantStyles(Colors), [Colors]);
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  const labelColor = textColor ?? v.text;
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={isDisabled ? undefined : handlePress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? StyleSheet.hairlineWidth * 2 : 0,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={labelColor} />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <Ionicons name={icon} size={s.fontSize + 4} color={labelColor} />
            )}
            <Text
              style={[styles.label, { color: labelColor, fontSize: s.fontSize }]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {icon && iconPosition === 'right' && (
              <Ionicons name={icon} size={s.fontSize + 4} color={labelColor} />
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  label: {
    ...Type.bodyMedium,
  },
});
