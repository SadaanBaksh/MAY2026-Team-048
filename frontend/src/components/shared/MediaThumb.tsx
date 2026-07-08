import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import type { MediaType } from '@/types';

export interface MediaThumbProps {
  uri: string;
  mediaType?: MediaType | null;
  height?: number;
  onPress?: () => void;
  radius?: number;
}

export function MediaThumb({ uri, mediaType, height = 200, onPress, radius = Radius.lg }: MediaThumbProps) {
  const content = (
    <View style={[styles.wrapper, { height, borderRadius: radius }]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      {mediaType === 'Video' && (
        <View style={styles.playOverlay}>
          <View style={styles.playCircle}>
            <Ionicons name="play" size={22} color={Colors.white} />
          </View>
        </View>
      )}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSunken,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,20,28,0.25)',
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(18,20,28,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});
