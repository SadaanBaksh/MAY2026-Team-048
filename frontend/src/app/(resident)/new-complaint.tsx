import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
import type { MediaType, Priority } from '@/types';
import { analyzeComplaint, type AIAnalysisResult } from '@/utils/mockAI';

type Step = 'capture' | 'analyzing' | 'review' | 'done';

function buildTitle(categoryName: string, note: string): string {
  const trimmed = note.trim();
  if (!trimmed) return `${categoryName} issue`;
  const words = trimmed.split(/\s+/).slice(0, 6).join(' ');
  return words.length < trimmed.length ? `${words}…` : words;
}

export default function NewComplaintScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((s) => s.currentUser)!;
  const submitComplaint = useTicketStore((s) => s.submitComplaint);

  const [step, setStep] = useState<Step>('capture');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [note, setNote] = useState('');
  const [permissionError, setPermissionError] = useState('');

  const voiceRecorder = useVoiceRecorder();
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  const [voiceNoteDurationSec, setVoiceNoteDurationSec] = useState<number | null>(null);

  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [newTicketId, setNewTicketId] = useState<string | null>(null);

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
    setPermissionError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissionError('Photo library permission is required to attach media.');
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

  const takePhoto = async () => {
    setPermissionError('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPermissionError('Camera permission is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType(result.assets[0].type === 'video' ? 'Video' : 'Image');
    }
  };

  const handleRecordVoiceNote = async () => {
    setPermissionError('');
    const granted = await voiceRecorder.start();
    if (!granted) {
      setPermissionError('Microphone permission is required to record a voice note.');
    }
  };

  const handleStopVoiceNote = async () => {
    const recording = await voiceRecorder.stop();
    if (recording) {
      setVoiceNoteUri(recording.uri);
      setVoiceNoteDurationSec(recording.durationSec);
    }
  };

  const handleDeleteVoiceNote = () => {
    setVoiceNoteUri(null);
    setVoiceNoteDurationSec(null);
  };

  const handleAnalyze = async () => {
    if (!mediaUri || !mediaType) return;
    setStep('analyzing');
    const result = await analyzeComplaint({
      note,
      hasVideo: mediaType === 'Video',
      hasVoiceNote: !!voiceNoteUri,
    });
    setAiResult(result);
    setDescription(result.aiDescription);
    setCategoryId(result.categoryId);
    setPriority(result.priority);
    setStep('review');
  };

  const handleSubmit = () => {
    if (!mediaUri || !mediaType || !aiResult) return;
    const category = getCategoryById(categoryId);
    const ticketId = submitComplaint({
      residentId: user.userId,
      categoryId,
      title: buildTitle(category.categoryName, note),
      aiDescription: description,
      aiConfidence: aiResult.confidence,
      priority,
      mediaUrl: mediaUri,
      mediaType,
      residentNote: note,
      voiceNoteUrl: voiceNoteUri,
      voiceNoteDurationSec,
    });
    setNewTicketId(ticketId);
    setStep('done');
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
            <Text style={styles.label}>Add a photo or video</Text>
            {mediaUri && mediaType ? (
              <MediaThumb uri={mediaUri} mediaType={mediaType} height={220} />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="image-outline" size={32} color={Colors.inkTertiary} />
                <Text style={styles.placeholderText}>No media attached yet</Text>
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
              disabled={!mediaUri}
              onPress={handleAnalyze}
            />
          </>
        )}

        {step === 'review' && aiResult && mediaUri && mediaType && (
          <>
            <MediaThumb uri={mediaUri} mediaType={mediaType} height={200} />
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
            />
            <Text style={styles.helper}>
              Review the AI-generated details above. You can edit the description, category, or
              priority before sending it to the facility team.
            </Text>
            <Button
              label="Submit Complaint"
              icon="send"
              fullWidth
              size="lg"
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
