import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { PublicComments } from '@/components/shared/PublicComments';
import { MediaThumb } from '@/components/shared/MediaThumb';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SwipeToResolve } from '@/components/ui/SwipeToResolve';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useAuthStore } from '@/store/authStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';
import type { MaintenanceStaff, UserRole } from '@/types';
import { formatFullDate } from '@/utils/date';

function publicRoute(role: UserRole, id: string): string {
  if (role === 'facility_employee') return `/(employee)/public/${id}`;
  if (role === 'maintenance_staff') return `/(maintenance)/public/${id}`;
  if (role === 'facility_manager') return `/(manager)/public/${id}`;
  return `/(resident)/public/${id}`;
}

// The public-service detail route is a sibling of each role's tab group, so a bare
// router.back() from it is unreliable (it can surface whatever tab was last focused).
// Navigate explicitly to where the request was opened from instead.
function publicHomeRoute(role: UserRole): string {
  if (role === 'facility_employee') return '/(employee)/(tabs)/public';
  if (role === 'maintenance_staff') return '/(maintenance)/(tabs)';
  if (role === 'facility_manager') return '/(manager)/(tabs)';
  return '/(resident)/(tabs)/public';
}

export function PublicServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { Colors } = useTheme();
  const isDesktop = useIsDesktop();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const user = useAuthStore((state) => state.currentUser)!;
  const users = useAuthStore((state) => state.users);
  const refreshUsers = useAuthStore((state) => state.refreshUsers);
  const token = useAuthStore((state) => state.token);
  const services = usePublicServiceStore((state) => state.services);
  const commentsByService = usePublicServiceStore((state) => state.comments);
  const refreshService = usePublicServiceStore((state) => state.refreshService);
  const refreshComments = usePublicServiceStore((state) => state.refreshComments);
  const updateService = usePublicServiceStore((state) => state.updateService);
  const addComment = usePublicServiceStore((state) => state.addComment);
  const unmergeService = usePublicServiceStore((state) => state.unmergeService);
  const [sending, setSending] = useState(false);
  const [working, setWorking] = useState(false);
  const [unmerging, setUnmerging] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!token || !id) return;
      refreshService(token, id).catch(() => {});
      refreshComments(token, id).catch(() => {});
      if (user.role === 'facility_employee') refreshUsers().catch(() => {});
    }, [token, id, user.role, refreshService, refreshComments, refreshUsers]),
  );

  const goBack = () => router.navigate(publicHomeRoute(user.role) as never);

  const service = services.find((item) => item.id === id);
  if (!service) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Public Service" showBack onBack={goBack} />
        <Screen>
          <EmptyState icon="alert-circle-outline" title="Public service not found" />
        </Screen>
      </View>
    );
  }

  const comments = commentsByService[service.id] ?? [];
  const isContributor = service.reports.some((report) => report.authorId === user.userId);
  const locked =
    service.status === 'Resolved' || service.status === 'Merged' || service.status === 'Rejected';
  const workers = users.filter(
    (item): item is MaintenanceStaff =>
      item.role === 'maintenance_staff' && item.accountStatus === 'active',
  );

  const doUpdate = async (patch: Parameters<typeof updateService>[2]) => {
    if (!token || working) return;
    setWorking(true);
    setError('');
    try {
      await updateService(token, service.id, patch);
      setRemarks('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this public service.');
    } finally {
      setWorking(false);
    }
  };

  const residentResolve = () => {
    const resolve = () =>
      doUpdate({
        status: 'Resolved',
        resolution_remarks: 'Marked resolved by a contributing resident.',
      });
    const message =
      'The discussion will close and the issue will remain visible in public history.';
    // Alert.alert's buttons/onPress never fire on web - react-native-web ships it as a no-op.
    if (Platform.OS === 'web') {
      if (window.confirm(`Mark this issue resolved?\n\n${message}`)) resolve();
      return;
    }
    Alert.alert('Mark this issue resolved?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Resolved', onPress: resolve },
    ]);
  };

  const rejectService = () => {
    const reason = remarks.trim();
    if (!reason) return;
    const doReject = () => doUpdate({ status: 'Rejected', resolution_remarks: reason });
    const message = `This will dismiss the report as implausible and notify contributors with your reason: "${reason}". This cannot be undone.`;
    // Alert.alert's buttons/onPress never fire on web - react-native-web ships it as a no-op.
    if (Platform.OS === 'web') {
      if (window.confirm(`Reject this report?\n\n${message}`)) doReject();
      return;
    }
    Alert.alert('Reject this report?', message, [
      { text: 'Keep Report', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: doReject },
    ]);
  };

  const canUnmerge =
    user.role === 'facility_employee' &&
    service.mergedFromCount > 0 &&
    service.status === 'Pending' &&
    !service.workerId;

  const unmerge = () => {
    const doUnmerge = async () => {
      if (!token || unmerging) return;
      setUnmerging(true);
      setError('');
      try {
        await unmergeService(token, service.id);
        goBack();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not unmerge this page.');
      } finally {
        setUnmerging(false);
      }
    };
    const message = `The ${service.mergedFromCount} reports on this page move back to their own separate pages and this combined page is removed. Comments posted here move to the oldest report.`;
    if (Platform.OS === 'web') {
      if (window.confirm(`Unmerge this combined page?\n\n${message}`)) doUnmerge();
      return;
    }
    Alert.alert('Unmerge this combined page?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unmerge', style: 'destructive', onPress: doUnmerge },
    ]);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Public Service" subtitle={service.location} showBack onBack={goBack} />
      <Screen edges={['bottom']}>
        {service.status === 'Merged' && service.mergedIntoId && (
          <Card style={styles.mergedBanner}>
            <Ionicons name="git-merge-outline" size={24} color={Colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>This report was merged</Text>
              <Text style={styles.secondary}>
                Open the combined service page to see every resident report.
              </Text>
            </View>
            <Button
              label="Open"
              size="sm"
              onPress={() => router.replace(publicRoute(user.role, service.mergedIntoId!) as never)}
            />
          </Card>
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{service.title}</Text>
          <View style={styles.badges}>
            <PriorityBadge priority={service.priority} />
            <StatusBadge status={service.status} />
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={17} color={Colors.inkSecondary} />
            <Text style={styles.secondary}>{service.location}</Text>
          </View>
        </View>

        {service.reports.length > 1 && (
          <Card style={styles.aiCard}>
            <View style={styles.locationRow}>
              <Ionicons name="sparkles" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Combined service</Text>
            </View>
            <Text style={styles.secondary}>{service.aiSummary}</Text>
          </Card>
        )}

        {canUnmerge && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Combined from {service.mergedFromCount} requests</Text>
            <Text style={styles.secondary}>
              Split this page back into separate requests. Available until a worker is assigned.
            </Text>
            <Button
              label={unmerging ? 'Unmerging…' : 'Unmerge'}
              variant="outline"
              icon="git-branch-outline"
              disabled={unmerging}
              onPress={unmerge}
            />
          </Card>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {service.reports.length > 1
              ? `${service.reports.length} merged resident reports`
              : 'Resident report'}
          </Text>
          {service.reports.map((report) => (
            <Card key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={styles.flex}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.author}>
                    {report.authorName}
                    {report.authorBuilding ? ` · ${report.authorBuilding}` : ''}
                  </Text>
                </View>
                <Text style={styles.date}>{formatFullDate(report.createdAt)}</Text>
              </View>
              <Text style={styles.body}>{report.description}</Text>
              {report.location !== service.location && (
                <Text style={styles.secondary}>Location supplied: {report.location}</Text>
              )}
              {report.media.map((media) => (
                <MediaThumb key={media.id} uri={media.mediaUrl} height={170} />
              ))}
            </Card>
          ))}
        </View>

        {service.workerId && (
          <Card>
            <Text style={styles.label}>Assigned maintenance staff</Text>
            <Text style={styles.body}>
              {users.find((item) => item.userId === service.workerId)?.name ??
                'Assigned staff member'}
            </Text>
          </Card>
        )}

        {user.role === 'facility_employee' && !locked && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assign maintenance staff</Text>
            <View style={styles.workerList}>
              {workers.map((worker) => (
                <Button
                  key={worker.userId}
                  label={
                    service.workerId === worker.userId ? `${worker.name} · Assigned` : worker.name
                  }
                  size="sm"
                  variant={service.workerId === worker.userId ? 'primary' : 'outline'}
                  disabled={working}
                  onPress={() => doUpdate({ worker_id: worker.userId })}
                />
              ))}
            </View>
          </View>
        )}

        {user.role === 'maintenance_staff' && service.status === 'Assigned' && (
          <Button
            label="Start Work"
            icon="play-circle-outline"
            fullWidth
            loading={working}
            onPress={() => doUpdate({ status: 'In_Progress' })}
          />
        )}

        {((user.role === 'maintenance_staff' && service.status === 'In_Progress') ||
          (user.role === 'facility_employee' && !locked)) && (
          <Card style={styles.resolveCard}>
            <Text style={styles.sectionTitle}>Resolve public service</Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Resolution details"
              placeholderTextColor={Colors.inkTertiary}
              multiline
              style={styles.remarks}
            />
            {user.role === 'maintenance_staff' && !isDesktop ? (
              <SwipeToResolve
                loading={working}
                blocked={!remarks.trim()}
                blockedMessage="Add resolution details before resolving."
                onResolve={() =>
                  doUpdate({ status: 'Resolved', resolution_remarks: remarks.trim() })
                }
              />
            ) : (
              <Button
                label="Mark Resolved"
                fullWidth
                loading={working}
                disabled={!remarks.trim()}
                onPress={() => doUpdate({ status: 'Resolved', resolution_remarks: remarks.trim() })}
              />
            )}
            {user.role === 'facility_employee' && service.status === 'Pending' && (
              <Button
                label="Reject as Implausible"
                icon="ban-outline"
                variant="danger"
                fullWidth
                loading={working}
                disabled={!remarks.trim()}
                onPress={rejectService}
              />
            )}
          </Card>
        )}

        {user.role === 'resident' && isContributor && !locked && (
          <Button
            label="Mark Issue Resolved"
            variant="outline"
            fullWidth
            loading={working}
            onPress={residentResolve}
          />
        )}

        {service.status === 'Resolved' && (
          <Card style={styles.resolvedCard}>
            <Text style={styles.sectionTitle}>Resolved</Text>
            <Text style={styles.body}>
              {service.resolutionRemarks || 'This public issue has been resolved.'}
            </Text>
          </Card>
        )}

        {service.status === 'Rejected' && (
          <Card style={styles.rejectedCard}>
            <Text style={styles.sectionTitle}>Rejected</Text>
            <Text style={styles.body}>
              {service.resolutionRemarks || 'The facility team determined this was not a real issue.'}
            </Text>
          </Card>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
        {service.status !== 'Merged' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Community discussion</Text>
            <Card>
              <PublicComments
                comments={comments}
                locked={locked}
                currentUserId={user.userId}
                sending={sending}
                onSend={async (message) => {
                  if (!token) return;
                  setSending(true);
                  setError('');
                  try {
                    await addComment(token, service.id, message);
                  } catch (err) {
                    setError(
                      err instanceof ApiError ? err.message : 'Could not post your comment.',
                    );
                    throw err;
                  } finally {
                    setSending(false);
                  }
                }}
              />
            </Card>
          </View>
        )}
      </Screen>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.surfaceMuted },
    flex: { flex: 1 },
    titleBlock: { gap: Spacing.xs },
    title: { ...Type.title, color: Colors.ink },
    badges: { flexDirection: 'row', gap: 6 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    section: { gap: Spacing.sm },
    sectionTitle: { ...Type.subtitle, color: Colors.ink },
    body: { ...Type.body, color: Colors.ink },
    secondary: { ...Type.caption, color: Colors.inkSecondary, flexShrink: 1 },
    author: { ...Type.caption, color: Colors.inkSecondary },
    date: { ...Type.tiny, color: Colors.inkTertiary },
    label: { ...Type.tiny, color: Colors.inkTertiary, textTransform: 'uppercase' },
    reportCard: { gap: Spacing.xs },
    reportHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
    reportTitle: { ...Type.bodyMedium, color: Colors.ink },
    mergedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.primarySoft,
    },
    aiCard: { gap: Spacing.xs, backgroundColor: Colors.primarySoft },
    workerList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    resolveCard: { gap: Spacing.sm },
    remarks: {
      minHeight: 80,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      padding: Spacing.sm,
      color: Colors.ink,
      textAlignVertical: 'top',
      backgroundColor: Colors.surfaceMuted,
    },
    resolvedCard: { gap: 4, backgroundColor: Colors.successSoft },
    rejectedCard: { gap: 4, backgroundColor: Colors.dangerSoft },
    error: { ...Type.caption, color: Colors.danger },
  });
