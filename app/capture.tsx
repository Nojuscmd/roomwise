import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ErrorNotice } from '@/components/ui';
import { analyzeRoom, createRoom, MAX_PHOTOS } from '@/lib/api';
import { colors, radius, spacing, type } from '@/theme/theme';

const parseCm = (s: string): number | undefined => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined;
};

export default function Capture() {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [widthM, setWidthM] = useState('');
  const [depthM, setDepthM] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        `Permission to use the ${source === 'camera' ? 'camera' : 'photo library'} was denied. You can enable it in Settings.`,
      );
      return;
    }
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: source === 'library',
      selectionLimit: remaining,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const added = (result.assets ?? []).map((a) => a.uri).slice(0, remaining);
    setPhotos((current) => [...current, ...added].slice(0, MAX_PHOTOS));
  }

  const w = parseCm(widthM);
  const d = parseCm(depthM);
  const dimsOk =
    (!widthM && !depthM) ||
    (w !== undefined && d !== undefined && w >= 150 && w <= 2000 && d >= 150 && d <= 2000);
  const canSubmit = photos.length > 0 && name.trim().length > 0 && dimsOk;

  async function submit() {
    if (photos.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom({
        name: name.trim(),
        photoUris: photos,
        widthCm: widthM ? w : undefined,
        depthCm: depthM ? d : undefined,
      });
      // Analysis can fail independently (network, rate limit): the room is kept so the user can retry.
      try {
        await analyzeRoom(room.id);
      } catch {
        /* the room screen offers a retry */
      }
      router.replace(`/room/${room.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {photos.length > 0 ? (
        <View style={styles.thumbs}>
          {photos.map((uri, i) => (
            <View key={uri} style={styles.thumbWrap}>
              <Image
                source={{ uri }}
                style={styles.thumb}
                accessibilityLabel={`Room photo ${i + 1}`}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
                onPress={() => setPhotos((current) => current.filter((p) => p !== uri))}
                style={styles.remove}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.preview, styles.placeholder]}>
          <Text style={type.caption}>
            Stand in a corner and capture as much of the room as you can.
          </Text>
        </View>
      )}
      <Text style={type.caption}>
        {photos.length === 0
          ? 'Add up to 4 photos from different corners. More angles make the analysis more reliable.'
          : photos.length < MAX_PHOTOS
            ? `${photos.length} of ${MAX_PHOTOS} photos. Add another angle to cover walls the first one hides. The first photo decides which wall is "up" on the plan.`
            : `${MAX_PHOTOS} of ${MAX_PHOTOS} photos. Remove one to add another.`}
      </Text>

      <View style={styles.row}>
        <Button
          title={photos.length === 0 ? 'Take photo' : 'Add photo'}
          onPress={() => pick('camera')}
          disabled={photos.length >= MAX_PHOTOS}
          style={{ flex: 1 }}
        />
        <Button
          title="Choose photos"
          variant="secondary"
          onPress={() => pick('library')}
          disabled={photos.length >= MAX_PHOTOS}
          style={{ flex: 1 }}
        />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Room name (e.g. Bedroom)"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
        maxLength={80}
        accessibilityLabel="Room name"
      />

      <Text style={type.caption}>
        Optional: enter the real room size in metres for more accurate results.
      </Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Width (m)"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          value={widthM}
          onChangeText={setWidthM}
          accessibilityLabel="Room width in metres"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Length (m)"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          value={depthM}
          onChangeText={setDepthM}
          accessibilityLabel="Room length in metres"
        />
      </View>
      {!dimsOk ? (
        <Text style={[type.caption, { color: colors.warn }]}>
          Enter both sizes, between 1.5 and 20 m.
        </Text>
      ) : null}

      {error ? <ErrorNotice message={error} /> : null}
      <Button title="Analyse room" onPress={submit} loading={busy} disabled={!canSubmit} />
      {busy ? (
        <Text style={[type.caption, { textAlign: 'center' }]}>
          Uploading and analysing. With several photos this can take up to a minute.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.line,
  },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { width: '48%', aspectRatio: 4 / 3 },
  thumb: { width: '100%', height: '100%', borderRadius: radius.md, backgroundColor: colors.line },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    fontSize: 16,
    color: colors.ink,
  },
});
