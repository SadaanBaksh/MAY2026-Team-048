import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, uploadFile } from '@/api/client';
import { AIDescriptionCard } from '@/components/shared/AIDescriptionCard';
import { CommentsThread } from '@/components/shared/CommentsThread';
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
import { MediaThumb } from '@/components/shared/MediaThumb';
import { TicketMediaGallery } from '@/components/shared/TicketMediaGallery';
import { VoiceNotePlayer } from '@/components/shared/VoiceNotePlayer';
import { Avatar } from '@/components/ui/Avatar';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RatingStars } from '@/components/ui/RatingStars';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusStepper } from '@/components/ui/StatusStepper';
import { SwipeToResolve } from '@/components/ui/SwipeToResolve';
import { APARTMENTS } from '@/data/seed';
import { getCategoryById } from '@/data/categories';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import { formatFullDate } from '@/utils/date';

export default function MaintenanceJobDetailScreen() {
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.currentUser)!;
  const users = useAuthStore((s) => s.users);
  const token = useAuthStore((s) => s.token);
  const tickets = useTicketStore((s) => s.tickets);
  const media = useTicketStore((s) => s.media);
  const history = useTicketStore((s) => s.history);
  const comments = useTicketStore((s) => s.comments);
  const startProgress = useTicketStore((s) => s.startProgress);
  const resolveTicket = useTicketStore((s) => s.resolveTicket);
  const refreshTickets = useTicketStore((s) => s.refreshTickets);
  const refreshComments = useTicketStore((s) => s.refreshComments);
  const refreshTicketHistory = useTicketStore((s) => s.refreshTicketHistory);

  useFocusEffect(
    useCallback(() => {
      if (token) refreshTickets(token);
      if (token && id) refreshComments(token, id);
      if (token && id) refreshTicketHistory(token, id);
    }, [token, id, refreshTickets, refreshComments, refreshTicketHistory]),
  );

  const [remarks, setRemarks] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const ticket = tickets.find((t) => t.ticketId === id);

  const styles = useMemo(() => getStyles(Colors), [Colors]);

  if (!ticket) {
    return (
      <Screen>
        <ScreenHeader title="Job" showBack />
        <EmptyState icon="alert-circle-outline" title="Job not found" />
      </Screen>
    );
  }

  const category = getCategoryById(ticket.categoryId);
  const resident = users.find((u) => u.userId === ticket.residentId);
  const apartment =
    resident && resident.role === 'resident'
      ? APARTMENTS.find((a) => a.apartmentId === resident.apartmentId)
      : null;
  const ticketHistory = history.filter((h) => h.ticketId === ticket.ticketId);
  const ticketComments = comments.filter((c) => c.ticketId === ticket.ticketId);
  const ticketMedia = media.filter((m) => m.ticketId === ticket.ticketId);

  const capturedProof = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setProofUri(result.assets[0].uri);
  };

  const pickProof = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) setProofUri(result.assets[0].uri);
  };

  const handleStart = async () => {
    if (!token || starting) return;
    setStartError('');
    setStarting(true);
    try {
      await startProgress(token, ticket.ticketId, { name: user.name, role: 'Maintenance Staff' });
    } catch (err) {
      setStartError(
        err instanceof ApiError ? err.message : 'Could not start the job. Please try again.',
      );
    } finally {
      setStarting(false);
    }
  };

  const handleResolve = async () => {
    if (!remarks.trim() || !proofUri || !token || resolving) return;
    setResolveError('');
    setResolving(true);
    try {
      const { url } = await uploadFile(token, proofUri, 'photo');
      await resolveTicket(
        token,
        ticket.ticketId,
        { remarks: remarks.trim(), proofUrl: url },
        { name: user.name, role: 'Maintenance Staff' },
      );
    } catch (err) {
      setResolveError(
        err instanceof ApiError
          ? err.message
          : 'Could not submit the resolution. Please try again.',
      );
    } finally {
      setResolving(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader
        title={category.categoryName}
        subtitle={`Reported ${formatFullDate(ticket.dateOfRequest)}`}
        showBack
      />
      <Screen edges={['bottom']}>
        <TicketMediaGallery media={ticketMedia} height={200} />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{ticket.title}</Text>
          <View style={styles.badgeRow}>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </View>
        </View>

        <Card>
          <StatusStepper status={ticket.status} />
        </Card>

        {resident && (
          <Card style={styles.personCard}>
            <Avatar name={resident.name} color={resident.avatarColor} size={44} />
            <View style={styles.personInfo}>
              <Text style={styles.sectionLabel}>Resident</Text>
              <Text style={styles.personName}>{resident.name}</Text>
              <Text style={styles.personMeta}>
                {apartment ? `${apartment.unitNumber}, ${apartment.building}` : ''} ·{' '}
                {resident.phone}
              </Text>
            </View>
          </Card>
        )}

        <AIDescriptionCard
          description={ticket.aiDescription}
          confidence={ticket.aiConfidence}
          categoryId={ticket.categoryId}
          priority={ticket.priority}
        />

        {!!ticket.residentNote && (
          <Card>
            <Text style={styles.sectionLabel}>Resident&rsquo;s Note</Text>
            <Text style={styles.body}>{ticket.residentNote}</Text>
          </Card>
        )}

        {!!ticket.voiceNoteUrl && (
          <Card>
            <Text style={styles.sectionLabel}>Voice Note</Text>
            <VoiceNotePlayer uri={ticket.voiceNoteUrl} durationSec={ticket.voiceNoteDurationSec} />
          </Card>
        )}

        {ticket.status === 'Assigned' && (
          <View style={styles.section}>
            {!!startError && <Text style={styles.error}>{startError}</Text>}
            <Button
              label={starting ? 'Starting…' : 'Start Work'}
              icon="play-circle-outline"
              fullWidth
              size="lg"
              disabled={starting}
              onPress={handleStart}
            />
          </View>
        )}

        {ticket.status === 'In_Progress' && (
          <Card style={styles.resolveCard}>
            <Text style={styles.sectionTitleLg}>Mark as Resolved</Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="What did you do to fix this? (required)"
              placeholderTextColor={Colors.inkTertiary}
              style={styles.remarksInput}
              multiline
            />
            {proofUri ? (
              <MediaThumb uri={proofUri} height={160} />
            ) : (
              <View style={styles.proofPlaceholder}>
                <Text style={styles.placeholderText}>Attach a proof-of-resolution photo</Text>
              </View>
            )}
            <View style={styles.mediaActions}>
              <Button
                label="Take Photo"
                icon="camera-outline"
                variant="secondary"
                onPress={capturedProof}
                style={styles.flexButton}
              />
              <Button
                label="Choose Photo"
                icon="images-outline"
                variant="secondary"
                onPress={pickProof}
                style={styles.flexButton}
              />
            </View>
            {!!resolveError && <Text style={styles.error}>{resolveError}</Text>}
            {isDesktop ? (
              <Button
                label={resolving ? 'Submitting…' : 'Mark Resolved'}
                icon="checkmark-done-outline"
                fullWidth
                size="lg"
                disabled={!remarks.trim() || !proofUri || resolving}
                onPress={handleResolve}
              />
            ) : (
              <SwipeToResolve
                loading={resolving}
                disabled={!remarks.trim() || !proofUri}
                disabledHint="Add resolution details and a proof photo to enable the gesture."
                onResolve={handleResolve}
              />
            )}
          </Card>
        )}

        {(ticket.status === 'Resolved' || ticket.status === 'Closed') && (
          <Card>
            <Text style={styles.sectionLabel}>Resolution Submitted</Text>
            <Text style={styles.body}>{ticket.resolutionRemarks}</Text>
            {ticket.resolutionProofUrl && (
              <View style={styles.proofWrap}>
                <MediaThumb uri={ticket.resolutionProofUrl} height={160} />
              </View>
            )}
          </Card>
        )}

        {ticket.status === 'Closed' && ticket.residentRating != null && (
          <Card>
            <Text style={styles.sectionLabel}>Resident Rating</Text>
            <RatingStars value={ticket.residentRating} readOnly size={20} />
            {!!ticket.residentFeedback && (
              <Text style={styles.body}>{ticket.residentFeedback}</Text>
            )}
          </Card>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitleLg}>Activity</Text>
          <Card>
            <HistoryTimeline entries={ticketHistory} />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleLg}>Messages</Text>
          <Text style={styles.helper}>
            Need another visit or replacement parts? Let the team know here.
          </Text>
          <Card>
            <CommentsThread comments={ticketComments} ticketId={ticket.ticketId} />
          </Card>
        </View>
      </Screen>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: Colors.surfaceMuted,
    },
    titleBlock: {
      gap: Spacing.xs,
    },
    title: {
      ...Type.title,
      color: Colors.ink,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: 6,
    },
    sectionLabel: {
      ...Type.tiny,
      color: Colors.inkTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    body: {
      ...Type.body,
      color: Colors.ink,
    },
    error: {
      ...Type.caption,
      color: Colors.danger,
    },
    personCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    personInfo: {
      flex: 1,
      gap: 2,
    },
    personName: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    personMeta: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    resolveCard: {
      gap: Spacing.sm,
    },
    remarksInput: {
      backgroundColor: Colors.surfaceMuted,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      minHeight: 80,
      color: Colors.ink,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      textAlignVertical: 'top',
    },
    proofPlaceholder: {
      height: 100,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: Colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
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
    proofWrap: {
      marginTop: Spacing.sm,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitleLg: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    helper: {
      ...Type.caption,
      color: Colors.inkTertiary,
      marginTop: -Spacing.xs,
    },
  });
