import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { PublicService } from '@/types';
import { timeAgo } from '@/utils/date';

export function PublicServiceCard({
  service,
  onPress,
}: {
  service: PublicService;
  onPress?: () => void;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>
          {service.title}
        </Text>
        <Text style={styles.time}>{timeAgo(service.createdAt)}</Text>
      </View>
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={15} color={Colors.inkSecondary} />
        <Text style={styles.location} numberOfLines={1}>
          {service.location}
        </Text>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {service.description}
      </Text>
      <View style={styles.footer}>
        <View style={styles.badges}>
          <PriorityBadge priority={service.priority} />
          <StatusBadge status={service.status} />
        </View>
        <View style={styles.counts}>
          {service.reports.length > 1 && (
            <Text style={styles.count}>{service.reports.length} reports</Text>
          )}
          <Ionicons name="chatbubble-outline" size={14} color={Colors.inkTertiary} />
          <Text style={styles.count}>{service.commentCount}</Text>
        </View>
      </View>
      <Text style={styles.author}>
        {service.creatorName}
        {service.creatorBuilding ? ` · ${service.creatorBuilding}` : ''}
      </Text>
    </Card>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: { gap: Spacing.xs },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
    title: { ...Type.subtitle, color: Colors.ink, flex: 1 },
    time: { ...Type.tiny, color: Colors.inkTertiary },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    location: { ...Type.caption, color: Colors.inkSecondary, flex: 1 },
    description: { ...Type.body, color: Colors.inkSecondary },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    counts: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    count: { ...Type.tiny, color: Colors.inkTertiary },
    author: { ...Type.tiny, color: Colors.inkTertiary },
  });
