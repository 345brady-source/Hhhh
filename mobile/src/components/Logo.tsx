/*
 * Sponsor logo lockup (generated mark + wordmark, or an uploaded image) and the
 * neutral Shareholder Desk mark shown before a sponsor is known.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { NS } from '../core';
import type { Any } from '../lib/format';
import { useColors } from '../lib/session';

/** The core draws marks with CSS `style` attributes; react-native-svg wants plain attributes. */
function toAttributes(svg: string): string {
  return svg.replace(/style="([^"]*)"/g, (_m, css: string) =>
    css
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(':');
        const k = d.slice(0, i).trim();
        const v = d.slice(i + 1).trim().replace(/px$/, '');
        return `${k}="${v.replace(/"/g, "'")}"`;
      })
      .join(' ')
  );
}

export function Mark({ tenant, size = 34, onBrand = false }: { tenant: Any; size?: number; onBrand?: boolean }) {
  const c = useColors();
  const logo = tenant.logo || {};
  const colors = onBrand ? { p: c.navFgStrong, a: c.markA, ink: c.navBg } : { p: c.markP, a: c.markA, ink: c.markInk };
  const body = NS.brand.markBody(logo.type === 'image' ? 'monogram' : logo.type, logo.letters, colors, 'System');
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${toAttributes(body)}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}

export function Lockup({ tenant, size = 'md' }: { tenant: Any; size?: 'sm' | 'md' | 'lg' }) {
  const c = useColors();
  const logo = tenant.logo || {};
  const img = logo.type === 'image' ? NS.brand.safeImage(logo.image) : '';
  const markSize = size === 'lg' ? 44 : size === 'sm' ? 26 : 34;
  const nameSize = size === 'lg' ? 22 : size === 'sm' ? 15 : 18;
  if (img) {
    return (
      <View style={[styles.row, logo.plate && styles.plate]}>
        <Image source={{ uri: img }} style={{ height: markSize, width: markSize * 4, resizeMode: 'contain' }} accessibilityLabel={tenant.name} />
      </View>
    );
  }
  return (
    <View style={styles.row} accessible accessibilityLabel={tenant.name}>
      <Mark tenant={tenant} size={markSize} />
      <View style={{ gap: 3 }}>
        <Text style={[styles.name, { color: c.fg, fontSize: nameSize }]}>{tenant.shortName || tenant.name}</Text>
        {tenant.tagline && size !== 'sm' ? <Text style={[styles.tag, { color: c.fg3 }]}>{String(tenant.tagline).toUpperCase()}</Text> : null}
      </View>
    </View>
  );
}

/** Shareholder Desk's logo: the Carrow & Vale mark (navy and teal split square). */
export function AppMark({ size = 48 }: { size?: number }) {
  const c = useColors();
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M0 0 L100 0 L0 100 Z" fill="#0F2742"/>
    <path d="M100 0 L100 100 L0 100 Z" fill="#1F7A8C"/>
    <line x1="-6" y1="106" x2="106" y2="-6" stroke="${c.bg}" stroke-width="11"/>
  </svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plate: { backgroundColor: '#FFFFFF', padding: 6, borderRadius: 4 },
  name: { fontWeight: '600', letterSpacing: 0.1 },
  tag: { fontSize: 9, fontWeight: '600', letterSpacing: 2.4 }
});
