import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ApiError, draftNotice, fetchNoticeTowers } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useNoticeStore } from '@/store/noticeStore';
import type { Notice, NoticeTower } from '@/types';

function localParts(date: Date): { date: string; time: string } {
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function parseLocal(dateValue: string, timeValue: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue.trim());
  if (!match || !timeMatch) return null;
  const result = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  return Number.isNaN(result.getTime()) ||
    result.getFullYear() !== Number(match[1]) ||
    result.getMonth() !== Number(match[2]) - 1 ||
    result.getDate() !== Number(match[3]) ||
    result.getHours() !== Number(timeMatch[1]) ||
    result.getMinutes() !== Number(timeMatch[2])
    ? null
    : result;
}

function askConfirmation(title: string, message: string, action: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${title}\n\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Not yet', style: 'cancel' },
    { text: 'Confirm', onPress: action },
  ]);
}

export default function NoticeComposerScreen() {
  const { id = 'new' } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((state) => state.token)!;
  const cached = useNoticeStore((state) => state.notices.find((notice) => notice.id === id));
  const refreshNotice = useNoticeStore((state) => state.refreshNotice);
  const saveNotice = useNoticeStore((state) => state.saveNotice);
  const send = useNoticeStore((state) => state.send);
  const schedule = useNoticeStore((state) => state.schedule);
  const cancel = useNoticeStore((state) => state.cancel);

  const defaultSchedule = useMemo(() => localParts(new Date(Date.now() + 60 * 60 * 1000)), []);
  const defaultExpiry = useMemo(() => localParts(new Date(Date.now() + 24 * 60 * 60 * 1000)), []);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  const [loadedNotice, setLoadedNotice] = useState<Notice | null>(cached ?? null);
  const [towers, setTowers] = useState<NoticeTower[]>([]);
  const [briefPoints, setBriefPoints] = useState<string[]>(['']);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(defaultSchedule.date);
  const [scheduleTime, setScheduleTime] = useState(defaultSchedule.time);
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry.date);
  const [expiryTime, setExpiryTime] = useState(defaultExpiry.time);
  const [loading, setLoading] = useState(!isNew && !cached);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    fetchNoticeTowers(token)
      .then(setTowers)
      .catch((exc) => setError(String(exc)));
    if (!isNew && !cached) {
      refreshNotice(token, id)
        .then(setLoadedNotice)
        .catch((exc) => setError(exc instanceof Error ? exc.message : 'Could not load notice'))
        .finally(() => setLoading(false));
    }
  }, [token, id, isNew, cached, refreshNotice]);

  useEffect(() => {
    const notice = cached ?? loadedNotice;
    if (!notice) return;
    setBriefPoints(notice.briefPoints.length ? notice.briefPoints : ['']);
    setSelected(notice.targetBuildings);
    setTitle(notice.title);
    setBody(notice.body);
    if (notice.scheduledAt) {
      const parts = localParts(new Date(notice.scheduledAt));
      setScheduleEnabled(true);
      setScheduleDate(parts.date);
      setScheduleTime(parts.time);
    }
    if (notice.expiresAt) {
      const parts = localParts(new Date(notice.expiresAt));
      setExpiryEnabled(true);
      setExpiryDate(parts.date);
      setExpiryTime(parts.time);
    }
  }, [cached, loadedNotice]);

  const notice = cached ?? loadedNotice;
  const editable = !notice || notice.status === 'Draft' || notice.status === 'Scheduled';
  const selectedResidents = towers
    .filter((tower) => selected.includes(tower.building))
    .reduce((sum, tower) => sum + tower.residentCount, 0);

  const toggleTower = (building: string) =>
    setSelected((current) =>
      current.includes(building)
        ? current.filter((value) => value !== building)
        : [...current, building],
    );

  const dateValues = () => {
    const scheduled = scheduleEnabled ? parseLocal(scheduleDate, scheduleTime) : null;
    const expires = expiryEnabled ? parseLocal(expiryDate, expiryTime) : null;
    if (scheduleEnabled && !scheduled)
      throw new Error('Enter a valid schedule as YYYY-MM-DD and HH:MM.');
    if (expiryEnabled && !expires) throw new Error('Enter a valid expiry as YYYY-MM-DD and HH:MM.');
    return { scheduled, expires };
  };

  const persist = async (): Promise<Notice> => {
    const { expires } = dateValues();
    const saved = await saveNotice(token, isNew ? null : id, {
      title,
      body,
      brief_points: briefPoints.map((point) => point.trim()).filter(Boolean),
      target_buildings: selected,
      timezone,
      expires_at: expires?.toISOString() ?? null,
    });
    setLoadedNotice(saved);
    if (isNew) router.replace(`/(manager)/notice/${saved.id}`);
    return saved;
  };

  const withBusy = async (action: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (exc) {
      setError(
        exc instanceof ApiError || exc instanceof Error ? exc.message : 'Something went wrong',
      );
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    const points = briefPoints.map((point) => point.trim()).filter(Boolean);
    if (!points.length || !selected.length) {
      setAiError('Add at least one brief point and select at least one tower first.');
      return;
    }
    setGenerating(true);
    setAiError(null);
    try {
      const { scheduled, expires } = dateValues();
      const result = await draftNotice(token, {
        brief_points: points,
        target_buildings: selected,
        scheduled_at: scheduled?.toISOString() ?? null,
        expires_at: expires?.toISOString() ?? null,
        timezone,
      });
      setTitle(result.title);
      setBody(result.body);
    } catch (exc) {
      setAiError(
        exc instanceof Error
          ? exc.message
          : 'AI notice generation failed. Please try again or write the notice manually.',
      );
    } finally {
      setGenerating(false);
    }
  };

  const sendNow = () =>
    askConfirmation(
      'Send this notice now?',
      `This will notify approximately ${selectedResidents} residents across ${selected.length} tower(s).`,
      () =>
        withBusy(async () => {
          const saved = await persist();
          const sent = await send(token, saved.id);
          setLoadedNotice(sent);
          Alert.alert('Notice sent', `Delivered to ${sent.recipientCount} residents.`);
        }),
    );

  const scheduleDelivery = () => {
    let delivery: Date | null = null;
    try {
      delivery = dateValues().scheduled;
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : 'Invalid schedule');
      return;
    }
    if (!scheduleEnabled || !delivery) {
      setError('Turn on scheduled delivery and choose a future date and time.');
      return;
    }
    askConfirmation(
      'Schedule this notice?',
      `It will be sent on ${delivery.toLocaleString()} using server time.`,
      () =>
        withBusy(async () => {
          const saved = await persist();
          const scheduled = await schedule(token, saved.id, delivery!.toISOString());
          setLoadedNotice(scheduled);
          Alert.alert('Notice scheduled', `Delivery is set for ${delivery!.toLocaleString()}.`);
        }),
    );
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Notice" showBack />
        <Screen>
          <Text style={styles.help}>Loading notice…</Text>
        </Screen>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isNew ? 'Create notice' : notice?.title || 'Edit notice'}
        subtitle={notice ? notice.status : 'New draft'}
        showBack
      />
      <Screen edges={['bottom']}>
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!editable && notice ? (
          <Card style={styles.readOnly}>
            <Text style={styles.sectionTitle}>{notice.title}</Text>
            <Text style={styles.message}>{notice.body}</Text>
            <Text style={styles.help}>Towers: {notice.targetBuildings.join(', ')}</Text>
            <Text style={styles.help}>Delivered to {notice.recipientCount} residents.</Text>
          </Card>
        ) : (
          <>
            <Card style={styles.section}>
              <View>
                <Text style={styles.sectionTitle}>1. What should residents know?</Text>
                <Text style={styles.help}>
                  Add the facts, timing, instructions and contact details as separate points.
                </Text>
              </View>
              {briefPoints.map((point, index) => (
                <View key={index} style={styles.briefRow}>
                  <Text style={styles.bullet}>•</Text>
                  <View style={styles.briefField}>
                    <TextField
                      value={point}
                      onChangeText={(value) =>
                        setBriefPoints((current) =>
                          current.map((item, i) => (i === index ? value : item)),
                        )
                      }
                      placeholder={
                        index === 0
                          ? 'Electricity will be unavailable from 2 PM to 4 PM'
                          : 'Add another detail'
                      }
                      style={styles.briefInput}
                    />
                  </View>
                  {briefPoints.length > 1 && (
                    <Pressable
                      onPress={() =>
                        setBriefPoints((current) => current.filter((_, i) => i !== index))
                      }
                      accessibilityLabel={`Remove brief point ${index + 1}`}
                    >
                      <Ionicons name="close-circle" size={22} color={Colors.inkTertiary} />
                    </Pressable>
                  )}
                </View>
              ))}
              <Button
                label="Add point"
                icon="add"
                size="sm"
                variant="ghost"
                onPress={() => setBriefPoints((current) => [...current, ''])}
              />
            </Card>

            <Card style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>2. Select towers</Text>
                  <Text style={styles.help}>{selectedResidents} active residents selected</Text>
                </View>
                <View style={styles.inlineActions}>
                  <Pressable onPress={() => setSelected(towers.map((tower) => tower.building))}>
                    <Text style={styles.link}>Select all</Text>
                  </Pressable>
                  <Pressable onPress={() => setSelected([])}>
                    <Text style={styles.link}>Select none</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.towerGrid}>
                {towers.map((tower) => {
                  const checked = selected.includes(tower.building);
                  return (
                    <Pressable
                      key={tower.building}
                      style={[styles.tower, checked && styles.towerChecked]}
                      onPress={() => toggleTower(tower.building)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                    >
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={checked ? Colors.teal : Colors.inkTertiary}
                      />
                      <View style={styles.towerText}>
                        <Text style={styles.towerName}>{tower.building}</Text>
                        <Text style={styles.help}>{tower.residentCount} residents</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>3. Delivery timing</Text>
              <ToggleRow
                label="Schedule for later"
                value={scheduleEnabled}
                onChange={setScheduleEnabled}
                Colors={Colors}
              />
              {scheduleEnabled && (
                <DateTimeFields
                  date={scheduleDate}
                  time={scheduleTime}
                  onDate={setScheduleDate}
                  onTime={setScheduleTime}
                />
              )}
              <ToggleRow
                label="Expire automatically"
                value={expiryEnabled}
                onChange={setExpiryEnabled}
                Colors={Colors}
              />
              {expiryEnabled && (
                <DateTimeFields
                  date={expiryDate}
                  time={expiryTime}
                  onDate={setExpiryDate}
                  onTime={setExpiryTime}
                />
              )}
              <Text style={styles.timezone}>
                Times shown in {timezone}. The server controls delivery and expiry.
              </Text>
            </Card>

            <Card style={styles.section}>
              <View style={styles.aiHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>4. Generate and edit</Text>
                  <Text style={styles.help}>
                    The brief and selected tower list are sent to Gemini.
                  </Text>
                </View>
                <Button
                  label={title || body ? 'Regenerate' : 'Write with AI'}
                  icon="sparkles"
                  size="sm"
                  variant="secondary"
                  loading={generating}
                  onPress={generate}
                />
              </View>
              {aiError && (
                <View style={styles.aiErrorBox} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                  <View style={styles.aiErrorTextBlock}>
                    <Text style={styles.aiErrorTitle}>Couldn&rsquo;t generate the notice</Text>
                    <Text style={styles.errorText}>{aiError}</Text>
                  </View>
                </View>
              )}
              <TextField
                label="Title"
                value={title}
                onChangeText={setTitle}
                placeholder="Notice title"
              />
              <TextField
                label="Message"
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
                placeholder="Generate a draft or write the notice here"
                style={styles.bodyInput}
              />
            </Card>

            <View style={styles.actions}>
              <Button
                label="Save draft"
                icon="save-outline"
                variant="outline"
                loading={saving}
                onPress={() =>
                  withBusy(async () => {
                    await persist();
                    Alert.alert('Draft saved');
                  })
                }
              />
              {scheduleEnabled && (
                <Button
                  label="Schedule"
                  icon="time-outline"
                  loading={saving}
                  onPress={scheduleDelivery}
                />
              )}
              <Button label="Send now" icon="send" loading={saving} onPress={sendNow} />
              {notice && (notice.status === 'Draft' || notice.status === 'Scheduled') && (
                <Button
                  label="Cancel notice"
                  variant="ghost"
                  textColor={Colors.danger}
                  onPress={() =>
                    askConfirmation(
                      'Cancel this notice?',
                      'It will remain in notice history.',
                      () =>
                        withBusy(async () => {
                          await cancel(token, notice.id);
                          router.back();
                        }),
                    )
                  }
                />
              )}
            </View>
          </>
        )}
      </Screen>
    </View>
  );
}

function DateTimeFields({
  date,
  time,
  onDate,
  onTime,
}: {
  date: string;
  time: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
      <View style={{ flex: 1 }}>
        <TextField
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={onDate}
          placeholder="2026-08-10"
        />
      </View>
      <View style={{ width: 130 }}>
        <TextField label="Time (HH:MM)" value={time} onChangeText={onTime} placeholder="14:00" />
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  Colors,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  Colors: ThemeColors;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ ...Type.body, color: Colors.ink }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.borderStrong, true: Colors.teal }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.surfaceMuted },
    section: { gap: Spacing.md },
    sectionTitle: { ...Type.subtitle, color: Colors.ink },
    help: { ...Type.caption, color: Colors.inkSecondary },
    briefRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    briefField: { flex: 1 },
    bullet: { ...Type.title, color: Colors.teal },
    briefInput: { minWidth: 0 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
    sectionHeaderText: { flex: 1 },
    inlineActions: { flexDirection: 'row', gap: Spacing.sm },
    link: { ...Type.captionBold, color: Colors.teal },
    towerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    tower: {
      minWidth: 170,
      flexGrow: 1,
      flexBasis: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      padding: Spacing.sm,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: Colors.border,
      borderRadius: Radius.md,
      backgroundColor: Colors.surfaceMuted,
    },
    towerChecked: { borderColor: Colors.teal, backgroundColor: Colors.primarySoft },
    towerText: { flex: 1 },
    towerName: { ...Type.bodyMedium, color: Colors.ink },
    timezone: { ...Type.tiny, color: Colors.inkTertiary },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    bodyInput: { minHeight: 160, paddingTop: 13 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
    errorBox: {
      flexDirection: 'row',
      gap: Spacing.xs,
      padding: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: Colors.dangerSoft,
    },
    errorText: { ...Type.caption, color: Colors.danger, flex: 1 },
    aiErrorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.xs,
      padding: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.danger,
      backgroundColor: Colors.dangerSoft,
    },
    aiErrorTextBlock: { flex: 1, gap: 2 },
    aiErrorTitle: { ...Type.captionBold, color: Colors.danger },
    readOnly: { gap: Spacing.md },
    message: { ...Type.body, color: Colors.ink },
  });
