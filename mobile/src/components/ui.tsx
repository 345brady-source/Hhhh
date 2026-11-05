/*
 * Shared building blocks. Institutional styling: white page (charcoal in dark),
 * hairline rules, small uppercase section labels, tabular figures.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../lib/session';
import { ChevronIcon } from './icons';

export function Screen({ children, scroll = true, padTop = true, topInset = false }: { children: React.ReactNode; scroll?: boolean; padTop?: boolean; topInset?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: (padTop ? 16 : 0) + (topInset ? insets.top + 8 : 0), paddingBottom: 32 + insets.bottom, paddingHorizontal: 20 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.bg }, pad]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 18, gap: 4 }}>
      <Text style={[s.title, { color: c.fg }]} accessibilityRole="header">
        {children}
      </Text>
      {sub ? <Text style={[s.sub, { color: c.fg3 }]}>{sub}</Text> : null}
    </View>
  );
}

export function Section({ label, right, children, style }: { label: string; right?: React.ReactNode; children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View style={[{ marginTop: 28 }, style]}>
      <View style={[s.secHead, { borderBottomColor: c.fg }]}>
        <Text style={[s.secLabel, { color: c.fg }]} accessibilityRole="header">
          {label.toUpperCase()}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Figures({ items }: { items: { label: string; value: string; note?: string }[] }) {
  const c = useColors();
  return (
    <View style={[s.figs, { borderTopColor: c.fg, borderBottomColor: c.line }]}>
      {items.map((it, i) => (
        <View key={it.label} style={[s.fig, i % 2 === 1 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.line, paddingLeft: 14 }, i >= 2 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
          <Text style={[s.figLabel, { color: c.fg3 }]}>{it.label.toUpperCase()}</Text>
          <Text style={[s.figValue, { color: c.fg }]} adjustsFontSizeToFit numberOfLines={2}>
            {it.value}
          </Text>
          {it.note ? <Text style={[s.figNote, { color: c.fg3 }]}>{it.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** A tappable row with a chevron, separated by a hairline. */
export function RowLink({ onPress, children, label }: { onPress: () => void; children: React.ReactNode; label: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.row, { borderBottomColor: c.line, backgroundColor: pressed ? c.surface2 : 'transparent' }]}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      <ChevronIcon color={c.fg3} />
    </Pressable>
  );
}

export function KV({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const c = useColors();
  return (
    <View style={[s.kv, { borderBottomColor: c.line }]}>
      <Text style={[s.kvLabel, { color: c.fg3 }]}>{label}</Text>
      <View style={{ flex: 1.3, alignItems: 'flex-end' }}>
        <Text style={[s.kvValue, { color: c.fg }]}>{value}</Text>
        {sub ? <Text style={[s.small, { color: c.fg3, textAlign: 'right' }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const c = useColors();
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        primary ? { backgroundColor: c.brand, borderColor: c.brand } : { backgroundColor: c.surface, borderColor: c.lineStrong },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 }
      ]}
    >
      <Text style={[s.btnText, { color: primary ? c.brandInk : kind === 'danger' ? c.bad : c.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6, marginBottom: 16 }}>
      <Text style={[s.fieldLabel, { color: c.fg2 }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.fg3}
        style={[s.input, { color: c.fg, borderColor: error ? c.bad : c.lineStrong, backgroundColor: c.surface }]}
        accessibilityLabel={label}
        {...props}
      />
      {error ? <Text style={[s.small, { color: c.bad, fontWeight: '600' }]}>{error}</Text> : hint ? <Text style={[s.small, { color: c.fg3 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  const c = useColors();
  return (
    <View style={[s.seg, { backgroundColor: c.surface3 }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[s.segItem, on && { backgroundColor: c.surface, shadowOpacity: 0.12 }]}>
            <Text style={[s.segText, { color: on ? c.fg : c.fg2, fontWeight: on ? '600' : '500' }]}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }} style={{ marginTop: 12, flexGrow: 0 }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, { borderColor: on ? c.brand : c.lineStrong, backgroundColor: on ? c.brand : c.surface }]}>
            <Text style={{ color: on ? c.brandInk : c.fg2, fontSize: 13, fontWeight: '600' }}>{l}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Elapsed share of the holding period, with the exit window shaded. */
export function HoldBar({ progress, windowStart }: { progress: number | null; windowStart?: number }) {
  const c = useColors();
  if (progress == null) return null;
  return (
    <View style={[s.bar, { backgroundColor: c.surface3 }]} accessibilityLabel={`${Math.round(progress * 100)} percent of the projected holding period has elapsed`}>
      {windowStart != null ? <View style={[s.barWin, { left: `${windowStart * 100}%`, backgroundColor: c.accent, opacity: 0.45 }]} /> : null}
      <View style={[s.barFill, { width: `${progress * 100}%`, backgroundColor: c.chart }]} />
    </View>
  );
}

export const textStyles = StyleSheet.create({
  strong: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 15 },
  small: { fontSize: 12 },
  num: { fontSize: 15, fontVariant: ['tabular-nums'] }
});

const s = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  sub: { fontSize: 13 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 8, borderBottomWidth: 1 },
  secLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  figs: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderBottomWidth: StyleSheet.hairlineWidth },
  fig: { width: '50%', paddingVertical: 14, paddingRight: 8, gap: 3 },
  figLabel: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.6 },
  figValue: { fontSize: 21, fontWeight: '600', letterSpacing: -0.2 },
  figNote: { fontSize: 11.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  kvLabel: { fontSize: 14, flex: 1 },
  kvValue: { fontSize: 15, textAlign: 'right' },
  small: { fontSize: 12 },
  btn: { minHeight: 48, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { fontSize: 16, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, fontSize: 16 },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 6, gap: 2 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 4, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0 },
  segText: { fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  bar: { height: 4, overflow: 'hidden', marginTop: 8 },
  barWin: { position: 'absolute', top: 0, bottom: 0, right: 0 },
  barFill: { position: 'absolute', top: 0, bottom: 0, left: 0 }
});
