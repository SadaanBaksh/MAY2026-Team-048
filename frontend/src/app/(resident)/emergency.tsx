import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, createTicket, uploadFile } from '@/api/client';
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

const EMERGENCY_PHONE_NUMBER = '112';
const MAX_PHOTOS = 5;

export default function EmergencyScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((s) => s.currentUser)!;
  const token = useAuthStore((s) => s.token);
  const addTicketFromApi = useTicketStore((s) => s.addTicketFromApi);
  const voiceRecorder = useVoiceRecorder();
  const voiceActionInFlight = useRef(false);

  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  const [voiceNoteDurationSec, setVoiceNoteDurationSec] = useState<number | null>(null);
  const [permissionError, setPermissionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const pickFromLibrary = async () => {
    if (photos.length >= MAX_PHOTOS) {
      setPermissionError(`You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setPermissionError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionError('Photo library permission is required to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      setPermissionError(`You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setPermissionError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPermissionError('Camera permission is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
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

  const submitEmergency = async () => {
    if ((photos.length === 0 && !voiceNoteUri && !note.trim()) || !token || submitting) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const description =
        note.trim() || 'Emergency assistance requested. See the attached media or audio message.';
      const photoUrls = await Promise.all(
        photos.map(async (uri) => (await uploadFile(token, uri, 'photo')).url),
      );
      const voiceNoteUploadUrl = voiceNoteUri
        ? (await uploadFile(token, voiceNoteUri, 'voice_note')).url
        : null;

      const apiTicket = await createTicket(token, {
        title: note.trim().split(/\s+/).slice(0, 6).join(' ') || 'Emergency assistance needed',
        category_id: 'cat_emergency',
        resident_note: note,
        photo_urls: photoUrls,
        voice_note_url: voiceNoteUploadUrl,
        voice_note_duration_sec: voiceNoteDurationSec,
        ai_description: description,
        ai_confidence: 1,
        priority: 'Emergency',
      });

      const ticketId = addTicketFromApi(apiTicket);
      setSubmittedTicketId(ticketId);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not send your emergency request. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
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

  const canSubmit = photos.length > 0 || !!voiceNoteUri || !!note.trim();

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

        <Text style={styles.label}>
          Photos ({photos.length}/{MAX_PHOTOS})
        </Text>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photos.map((uri) => (
              <View key={uri} style={styles.photoItem}>
                <MediaThumb uri={uri} mediaType="Image" height={120} radius={Radius.md} />
                <Pressable style={styles.removeBadge} onPress={() => removePhoto(uri)}>
                  <Ionicons name="close" size={14} color={Colors.white} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={32} color={Colors.inkTertiary} />
            <Text style={styles.placeholderText}>No photos attached yet</Text>
          </View>
        )}
        <View style={styles.mediaActions}>
          <Button
            label="Take Photo"
            icon="camera-outline"
            variant="secondary"
            onPress={takePhoto}
            style={styles.flexButton}
          />
          <Button
            label="Choose File"
            icon="images-outline"
            variant="secondary"
            onPress={pickFromLibrary}
            style={styles.flexButton}
          />
        </View>

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
        {!!submitError && <Text style={styles.error}>{submitError}</Text>}

        <Button
          label={submitting ? 'Sending…' : 'Send emergency request'}
          icon="alert-circle"
          fullWidth
          size="lg"
          variant="danger"
          disabled={!canSubmit || submitting}
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
    placeholder: {
      height: 180,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: Colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: Colors.surface,
    },
    placeholderText: { ...Type.caption, color: Colors.inkTertiary },
    photoRow: { flexDirection: 'row' },
    photoItem: { width: 120, marginRight: Spacing.sm },
    removeBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(18,20,28,0.65)',
    },
    mediaActions: { flexDirection: 'row', gap: Spacing.sm },
    flexButton: { flex: 1 },
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
