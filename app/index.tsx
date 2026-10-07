import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloorPlan } from '@/components/FloorPlan';
import { Button, Centered, ErrorNotice } from '@/components/ui';
import { parseRoomAnalysis, RoomAnalysis } from '@/domain';
import { listRooms, RoomRow } from '@/lib/api';
import { colors, radius, spacing, type } from '@/theme/theme';

const THUMB = 88;

/** What the empty list shows: a blank sheet of grid paper waiting for a room. */
const BLANK_ROOM = { room: { widthCm: 300, depthCm: 400 }, openings: [] };

function RoomCard({ room, onPress }: { room: RoomRow; onPress: () => void }) {
  const analysis = useMemo<RoomAnalysis | null>(() => {
    if (!room.analysis_json) return null;
    try {
      return parseRoomAnalysis(room.analysis_json);
    } catch {
      return null;
    }
  }, [room.analysis_json]);

  const added = new Date(room.created_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

  let thumb: React.ReactNode = <View style={styles.thumbEmpty} />;
  let size: string | null = null;
  if (analysis) {
    const { widthCm, depthCm } = analysis.layout.room;
    const aspect = widthCm / depthCm;
    const drawingWidth = Math.max(40, Math.round(aspect >= 1 ? THUMB : THUMB * aspect));
    size = `${analysis.layout.items.length} items · ${(widthCm / 100).toFixed(1)} × ${(depthCm / 100).toFixed(1)} m`;
    thumb = (
      <FloorPlan
        layout={analysis.layout}
        items={analysis.layout.items}
        width={drawingWidth}
        variant="thumb"
      />
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.thumbBox}>{thumb}</View>
      <View style={styles.cardText}>
        <Text style={type.heading} numberOfLines={1}>
          {room.name}
        </Text>
        {size ? <Text style={type.measure}>{size}</Text> : null}
        {!analysis ? (
          <View style={styles.todo}>
            <Text style={styles.todoText}>Needs analysis</Text>
          </View>
        ) : null}
        <Text style={type.caption}>Added {added}</Text>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRooms(await listRooms());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View>
          <Text style={type.title}>Rooms</Text>
          {rooms && rooms.length > 0 ? (
            <Text style={type.caption}>
              {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={8}
          style={styles.settings}
        >
          <Text style={styles.settingsText}>Settings</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={{ padding: spacing.md }}>
          <ErrorNotice message={error} onRetry={load} />
        </View>
      ) : rooms === null ? (
        <Centered>
          <ActivityIndicator color={colors.accent} />
        </Centered>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FloorPlan layout={BLANK_ROOM} items={[]} width={240} />
              <Text style={[type.heading, { marginTop: spacing.lg }]}>No rooms yet</Text>
              <Text style={[type.body, styles.emptyText]}>
                Photograph a room from one corner so the doors, windows and furniture are in view.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <RoomCard room={item} onPress={() => router.push(`/room/${item.id}`)} />
          )}
        />
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button title="Add a room" onPress={() => router.push('/capture')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  settings: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  settingsText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  thumbBox: {
    width: THUMB + 4,
    height: THUMB + 4,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmpty: {
    width: THUMB - 20,
    height: THUMB - 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.muted,
    opacity: 0.5,
  },
  cardText: { flex: 1, gap: 2 },
  todo: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tapeSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    marginVertical: 2,
  },
  todoText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { color: colors.muted, textAlign: 'center', maxWidth: 300, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
});
