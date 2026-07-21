import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';

export interface VoiceNotePlayerProps {
  uri: string;
  durationSec?: number | null;
  onDelete?: () => void;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VoiceNotePlayer({ uri, durationSec, onDelete }: VoiceNotePlayerProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const totalSec = (status.isLoaded ? status.duration : null) ?? durationSec ?? 0;

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (totalSec > 0 && status.currentTime >= totalSec) {
      player.seekTo(0);
    }
    player.play();
  };

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={togglePlayback} style={styles.playButton}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={Colors.white} />
      </Pressable>
      <View style={styles.info}>
        <Text style={styles.label}>Voice note</Text>
        <Text style={styles.duration}>
          {formatTime(status.currentTime)} / {formatTime(totalSec)}
        </Text>
      </View>
      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteButton} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
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
      gap: Spacing.sm,
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      padding: Spacing.sm,
    },
    playButton: {
      width: 40,
      height: 40,
      borderRadius: Radius.pill,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      gap: 2,
    },
    label: {
      ...Type.captionBold,
      color: Colors.inkSecondary,
    },
    duration: {
      ...Type.caption,
      color: Colors.inkTertiary,
    },
    deleteButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
