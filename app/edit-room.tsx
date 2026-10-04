import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { FloorPlan } from '@/components/FloorPlan';
import { Button, Card, Centered, ErrorNotice } from '@/components/ui';
import {
  addItem,
  addOpening,
  cycleOpeningWall,
  FURNITURE_TYPES,
  layoutToAnalysisJson,
  moveItem,
  moveOpening,
  NUDGE_CM,
  parseRoomAnalysis,
  removeItem,
  removeOpening,
  renameItem,
  resizeItem,
  rotateItem,
  RoomLayout,
  setItemType,
  setRoomSize,
  TYPE_LABELS,
  Wall,
} from '@/domain';
import { getRoom, updateRoomAnalysis } from '@/lib/api';
import { colors, radius, spacing, type } from '@/theme/theme';

const WALL_NAMES: Record<Wall, string> = { N: 'north', E: 'east', S: 'south', W: 'west' };
const FACING_NAMES: Record<Wall, string> = { N: 'up', E: 'right', S: 'down', W: 'left' };
const OPENING_STEP_CM = 20;

function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[type.body, active && { fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({
  label,
  onMinus,
  onPlus,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.row}>
      <Button title="−" variant="secondary" onPress={onMinus} style={styles.small} />
      <Text style={[type.body, styles.stepperLabel]}>{label}</Text>
      <Button title="+" variant="secondary" onPress={onPlus} style={styles.small} />
    </View>
  );
}

const metres = (cm: number) => String(Math.round(cm) / 100);

export default function EditRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [layout, setLayout] = useState<RoomLayout | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [widthText, setWidthText] = useState('');
  const [depthText, setDepthText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const room = await getRoom(id);
        const analysis = parseRoomAnalysis(room.analysis_json);
        if (cancelled) return;
        setLayout(analysis.layout);
        setNotes(analysis.notes);
        setWidthText(metres(analysis.layout.room.widthCm));
        setDepthText(metres(analysis.layout.room.depthCm));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error && !layout) {
    return (
      <Centered>
        <ErrorNotice message={error} />
      </Centered>
    );
  }
  if (!layout) {
    return (
      <Centered>
        <ActivityIndicator color={colors.accent} />
      </Centered>
    );
  }

  const selected = layout.items.find((i) => i.id === selectedId) ?? null;

  // The plan stays pinned above the controls, so every change is visible while you make it.
  const aspect = layout.room.widthCm / layout.room.depthCm;
  const planWidth = Math.max(
    140,
    Math.min(screenWidth - spacing.md * 2, 420, screenHeight * 0.38 * aspect),
  );

  function commitRoomSize() {
    if (!layout) return;
    const w = Number.parseFloat(widthText.replace(',', '.'));
    const d = Number.parseFloat(depthText.replace(',', '.'));
    if (Number.isFinite(w) && Number.isFinite(d)) {
      const next = setRoomSize(layout, w * 100, d * 100);
      setLayout(next);
      setWidthText(metres(next.room.widthCm));
      setDepthText(metres(next.room.depthCm));
    } else {
      setWidthText(metres(layout.room.widthCm));
      setDepthText(metres(layout.room.depthCm));
    }
  }

  async function save() {
    if (!layout) return;
    setSaving(true);
    try {
      await updateRoomAnalysis(id, layoutToAnalysisJson(layout, notes));
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.pinnedPlan}>
        <FloorPlan
          layout={layout}
          items={layout.items}
          width={planWidth}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={type.caption}>
          Fix anything the photo analysis got wrong. Tap an item on the plan to edit it. Suggestions
          update from your corrections.
        </Text>

        {selected ? (
          <Card style={{ gap: spacing.sm }}>
            <Text style={type.heading}>{selected.label || 'Item'}</Text>
            <TextInput
              style={styles.input}
              value={selected.label}
              onChangeText={(t) => setLayout(renameItem(layout, selected.id, t))}
              placeholder="Name"
              placeholderTextColor={colors.muted}
              maxLength={40}
              accessibilityLabel="Item name"
            />

            <Text style={type.caption}>Type (changes which guidelines apply)</Text>
            <View style={styles.wrap}>
              {FURNITURE_TYPES.map((t) => (
                <Chip
                  key={t}
                  label={TYPE_LABELS[t]}
                  active={selected.type === t}
                  onPress={() => setLayout(setItemType(layout, selected.id, t))}
                />
              ))}
            </View>

            <Text style={type.caption}>Move by {NUDGE_CM} cm</Text>
            <View style={styles.row}>
              <Button
                title="←"
                variant="secondary"
                style={styles.small}
                onPress={() => setLayout(moveItem(layout, selected.id, -NUDGE_CM, 0))}
              />
              <Button
                title="↑"
                variant="secondary"
                style={styles.small}
                onPress={() => setLayout(moveItem(layout, selected.id, 0, -NUDGE_CM))}
              />
              <Button
                title="↓"
                variant="secondary"
                style={styles.small}
                onPress={() => setLayout(moveItem(layout, selected.id, 0, NUDGE_CM))}
              />
              <Button
                title="→"
                variant="secondary"
                style={styles.small}
                onPress={() => setLayout(moveItem(layout, selected.id, NUDGE_CM, 0))}
              />
            </View>

            <Button
              title={`Turn 90° (front faces ${FACING_NAMES[selected.facing]})`}
              variant="secondary"
              onPress={() => setLayout(rotateItem(layout, selected.id))}
            />

            <Text style={type.caption}>Size</Text>
            <Stepper
              label={`Width ${selected.widthCm} cm`}
              onMinus={() => setLayout(resizeItem(layout, selected.id, -NUDGE_CM, 0))}
              onPlus={() => setLayout(resizeItem(layout, selected.id, NUDGE_CM, 0))}
            />
            <Stepper
              label={`Depth ${selected.depthCm} cm`}
              onMinus={() => setLayout(resizeItem(layout, selected.id, 0, -NUDGE_CM))}
              onPlus={() => setLayout(resizeItem(layout, selected.id, 0, NUDGE_CM))}
            />

            <Button
              title="Delete this item"
              variant="danger"
              onPress={() => {
                setLayout(removeItem(layout, selected.id));
                setSelectedId(null);
              }}
            />
          </Card>
        ) : (
          <Text style={type.caption}>Nothing selected. Tap an item on the plan.</Text>
        )}

        <Card style={{ gap: spacing.sm }}>
          <Text style={type.heading}>Add a missing item</Text>
          <View style={styles.wrap}>
            {FURNITURE_TYPES.map((t) => (
              <Chip
                key={t}
                label={`+ ${TYPE_LABELS[t]}`}
                onPress={() => {
                  const result = addItem(layout, t);
                  setLayout(result.layout);
                  setSelectedId(result.id);
                }}
              />
            ))}
          </View>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={type.heading}>Room size (metres)</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={widthText}
              onChangeText={setWidthText}
              onEndEditing={commitRoomSize}
              keyboardType="decimal-pad"
              accessibilityLabel="Room width in metres"
            />
            <Text style={type.body}>×</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={depthText}
              onChangeText={setDepthText}
              onEndEditing={commitRoomSize}
              keyboardType="decimal-pad"
              accessibilityLabel="Room length in metres"
            />
          </View>
          <Text style={type.caption}>
            Width runs left to right on the plan, length top to bottom. A measured size makes the
            suggestions much more reliable.
          </Text>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={type.heading}>Doors and windows</Text>
          {layout.openings.length === 0 ? (
            <Text style={type.caption}>None detected. Add the door so it is kept clear.</Text>
          ) : null}
          {layout.openings.map((o) => (
            <View key={o.id} style={{ gap: spacing.xs }}>
              <Text style={type.body}>
                {o.kind === 'door' ? 'Door' : 'Window'} on the {WALL_NAMES[o.wall]} wall
              </Text>
              <View style={styles.row}>
                <Button
                  title="◀"
                  variant="secondary"
                  style={styles.small}
                  onPress={() => setLayout(moveOpening(layout, o.id, -OPENING_STEP_CM))}
                />
                <Button
                  title="▶"
                  variant="secondary"
                  style={styles.small}
                  onPress={() => setLayout(moveOpening(layout, o.id, OPENING_STEP_CM))}
                />
                <Button
                  title="Other wall"
                  variant="secondary"
                  style={styles.small}
                  onPress={() => setLayout(cycleOpeningWall(layout, o.id))}
                />
                <Button
                  title="✕"
                  variant="danger"
                  style={styles.small}
                  onPress={() => setLayout(removeOpening(layout, o.id))}
                />
              </View>
            </View>
          ))}
          <View style={styles.row}>
            <Button
              title="+ Door"
              variant="secondary"
              style={styles.small}
              onPress={() => setLayout(addOpening(layout, 'door').layout)}
            />
            <Button
              title="+ Window"
              variant="secondary"
              style={styles.small}
              onPress={() => setLayout(addOpening(layout, 'window').layout)}
            />
          </View>
        </Card>

        <Button title="Save corrections" onPress={save} loading={saving} />
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pinnedPlan: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  small: { flex: 1, minHeight: 44, paddingHorizontal: spacing.sm },
  stepperLabel: { flex: 2, textAlign: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 16,
    color: colors.ink,
  },
});
