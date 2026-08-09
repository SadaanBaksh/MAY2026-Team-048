import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';

export function SimilarityReviewModal() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((state) => state.token);
  const suggestions = usePublicServiceStore((state) => state.suggestions);
  const refreshSuggestions = usePublicServiceStore((state) => state.refreshSuggestions);
  const refreshServices = usePublicServiceStore((state) => state.refreshServices);
  const reviewSuggestion = usePublicServiceStore((state) => state.reviewSuggestion);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const suggestion = suggestions[0];

  useEffect(() => {
    if (!token) return;
    refreshSuggestions(token).catch(() => {});
    const interval = setInterval(() => refreshSuggestions(token).catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, [token, refreshSuggestions]);

  const review = async (accept: boolean) => {
    if (!token || !suggestion || reviewing) return;
    setReviewing(true);
    setError('');
    try {
      const result = await reviewSuggestion(token, suggestion.id, accept);
      await refreshServices(token);
      if (accept && result.mergedServiceId) {
        router.push(`/(employee)/public/${result.mergedServiceId}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not review this merge suggestion.');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <Modal visible={!!suggestion} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {suggestion && (
            <>
              <Text style={styles.eyebrow}>
                AI MERGE SUGGESTION · {Math.round(suggestion.score * 100)}% MATCH
              </Text>
              <Text style={styles.title}>Do these reports describe the same problem?</Text>
              {[suggestion.serviceA, suggestion.serviceB].map((service) => (
                <Card key={service.id} elevated={false} style={styles.compareCard}>
                  <Text style={styles.reportTitle}>{service.title}</Text>
                  <Text style={styles.location}>{service.location}</Text>
                  <Text style={styles.description}>{service.description}</Text>
                </Card>
              ))}
              <Text style={styles.rationale}>{suggestion.rationale}</Text>
              {!!error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.actions}>
                <Button
                  label="Decline"
                  variant="outline"
                  disabled={reviewing}
                  onPress={() => review(false)}
                  style={styles.action}
                />
                <Button
                  label="Accept & Merge"
                  loading={reviewing}
                  onPress={() => review(true)}
                  style={styles.action}
                />
              </View>
              <Text style={styles.helper}>
                Accepting creates a new combined service page and preserves both resident reports.
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.md,
    },
    modal: {
      width: '100%',
      maxWidth: 580,
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    eyebrow: { ...Type.tiny, color: Colors.primary, letterSpacing: 0.5 },
    title: { ...Type.title, color: Colors.ink },
    compareCard: { gap: 3, backgroundColor: Colors.surfaceMuted },
    reportTitle: { ...Type.bodyMedium, color: Colors.ink },
    location: { ...Type.caption, color: Colors.primary },
    description: { ...Type.caption, color: Colors.inkSecondary },
    rationale: { ...Type.body, color: Colors.ink },
    actions: { flexDirection: 'row', gap: Spacing.sm },
    action: { flex: 1 },
    helper: { ...Type.tiny, color: Colors.inkTertiary, textAlign: 'center' },
    error: { ...Type.caption, color: Colors.danger },
  });
