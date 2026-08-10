import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { analyzeComplaint, ApiError, createTicket, uploadFile } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AIDescriptionCard } from '@/components/shared/AIDescriptionCard';
import { MediaThumb } from '@/components/shared/MediaThumb';
import { VoiceNotePlayer } from '@/components/shared/VoiceNotePlayer';
import { getCategoryById } from '@/data/categories';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type { Priority } from '@/types';

type Step = 'capture' | 'analyzing' | 'review' | 'done';

interface AIAnalysisResult {
  categoryId: string;
  aiDescription: string;
  priority: Priority;
  confidence: number;
}

const MAX_PHOTOS = 5;

function buildTitle(categoryName: string, note: string): string {
  const trimmed = note.trim();
  if (!trimmed) return `${categoryName} issue`;
  const words = trimmed.split(/\s+/).slice(0, 6).join(' ');
  return words.length < trimmed.length ? `${words}…` : words;
}

export default function NewComplaintScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((s) => s.token);
  const addTicketFromApi = useTicketStore((s) => s.addTicketFromApi);

  const [step, setStep] = useState<Step>('capture');
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [permissionError, setPermissionError] = useState('');

  const voiceRecorder = useVoiceRecorder();
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  const [voiceNoteDurationSec, setVoiceNoteDurationSec] = useState<number | null>(null);
  const voiceActionInFlight = useRef(false);

  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  // Upload once before analysis, then reuse the same URLs when the resident submits. This keeps
  // the model input private to the server and avoids paying for an extra upload/call on submit.
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[] | null>(null);
  const [uploadedVoiceNoteUrl, setUploadedVoiceNoteUrl] = useState<string | null | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [newTicketId, setNewTicketId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);

  const pulse = useMemo(() => new Animated.Value(0.4), []);

  useEffect(() => {
    if (step !== 'analyzing') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [step, pulse]);

  const pickFromLibrary = async () => {
    if (photos.length >= MAX_PHOTOS) {
      setPermissionError(`You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setPermissionError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissionError('Photo library permission is required to attach media.');
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
      setUploadedPhotoUrls(null);
    }
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      setPermissionError(`You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setPermissionError('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPermissionError('Camera permission is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
      setUploadedPhotoUrls(null);
    }
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
    setUploadedPhotoUrls(null);
  };

  const handleRecordVoiceNote = async () => {
    if (voiceActionInFlight.current) return;
    voiceActionInFlight.current = true;
    setPermissionError('');
    try {
      const granted = await voiceRecorder.start();
      if (!granted) {
        setPermissionError('Microphone permission is required to record a voice note.');
      }
    } finally {
      voiceActionInFlight.current = false;
    }
  };

  const handleStopVoiceNote = async () => {
    if (voiceActionInFlight.current) return;
    voiceActionInFlight.current = true;
    try {
      const recording = await voiceRecorder.stop();
      if (recording) {
        setVoiceNoteUri(recording.uri);
        setVoiceNoteDurationSec(recording.durationSec);
        setUploadedVoiceNoteUrl(undefined);
      }
    } finally {
      voiceActionInFlight.current = false;
    }
  };

  const handleDeleteVoiceNote = () => {
    setVoiceNoteUri(null);
    setVoiceNoteDurationSec(null);
    setUploadedVoiceNoteUrl(undefined);
  };

  const handleAnalyze = async () => {
    if (!photos.length && !voiceNoteUri && !note.trim()) return;
    if (!token) {
      setSubmitError('Your session has expired. Please sign in again.');
      return;
    }
    setStep('analyzing');
    setSubmitError('');
    setAiUnavailable(false);
    try {
      const photoUrls =
        uploadedPhotoUrls ??
        (await Promise.all(photos.map(async (uri) => (await uploadFile(token, uri, 'photo')).url)));
      const voiceNoteUrl =
        uploadedVoiceNoteUrl !== undefined
          ? uploadedVoiceNoteUrl
          : voiceNoteUri
            ? (await uploadFile(token, voiceNoteUri, 'voice_note')).url
            : null;
      setUploadedPhotoUrls(photoUrls);
      setUploadedVoiceNoteUrl(voiceNoteUrl);

      const result = await analyzeComplaint(token, {
        resident_note: note,
        photo_urls: photoUrls,
        voice_note_url: voiceNoteUrl,
      });
      setAiResult({
        aiDescription: result.ai_description,
        categoryId: result.category_id,
        priority: result.priority,
        confidence: result.confidence,
      });
      setDescription(result.ai_description);
      setCategoryId(result.category_id);
      setPriority(result.priority);
      setIsManualEntry(false);
      setStep('review');
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not analyze the complaint. Please try again.',
      );
      setAiUnavailable(true);
      setStep('capture');
    }
  };

  // Lets the resident proceed when AI analysis is down (rate-limited, Gemini outage, etc.)
  // instead of being stuck unable to submit at all. Photo/voice-note uploads from the failed
  // analyze attempt (if any) are preserved and reused here.
  const handleContinueManually = () => {
    setAiResult({ categoryId: '', aiDescription: note, priority: 'Medium', confidence: 0 });
    setDescription(note);
    setCategoryId('');
    setPriority('Medium');
    setIsManualEntry(true);
    setAiUnavailable(false);
    setSubmitError('');
    setStep('review');
  };

  const handleSubmit = async () => {
    if (!aiResult || !token || submitting) return;
    if (!categoryId) {
      setSubmitError('Please select a category.');
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      const category = getCategoryById(categoryId);
      const photoUrls = uploadedPhotoUrls ?? [];
      const voiceNoteUrl = uploadedVoiceNoteUrl ?? null;

      const apiTicket = await createTicket(token, {
        title: buildTitle(category.categoryName, note),
        category_id: categoryId,
        resident_note: note,
        photo_urls: photoUrls,
        voice_note_url: voiceNoteUrl,
        voice_note_duration_sec: voiceNoteDurationSec,
        ai_description: description,
        ai_confidence: aiResult.confidence,
        priority,
      });

      const ticketId = addTicketFromApi(apiTicket);
      setNewTicketId(ticketId);
      setStep('done');
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not submit your complaint. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'review') {
      setStep('capture');
      return;
    }
    router.back();
  };

  if (step === 'done' && newTicketId) {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <View style={styles.centerFill}>
          <IconCircle
            name="checkmark"
            color={Colors.success}
            background={Colors.successSoft}
            size={72}
          />
          <Text style={styles.doneTitle}>Complaint Submitted!</Text>
          <Text style={styles.doneMessage}>
            Your complaint has been logged. The facility team has been notified and will assign a
            technician shortly.
          </Text>
          <View style={styles.doneActions}>
            <Button
              label="Track Status"
              fullWidth
              size="lg"
              onPress={() => router.replace(`/(resident)/complaint/${newTicketId}`)}
            />
            <Button
              label="Back to Home"
              variant="ghost"
              fullWidth
              onPress={() => router.replace('/(resident)/(tabs)')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  if (step === 'analyzing') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <View style={styles.centerFill}>
          <Animated.View style={{ opacity: pulse, transform: [{ scale: pulse }] }}>
            <IconCircle
              name="sparkles"
              color={Colors.primary}
              background={Colors.primarySoft}
              size={72}
            />
          </Animated.View>
          <Text style={styles.doneTitle}>Analyzing your complaint…</Text>
          <Text style={styles.doneMessage}>
            Our AI is reviewing the photo and identifying the issue, category, and priority.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScreenHeader
        title={step === 'review' ? 'Review & Submit' : 'Report an Issue'}
        showBack
        onBack={handleBack}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'capture' && (
          <>
            <Text style={styles.label}>Add photos ({photos.length}/{MAX_PHOTOS})</Text>
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
            {!!permissionError && <Text style={styles.error}>{permissionError}</Text>}

            <Text style={styles.label}>Describe what&rsquo;s wrong (optional)</Text>
            <Card style={styles.noteCard}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. The kitchen tap has been leaking since this morning…"
                placeholderTextColor={Colors.inkTertiary}
                multiline
                style={styles.noteInput}
              />
            </Card>

            <Text style={styles.label}>Add a voice note (optional)</Text>
            {voiceNoteUri ? (
              <VoiceNotePlayer
                uri={voiceNoteUri}
                durationSec={voiceNoteDurationSec}
                onDelete={handleDeleteVoiceNote}
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
                  onPress={handleStopVoiceNote}
                />
              </View>
            ) : (
              <Button
                label="Record Voice Note"
                icon="mic-outline"
                variant="secondary"
                onPress={handleRecordVoiceNote}
              />
            )}

            <Button
              label="Analyze with AI"
              icon="sparkles-outline"
              fullWidth
              size="lg"
              disabled={!photos.length && !voiceNoteUri && !note.trim()}
              onPress={handleAnalyze}
            />
            {!!submitError && <Text style={styles.error}>{submitError}</Text>}
            {aiUnavailable && (
              <Button
                label="Continue Without AI"
                icon="create-outline"
                variant="secondary"
                fullWidth
                onPress={handleContinueManually}
              />
            )}
          </>
        )}

        {step === 'review' && aiResult && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {photos.map((uri) => (
                <View key={uri} style={styles.photoItem}>
                  <MediaThumb uri={uri} mediaType="Image" height={140} radius={Radius.md} />
                </View>
              ))}
            </ScrollView>
            {!!note && <Text style={styles.noteEcho}>“{note}”</Text>}
            {!!voiceNoteUri && (
              <VoiceNotePlayer uri={voiceNoteUri} durationSec={voiceNoteDurationSec} />
            )}
            <AIDescriptionCard
              description={description}
              onChangeDescription={setDescription}
              confidence={aiResult.confidence}
              categoryId={categoryId}
              onChangeCategory={setCategoryId}
              priority={priority}
              onChangePriority={setPriority}
              editable
              isManual={isManualEntry}
            />
            <Text style={styles.helper}>
              {isManualEntry
                ? 'AI analysis was unavailable, so fill in the category, priority, and description yourself before sending it to the facility team.'
                : 'Review the AI-generated details above. You can edit the description, category, or priority before sending it to the facility team.'}
            </Text>
            {!!submitError && <Text style={styles.error}>{submitError}</Text>}
            <Button
              label={submitting ? 'Submitting…' : 'Submit Complaint'}
              icon="send"
              fullWidth
              size="lg"
              disabled={submitting}
              onPress={handleSubmit}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: Colors.surfaceMuted,
    },
    content: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xxxl,
      gap: Spacing.sm,
    },
    label: {
      ...Type.captionBold,
      color: Colors.inkSecondary,
      marginTop: Spacing.xs,
    },
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
    placeholderText: {
      ...Type.caption,
      color: Colors.inkTertiary,
    },
    photoRow: {
      flexDirection: 'row',
    },
    photoItem: {
      width: 120,
      marginRight: Spacing.sm,
    },
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
    mediaActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    flexButton: {
      flex: 1,
    },
    error: {
      ...Type.caption,
      color: Colors.danger,
    },
    noteCard: {
      padding: 0,
    },
    noteInput: {
      minHeight: 90,
      padding: Spacing.sm,
      fontSize: 15,
      color: Colors.ink,
      textAlignVertical: 'top',
    },
    noteEcho: {
      ...Type.caption,
      color: Colors.inkSecondary,
      fontStyle: 'italic',
    },
    recordingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.dangerSoft,
      borderRadius: Radius.lg,
      padding: Spacing.sm,
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.danger,
    },
    recordingText: {
      ...Type.bodyMedium,
      color: Colors.danger,
      flex: 1,
    },
    helper: {
      ...Type.caption,
      color: Colors.inkTertiary,
    },
    centerFill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    doneTitle: {
      ...Type.title,
      color: Colors.ink,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    doneMessage: {
      ...Type.body,
      color: Colors.inkSecondary,
      textAlign: 'center',
    },
    doneActions: {
      width: '100%',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
  });
