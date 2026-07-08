import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AIDescriptionCard } from '@/components/shared/AIDescriptionCard';
import { CommentsThread } from '@/components/shared/CommentsThread';
import { HistoryTimeline } from '@/components/shared/HistoryTimeline';
import { MediaThumb } from '@/components/shared/MediaThumb';
import { Avatar } from '@/components/ui/Avatar';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
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
import type { CostResponsibility, MaintenanceStaff, Priority } from '@/types';
import { formatFullDate } from '@/utils/date';

const COST_OPTIONS: CostResponsibility[] = ['Owner', 'Resident', 'Society', 'Pending Review'];

export default function EmployeeComplaintDetailScreen() {
  const { Colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.currentUser)!;
  const users = useAuthStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);
  const history = useTicketStore((s) => s.history);
  const comments = useTicketStore((s) => s.comments);
  const reviewAndAssign = useTicketStore((s) => s.reviewAndAssign);
  const addComment = useTicketStore((s) => s.addComment);

  const ticket = tickets.find((t) => t.ticketId === id);

  const [categoryId, setCategoryId] = useState(ticket?.categoryId ?? '');
  const [priority, setPriority] = useState<Priority>(ticket?.priority ?? 'Medium');
  const [costResponsibility, setCostResponsibility] = useState<CostResponsibility>(
    ticket?.costResponsibility ?? 'Pending Review'
  );
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(ticket?.workerId ?? null);

  const resident = ticket ? users.find((u) => u.userId === ticket.residentId) : null;
  const apartment = resident && resident.role === 'resident' ? APARTMENTS.find((a) => a.apartmentId === resident.apartmentId) : null;

  const workers = useMemo(() => {
    if (!ticket) return [];
    const category = getCategoryById(categoryId);
    const staff = users.filter((u): u is MaintenanceStaff => u.role === 'maintenance_staff');
    return staff
      .map((w) => ({
        worker: w,
        activeJobs: tickets.filter((t) => t.workerId === w.userId && (t.status === 'Assigned' || t.status === 'In_Progress')).length,
        relevance: category.categoryName.toLowerCase().includes(w.specialization.toLowerCase().split(' ')[0])
          ? 0
          : 1,
      }))
      .sort((a, b) => a.relevance - b.relevance || a.activeJobs - b.activeJobs);
  }, [users, tickets, categoryId, ticket]);

  const styles = useMemo(() => getStyles(Colors), [Colors]);

  if (!ticket) {
    return (
      <Screen>
        <ScreenHeader title="Complaint" showBack />
        <EmptyState icon="alert-circle-outline" title="Complaint not found" />
      </Screen>
    );
  }

  const category = getCategoryById(ticket.categoryId);
  const assignedWorker = ticket.workerId ? users.find((u) => u.userId === ticket.workerId) : null;
  const canEdit = ticket.status === 'Pending' || ticket.status === 'Assigned';
  const ticketHistory = history.filter((h) => h.ticketId === ticket.ticketId);
  const ticketComments = comments.filter((c) => c.ticketId === ticket.ticketId);

  const handleAssign = () => {
    if (!selectedWorkerId) return;
    reviewAndAssign(
      ticket.ticketId,
      { categoryId, priority, workerId: selectedWorkerId, costResponsibility },
      { name: user.name, role: 'Facility Employee' }
    );
  };

  return (
    <View style={styles.wrapper}>
      <ScreenHeader title={category.categoryName} subtitle={`Reported ${formatFullDate(ticket.dateOfRequest)}`} showBack />
      <Screen edges={['bottom']}>
        {ticket.imageUrl && <MediaThumb uri={ticket.imageUrl} mediaType={ticket.mediaType} height={200} />}

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{ticket.title}</Text>
          <View style={styles.badgeRow}>
            <PriorityBadge priority={priority} />
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
              <Text style={styles.sectionLabel}>Reported By</Text>
              <Text style={styles.personName}>{resident.name}</Text>
              <Text style={styles.personMeta}>
                {apartment ? `${apartment.unitNumber}, ${apartment.building}` : ''} · {resident.phone}
              </Text>
            </View>
          </Card>
        )}

        <AIDescriptionCard
          description={ticket.aiDescription}
          confidence={ticket.aiConfidence}
          categoryId={categoryId}
          priority={priority}
          editable={canEdit}
          onChangeCategory={canEdit ? setCategoryId : undefined}
          onChangePriority={canEdit ? setPriority : undefined}
        />

        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Cost Responsibility</Text>
          {canEdit ? (
            <View style={styles.chipRow}>
              {COST_OPTIONS.map((opt) => (
                <Chip key={opt} label={opt} active={costResponsibility === opt} onPress={() => setCostResponsibility(opt)} />
              ))}
            </View>
          ) : (
            <Text style={styles.body}>{ticket.costResponsibility}</Text>
          )}
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitleLg}>{canEdit ? 'Assign Maintenance Staff' : 'Assigned Staff'}</Text>
          {canEdit ? (
            <View style={styles.workerList}>
              {workers.map(({ worker, activeJobs }) => {
                const selected = selectedWorkerId === worker.userId;
                return (
                  <Card
                    key={worker.userId}
                    onPress={() => setSelectedWorkerId(worker.userId)}
                    style={[styles.workerCard, selected && styles.workerCardSelected]}>
                    <Avatar name={worker.name} color={worker.avatarColor} size={40} />
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>{worker.name}</Text>
                      <Text style={styles.personMeta}>
                        {worker.specialization} · {activeJobs} active
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? Colors.primary : Colors.borderStrong}
                    />
                  </Card>
                );
              })}
              <Button
                label={ticket.workerId ? 'Update Assignment' : 'Assign & Notify'}
                fullWidth
                size="lg"
                disabled={!selectedWorkerId}
                onPress={handleAssign}
                icon="checkmark-circle-outline"
              />
            </View>
          ) : assignedWorker ? (
            <Card style={styles.personCard}>
              <Avatar name={assignedWorker.name} color={assignedWorker.avatarColor} size={44} />
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{assignedWorker.name}</Text>
                {'specialization' in assignedWorker && <Text style={styles.personMeta}>{assignedWorker.specialization}</Text>}
              </View>
            </Card>
          ) : null}
        </View>

        {ticket.status === 'Closed' && ticket.residentRating != null && (
          <Card>
            <Text style={styles.sectionLabel}>Resident Feedback</Text>
            <RatingStars value={ticket.residentRating} readOnly size={20} />
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
    section: {
      gap: Spacing.sm,
    },
    sectionTitleLg: {
      ...Type.subtitle,
      color: Colors.ink,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    workerList: {
      gap: Spacing.xs,
    },
    workerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1.5,
    },
    workerCardSelected: {
      borderColor: Colors.primary,
      backgroundColor: Colors.primarySoft,
    },
  });
