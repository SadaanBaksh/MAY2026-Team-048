import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { PublicServiceComment } from '@/types';

export function PublicComments({
  comments,
  locked,
  currentUserId,
  sending,
  onSend,
}: {
  comments: PublicServiceComment[];
  locked: boolean;
  currentUserId: string;
  sending: boolean;
  onSend: (message: string) => Promise<void>;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const [message, setMessage] = useState('');

  const submit = async () => {
    const value = message.trim();
    if (!value || sending || locked) return;
    try {
      await onSend(value);
      setMessage('');
    } catch {
      // The parent renders the API error and keeps the draft for retry.
    }
  };

  return (
    <View style={styles.wrapper}>
      {comments.length === 0 ? (
        <Text style={styles.empty}>No comments yet. Start the discussion.</Text>
      ) : (
        comments.map((comment) => (
          <View
            key={comment.id}
            style={[styles.comment, comment.userId === currentUserId && styles.myComment]}
          >
            <Text style={styles.author}>{comment.authorName}</Text>
            <Text style={styles.message}>{comment.message}</Text>
          </View>
        ))
      )}
      {locked ? (
        <Text style={styles.locked}>Discussion closed because this service is resolved.</Text>
      ) : (
        <View style={styles.composer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Add a public comment…"
            placeholderTextColor={Colors.inkTertiary}
            multiline
            maxLength={2000}
            style={styles.input}
          />
          <Button
            label="Post"
            size="sm"
            loading={sending}
            disabled={!message.trim()}
            onPress={submit}
          />
        </View>
      )}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { gap: Spacing.sm },
    empty: { ...Type.caption, color: Colors.inkTertiary },
    comment: {
      backgroundColor: Colors.surfaceSunken,
      borderRadius: Radius.md,
      padding: Spacing.sm,
    },
    myComment: { backgroundColor: Colors.primarySoft },
    author: { ...Type.captionBold, color: Colors.ink },
    message: { ...Type.body, color: Colors.ink, marginTop: 2 },
    locked: { ...Type.caption, color: Colors.inkTertiary },
    composer: { gap: Spacing.xs },
    input: {
      minHeight: 72,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      color: Colors.ink,
      padding: Spacing.sm,
      textAlignVertical: 'top',
      backgroundColor: Colors.surfaceMuted,
    },
  });
