import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { AppUser } from '@/types';

export function EditProfileModal({
  visible,
  onClose,
  user,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  user: AppUser;
  onSave: (update: { name: string; avatarUri?: string }) => void | Promise<void>;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  const [name, setName] = useState(user.name);
  const [avatarUri, setAvatarUri] = useState(user.avatarUri);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(user.name);
      setAvatarUri(user.avatarUri);
      setError('');
    }
  }, [visible, user]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await onSave({ name: name.trim(), avatarUri });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not save your changes. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goToChangeEmail = () => {
    onClose();
    router.push('/(auth)/change-email');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Edit Profile</Text>

          <Pressable style={styles.avatarWrap} onPress={pickPhoto}>
            <Avatar name={name || user.name} color={user.avatarColor} uri={avatarUri} size={80} />
            <View style={[styles.avatarBadge, { backgroundColor: Colors.primary }]}>
              <Ionicons name="pencil" size={14} color={Colors.white} />
            </View>
          </Pressable>

          <View style={styles.fields}>
            <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />

            <View>
              <View style={styles.lockedLabelRow}>
                <Text style={styles.lockedLabel}>Email</Text>
                <Pressable onPress={goToChangeEmail} hitSlop={8}>
                  <Text style={styles.changeLink}>Change</Text>
                </Pressable>
              </View>
              <TextField value={user.email} editable={false} style={styles.lockedInput} />
              <Text style={styles.hint}>
                Changing your email needs a verification code sent to the new address.
              </Text>
            </View>

            <View>
              <Text style={styles.lockedLabel}>Phone</Text>
              <TextField value={user.phone} editable={false} style={styles.lockedInput} />
              <Text style={styles.hint}>
                Phone number can’t be changed here. Contact your facility manager.
              </Text>
            </View>
          </View>

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
              label={submitting ? 'Saving…' : 'Save'}
              variant="primary"
              onPress={handleSave}
              loading={submitting}
              disabled={submitting}
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
      alignItems: 'center',
    },
    title: {
      ...Type.title,
      color: Colors.ink,
    },
    avatarWrap: {
      alignSelf: 'center',
    },
    avatarBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: Colors.surface,
    },
    fields: {
      alignSelf: 'stretch',
      gap: Spacing.md,
    },
    lockedLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    lockedLabel: {
      ...Type.caption,
      color: Colors.inkSecondary,
      marginBottom: 6,
    },
    changeLink: {
      ...Type.captionBold,
      color: Colors.primary,
    },
    lockedInput: {
      color: Colors.inkTertiary,
    },
    hint: {
      ...Type.tiny,
      color: Colors.inkTertiary,
      marginTop: 4,
    },
    error: {
      ...Type.caption,
      color: Colors.danger,
      alignSelf: 'flex-start',
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignSelf: 'stretch',
    },
    actionBtn: {
      flex: 1,
    },
  });
