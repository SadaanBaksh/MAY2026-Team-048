import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import type { Comment } from '@/types';
import { timeAgo } from '@/utils/date';

export interface CommentsThreadProps {
  comments: Comment[];
  currentUserId: string;
  onSend?: (message: string) => void;
  readOnly?: boolean;
}

export function CommentsThread({ comments, currentUserId, onSend, readOnly }: CommentsThreadProps) {
  const [draft, setDraft] = useState('');

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setDraft('');
  };

  return (
    <View style={styles.wrapper}>
      {comments.length === 0 && <Text style={styles.empty}>No messages yet.</Text>}
      {comments.map((c) => {
        const mine = c.userId === currentUserId;
        return (
          <View key={c.commentId} style={[styles.row, mine && styles.rowMine]}>
            {!mine && <Avatar name={c.authorName} size={28} />}
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
              {!mine && <Text style={styles.author}>{c.authorName}</Text>}
              <Text style={[styles.message, mine && styles.messageMine]}>{c.message}</Text>
              <Text style={[styles.time, mine && styles.timeMine]}>{timeAgo(c.postedAt)}</Text>
            </View>
          </View>
        );
      })}

      {!readOnly && (
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message…"
            placeholderTextColor={Colors.inkTertiary}
            style={styles.input}
            multiline
          />
          <Pressable onPress={handleSend} style={styles.sendButton} hitSlop={8}>
            <Ionicons name="send" size={16} color={Colors.white} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  empty: {
    ...Type.caption,
    color: Colors.inkTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'flex-end',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    gap: 2,
  },
  bubbleOther: {
    backgroundColor: Colors.surfaceSunken,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  author: {
    ...Type.tiny,
    color: Colors.inkSecondary,
  },
  message: {
    ...Type.body,
    color: Colors.ink,
  },
  messageMine: {
    color: Colors.white,
  },
  time: {
    ...Type.tiny,
    color: Colors.inkTertiary,
    alignSelf: 'flex-end',
  },
  timeMine: {
    color: 'rgba(255,255,255,0.75)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceSunken,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    maxHeight: 100,
    color: Colors.ink,
    fontSize: 14,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
