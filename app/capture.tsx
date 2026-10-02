import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ErrorNotice } from '@/components/ui';
import { analyzeRoom, createRoom } from '@/lib/api';
import { colors, radius, spacing, type } from '@/theme/theme';

const parseCm = (s: string): number | undefined => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined;
};

export default function Capture() {
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const uri = result.assets?.[0]?.uri;
    if (!result.canceled && uri) setPhotoUri(uri);
  }

  const w = parseCm(widthM);
  const d = parseCm(depthM);
  const dimsOk =
    (!widthM && !depthM) ||
    (w !== undefined && d !== undefined && w >= 150 && w <= 2000 && d >= 150 && d <= 2000);
  const canSubmit = !!photoUri && name.trim().length > 0 && dimsOk;

  async function submit() {
    if (!photoUri) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom({
        name: name.trim(),
        photoUri,
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
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.preview}
          accessibilityLabel="Selected room photo"
        />
      ) : (
        <View style={[styles.preview, styles.placeholder]}>
          <Text style={type.caption}>
            Stand in a corner and capture as much of the room as you can.
          </Text>
        </View>
      )}

      <View style={styles.row}>
        <Button title="Take photo" onPress={() => pick('camera')} style={{ flex: 1 }} />
        <Button
          title="Choose photo"
          variant="secondary"
          onPress={() => pick('library')}
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
          Uploading and analysing. This takes a few seconds.
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
