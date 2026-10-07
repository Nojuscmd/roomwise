import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FloorPlan } from '@/components/FloorPlan';
import { Button, ErrorNotice } from '@/components/ui';
import { Furniture, RoomLayout } from '@/domain';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, type } from '@/theme/theme';

/** A small sample room that introduces the app before anyone signs in. */
const SAMPLE_LAYOUT: Pick<RoomLayout, 'room' | 'openings'> = {
  room: { widthCm: 360, depthCm: 280 },
  openings: [
    { id: 'door', kind: 'door', wall: 'S', offsetCm: 230, widthCm: 90 },
    { id: 'window', kind: 'window', wall: 'E', offsetCm: 70, widthCm: 130 },
  ],
};
const SAMPLE_ITEMS: Furniture[] = [
  {
    id: 'bed',
    type: 'bed',
    label: 'Bed',
    xCm: 14,
    yCm: 10,
    widthCm: 160,
    depthCm: 200,
    facing: 'S',
  },
  {
    id: 'desk',
    type: 'desk',
    label: 'Desk',
    xCm: 215,
    yCm: 10,
    widthCm: 130,
    depthCm: 60,
    facing: 'S',
  },
  {
    id: 'wardrobe',
    type: 'wardrobe',
    label: 'Wardrobe',
    xCm: 14,
    yCm: 222,
    widthCm: 110,
    depthCm: 55,
    facing: 'N',
  },
];

export default function SignIn() {
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = /^\S+@\S+\.\S+$/.test(email) && password.length >= 8;

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error: err } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(err.message);
    else if (mode === 'up' && !data.session)
      setNotice('Check your email to confirm your account, then sign in.');
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <View style={{ alignItems: 'flex-start' }}>
          <FloorPlan layout={SAMPLE_LAYOUT} items={SAMPLE_ITEMS} width={250} />
        </View>
        <View style={{ marginBottom: spacing.sm }}>
          <Text style={type.title}>Roomwise</Text>
          <Text style={[type.body, { color: colors.muted }]}>
            Photograph a room, get a layout that works.
          </Text>
        </View>

        <TextInput
          style={[styles.input, focused === 'email' && styles.inputFocused]}
          onFocus={() => setFocused('email')}
          onBlur={() => setFocused(null)}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email"
        />
        <TextInput
          style={[styles.input, focused === 'password' && styles.inputFocused]}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused(null)}
          placeholder="Password (8+ characters)"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
        />

        {error ? <ErrorNotice message={error} /> : null}
        {notice ? <Text style={[type.body, { color: colors.accent }]}>{notice}</Text> : null}

        <Button
          title={mode === 'in' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={busy}
          disabled={!valid}
        />
        <View style={{ alignItems: 'center' }}>
          <Button
            variant="secondary"
            title={mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
            onPress={() => setMode(mode === 'in' ? 'up' : 'in')}
            style={{ borderWidth: 0, backgroundColor: 'transparent' }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 54,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocused: { borderColor: colors.ink },
});
