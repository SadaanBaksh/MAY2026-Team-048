import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as v from 'valibot';

import { ApiError, createManager, listManagers, updateManager, type ApiUser } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import {
  emailSchema,
  firstIssueMessage,
  passwordSchema,
  phoneSchema,
  toCanonicalPhone,
} from '@/utils/validation';

interface FormState {
  name: string;
  email: string;
  phone: string;
  title: string;
  password: string;
}

const EMPTY_FORM: FormState = { name: '', email: '', phone: '', title: '', password: '' };

export default function AdminManagersScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [managers, setManagers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      setManagers(await listManagers(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load facility managers.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (manager: ApiUser) => {
    setEditing(manager);
    setForm({
      name: manager.name,
      email: manager.email,
      phone: manager.phone,
      title: manager.title ?? '',
      password: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const submit = async () => {
    if (!token) return;
    const name = form.name.trim();
    if (!name) return setFormError('Name is required.');

    const emailError = firstIssueMessage(v.safeParse(emailSchema, form.email));
    if (emailError) return setFormError(emailError);

    const phoneError = firstIssueMessage(v.safeParse(phoneSchema, form.phone));
    if (phoneError) return setFormError(phoneError);

    const passwordRequired = !editing;
    if (passwordRequired || form.password) {
      const pwError = firstIssueMessage(v.safeParse(passwordSchema, form.password));
      if (pwError) return setFormError(pwError);
    }

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateManager(token, editing.id, {
          name,
          email: form.email.trim(),
          phone: toCanonicalPhone(form.phone),
          title: form.title.trim(),
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await createManager(token, {
          name,
          email: form.email.trim(),
          phone: toCanonicalPhone(form.phone),
          password: form.password,
          title: form.title.trim() || undefined,
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspend = async (manager: ApiUser) => {
    if (!token) return;
    setBusyId(manager.id);
    setError('');
    try {
      await updateManager(token, manager.id, {
        account_status: manager.account_status === 'suspended' ? 'active' : 'suspended',
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the account.');
    } finally {
      setBusyId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/landing');
  };

  return (
    <Screen edges={['top', 'bottom']} maxWidth={560} onRefresh={load} refreshing={loading}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Facility managers</Text>
          <Text style={styles.subtitle}>Create, edit, and suspend facility manager accounts.</Text>
        </View>
        <Button label="New manager" variant="outline" size="sm" onPress={openCreate} />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator color={Colors.inkTertiary} style={styles.loader} />
      ) : managers.length === 0 ? (
        <Text style={styles.empty}>No facility managers yet.</Text>
      ) : (
        <View style={styles.list}>
          {managers.map((manager) => {
            const suspended = manager.account_status === 'suspended';
            return (
              <View key={manager.id} style={styles.row}>
                <View style={styles.rowInfo}>
                  <View style={styles.nameLine}>
                    <Text style={styles.name}>{manager.name}</Text>
                    {suspended && <Text style={styles.suspendedTag}>Suspended</Text>}
                  </View>
                  <Text style={styles.meta}>{manager.email}</Text>
                  <Text style={styles.meta}>{manager.phone}</Text>
                  {!!manager.title && <Text style={styles.meta}>{manager.title}</Text>}
                </View>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => openEdit(manager)} hitSlop={8}>
                    <Text style={styles.action}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleSuspend(manager)}
                    disabled={busyId === manager.id}
                    hitSlop={8}
                  >
                    <Text style={[styles.action, suspended ? styles.actionPositive : styles.actionDanger]}>
                      {busyId === manager.id ? '…' : suspended ? 'Reactivate' : 'Suspend'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Pressable onPress={handleLogout} style={styles.logout} hitSlop={8}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => !saving && setModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{editing ? 'Edit manager' : 'New manager'}</Text>
            <View style={styles.form}>
              <TextField
                label="Name"
                value={form.name}
                onChangeText={(name) => setForm((f) => ({ ...f, name }))}
                autoCapitalize="words"
              />
              <TextField
                label="Email"
                value={form.email}
                onChangeText={(email) => setForm((f) => ({ ...f, email }))}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextField
                label="Phone"
                value={form.phone}
                onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
                keyboardType="phone-pad"
              />
              <TextField
                label="Title (optional)"
                value={form.title}
                onChangeText={(title) => setForm((f) => ({ ...f, title }))}
              />
              <TextField
                label={editing ? 'New password (leave blank to keep)' : 'Set password'}
                value={form.password}
                onChangeText={(password) => setForm((f) => ({ ...f, password }))}
                secure
              />
              {!!formError && <Text style={styles.error}>{formError}</Text>}
            </View>
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                variant="ghost"
                size="sm"
                onPress={() => setModalOpen(false)}
                disabled={saving}
              />
              <Button
                label={editing ? 'Save' : 'Create'}
                size="sm"
                onPress={submit}
                loading={saving}
                disabled={saving}
                style={styles.saveButton}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    headerText: { flex: 1, gap: 2 },
    title: { ...Type.title, color: Colors.ink },
    subtitle: { ...Type.caption, color: Colors.inkSecondary },
    loader: { marginTop: Spacing.xl },
    empty: { ...Type.body, color: Colors.inkTertiary, marginTop: Spacing.lg },
    error: { ...Type.caption, color: Colors.danger },
    list: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
    },
    rowInfo: { flex: 1, gap: 3 },
    nameLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    name: { ...Type.bodyMedium, color: Colors.ink },
    suspendedTag: {
      ...Type.tiny,
      color: Colors.danger,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.danger,
      borderRadius: Radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    meta: { ...Type.caption, color: Colors.inkSecondary },
    rowActions: { alignItems: 'flex-end', gap: Spacing.xs },
    action: { ...Type.captionBold, color: Colors.teal },
    actionDanger: { color: Colors.danger },
    actionPositive: { color: Colors.success },
    logout: { alignSelf: 'flex-start', marginTop: Spacing.lg },
    logoutText: { ...Type.captionBold, color: Colors.inkSecondary },
    backdrop: {
      flex: 1,
      backgroundColor: Colors.surfaceOverlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    modalTitle: { ...Type.subtitle, color: Colors.ink },
    form: { gap: Spacing.sm },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    saveButton: { backgroundColor: Colors.teal },
  });
