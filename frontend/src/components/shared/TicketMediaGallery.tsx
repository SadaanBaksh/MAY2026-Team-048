import { ScrollView, StyleSheet, View } from 'react-native';

import { MediaThumb } from '@/components/shared/MediaThumb';
import { Radius, Spacing } from '@/constants/theme';
import type { ComplaintMedia } from '@/types';

export interface TicketMediaGalleryProps {
  media: ComplaintMedia[];
  height?: number;
}

/** Renders every photo attached to a ticket, scrolling horizontally when there's more than one.
 * Tapping a photo opens it full-screen (built into MediaThumb). */
export function TicketMediaGallery({ media, height = 200 }: TicketMediaGalleryProps) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    return <MediaThumb uri={media[0].mediaUrl} mediaType={media[0].mediaType} height={height} />;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
      {media.map((item) => (
        <View key={item.mediaId} style={styles.item}>
          <MediaThumb uri={item.mediaUrl} mediaType={item.mediaType} height={height} radius={Radius.md} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  item: {
    width: 160,
    marginRight: Spacing.sm,
  },
});
