import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Card, Centered, ErrorNotice } from '@/components/ui';
import { listRooms, RoomRow } from '@/lib/api';
import { colors, spacing, type } from '@/theme/theme';

export default function Home() {
  const router = useRouter();
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
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityLabel="Settings"
              hitSlop={12}
            >
              <Text style={{ color: colors.accent, fontSize: 16 }}>Settings</Text>
            </Pressable>
          ),
        }}
      />

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
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <Centered>
              <Text style={type.heading}>No rooms yet</Text>
              <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
                Take a photo of a room and Roomwise will suggest a better arrangement.
              </Text>
            </Centered>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/room/${item.id}`)} accessibilityRole="button">
              <Card>
                <Text style={type.heading}>{item.name}</Text>
                <Text style={type.caption}>
                  {item.analyzed_at ? 'Analysed' : 'Not analysed yet'} ·{' '}
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </Card>
            </Pressable>
          )}
        />
      )}

      <View style={styles.footer}>
        <Button title="Add a room" onPress={() => router.push('/capture')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  footer: { padding: spacing.md, paddingBottom: spacing.lg },
});
