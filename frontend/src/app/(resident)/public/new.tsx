import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError, uploadFile } from '@/api/client';
import { CategoryPicker } from '@/components/shared/CategoryPicker';
import { PriorityPicker } from '@/components/shared/PriorityPicker';
import { MediaThumb } from '@/components/shared/MediaThumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { usePublicServiceStore } from '@/store/publicServiceStore';
import type { Priority } from '@/types';

export default function NewPublicServiceScreen() {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const token = useAuthStore((state) => state.token);
  const submit = usePublicServiceStore((state) => state.submitService);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [categoryId, setCategoryId] = useState('cat_electrical');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [submitting, setSubmitting] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState('');

  const valid =
    title.trim().length >= 3 && description.trim().length >= 3 && location.trim().length >= 2;
  const handleSubmit = async () => {
    if (!token || !valid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const photoUrls: string[] = [];
      if (photoUri) photoUrls.push((await uploadFile(token, photoUri, 'photo')).url);
      const service = await submit(token, {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        category_id: categoryId,
        priority,
        photo_urls: photoUrls,
      });
      router.replace(`/(resident)/public/${service.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not publish this issue.');
    } finally {
      setSubmitting(false);
    }
  };

  const choosePhoto = async (camera: boolean) => {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Report a Public Issue" showBack />
      <Screen edges={['bottom']}>
        <Card style={styles.intro}>
          <Text style={styles.introTitle}>Visible to society residents</Text>
          <Text style={styles.body}>
            Use this for common areas and shared facilities. Your exact apartment and phone number
            are not shown.
          </Text>
        </Card>
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          placeholder="Street light below Tower A is not working"
        />
        <TextField
          label="Exact location"
          value={location}
          onChangeText={setLocation}
          maxLength={300}
          icon="location-outline"
          placeholder="Below Tower A, near the east gate"
        />
        <TextField
          label="What is happening?"
          value={description}
          onChangeText={setDescription}
          maxLength={4000}
          multiline
          style={styles.multiline}
          placeholder="Include details that help distinguish this from similar issues."
        />
        <View style={styles.field}>
          <Text style={styles.label}>Photo (optional)</Text>
          {photoUri && <MediaThumb uri={photoUri} height={180} />}
          <View style={styles.photoActions}>
            <Button
              label="Take Photo"
              icon="camera-outline"
              variant="outline"
              size="sm"
              onPress={() => choosePhoto(true)}
              style={styles.photoButton}
            />
            <Button
              label="Choose Photo"
              icon="images-outline"
              variant="outline"
              size="sm"
              onPress={() => choosePhoto(false)}
              style={styles.photoButton}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Priority</Text>
          <PriorityPicker value={priority} onChange={setPriority} />
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button
          label={submitting ? 'Publishing…' : 'Publish Public Issue'}
          loading={submitting}
          disabled={!valid}
          fullWidth
          size="lg"
          onPress={handleSubmit}
        />
      </Screen>
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.surfaceMuted },
    intro: { gap: 4, backgroundColor: Colors.primarySoft },
    introTitle: { ...Type.subtitle, color: Colors.ink },
    body: { ...Type.body, color: Colors.inkSecondary },
    multiline: { minHeight: 110, textAlignVertical: 'top' },
    field: { gap: Spacing.xs },
    photoActions: { flexDirection: 'row', gap: Spacing.sm },
    photoButton: { flex: 1 },
    label: { ...Type.caption, color: Colors.inkSecondary },
    error: { ...Type.caption, color: Colors.danger },
  });
