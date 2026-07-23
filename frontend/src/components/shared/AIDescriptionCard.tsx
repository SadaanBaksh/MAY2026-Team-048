import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PriorityBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CategoryPicker } from '@/components/shared/CategoryPicker';
import { PriorityPicker } from '@/components/shared/PriorityPicker';
import { Radius, Spacing, Type } from '@/constants/theme';
import { getCategoryById } from '@/data/categories';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { Priority } from '@/types';

export interface AIDescriptionCardProps {
  description: string;
  confidence: number;
  categoryId: string;
  priority: Priority;
  editable?: boolean;
  onChangeDescription?: (text: string) => void;
  onChangeCategory?: (categoryId: string) => void;
  onChangePriority?: (priority: Priority) => void;
}

export function AIDescriptionCard({
  description,
  confidence,
  categoryId,
  priority,
  editable,
  onChangeDescription,
  onChangeCategory,
  onChangePriority,
}: AIDescriptionCardProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const category = getCategoryById(categoryId);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.sparkleWrap}>
            <Ionicons name="sparkles" size={14} color={Colors.primary} />
          </View>
          <Text style={styles.headerTitle}>AI Analysis</Text>
        </View>
        <Text style={styles.confidence}>{Math.round(confidence * 100)}% confidence</Text>
      </View>

      <View style={styles.confidenceTrack}>
        <View style={[styles.confidenceFill, { width: `${Math.round(confidence * 100)}%` }]} />
      </View>

      {editable && onChangeDescription ? (
        <TextInput
          value={description}
          onChangeText={onChangeDescription}
          multiline
          style={styles.descriptionInput}
          placeholder="Describe the issue"
          placeholderTextColor={Colors.inkTertiary}
        />
      ) : (
        <Text style={styles.description}>{description}</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Category</Text>
        {editable && onChangeCategory ? (
          <CategoryPicker value={categoryId} onChange={onChangeCategory} />
        ) : (
          <View style={styles.readonlyRow}>
            <Ionicons name={category.icon} size={16} color={Colors.teal} />
            <Text style={styles.readonlyText}>{category.categoryName}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Priority</Text>
        {editable && onChangePriority && priority !== 'Emergency' ? (
          <PriorityPicker value={priority} onChange={onChangePriority} />
        ) : (
          <PriorityBadge priority={priority} />
        )}
      </View>
    </Card>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      gap: Spacing.sm,
      backgroundColor: Colors.primarySoft,
      borderColor: Colors.primaryTint,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sparkleWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...Type.captionBold,
      color: Colors.primaryDark,
    },
    confidence: {
      ...Type.tiny,
      color: Colors.primaryDark,
    },
    confidenceTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.primaryTint,
      overflow: 'hidden',
    },
    confidenceFill: {
      height: '100%',
      backgroundColor: Colors.primary,
      borderRadius: 2,
    },
    description: {
      ...Type.body,
      color: Colors.ink,
    },
    descriptionInput: {
      ...Type.body,
      color: Colors.ink,
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      minHeight: 88,
      textAlignVertical: 'top',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    section: {
      gap: 6,
    },
    sectionLabel: {
      ...Type.tiny,
      color: Colors.primaryDark,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    readonlyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    readonlyText: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
  });
