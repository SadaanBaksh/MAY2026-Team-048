import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { PublicServiceCard } from '@/components/shared/PublicServiceCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SearchBar } from '@/components/ui/SearchBar';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';
import type { PublicServiceStatus } from '@/types';

// A service can be folded into a combined page only while it's still open.
const MERGEABLE_STATUSES: PublicServiceStatus[] = ['Pending', 'Assigned', 'In_Progress'];

export default function EmployeePublicServicesScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((state) => state.token);
  const services = usePublicServiceStore((state) => state.services);
  const suggestions = usePublicServiceStore((state) => state.suggestions);
  const loading = usePublicServiceStore((state) => state.loading);
  const refreshServices = usePublicServiceStore((state) => state.refreshServices);
  const refreshSuggestions = usePublicServiceStore((state) => state.refreshSuggestions);
  const mergeServices = usePublicServiceStore((state) => state.mergeServices);
  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  const refresh = useCallback(() => {
    if (!token) return;
    Promise.all([refreshServices(token), refreshSuggestions(token)]).catch(() => {});
  }, [token, refreshServices, refreshSuggestions]);
  useFocusEffect(refresh);

  const mergeable = useMemo(
    () => services.filter((s) => MERGEABLE_STATUSES.includes(s.status)),
    [services],
  );

  const visible = selecting ? mergeable : services;
  const filtered = visible.filter((service) => {
    const value = query.trim().toLowerCase();
    return (
      !value ||
      service.title.toLowerCase().includes(value) ||
      service.location.toLowerCase().includes(value)
    );
  });

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const exitSelection = () => {
    setSelecting(false);
    setSelectedIds([]);
  };

  const doMerge = async () => {
    if (!token || selectedIds.length < 2) return;
    setMerging(true);
    try {
      const merged = await mergeServices(token, selectedIds);
      exitSelection();
      router.push(`/(employee)/public/${merged.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not merge these requests. Please try again.';
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Merge failed', message);
    } finally {
      setMerging(false);
    }
  };

  const confirmMerge = () => {
    const message = `${selectedIds.length} requests will be combined into one page. Their reports, photos, and comments move to the combined page and the originals are closed as merged. This cannot be undone.`;
    if (Platform.OS === 'web') {
      if (window.confirm(`Merge ${selectedIds.length} public service requests?\n\n${message}`)) {
        doMerge();
      }
      return;
    }
    Alert.alert('Merge requests?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Merge', style: 'destructive', onPress: doMerge },
    ]);
  };

  return (
    <View style={styles.root}>
      <Screen edges={['top']} refreshing={loading} onRefresh={refresh}>
        <View>
          <Text style={styles.title}>Public Services</Text>
          <Text style={styles.subtitle}>
            {selecting
              ? 'Tick the open requests that describe the same issue, then merge them.'
              : 'Assign shared issues and review AI merge suggestions'}
          </Text>
        </View>

        {selecting ? (
          <View style={styles.selectionActions}>
            <Button
              label="Cancel"
              variant="ghost"
              size="sm"
              onPress={exitSelection}
              disabled={merging}
            />
            <Button
              label={
                merging
                  ? 'Merging…'
                  : selectedIds.length >= 2
                    ? `Merge ${selectedIds.length}`
                    : 'Merge'
              }
              size="sm"
              icon="git-merge-outline"
              disabled={selectedIds.length < 2 || merging}
              onPress={confirmMerge}
            />
          </View>
        ) : (
          mergeable.length >= 2 && (
            <Button
              label="Merge duplicate requests"
              variant="outline"
              size="sm"
              icon="git-merge-outline"
              onPress={() => setSelecting(true)}
            />
          )
        )}

        {suggestions.length > 0 && !selecting && (
          <Card style={styles.reviewBanner}>
            <Text style={styles.reviewCount}>{suggestions.length}</Text>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>Possible duplicate reports</Text>
              <Text style={styles.subtitle}>
                The highest-scoring suggestion is ready for review.
              </Text>
            </View>
          </Card>
        )}
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search public issues or locations"
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon="people-circle-outline"
            title={selecting ? 'No open requests to merge' : 'No public services'}
            message={
              selecting
                ? 'Only open requests (pending, assigned, or in progress) can be merged.'
                : 'Resident public reports will appear here.'
            }
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((service) => (
              <PublicServiceCard
                key={service.id}
                service={service}
                selectable={selecting}
                selected={selectedIds.includes(service.id)}
                onPress={() =>
                  selecting
                    ? toggle(service.id)
                    : router.push(`/(employee)/public/${service.id}`)
                }
              />
            ))}
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
    title: { ...Type.title, color: Colors.ink },
    subtitle: { ...Type.caption, color: Colors.inkSecondary },
    sectionTitle: { ...Type.subtitle, color: Colors.ink },
    list: { gap: Spacing.sm },
    selectionActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reviewBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.primarySoft,
    },
    reviewCount: { ...Type.title, color: Colors.primary },
  });
