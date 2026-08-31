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
const COMPLETE_THRESHOLD = 0.72;

interface SwipeToResolveProps {
  onResolve: () => void;
  /** Truly inert: the handle cannot be dragged at all. */
  disabled?: boolean;
  /** The handle still drags, but completing the swipe fails with a shake + message
   *  instead of resolving. Use this for "requirements not met yet". */
  blocked?: boolean;
  /** Shown under the track, and announced, when a blocked swipe is attempted. */
  blockedMessage?: string;
  loading?: boolean;
}

/** A deliberate mobile-only resolution control. Its parent decides when it is rendered. */
export function SwipeToResolve({
  onResolve,
  disabled = false,
  blocked = false,
  blockedMessage,
  loading = false,
}: SwipeToResolveProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const translateX = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const maxTranslate = useRef(0);
  const wasLoading = useRef(false);
  const [completed, setCompleted] = useState(false);
  const [showBlockedError, setShowBlockedError] = useState(false);

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

  // The swipe physically completes, then the handle shakes at the far end and springs
  // back — so a missing-requirement swipe reads as "tried and rejected", not "broken".
  const fail = () => {
    if (disabled || loading || completed) return;
    setShowBlockedError(true);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    Animated.sequence([
      Animated.timing(translateX, {
        toValue: maxTranslate.current,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.sequence(
        [10, -10, 7, -7, 4, -4, 0].map((toValue) =>
          Animated.timing(shake, { toValue, duration: 45, useNativeDriver: true }),
        ),
      ),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
    ]).start();
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

  // Clear the failure message as soon as the blocking condition is resolved.
  useEffect(() => {
    if (!blocked) setShowBlockedError(false);
  }, [blocked]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !disabled &&
          !loading &&
          !completed &&
          Math.abs(gesture.dx) > 6 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => setShowBlockedError(false),
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.max(0, Math.min(gesture.dx, maxTranslate.current)));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx >= maxTranslate.current * COMPLETE_THRESHOLD) {
            if (blocked) fail();
            else finish();
          } else {
            reset();
          }
        },
        onPanResponderTerminate: reset,
      }),
    // Recreate the responder when interactivity changes so its captured props stay current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, loading, completed, blocked],
  );

  return (
    <View style={styles.container}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel="Swipe to mark resolved"
        accessibilityHint={blocked ? blockedMessage : 'Swipe the handle to the right'}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        onAccessibilityTap={blocked ? fail : finish}
        onLayout={(event) => {
          maxTranslate.current = Math.max(
            0,
            event.nativeEvent.layout.width - THUMB_SIZE - TRACK_PADDING * 2,
          );
        }}
        style={[
          styles.track,
          disabled && styles.trackDisabled,
          showBlockedError && styles.trackError,
          { transform: [{ translateX: shake }] },
        ]}
      >
        <Text style={[styles.label, showBlockedError && styles.labelError]}>
          {loading ? 'Resolving…' : 'Swipe to resolve'}
        </Text>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.thumb,
            showBlockedError && styles.thumbError,
            { transform: [{ translateX }] },
          ]}
        >
          {loading || completed ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons
              name={showBlockedError ? 'close' : 'chevron-forward'}
              size={24}
              color={Colors.white}
            />
          )}
        </Animated.View>
      </Animated.View>
      {blocked && blockedMessage ? (
        <Text style={[styles.hint, showBlockedError && styles.hintError]}>{blockedMessage}</Text>
      ) : null}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: { gap: Spacing.xs },
    track: {
      height: THUMB_SIZE + TRACK_PADDING * 2,
      borderRadius: Radius.pill,
      backgroundColor: Colors.successSoft,
      borderWidth: 1.5,
      borderColor: Colors.success,
      justifyContent: 'center',
      padding: TRACK_PADDING,
      overflow: 'hidden',
    },
    trackDisabled: { opacity: 0.5 },
    trackError: {
      backgroundColor: Colors.dangerSoft,
      borderColor: Colors.danger,
    },
    label: {
      ...Type.bodyMedium,
      color: Colors.success,
      position: 'absolute',
      alignSelf: 'center',
      paddingLeft: THUMB_SIZE / 2,
    },
    labelError: {
      color: Colors.danger,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: Radius.pill,
      backgroundColor: Colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbError: {
      backgroundColor: Colors.danger,
    },
    hint: {
      ...Type.caption,
      color: Colors.inkSecondary,
      paddingHorizontal: Spacing.xs,
    },
    hintError: {
      color: Colors.danger,
    },
  });
