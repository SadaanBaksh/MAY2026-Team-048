import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BurgerMenu } from '@/components/shared/BurgerMenu';
import { NoticeCard } from '@/components/shared/NoticeCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useNoticeStore } from '@/store/noticeStore';

type Filter = 'All' | 'Drafts' | 'Scheduled' | 'Sent';

export default function ManagerNoticesScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((state) => state.token);
  const notices = useNoticeStore((state) => state.notices);
  const loading = useNoticeStore((state) => state.loading);
  const refresh = useNoticeStore((state) => state.refreshNotices);
  const [filter, setFilter] = useState<Filter>('All');

  useFocusEffect(
    useCallback(() => {
      if (token) refresh(token).catch(() => {});
    }, [token, refresh]),
  );

  const filtered = notices.filter((notice) => {
    if (filter === 'Drafts') return notice.status === 'Draft';
    if (filter === 'Scheduled') return notice.status === 'Scheduled';
    if (filter === 'Sent') return notice.status === 'Sent' || notice.status === 'Expired';
    return true;
  });

  return (
    <Screen
      edges={['top']}
      refreshing={loading}
      onRefresh={() => token && refresh(token).catch(() => {})}
    >
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <BurgerMenu />
          <View>
            <Text style={styles.title}>Resident notices</Text>
            <Text style={styles.subtitle}>Draft, schedule and review community announcements</Text>
          </View>
        </View>
        <Button
          label="New notice"
          icon="add"
          size="sm"
          onPress={() => router.push('/(manager)/notice/new')}
        />
      </View>

      <SegmentedControl
        options={[
          { label: 'All', value: 'All' },
          { label: 'Drafts', value: 'Drafts' },
          { label: 'Scheduled', value: 'Scheduled' },
          { label: 'Sent', value: 'Sent' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {filtered.length ? (
        <View style={styles.list}>
          {filtered.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              onPress={() => router.push(`/(manager)/notice/${notice.id}`)}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="megaphone-outline"
          title={filter === 'All' ? 'No notices yet' : `No ${filter.toLowerCase()}`}
          message="Create a clear notice from a short brief and deliver it to selected towers."
          actionLabel="Create Notice"
          onAction={() => router.push('/(manager)/notice/new')}
        />
      )}
    </Screen>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    headerTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    title: { ...Type.title, color: Colors.ink },
    subtitle: { ...Type.caption, color: Colors.inkSecondary },
    list: { gap: Spacing.sm },
  });
