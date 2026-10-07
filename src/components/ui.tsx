import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, type } from '@/theme/theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.ink} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary && { color: '#fff' },
            variant === 'danger' && { color: colors.warn },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && { color: '#fff', fontWeight: '700' }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** One bullet line whose text wraps inside its container instead of running off the edge. */
export function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[type.body, { color: colors.accent }]}>•</Text>
      <Text style={[type.body, styles.bulletText]}>{children}</Text>
    </View>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={[type.body, { color: colors.warn }]}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.ink },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  buttonDanger: { backgroundColor: colors.warnSoft },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.ink, letterSpacing: -0.1 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#DFD9CE',
    borderRadius: radius.md,
    padding: 4,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md - 4 },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  bulletText: { flex: 1, flexShrink: 1 },
  error: {
    backgroundColor: colors.warnSoft,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warn,
    padding: spacing.md,
    gap: spacing.sm,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
});
