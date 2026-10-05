import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FloorPlan } from '@/components/FloorPlan';
import { Bullet, Button, Card, Centered, ErrorNotice, SegmentedControl } from '@/components/ui';
import { Mode, parseRoomAnalysis, RoomAnalysis, suggestArrangement } from '@/domain';
import {
  analyzeRoom,
  ArrangementRow,
  deleteRoom,
  getPreferences,
  getRoom,
  listArrangements,
  photoUrl,
  RoomRow,
  saveArrangement,
} from '@/lib/api';
import { confirmAction, notify } from '@/lib/dialog';
import { colors, spacing, type } from '@/theme/theme';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const planWidth = Math.min(screenWidth - spacing.md * 4, 420);
  const photoWidth = screenWidth - spacing.md * 2;

  const [room, setRoom] = useState<RoomRow | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saved, setSaved] = useState<ArrangementRow[]>([]);
  const [mode, setMode] = useState<Mode>('ergonomic');
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [r, prefs, arrangements] = await Promise.all([
        getRoom(id),
        getPreferences(),
        listArrangements(id),
      ]);
      setRoom(r);
      setSaved(arrangements);
      setMode(prefs.default_mode);
      const paths = [r.photo_path, ...(r.extra_photo_paths ?? [])].filter((p): p is string => !!p);
      const urls = await Promise.all(paths.map((p) => photoUrl(p)));
      setPhotos(urls.filter((u): u is string => !!u));
      setPhotoIndex(0);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  // Reload when returning from the correction screen.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Strictly validate whatever the model returned before the rest of the app trusts it.
  const parsed = useMemo<{ analysis?: RoomAnalysis; problem?: string }>(() => {
    if (!room?.analysis_json) return {};
    try {
      return { analysis: parseRoomAnalysis(room.analysis_json) };
    } catch (e) {
      return { problem: (e as Error).message };
    }
  }, [room?.analysis_json]);

  const arrangement = useMemo(
    () => (parsed.analysis ? suggestArrangement(parsed.analysis.layout, mode) : null),
    [parsed.analysis, mode],
  );

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    try {
      await analyzeRoom(id);
      setRoom(await getRoom(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  /** Re-analysing replaces the current detection, so ask first when there is one. */
  function confirmAnalysis() {
    if (!room?.analysis_json) {
      void runAnalysis();
      return;
    }
    confirmAction({
      title: 'Analyse again?',
      message:
        'This replaces the current detection with a new one. The result can differ a little each time.',
      confirmLabel: 'Analyse again',
      cancelLabel: 'Keep current',
      onConfirm: () => void runAnalysis(),
    });
  }

  async function save() {
    if (!arrangement) return;
    setSaving(true);
    try {
      await saveArrangement(id, arrangement);
      setSaved(await listArrangements(id));
    } catch (e) {
      notify('Could not save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!room) return;
    confirmAction({
      title: 'Delete this room?',
      message: 'The photo and all saved arrangements will be removed.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteRoom(room);
          router.back();
        } catch (e) {
          notify('Could not delete', (e as Error).message);
        }
      },
    });
  }

  if (!room && !error) {
    return (
      <Centered>
        <ActivityIndicator color={colors.accent} />
      </Centered>
    );
  }
  if (!room) {
    return (
      <View style={{ padding: spacing.md }}>
        <ErrorNotice message={error ?? 'Room not found.'} onRetry={load} />
      </View>
    );
  }

  const layout = parsed.analysis?.layout;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: room.name }} />

      {photos.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / photoWidth))
            }
            style={{ width: photoWidth, borderRadius: 20 }}
          >
            {photos.map((uri, i) => (
              <Image
                key={uri}
                source={{ uri }}
                style={[styles.photo, { width: photoWidth }]}
                accessibilityLabel={`Room photo ${i + 1} of ${photos.length}`}
              />
            ))}
          </ScrollView>
          {photos.length > 1 ? (
            <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.xs }]}>
              Photo {photoIndex + 1} of {photos.length}. Swipe sideways to see the others.
            </Text>
          ) : null}
        </View>
      ) : null}
      {error ? <ErrorNotice message={error} /> : null}

      {!room.analysis_json || parsed.problem ? (
        <Card style={{ gap: spacing.sm }}>
          <Text style={type.heading}>
            {parsed.problem ? "We couldn't read the analysis" : 'Not analysed yet'}
          </Text>
          <Text style={type.caption}>
            {parsed.problem ?? 'Analyse the photo to detect the layout and get suggestions.'}
          </Text>
          <Button
            title={room.analysis_json ? 'Analyse again' : 'Analyse room'}
            onPress={confirmAnalysis}
            loading={analyzing}
          />
        </Card>
      ) : null}

      {layout && arrangement && parsed.analysis ? (
        <React.Fragment key={`${room.updated_at}-${mode}`}>
          {parsed.analysis.confidence < 0.5 ? (
            <ErrorNotice message="The photo was hard to read, so treat this layout as a rough estimate. A wider photo or entering the room size helps." />
          ) : null}
          {parsed.analysis.notes ? <Text style={type.caption}>{parsed.analysis.notes}</Text> : null}

          <SegmentedControl<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { label: 'Ergonomic', value: 'ergonomic' },
              { label: 'Feng shui', value: 'feng_shui' },
            ]}
          />

          <Card style={{ gap: spacing.sm, alignItems: 'center' }}>
            <Text style={type.heading}>Current layout</Text>
            <FloorPlan layout={layout} items={layout.items} width={planWidth} />
          </Card>

          <Card style={{ gap: spacing.sm, alignItems: 'center' }}>
            <Text style={type.heading}>Suggested layout</Text>
            <Text style={type.caption}>
              Score {pct(arrangement.scoreBefore)} → {pct(arrangement.scoreAfter)}
            </Text>
            <FloorPlan
              layout={layout}
              items={arrangement.items}
              moves={arrangement.moves}
              width={planWidth}
            />
          </Card>

          <Text style={type.heading}>What to change</Text>
          {arrangement.moves.length === 0 ? (
            <Card>
              <Text style={type.body}>
                This layout already follows the {mode === 'feng_shui' ? 'feng shui' : 'ergonomic'}{' '}
                guidelines well. Nothing to move.
              </Text>
            </Card>
          ) : (
            arrangement.moves.map((m) => (
              <Card key={m.itemId} style={{ gap: spacing.xs }}>
                <Text style={type.heading}>Move the {m.label}</Text>
                {m.reasons.map((r) => (
                  <Bullet key={r}>{r}</Bullet>
                ))}
              </Card>
            ))
          )}

          {arrangement.remainingIssues.length > 0 ? (
            <Card style={{ backgroundColor: colors.warnSoft, gap: spacing.xs }}>
              <Text style={type.heading}>Still not ideal</Text>
              {arrangement.remainingIssues.map((r) => (
                <Bullet key={`${r.ruleId}-${r.itemIds.join()}`}>{r.message}</Bullet>
              ))}
            </Card>
          ) : null}

          <Button title="Save this arrangement" onPress={save} loading={saving} />
          <Button
            title="Correct detected items"
            variant="secondary"
            onPress={() => router.push({ pathname: '/edit-room', params: { id } })}
          />
          <Button
            title="Re-analyse photo"
            variant="secondary"
            onPress={confirmAnalysis}
            loading={analyzing}
          />
        </React.Fragment>
      ) : null}

      {saved.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={type.heading}>Saved arrangements</Text>
          {saved.map((s) => (
            <Card key={s.id}>
              <Text style={type.body}>
                {s.mode === 'feng_shui' ? 'Feng shui' : 'Ergonomic'} · {pct(s.score_after)}
              </Text>
              <Text style={type.caption}>{new Date(s.created_at).toLocaleString()}</Text>
            </Card>
          ))}
        </View>
      ) : null}

      <Button title="Delete room" variant="danger" onPress={confirmDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  photo: { aspectRatio: 4 / 3, borderRadius: 20, backgroundColor: colors.line },
});
