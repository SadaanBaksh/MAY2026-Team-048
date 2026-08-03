import Ionicons from "@react-native-vector-icons/ionicons";
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as v from 'valibot';

import { ApiError } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import type { AppUser } from '@/types';
import { emailSchema, firstIssueMessage, phoneSchema, toCanonicalPhone } from '@/utils/validation';

export function EditProfileModal({
  visible,
  onClose,
  user,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  user: AppUser;
  onSave: (update: {
    name: string;
    email: string;
    phone: string;
    avatarUri?: string;
  }) => void | Promise<void>;
}) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [avatarUri, setAvatarUri] = useState(user.avatarUri);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone);
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
    const emailError = firstIssueMessage(v.safeParse(emailSchema, email));
    if (emailError) {
      setError(emailError);
      return;
    }
    const phoneError = firstIssueMessage(v.safeParse(phoneSchema, phone));
    if (phoneError) {
      setError(phoneError);
      return;
    }
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        phone: toCanonicalPhone(phone),
        avatarUri,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not save your changes. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
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
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
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
      gap: Spacing.sm,
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
