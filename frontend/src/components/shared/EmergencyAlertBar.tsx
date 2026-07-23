import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useTicketStore } from '@/store/ticketStore';

export function EmergencyAlertBar() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const isDesktop = useIsDesktop();
  const tickets = useTicketStore((s) => s.tickets);
  const activeEmergencyAlertId = useTicketStore((s) => s.activeEmergencyAlertId);
  const pulse = useRef(new Animated.Value(1)).current;

  const emergency = useMemo(
    () =>
      tickets.find(
        (ticket) =>
          ticket.ticketId === activeEmergencyAlertId &&
          ticket.priority === 'Emergency' &&
          ticket.status === 'Pending',
      ),
    [activeEmergencyAlertId, tickets],
  );

  useEffect(() => {
    if (!emergency) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.82, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      pulse.setValue(1);
    };
  }, [emergency, pulse]);

  if (!emergency) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        isDesktop ? styles.desktopPosition : styles.mobilePosition,
        { opacity: pulse },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open emergency service request"
        onPress={() => router.push(`/(employee)/complaint/${emergency.ticketId}`)}
        style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="warning" size={22} color={Colors.white} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>EMERGENCY REQUEST</Text>
          <Text style={styles.title} numberOfLines={1}>
            Tap to review now
          </Text>
        </View>
        <Ionicons name="chevron-up" size={24} color={Colors.white} />
      </Pressable>
    </Animated.View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      right: Spacing.lg,
      zIndex: 100,
    },
    desktopPosition: {
      bottom: Spacing.xl,
    },
    mobilePosition: {
      bottom: 88,
    },
    bar: {
      width: 264,
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      backgroundColor: Colors.danger,
      shadowColor: Colors.danger,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.85,
      shadowRadius: 18,
      elevation: 12,
    },
    barPressed: {
      transform: [{ scale: 0.98 }],
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    copy: {
      flex: 1,
      gap: 1,
    },
    eyebrow: {
      ...Type.tiny,
      color: 'rgba(255,255,255,0.8)',
      letterSpacing: 0.7,
    },
    title: {
      ...Type.bodyMedium,
      color: Colors.white,
    },
  });
