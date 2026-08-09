import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PublicServiceCard } from '@/components/shared/PublicServiceCard';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SearchBar } from '@/components/ui/SearchBar';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';

export default function EmployeePublicServicesScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((state) => state.token);
  const services = usePublicServiceStore((state) => state.services);
  const suggestions = usePublicServiceStore((state) => state.suggestions);
  const loading = usePublicServiceStore((state) => state.loading);
  const refreshServices = usePublicServiceStore((state) => state.refreshServices);
  const refreshSuggestions = usePublicServiceStore((state) => state.refreshSuggestions);
  const [query, setQuery] = useState('');

  const refresh = useCallback(() => {
    if (!token) return;
    Promise.all([refreshServices(token), refreshSuggestions(token)]).catch(() => {});
  }, [token, refreshServices, refreshSuggestions]);
  useFocusEffect(refresh);

  const filtered = services.filter((service) => {
    const value = query.trim().toLowerCase();
    return (
      !value ||
      service.title.toLowerCase().includes(value) ||
      service.location.toLowerCase().includes(value)
    );
  });

  return (
    <View style={styles.root}>
      <Screen edges={['top']} refreshing={loading} onRefresh={refresh}>
        <View>
          <Text style={styles.title}>Public Services</Text>
          <Text style={styles.subtitle}>Assign shared issues and review AI merge suggestions</Text>
        </View>
        {suggestions.length > 0 && (
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
            title="No public services"
            message="Resident public reports will appear here."
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((service) => (
              <PublicServiceCard
                key={service.id}
                service={service}
                onPress={() => router.push(`/(employee)/public/${service.id}`)}
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
    reviewBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.primarySoft,
    },
    reviewCount: { ...Type.title, color: Colors.primary },
  });
