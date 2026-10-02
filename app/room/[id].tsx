import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FloorPlan } from '@/components/FloorPlan';
import { Button, Card, Centered, ErrorNotice, SegmentedControl } from '@/components/ui';
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
import { colors, spacing, type } from '@/theme/theme';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const planWidth = Math.min(screenWidth - spacing.md * 4, 420);

  const [room, setRoom] = useState<RoomRow | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
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
      setPhoto(r.photo_path ? await photoUrl(r.photo_path) : null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function save() {
    if (!arrangement) return;
    setSaving(true);
    try {
      await saveArrangement(id, arrangement);
      setSaved(await listArrangements(id));
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!room) return;
    Alert.alert('Delete this room?', 'The photo and all saved arrangements will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoom(room);
            router.back();
          } catch (e) {
            Alert.alert('Could not delete', (e as Error).message);
          }
        },
      },
    ]);
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

      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} accessibilityLabel="Room photo" />
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
            onPress={runAnalysis}
            loading={analyzing}
          />
        </Card>
      ) : null}

      {layout && arrangement && parsed.analysis ? (
        <>
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
                  <Text key={r} style={type.body}>
                    • {r}
                  </Text>
                ))}
              </Card>
            ))
          )}

          {arrangement.remainingIssues.length > 0 ? (
            <Card style={{ backgroundColor: colors.warnSoft, gap: spacing.xs }}>
              <Text style={type.heading}>Still not ideal</Text>
              {arrangement.remainingIssues.map((r) => (
                <Text key={`${r.ruleId}-${r.itemIds.join()}`} style={type.body}>
                  • {r.message}
                </Text>
              ))}
            </Card>
          ) : null}

          <Button title="Save this arrangement" onPress={save} loading={saving} />
          <Button
            title="Re-analyse photo"
            variant="secondary"
            onPress={runAnalysis}
            loading={analyzing}
          />
        </>
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
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 20, backgroundColor: colors.line },
});
