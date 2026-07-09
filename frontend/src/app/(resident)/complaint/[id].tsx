import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AIDescriptionCard } from '@/components/shared/AIDescriptionCard';
import { CommentsThread } from '@/components/shared/CommentsThread';
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
import { MediaThumb } from '@/components/shared/MediaThumb';
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
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import { formatFullDate } from '@/utils/date';

export default function ResidentComplaintDetailScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.currentUser)!;
  const users = useAuthStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);
  const history = useTicketStore((s) => s.history);
  const comments = useTicketStore((s) => s.comments);
  const verifyAndClose = useTicketStore((s) => s.verifyAndClose);
  const addComment = useTicketStore((s) => s.addComment);

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

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

  const handleVerify = () => {
    if (rating === 0) return;
    verifyAndClose(ticket.ticketId, { rating, feedback });
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader title={category.categoryName} subtitle={`Reported ${formatFullDate(ticket.dateOfRequest)}`} showBack />
      <Screen edges={['bottom']}>
        {ticket.imageUrl && <MediaThumb uri={ticket.imageUrl} mediaType={ticket.mediaType} height={220} />}

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

        {worker && (
          <Card style={styles.workerCard}>
            <Avatar name={worker.name} color={worker.avatarColor} size={44} />
            <View style={styles.workerInfo}>
              <Text style={styles.sectionLabel}>Assigned Technician</Text>
              <Text style={styles.workerName}>{worker.name}</Text>
              {'specialization' in worker && <Text style={styles.workerSpec}>{worker.specialization}</Text>}
            </View>
            <View style={styles.callIcon}>
              <Ionicons name="call-outline" size={16} color={Colors.primary} />
            </View>
          </Card>
        )}

        <Card style={styles.costCard}>
          <Ionicons name="wallet-outline" size={18} color={Colors.primaryDark} />
          <View style={styles.costText}>
            <Text style={styles.sectionLabel}>Cost Responsibility</Text>
            <Text style={styles.body}>
              {ticket.costResponsibility === 'Pending Review'
                ? 'Will be confirmed once the facility team reviews this complaint.'
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
              <Text style={styles.body}>Confirm the issue is fixed before this complaint is closed.</Text>
              <RatingStars value={rating} onChange={setRating} size={30} />
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Add feedback (optional)"
                placeholderTextColor={Colors.inkTertiary}
                style={styles.feedbackInput}
                multiline
              />
              <Button label="Verify & Close Complaint" fullWidth disabled={rating === 0} onPress={handleVerify} />
            </Card>
          </>
        )}

        {ticket.status === 'Closed' && (
          <Card>
            <Text style={styles.sectionLabel}>Your Feedback</Text>
            <RatingStars value={ticket.residentRating ?? 0} readOnly size={22} />
            {!!ticket.residentFeedback && <Text style={styles.body}>{ticket.residentFeedback}</Text>}
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

const getStyles = (Colors: ThemeColors) => StyleSheet.create({
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
    borderColor: 'rgba(255,223,0,0.35)',
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
