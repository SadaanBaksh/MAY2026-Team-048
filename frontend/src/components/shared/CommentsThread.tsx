import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { Comment } from '@/types';

export interface CommentsThreadProps {
  comments: Comment[];
  currentUserId: string;
  onSend?: (message: string) => void;
  readOnly?: boolean;
}

export function CommentsThread({ comments }: CommentsThreadProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const count = comments.length;

  return (
    <Pressable 
      style={({ pressed }) => [styles.wrapper, pressed && { opacity: 0.8 }]} 
      onPress={() => router.push('/test-chat')}
    >
      <View style={styles.iconBox}>
        <Ionicons name="chatbubbles" size={24} color={Colors.primary} />
      </View>
      <View style={styles.textStack}>
        <Text style={styles.title}>Conversation</Text>
        <Text style={styles.subtitle}>
          {count > 0 ? `${count} messages` : 'Start a conversation'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.inkTertiary} />
    </Pressable>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.sm,
      gap: Spacing.sm,
      backgroundColor: Colors.surfaceSunken,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: Radius.sm,
      backgroundColor: Colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textStack: {
      flex: 1,
    },
    title: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    subtitle: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
  });
