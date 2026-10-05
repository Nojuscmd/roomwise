import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, SegmentedControl } from '@/components/ui';
import { Mode } from '@/domain';
import { getPreferences, Preferences, savePreferences } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, spacing, type } from '@/theme/theme';
import { notify } from '@/lib/dialog';

export default function Settings() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);

  useEffect(() => {
    getPreferences()
      .then(setPrefs)
      .catch(() => setPrefs({ default_mode: 'ergonomic', units: 'metric' }));
  }, []);

  async function update(next: Preferences) {
    const previous = prefs;
    setPrefs(next);
    try {
      await savePreferences(next);
    } catch (e) {
      setPrefs(previous);
      notify('Could not save', (e as Error).message);
    }
  }

  if (!prefs) return null;

  return (
    <View style={styles.root}>
      <Card style={{ gap: spacing.sm }}>
        <Text style={type.heading}>Default suggestion style</Text>
        <SegmentedControl<Mode>
          value={prefs.default_mode}
          onChange={(m) => update({ ...prefs, default_mode: m })}
          options={[
            { label: 'Ergonomic', value: 'ergonomic' },
            { label: 'Feng shui', value: 'feng_shui' },
          ]}
        />
      </Card>
      <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      <Text style={[type.caption, { textAlign: 'center' }]}>
        Suggestions are guidelines based on common ergonomic and feng shui principles, not
        professional advice.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md },
});
