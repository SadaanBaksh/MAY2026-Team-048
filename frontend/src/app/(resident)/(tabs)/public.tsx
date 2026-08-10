import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PublicServiceCard } from '@/components/shared/PublicServiceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SearchBar } from '@/components/ui/SearchBar';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';

export default function ResidentPublicServicesScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((state) => state.token);
  const services = usePublicServiceStore((state) => state.services);
  const loading = usePublicServiceStore((state) => state.loading);
  const refresh = usePublicServiceStore((state) => state.refreshServices);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (token) refresh(token).catch(() => {});
    }, [token, refresh]),
  );

  const filtered = services.filter((service) => {
    const value = query.trim().toLowerCase();
    return (
      !value ||
      service.title.toLowerCase().includes(value) ||
      service.description.toLowerCase().includes(value) ||
      service.location.toLowerCase().includes(value)
    );
  });

  return (
    <View style={styles.root}>
      <Screen
        edges={['top']}
        refreshing={loading}
        onRefresh={() => token && refresh(token).catch(() => {})}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Community Issues</Text>
            <Text style={styles.subtitle}>Shared maintenance reports for our society</Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => router.push('/(resident)/public/new')}>
            <Ionicons name="add" size={24} color={Colors.white} />
          </Pressable>
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search issues or locations" />
        {filtered.length === 0 ? (
          <EmptyState
            icon="people-circle-outline"
            title="No public issues found"
            message="Report a common-area problem for neighbours and the facility team to see."
            actionLabel="Report Public Issue"
            onAction={() => router.push('/(resident)/public/new')}
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((service) => (
              <PublicServiceCard
                key={service.id}
                service={service}
                onPress={() => router.push(`/(resident)/public/${service.id}`)}
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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { ...Type.title, color: Colors.ink },
    subtitle: { ...Type.caption, color: Colors.inkSecondary },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.teal,
    },
    list: { gap: Spacing.sm },
  });
