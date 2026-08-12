import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

const THUMB_SIZE = 52;
const TRACK_PADDING = 4;

interface SwipeToResolveProps {
  onResolve: () => void;
  disabled?: boolean;
  loading?: boolean;
  disabledHint?: string;
}

/** A deliberate mobile-only resolution control. Its parent decides when it is rendered. */
export function SwipeToResolve({
  onResolve,
  disabled = false,
  loading = false,
  disabledHint,
}: SwipeToResolveProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const translateX = useRef(new Animated.Value(0)).current;
  const maxTranslate = useRef(0);
  const wasLoading = useRef(false);
  const [completed, setCompleted] = useState(false);

  const reset = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const finish = () => {
    if (disabled || loading || completed) return;
    setCompleted(true);
    Animated.timing(translateX, {
      toValue: maxTranslate.current,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onResolve();
    });
  };

  useEffect(() => {
    if (wasLoading.current && !loading && completed) {
      setCompleted(false);
      reset();
    }
    wasLoading.current = loading;
    // translateX is stable for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, completed]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !disabled &&
          !loading &&
          Math.abs(gesture.dx) > 6 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.max(0, Math.min(gesture.dx, maxTranslate.current)));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx >= maxTranslate.current * 0.72) finish();
          else reset();
        },
        onPanResponderTerminate: reset,
      }),
    // Recreate the responder when interactivity changes so it cannot capture a disabled gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, loading, completed],
  );

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="Swipe to mark resolved"
        accessibilityHint={disabled ? disabledHint : 'Swipe the handle to the right'}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        onAccessibilityTap={finish}
        onLayout={(event) => {
          maxTranslate.current = Math.max(
            0,
            event.nativeEvent.layout.width - THUMB_SIZE - TRACK_PADDING * 2,
          );
        }}
        style={[styles.track, (disabled || loading) && styles.disabled]}
      >
        <Text style={styles.label}>{loading ? 'Resolving…' : 'Swipe to resolve'}</Text>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.thumb, { transform: [{ translateX }] }]}
        >
          {loading || completed ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="chevron-forward" size={24} color={Colors.white} />
          )}
        </Animated.View>
      </View>
      {disabled && disabledHint ? <Text style={styles.hint}>{disabledHint}</Text> : null}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 6 },
    track: {
      height: THUMB_SIZE + TRACK_PADDING * 2,
      borderRadius: Radius.pill,
      backgroundColor: Colors.successSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.success,
      justifyContent: 'center',
      padding: TRACK_PADDING,
      overflow: 'hidden',
    },
    disabled: { opacity: 0.5 },
    label: {
      ...Type.bodyMedium,
      color: Colors.success,
      position: 'absolute',
      alignSelf: 'center',
      paddingLeft: THUMB_SIZE / 2,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: Radius.pill,
      backgroundColor: Colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      ...Type.tiny,
      color: Colors.inkTertiary,
      paddingHorizontal: Spacing.xs,
    },
  });
