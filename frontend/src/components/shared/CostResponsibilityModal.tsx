import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { CostResponsibility } from '@/types';

export type CostChoice = Exclude<CostResponsibility, 'Pending Review'>;

const CHOICES: CostChoice[] = ['Owner', 'Resident', 'Society'];

const HELP: Record<CostChoice, string> = {
  Owner: 'The flat owner is billed for the repair.',
  Resident: 'You, the current resident, cover the repair cost.',
  Society: 'The society maintenance fund covers the repair.',
};

/**
 * Forces the resident to pick who pays before a complaint that the facility team
 * left as "Pending Review" can be verified and closed.
 */
export function CostResponsibilityModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (choice: CostChoice) => void | Promise<void>;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  const [choice, setChoice] = useState<CostChoice | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setChoice(null);
      setError('');
      setSubmitting(false);
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (!choice || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await onConfirm(choice);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not close the complaint. Please try again.',
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={submitting ? undefined : onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Who covers the repair cost?</Text>
          <Text style={styles.subtitle}>
            The facility team left the cost responsibility for this complaint as “Pending
            Review”. Confirm who is responsible before closing it.
          </Text>

          <View style={styles.choices}>
            {CHOICES.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                active={choice === opt}
                onPress={() => setChoice(opt)}
              />
            ))}
          </View>
          {!!choice && <Text style={styles.help}>{HELP[choice]}</Text>}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={onClose}
              disabled={submitting}
              style={styles.actionBtn}
            />
            <Button
              label={submitting ? 'Closing…' : 'Confirm & Close'}
              onPress={handleConfirm}
              loading={submitting}
              disabled={!choice || submitting}
              style={styles.actionBtn}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: Colors.surfaceOverlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    title: {
      ...Type.title,
      color: Colors.ink,
    },
    subtitle: {
      ...Type.body,
      color: Colors.inkSecondary,
    },
    choices: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    help: {
      ...Type.caption,
      color: Colors.inkSecondary,
    },
    error: {
      ...Type.caption,
      color: Colors.danger,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionBtn: {
      flex: 1,
    },
  });
