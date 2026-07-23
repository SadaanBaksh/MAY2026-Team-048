import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
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

type MessageRole = 'resident' | 'staff' | 'employee';

interface ChatMessage {
  id: string;
  senderRole: MessageRole;
  senderName: string;
  text: string;
  createdAt: Date;
  isMe: boolean;
}

export function ConversationChat() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');

  // Mock data for the design preview
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      senderRole: 'employee',
      senderName: 'Neha (Facility)',
      text: 'Hi, I have assigned Ramesh to fix the kitchen tap.',
      createdAt: new Date(Date.now() - 3600000),
      isMe: false,
    },
    {
      id: '2',
      senderRole: 'staff',
      senderName: 'Ramesh (Plumber)',
      text: 'I will be there in 15 minutes. Please ensure someone is home.',
      createdAt: new Date(Date.now() - 3000000),
      isMe: false,
    },
    {
      id: '3',
      senderRole: 'resident',
      senderName: 'Aditi',
      text: 'Thanks Ramesh! I am at home, you can come up.',
      createdAt: new Date(Date.now() - 2900000),
      isMe: true, // Viewing as the resident for this design mockup
    },
  ]);

  const sendMessage = (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      {
        id: Date.now().toString(),
        senderRole: 'resident',
        senderName: 'Aditi',
        text,
        createdAt: new Date(),
        isMe: true,
      },
    ]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Kitchen tap leaking" subtitle="Ticket #A-101" showBack />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Screen scroll={false} padded={false} edges={['bottom']} style={styles.screen}>
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contextPanel}>
              <View style={styles.contextIcon}>
                <Ionicons name="build" size={20} color={Colors.primary} />
              </View>
              <View style={styles.contextText}>
                <Text style={styles.contextTitle}>Assigned to Ramesh</Text>
                <Text style={styles.contextSubtitle}>Plumbing • ETA: 15 mins</Text>
              </View>
              <Pressable style={styles.callButton}>
                <Ionicons name="call" size={18} color={Colors.white} />
              </Pressable>
            </View>

            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.isMe ? styles.messageRowMe : styles.messageRowOther,
                ]}
              >
                {!message.isMe && (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{message.senderName.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.messageContent}>
                  {!message.isMe && <Text style={styles.senderName}>{message.senderName}</Text>}
                  <View
                    style={[
                      styles.bubble,
                      message.isMe ? styles.myBubble : styles.otherBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        message.isMe ? styles.myText : styles.otherText,
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.composer}>
            <View style={styles.inputRow}>
              <Pressable style={styles.attachButton}>
                <Ionicons name="add" size={26} color={Colors.inkTertiary} />
              </Pressable>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Type a message..."
                placeholderTextColor={Colors.inkTertiary}
                style={styles.input}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => sendMessage(input)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                onPress={() => sendMessage(input)}
                style={({ pressed }) => [
                  styles.sendButton,
                  !input.trim() && styles.sendButtonDisabled,
                  pressed && input.trim() && styles.pressed,
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
    messagesScroll: {
      flex: 1,
    },
    messagesContent: {
      padding: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
    },
    contextPanel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: Colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      marginBottom: Spacing.sm,
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
    callButton: {
      width: 36,
      height: 36,
      borderRadius: Radius.pill,
      backgroundColor: '#10B981', // emerald green for call action
      alignItems: 'center',
      justifyContent: 'center',
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
    composer: {
      paddingTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingBottom: Platform.select({ ios: Spacing.md, android: Spacing.md, default: Spacing.md }),
      backgroundColor: Colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.xs,
    },
    attachButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
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
