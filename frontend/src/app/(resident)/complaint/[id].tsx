import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { AIDescriptionCard } from '@/components/shared/AIDescriptionCard';
import { CommentsThread } from '@/components/shared/CommentsThread';
import { CostResponsibilityModal, type CostChoice } from '@/components/shared/CostResponsibilityModal';
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
import { getCategoryById } from '@/data/categories';
import { Radius, Spacing, Type } from '@/constants/theme';
import { MAINTENANCE_SUPPORT_PHONE } from '@/constants/contact';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import { formatFullDate } from '@/utils/date';

export default function ResidentComplaintDetailScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const users = useAuthStore((s) => s.users);
  const token = useAuthStore((s) => s.token);
  const tickets = useTicketStore((s) => s.tickets);
  const media = useTicketStore((s) => s.media);
  const history = useTicketStore((s) => s.history);
  const comments = useTicketStore((s) => s.comments);
  const verifyAndClose = useTicketStore((s) => s.verifyAndClose);
  const cancelTicket = useTicketStore((s) => s.cancelTicket);
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

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [showCostModal, setShowCostModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const ticket = tickets.find((t) => t.ticketId === id);

  if (!ticket) {
    return (
      <Screen>
        <ScreenHeader title="Complaint" showBack />
        <EmptyState icon="alert-circle-outline" title="Complaint not found" />
      </Screen>
    );
  }

  const category = getCategoryById(ticket.categoryId);
  const worker = ticket.workerId ? users.find((u) => u.userId === ticket.workerId) : null;
  const ticketHistory = history.filter((h) => h.ticketId === ticket.ticketId);
  const ticketComments = comments.filter((c) => c.ticketId === ticket.ticketId);
  const ticketMedia = media.filter((m) => m.ticketId === ticket.ticketId);

  const needsCostResponsibility = ticket.costResponsibility === 'Pending Review';

  const submitClose = async (costResponsibility?: CostChoice) => {
    if (rating === 0 || !token || verifying) return;
    setVerifyError('');
    setVerifying(true);
    try {
      await verifyAndClose(token, ticket.ticketId, { rating, feedback, costResponsibility });
      setShowCostModal(false);
    } catch (err) {
      setVerifyError(
        err instanceof ApiError ? err.message : 'Could not submit your feedback. Please try again.',
      );
      throw err;
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyPress = () => {
    if (rating === 0 || verifying) return;
    if (needsCostResponsibility) {
      setShowCostModal(true);
      return;
    }
    // Error is surfaced via verifyError; swallow the rethrow used by the modal path.
    submitClose().catch(() => {});
  };

  const doCancel = async () => {
    if (!token || cancelling) return;
    setCancelError('');
    setCancelling(true);
    try {
      await cancelTicket(token, ticket.ticketId);
      router.back();
    } catch (err) {
      setCancelError(
        err instanceof ApiError ? err.message : 'Could not cancel this request. Please try again.',
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelPress = () => {
    const message =
      'This will withdraw your complaint. The facility team will be notified and no technician will be dispatched. This cannot be undone.';
    // Alert.alert's buttons/onPress never fire on web - react-native-web ships it as a no-op
    // (see node_modules/react-native-web/src/exports/Alert), so this needs a web-specific path.
    if (Platform.OS === 'web') {
      if (window.confirm(`Cancel this request?\n\n${message}`)) doCancel();
      return;
    }
    Alert.alert('Cancel this request?', message, [
      { text: 'Keep Request', style: 'cancel' },
      { text: 'Cancel Request', style: 'destructive', onPress: doCancel },
    ]);
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader
        title={category.categoryName}
        subtitle={`Reported ${formatFullDate(ticket.dateOfRequest)}`}
        showBack
      />
      <Screen edges={['bottom']}>
        <TicketMediaGallery media={ticketMedia} height={220} />

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

        <AIDescriptionCard
          description={ticket.aiDescription}
          confidence={ticket.aiConfidence}
          categoryId={ticket.categoryId}
          priority={ticket.priority}
        />

        {!!ticket.residentNote && (
          <Card>
            <Text style={styles.sectionLabel}>Your note</Text>
            <Text style={styles.body}>{ticket.residentNote}</Text>
          </Card>
        )}

        {!!ticket.voiceNoteUrl && (
          <Card>
            <Text style={styles.sectionLabel}>Voice Note</Text>
            <VoiceNotePlayer uri={ticket.voiceNoteUrl} durationSec={ticket.voiceNoteDurationSec} />
          </Card>
        )}

        {worker && (
          <Card style={styles.workerCard}>
            <Avatar name={worker.name} color={worker.avatarColor} size={44} />
            <View style={styles.workerInfo}>
              <Text style={styles.sectionLabel}>Assigned Technician</Text>
              <Text style={styles.workerName}>{worker.name}</Text>
              {'specialization' in worker && (
                <Text style={styles.workerSpec}>{worker.specialization}</Text>
              )}
            </View>
            <View style={styles.contactActions}>
              <Pressable
                style={styles.callIcon}
                onPress={() => Linking.openURL(`tel:${worker.phone}`)}
                accessibilityRole="button"
                accessibilityLabel={`Call ${worker.name}`}
              >
                <Ionicons name="call-outline" size={16} color={Colors.primary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.supportButton, pressed && styles.pressedButton]}
                onPress={() => Linking.openURL(`tel:${MAINTENANCE_SUPPORT_PHONE}`)}
                accessibilityRole="button"
                accessibilityLabel="Call maintenance support"
              >
                <Ionicons name="headset-outline" size={16} color={Colors.primary} />
                <Text style={styles.supportButtonText}>Support</Text>
              </Pressable>
            </View>
          </Card>
        )}

        <Card style={styles.costCard}>
          <Ionicons name="wallet-outline" size={18} color={Colors.primaryDark} />
          <View style={styles.costText}>
            <Text style={styles.sectionLabel}>Cost Responsibility</Text>
            <Text style={styles.body}>
              {ticket.costResponsibility === 'Pending Review'
                ? ticket.status === 'Resolved'
                  ? 'Not set by the facility team — you’ll confirm this when you close the complaint.'
                  : 'Will be confirmed once the facility team reviews this complaint.'
                : `Payable by: ${ticket.costResponsibility}`}
            </Text>
          </View>
        </Card>

        {ticket.status === 'Resolved' && (
          <>
            <Card>
              <Text style={styles.sectionLabel}>Resolution Notes</Text>
              <Text style={styles.body}>{ticket.resolutionRemarks}</Text>
              {ticket.resolutionProofUrl && (
                <View style={styles.proofWrap}>
                  <MediaThumb uri={ticket.resolutionProofUrl} height={160} />
                </View>
              )}
            </Card>

            <Card style={styles.verifyCard}>
              <Text style={styles.verifyTitle}>Verify & Rate the Work</Text>
              <Text style={styles.body}>
                Confirm the issue is fixed before this complaint is closed.
              </Text>
              <RatingStars value={rating} onChange={setRating} size={30} />
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Add feedback (optional)"
                placeholderTextColor={Colors.inkTertiary}
                style={styles.feedbackInput}
                multiline
              />
              {needsCostResponsibility && (
                <Text style={styles.body}>
                  You&rsquo;ll be asked to confirm who covers the repair cost before this
                  complaint is closed.
                </Text>
              )}
              {!!verifyError && <Text style={styles.error}>{verifyError}</Text>}
              <Button
                label={verifying ? 'Submitting…' : 'Verify & Close Complaint'}
                fullWidth
                disabled={rating === 0 || verifying}
                onPress={handleVerifyPress}
              />
            </Card>
          </>
        )}

        {ticket.status === 'Closed' && (
          <Card>
            <Text style={styles.sectionLabel}>Your Feedback</Text>
            <RatingStars value={ticket.residentRating ?? 0} readOnly size={22} />
            {!!ticket.residentFeedback && (
              <Text style={styles.body}>{ticket.residentFeedback}</Text>
            )}
          </Card>
        )}

        {ticket.status === 'Rejected' && (
          <Card style={styles.rejectedCard}>
            <Text style={styles.sectionLabel}>Why this was closed</Text>
            <Text style={styles.body}>
              {ticket.resolutionRemarks || 'The facility team closed this request without assigning maintenance staff.'}
            </Text>
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
          <Card>
            <CommentsThread comments={ticketComments} ticketId={ticket.ticketId} />
          </Card>
        </View>

        {ticket.status === 'Pending' && (
          <View style={styles.section}>
            {!!cancelError && <Text style={styles.error}>{cancelError}</Text>}
            <Button
              label={cancelling ? 'Cancelling…' : 'Cancel Request'}
              icon="trash-outline"
              variant="danger"
              fullWidth
              disabled={cancelling}
              onPress={handleCancelPress}
            />
          </View>
        )}
      </Screen>

      <CostResponsibilityModal
        visible={showCostModal}
        onClose={() => setShowCostModal(false)}
        onConfirm={(choice) => submitClose(choice)}
      />
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
    workerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    workerInfo: {
      flex: 1,
    },
    workerName: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    workerSpec: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    callIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    supportButton: {
      height: 34,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      backgroundColor: Colors.primarySoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    pressedButton: {
      opacity: 0.75,
    },
    supportButtonText: {
      ...Type.tiny,
      color: Colors.primary,
    },
    costCard: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    costText: {
      flex: 1,
    },
    proofWrap: {
      marginTop: Spacing.sm,
    },
    verifyCard: {
      gap: Spacing.sm,
      backgroundColor: Colors.accentSoft,
      borderColor: '#F1D9AE',
    },
    rejectedCard: {
      gap: 4,
      backgroundColor: Colors.dangerSoft,
    },
    verifyTitle: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    feedbackInput: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      minHeight: 70,
      color: Colors.ink,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      textAlignVertical: 'top',
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitleLg: {
      ...Type.subtitle,
      color: Colors.ink,
    },
  });
