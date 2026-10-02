import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorNotice } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, type } from '@/theme/theme';

export default function SignIn() {
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
        <Text style={type.title}>Roomwise</Text>
        <Text style={[type.body, { color: colors.muted, marginBottom: spacing.lg }]}>
          Photograph a room, get a calmer layout.
        </Text>

        <TextInput
          style={styles.input}
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
          style={styles.input}
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
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    fontSize: 16,
    color: colors.ink,
  },
});
