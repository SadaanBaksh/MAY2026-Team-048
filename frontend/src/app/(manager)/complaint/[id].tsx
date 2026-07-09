import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AIDescriptionCard } from '@/components/shared/AIDescriptionCard';
import { CommentsThread } from '@/components/shared/CommentsThread';
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
import { MediaThumb } from '@/components/shared/MediaThumb';
import { Avatar } from '@/components/ui/Avatar';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RatingStars } from '@/components/ui/RatingStars';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusStepper } from '@/components/ui/StatusStepper';
import { APARTMENTS } from '@/data/seed';
import { getCategoryById } from '@/data/categories';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import { formatFullDate } from '@/utils/date';

export default function ManagerComplaintAuditScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.currentUser)!;
  const users = useAuthStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);
  const history = useTicketStore((s) => s.history);
  const comments = useTicketStore((s) => s.comments);

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
  const resident = users.find((u) => u.userId === ticket.residentId);
  const worker = ticket.workerId ? users.find((u) => u.userId === ticket.workerId) : null;
  const apartment =
    resident && resident.role === 'resident'
      ? APARTMENTS.find((a) => a.apartmentId === resident.apartmentId)
      : null;
  const ticketHistory = history.filter((h) => h.ticketId === ticket.ticketId);
  const ticketComments = comments.filter((c) => c.ticketId === ticket.ticketId);

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

        <View style={styles.peopleRow}>
          {resident && (
            <Card style={styles.personCard}>
              <Avatar name={resident.name} color={resident.avatarColor} size={38} />
              <View style={styles.personInfo}>
                <Text style={styles.sectionLabel}>Resident</Text>
                <Text style={styles.personName}>{resident.name}</Text>
                <Text style={styles.personMeta}>
                  {apartment ? `${apartment.unitNumber}, ${apartment.building}` : ''}
                </Text>
              </View>
            </Card>
          )}
          {worker && (
            <Card style={styles.personCard}>
              <Avatar name={worker.name} color={worker.avatarColor} size={38} />
              <View style={styles.personInfo}>
                <Text style={styles.sectionLabel}>Assigned To</Text>
                <Text style={styles.personName}>{worker.name}</Text>
                {'specialization' in worker && (
                  <Text style={styles.personMeta}>{worker.specialization}</Text>
                )}
              </View>
            </Card>
          )}
        </View>

        <AIDescriptionCard
          description={ticket.aiDescription}
          confidence={ticket.aiConfidence}
          categoryId={ticket.categoryId}
          priority={ticket.priority}
        />

        <Card>
          <Text style={styles.sectionLabel}>Cost Responsibility</Text>
          <Text style={styles.body}>{ticket.costResponsibility}</Text>
        </Card>

        {ticket.residentRating != null && (
          <Card>
            <Text style={styles.sectionLabel}>Resident Rating</Text>
            <RatingStars value={ticket.residentRating} readOnly size={20} />
            {!!ticket.residentFeedback && (
              <Text style={styles.body}>{ticket.residentFeedback}</Text>
            )}
          </Card>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitleLg}>Audit Trail</Text>
          <Card>
            <HistoryTimeline entries={ticketHistory} />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleLg}>Messages</Text>
          <Card>
            <CommentsThread comments={ticketComments} currentUserId={user.userId} readOnly />
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
    peopleRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    personCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    personInfo: {
      flex: 1,
      gap: 1,
    },
    personName: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    personMeta: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionTitleLg: {
      ...Type.subtitle,
      color: Colors.ink,
    },
  });
