import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { MediaType } from '@/types';

export interface MediaThumbProps {
  uri: string;
  mediaType?: MediaType | null;
  height?: number;
  /** Overrides the default tap behavior (opening a full-screen preview). */
  onPress?: () => void;
  radius?: number;
  /** Disables the built-in tap-to-preview full-screen viewer. */
  disablePreview?: boolean;
}

export function MediaThumb({
  uri,
  mediaType,
  height = 200,
  onPress,
  radius = Radius.lg,
  disablePreview = false,
}: MediaThumbProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const [previewVisible, setPreviewVisible] = useState(false);

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

  const handlePress = onPress ?? (disablePreview ? undefined : () => setPreviewVisible(true));
  const showsOwnPreview = !onPress && !disablePreview;

  return (
    <>
      {handlePress ? (
        <Pressable onPress={handlePress} style={({ pressed }) => pressed && styles.pressed}>
          {content}
        </Pressable>
      ) : (
        content
      )}

      {showsOwnPreview && (
        <Modal
          visible={previewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setPreviewVisible(false)}>
            <Image source={{ uri }} style={styles.fullImage} contentFit="contain" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
              onPress={() => setPreviewVisible(false)}
              hitSlop={12}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
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
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullImage: {
      width: '100%',
      height: '80%',
    },
    closeButton: {
      position: 'absolute',
      top: 48,
      right: 24,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
