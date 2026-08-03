import Ionicons from "@react-native-vector-icons/ionicons";
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';

// No WebSocket support on the backend — this polls instead of pushing, which is close enough
// for a maintenance-ticket thread (not a high-frequency chat) without the infra cost.
const POLL_INTERVAL_MS = 8000;

export default function TicketCommentsScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const currentUser = useAuthStore((s) => s.currentUser)!;
  const token = useAuthStore((s) => s.token);
  const refreshUsers = useAuthStore((s) => s.refreshUsers);
  const ticket = useTicketStore((s) => s.tickets.find((t) => t.ticketId === ticketId));
  const allComments = useTicketStore((s) => s.comments);
  const comments = useMemo(
    () =>
      allComments
        .filter((c) => c.ticketId === ticketId)
        .sort((a, b) => a.postedAt.localeCompare(b.postedAt)),
    [allComments, ticketId],
  );
  const refreshComments = useTicketStore((s) => s.refreshComments);
  const postCommentAction = useTicketStore((s) => s.postCommentAction);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token || !ticketId) return;
      let cancelled = false;

      setLoading(true);
      setError('');
      Promise.all([refreshUsers(), refreshComments(token, ticketId)])
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.message : 'Could not load messages.');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      const interval = setInterval(() => {
        refreshComments(token, ticketId).catch(() => {});
      }, POLL_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [token, ticketId, refreshUsers, refreshComments]),
  );

  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [comments.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !token || !ticketId || sending) return;
    setSending(true);
    setError('');
    try {
      await postCommentAction(token, ticketId, text);
      setInput('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={ticket?.title ?? 'Conversation'}
        subtitle={ticket ? `Ticket #${ticket.ticketId}` : undefined}
        showBack
      />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Screen scroll={false} padded={false} edges={['bottom']} style={styles.screen}>
          {loading && comments.length === 0 ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.centered}>
              <EmptyState icon="chatbubbles-outline" title="Start a conversation" />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.messagesScroll}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {comments.map((comment) => {
                const isMe = comment.userId === currentUser.userId;
                return (
                  <View
                    key={comment.commentId}
                    style={[
                      styles.messageRow,
                      isMe ? styles.messageRowMe : styles.messageRowOther,
                    ]}
                  >
                    {!isMe && (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{comment.authorName.charAt(0)}</Text>
                      </View>
                    )}
                    <View style={styles.messageContent}>
                      {!isMe && <Text style={styles.senderName}>{comment.authorName}</Text>}
                      <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                        <Text
                          style={[styles.messageText, isMe ? styles.myText : styles.otherText]}
                        >
                          {comment.message}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.composer}>
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Type a message..."
                placeholderTextColor={Colors.inkTertiary}
                style={styles.input}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                onPress={handleSend}
                disabled={!input.trim() || sending}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!input.trim() || sending) && styles.sendButtonDisabled,
                  pressed && input.trim() && !sending && styles.pressed,
                ]}
              >
                <Ionicons name="send" size={18} color={Colors.white} />
              </Pressable>
            </View>
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: Colors.surfaceMuted,
    },
    keyboard: {
      flex: 1,
    },
    screen: {
      backgroundColor: Colors.surfaceMuted,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messagesScroll: {
      flex: 1,
    },
    messagesContent: {
      padding: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
    },
    messageRow: {
      width: '100%',
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    messageRowOther: {
      justifyContent: 'flex-start',
    },
    messageRowMe: {
      justifyContent: 'flex-end',
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: Radius.pill,
      backgroundColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
    },
    avatarText: {
      ...Type.captionBold,
      color: Colors.inkSecondary,
    },
    messageContent: {
      maxWidth: '80%',
      gap: 4,
    },
    senderName: {
      ...Type.caption,
      color: Colors.inkSecondary,
      marginLeft: 4,
    },
    bubble: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.lg,
    },
    otherBubble: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: Radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    myBubble: {
      backgroundColor: Colors.primary,
      borderTopRightRadius: Radius.sm,
    },
    messageText: {
      ...Type.body,
    },
    otherText: {
      color: Colors.ink,
    },
    myText: {
      color: Colors.white,
    },
    error: {
      ...Type.caption,
      color: Colors.danger,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.xs,
    },
    composer: {
      paddingTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      backgroundColor: Colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.xs,
    },
    input: {
      ...Type.body,
      flex: 1,
      minHeight: 44,
      maxHeight: 112,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Platform.select({ ios: 11, android: 8, default: 10 }),
      borderRadius: Radius.md,
      color: Colors.ink,
      backgroundColor: Colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primary,
    },
    sendButtonDisabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.75,
    },
  });
