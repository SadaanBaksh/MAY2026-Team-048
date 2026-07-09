import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { Resident } from '@/types';
import { answerResidentMessage } from '@/utils/mockResidentAssistant';

type MessageRole = 'assistant' | 'resident';

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: Date;
  relatedTicketId?: string;
  suggestions?: string[];
}

const STARTER_PROMPTS = [
  'What is my latest status?',
  'Which complaint needs review?',
  'Who is assigned?',
  'Show active complaints',
];

function makeMessage(role: MessageRole, text: string, extra?: Partial<ChatMessage>): ChatMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: new Date(),
    ...extra,
  };
}

export default function ResidentChatScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const scrollRef = useRef<ScrollView>(null);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = useAuthStore((state) => state.currentUser) as Resident;
  const tickets = useTicketStore((state) => state.tickets);
  const comments = useTicketStore((state) => state.comments);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const myTickets = useMemo(
    () =>
      tickets
        .filter((ticket) => ticket.residentId === user.userId)
        .sort((a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime()),
    [tickets, user.userId]
  );

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    makeMessage(
      'assistant',
      `Hi ${user.name.split(' ')[0]}. I can help you check service status, assigned professionals, pending reviews, and complaint details.`,
      { suggestions: STARTER_PROMPTS }
    ),
  ]);

  const activeCount = myTickets.filter((ticket) => ticket.status !== 'Closed').length;
  const reviewCount = myTickets.filter((ticket) => ticket.status === 'Resolved' && ticket.residentRating == null).length;

  useEffect(() => {
    const handle = requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(handle);
  }, [messages.length, isThinking]);

  useEffect(
    () => () => {
      if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    },
    []
  );

  const sendMessage = (rawText: string) => {
    const text = rawText.trim();
    if (!text || isThinking) return;

    setMessages((current) => [...current, makeMessage('resident', text)]);
    setInput('');
    setIsThinking(true);

    responseTimerRef.current = setTimeout(() => {
      const reply = answerResidentMessage(text, { resident: user, tickets: myTickets, comments });
      setMessages((current) => [
        ...current,
        makeMessage('assistant', reply.text, {
          relatedTicketId: reply.relatedTicketId,
          suggestions: reply.suggestions,
        }),
      ]);
      setIsThinking(false);
      responseTimerRef.current = null;
    }, 650);
  };

  const latestSuggestions = messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1].suggestions : undefined;
  const promptChips = latestSuggestions?.length ? latestSuggestions : STARTER_PROMPTS;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Simplifix Assistant"
        subtitle="Resident support"
        showBack
        right={
          <View style={styles.headerBadge}>
            <Ionicons name="sparkles" size={16} color={Colors.primary} />
          </View>
        }
      />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <Screen scroll={false} padded={false} edges={['bottom']} style={styles.screen}>
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.contextPanel}>
              <View style={styles.contextIcon}>
                <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
              </View>
              <View style={styles.contextText}>
                <Text style={styles.contextTitle}>Customer side assistant</Text>
                <Text style={styles.contextSubtitle}>
                  {activeCount} active, {reviewCount} awaiting review
                </Text>
              </View>
            </View>

            {messages.map((message) => (
              <View
                key={message.id}
                style={[styles.messageRow, message.role === 'resident' ? styles.messageRowResident : styles.messageRowAssistant]}>
                <View style={[styles.bubble, message.role === 'resident' ? styles.residentBubble : styles.assistantBubble]}>
                  <Text style={[styles.messageText, message.role === 'resident' ? styles.residentText : styles.assistantText]}>
                    {message.text}
                  </Text>
                  {message.relatedTicketId && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push(`/(resident)/complaint/${message.relatedTicketId}`)}
                      style={styles.ticketLink}>
                      <Text style={styles.ticketLinkText}>Open complaint</Text>
                      <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}

            {isThinking && (
              <View style={[styles.messageRow, styles.messageRowAssistant]}>
                <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
                  <View style={styles.typingDots}>
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                  </View>
                  <Text style={styles.typingText}>Checking your service history</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.composer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.promptRow}>
              {promptChips.map((prompt) => (
                <Pressable
                  key={prompt}
                  accessibilityRole="button"
                  onPress={() => sendMessage(prompt)}
                  style={({ pressed }) => [styles.promptChip, pressed && styles.pressed]}>
                  <Text style={styles.promptText}>{prompt}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask about your service..."
                placeholderTextColor={Colors.inkTertiary}
                style={styles.input}
                multiline
                maxLength={240}
                returnKeyType="send"
                onSubmitEditing={() => sendMessage(input)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                onPress={() => sendMessage(input)}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!input.trim() || isThinking) && styles.sendButtonDisabled,
                  pressed && input.trim() && !isThinking && styles.pressed,
                ]}>
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
    headerBadge: {
      width: 32,
      height: 32,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primarySoft,
    },
    messagesScroll: {
      flex: 1,
    },
    messagesContent: {
      padding: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    contextPanel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Radius.sm,
      backgroundColor: Colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    contextIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.primarySoft,
    },
    contextText: {
      flex: 1,
    },
    contextTitle: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    contextSubtitle: {
      ...Type.caption,
      color: Colors.inkSecondary,
      marginTop: 2,
    },
    messageRow: {
      width: '100%',
      flexDirection: 'row',
    },
    messageRowAssistant: {
      justifyContent: 'flex-start',
    },
    messageRowResident: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '86%',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.lg,
      gap: Spacing.xs,
    },
    assistantBubble: {
      backgroundColor: Colors.surface,
      borderBottomLeftRadius: Radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    residentBubble: {
      backgroundColor: Colors.primary,
      borderBottomRightRadius: Radius.sm,
    },
    messageText: {
      ...Type.body,
    },
    assistantText: {
      color: Colors.ink,
    },
    residentText: {
      color: Colors.white,
    },
    ticketLink: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: Spacing.xxs,
      paddingTop: Spacing.xxs,
    },
    ticketLinkText: {
      ...Type.captionBold,
      color: Colors.primary,
    },
    typingBubble: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    typingDots: {
      flexDirection: 'row',
      gap: 3,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: Radius.pill,
      backgroundColor: Colors.inkTertiary,
    },
    typingText: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    composer: {
      gap: Spacing.sm,
      paddingTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingBottom: Platform.select({ ios: Spacing.md, android: Spacing.md, default: Spacing.md }),
      backgroundColor: Colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    promptRow: {
      gap: Spacing.xs,
      paddingRight: Spacing.md,
    },
    promptChip: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.pill,
      backgroundColor: Colors.primarySoft,
    },
    promptText: {
      ...Type.captionBold,
      color: Colors.primary,
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
