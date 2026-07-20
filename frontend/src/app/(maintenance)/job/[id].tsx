import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AIDescriptionCard } from '@/components/shared/AIDescriptionCard';
import { CommentsThread } from '@/components/shared/CommentsThread';
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
import { MediaThumb } from '@/components/shared/MediaThumb';
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
import { APARTMENTS } from '@/data/seed';
import { getCategoryById } from '@/data/categories';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import { formatFullDate } from '@/utils/date';

export default function MaintenanceJobDetailScreen() {
  const { Colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.currentUser)!;
  const users = useAuthStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);
  const history = useTicketStore((s) => s.history);
  const comments = useTicketStore((s) => s.comments);
  const startProgress = useTicketStore((s) => s.startProgress);
  const resolveTicket = useTicketStore((s) => s.resolveTicket);
  const addComment = useTicketStore((s) => s.addComment);

  const [remarks, setRemarks] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);

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

  const handleStart = () =>
    startProgress(ticket.ticketId, { name: user.name, role: 'Maintenance Staff' });

  const handleResolve = () => {
    if (!remarks.trim() || !proofUri) return;
    resolveTicket(
      ticket.ticketId,
      { remarks: remarks.trim(), proofUrl: proofUri },
      { name: user.name, role: 'Maintenance Staff' },
    );
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader
        title={category.categoryName}
        subtitle={`Reported ${formatFullDate(ticket.dateOfRequest)}`}
        showBack
      />
      <Screen edges={['bottom']}>
        {ticket.imageUrl && (
          <MediaThumb uri={ticket.imageUrl} mediaType={ticket.mediaType} height={200} />
        )}

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
          <Button
            label="Start Work"
            icon="play-circle-outline"
            fullWidth
            size="lg"
            onPress={handleStart}
          />
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
            <Button
              label="Mark Resolved"
              icon="checkmark-done-outline"
              fullWidth
              size="lg"
              disabled={!remarks.trim() || !proofUri}
              onPress={handleResolve}
            />
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
            <CommentsThread
              comments={ticketComments}
              currentUserId={user.userId}
              onSend={(message) =>
                addComment(ticket.ticketId, {
                  userId: user.userId,
                  authorName: user.name,
                  authorRole: user.role,
                  message,
                })
              }
            />
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
