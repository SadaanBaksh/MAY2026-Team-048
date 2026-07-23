import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MediaThumb } from '@/components/shared/MediaThumb';
import { VoiceNotePlayer } from '@/components/shared/VoiceNotePlayer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { MediaType } from '@/types';

const EMERGENCY_PHONE_NUMBER = '1800123456';

export default function EmergencyScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((s) => s.currentUser)!;
  const submitComplaint = useTicketStore((s) => s.submitComplaint);
  const voiceRecorder = useVoiceRecorder();
  const voiceActionInFlight = useRef(false);

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [note, setNote] = useState('');
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  const [voiceNoteDurationSec, setVoiceNoteDurationSec] = useState<number | null>(null);
  const [permissionError, setPermissionError] = useState('');
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const chooseMedia = async () => {
    setPermissionError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionError('Photo library permission is required to attach a photo or video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      videoMaxDuration: 30,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType(result.assets[0].type === 'video' ? 'Video' : 'Image');
    }
  };

  const startVoiceNote = async () => {
    if (voiceActionInFlight.current) return;
    voiceActionInFlight.current = true;
    setPermissionError('');
    try {
      if (!(await voiceRecorder.start())) {
        setPermissionError('Microphone permission is required to record an audio message.');
      }
    } finally {
      voiceActionInFlight.current = false;
    }
  };

  const stopVoiceNote = async () => {
    if (voiceActionInFlight.current) return;
    voiceActionInFlight.current = true;
    try {
      const recording = await voiceRecorder.stop();
      if (recording) {
        setVoiceNoteUri(recording.uri);
        setVoiceNoteDurationSec(recording.durationSec);
      }
    } finally {
      voiceActionInFlight.current = false;
    }
  };

  const submitEmergency = () => {
    if (!mediaUri && !voiceNoteUri && !note.trim()) return;
    const description =
      note.trim() || 'Emergency assistance requested. See the attached media or audio message.';
    const ticketId = submitComplaint({
      residentId: user.userId,
      categoryId: 'cat_emergency',
      title: note.trim().split(/\s+/).slice(0, 6).join(' ') || 'Emergency assistance needed',
      aiDescription: description,
      aiConfidence: 1,
      priority: 'Emergency',
      mediaUrl: mediaUri,
      mediaType,
      residentNote: note,
      voiceNoteUrl: voiceNoteUri,
      voiceNoteDurationSec,
    });
    setSubmittedTicketId(ticketId);
  };

  if (submittedTicketId) {
    return (
      <View style={styles.wrapper}>
        <ScreenHeader
          title="Emergency request sent"
          showBack
          onBack={() => router.replace('/(resident)/(tabs)')}
        />
        <View style={styles.successWrap}>
          <IconCircle
            name="checkmark"
            color={Colors.danger}
            background={Colors.dangerSoft}
            size={72}
          />
          <Text style={styles.successTitle}>Help is on the way</Text>
          <Text style={styles.successText}>
            Your emergency request has been sent to the facility team with Emergency priority.
          </Text>
          <View style={styles.successActions}>
            <Button
              label="Track request"
              icon="arrow-forward"
              fullWidth
              size="lg"
              variant="danger"
              onPress={() => router.replace(`/(resident)/complaint/${submittedTicketId}`)}
            />
            <Button
              label="Back to home"
              fullWidth
              variant="ghost"
              onPress={() => router.replace('/(resident)/(tabs)')}
            />
          </View>
        </View>
      </View>
    );
  }

  const canSubmit = !!mediaUri || !!voiceNoteUri || !!note.trim();

  return (
    <View style={styles.wrapper}>
      <ScreenHeader title="Emergency service" subtitle="Get help right away" showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.alertCard} elevated={false}>
          <Ionicons name="warning" size={26} color={Colors.danger} />
          <View style={styles.alertBody}>
            <Text style={styles.alertTitle}>This sends an Emergency-priority request</Text>
            <Text style={styles.alertText}>
              For immediate danger, call emergency services first.
            </Text>
          </View>
        </Card>

        <Button
          label="Call emergency services"
          icon="call"
          fullWidth
          size="lg"
          variant="danger"
          onPress={() => Linking.openURL(`tel:${EMERGENCY_PHONE_NUMBER}`)}
        />

        <Text style={styles.sectionTitle}>Tell us what happened</Text>
        <Text style={styles.helper}>
          Use any one or more options below. A message is helpful, but not required.
        </Text>

        <Text style={styles.label}>Photo or video</Text>
        {mediaUri && mediaType ? (
          <MediaThumb uri={mediaUri} mediaType={mediaType} height={180} />
        ) : null}
        <Button
          label={mediaUri ? 'Replace photo or video' : 'Add photo or video'}
          icon="images-outline"
          variant="secondary"
          onPress={chooseMedia}
        />

        <Text style={styles.label}>Audio message</Text>
        {voiceNoteUri ? (
          <VoiceNotePlayer
            uri={voiceNoteUri}
            durationSec={voiceNoteDurationSec}
            onDelete={() => {
              setVoiceNoteUri(null);
              setVoiceNoteDurationSec(null);
            }}
          />
        ) : voiceRecorder.isRecording ? (
          <View style={styles.recordingRow}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              Recording… {Math.floor(voiceRecorder.durationMillis / 1000)}s
            </Text>
            <Button
              label="Stop"
              icon="stop-circle"
              variant="danger"
              size="sm"
              onPress={stopVoiceNote}
            />
          </View>
        ) : (
          <Button
            label="Record audio message"
            icon="mic-outline"
            variant="secondary"
            onPress={startVoiceNote}
          />
        )}

        <Text style={styles.label}>Text message (optional)</Text>
        <Card style={styles.noteCard}>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Describe the emergency and where it is happening…"
            placeholderTextColor={Colors.inkTertiary}
            style={styles.noteInput}
          />
        </Card>
        {!!permissionError && <Text style={styles.error}>{permissionError}</Text>}

        <Button
          label="Send emergency request"
          icon="alert-circle"
          fullWidth
          size="lg"
          variant="danger"
          disabled={!canSubmit}
          onPress={submitEmergency}
        />
      </ScrollView>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { flex: 1, backgroundColor: Colors.surfaceMuted },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.sm },
    alertCard: {
      flexDirection: 'row',
      gap: Spacing.sm,
      backgroundColor: Colors.dangerSoft,
      borderColor: Colors.danger,
    },
    alertBody: { flex: 1, gap: 2 },
    alertTitle: { ...Type.bodyMedium, color: Colors.danger },
    alertText: { ...Type.caption, color: Colors.inkSecondary },
    sectionTitle: { ...Type.subtitle, color: Colors.ink, marginTop: Spacing.md },
    helper: { ...Type.caption, color: Colors.inkSecondary, marginBottom: Spacing.xs },
    label: { ...Type.captionBold, color: Colors.inkSecondary, marginTop: Spacing.sm },
    noteCard: { padding: 0 },
    noteInput: {
      minHeight: 100,
      padding: Spacing.sm,
      fontSize: 15,
      color: Colors.ink,
      textAlignVertical: 'top',
    },
    recordingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.dangerSoft,
      borderRadius: Radius.lg,
      padding: Spacing.sm,
    },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
    recordingText: { ...Type.bodyMedium, color: Colors.danger, flex: 1 },
    error: { ...Type.caption, color: Colors.danger },
    successWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    successTitle: {
      ...Type.title,
      color: Colors.ink,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    successText: { ...Type.body, color: Colors.inkSecondary, textAlign: 'center' },
    successActions: { width: '100%', gap: Spacing.sm, marginTop: Spacing.lg },
  });
