import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/RichText.styles';

/**
 * The little bit of markdown a chat answer needs, rendered with AppText so
 * every size and colour comes from the theme:
 *   - "**bold**" inline
 *   - lines ending in ":" or starting with "#" → a heading line
 *   - "- " / "• " / "1. " → bullet or numbered items
 *   - "| a | b |" blocks → a compact table (numeric cells right-aligned)
 * Anything else is a plain paragraph line. No library, no HTML.
 */

type Block = { kind: 'line'; text: string } | { kind: 'table'; rows: string[][] };

/** Group consecutive "|…|" lines into table blocks; everything else stays a line. */
function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let table: string[][] | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('|')) {
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        // A cell that is only a dash / comma / dot is the model's "nothing": show it empty.
        .map((c) => c.trim())
        .map((c) => (/^[\s,.\-–—]*$/.test(c) ? '' : c));
      // Separator rows (|---|:--:|) carry no data.
      if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) continue;
      (table ??= []).push(cells);
      continue;
    }
    if (table) {
      blocks.push({ kind: 'table', rows: table });
      table = null;
    }
    blocks.push({ kind: 'line', text: line });
  }
  if (table) blocks.push({ kind: 'table', rows: table });
  return blocks;
}

/** Status words → semantic colour (English + Roman Urdu). Matched on the whole cell, case-insensitive. */
const STATUS_TONE: { re: RegExp; color: 'success' | 'gold' | 'danger' }[] = [
  { re: /^(delivered|paid|active|completed|complete|sold|full|present|received|done|settled|transferred|hazir|mil gaya|aa gaya|poora|mukammal)$/i, color: 'success' },
  { re: /^(pending( delivery)?|partial(ly)? delivered|partial|half|on hold|open|in progress|baqi|adha|ruka|pending payment|to pay|due)$/i, color: 'gold' },
  { re: /^(absent|unpaid|cancelled|canceled|overdue|late|closed|ghair hazir|band|late payment)$/i, color: 'danger' },
];
function statusTone(cell: string): 'success' | 'gold' | 'danger' | undefined {
  const c = cell.replace(/\*\*/g, '').trim();
  return STATUS_TONE.find((s) => s.re.test(c))?.color;
}

/** Narrowest a text column may get before the table starts to scroll. */
const TEXT_MIN = 76;

const NUMERIC = /^[+−\-]?\s*(rs\.?|₨)?\s*[\d,.]+\s*(%|k|l|cr|lakh|crore)?$/i;

export function RichText({ text }: { text: string }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const blocks = parseBlocks(text);
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        if (b.kind === 'table') return <Table key={i} rows={b.rows} />;
        const line = b.text;
        if (!line) return <View key={i} style={styles.gap} />;
        const marker = /^([-•*]|\d+[.)])\s+/.exec(line);
        // A heading is a short label ("Cost:", "Needs attention:"), not a sentence that happens to end in a colon.
        const heading = /^#{1,3}\s+/.test(line) || (/[:：]$/.test(line) && line.length <= 32 && line.split(/\s+/).length <= 4 && !marker);
        if (heading) {
          // Sections read as blocks: a rule above every heading except the first.
          const first = !blocks.slice(0, i).some((x) => x.kind === 'line' && x.text);
          return (
            <View key={i} style={[styles.headingWrap, !first && styles.headingRule]}>
              <AppText size="sm" weight="bold">
                {line.replace(/^#{1,3}\s+/, '').replace(/[:：]$/, '').replace(/\*\*/g, '')}
              </AppText>
            </View>
          );
        }
        if (!marker) {
          return (
            <AppText key={i} size="sm" selectable>
              {renderInline(line)}
            </AppText>
          );
        }
        const numbered = /^\d/.test(marker[1]);
        return (
          <View key={i} style={styles.bulletRow}>
            <AppText size="sm" weight={numbered ? 'bold' : 'regular'} color="accent" style={styles.dot}>
              {numbered ? marker[1].replace(')', '.') : '•'}
            </AppText>
            <AppText size="sm" selectable style={styles.bulletText}>
              {renderInline(line.slice(marker[0].length))}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

/**
 * A compact table that never breaks: every column gets a fixed width from its
 * longest cell (so rows stay aligned), the widths are scaled up to fill the
 * bubble when there is room, and the whole table scrolls sideways when not.
 */
function Table({ rows }: { rows: string[][] }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [avail, setAvail] = useState(0);
  const cols = Math.max(...rows.map((r) => r.length));
  const [rawHeader, ...rawBody] = rows;
  // A column is numeric when most of its body cells look like numbers.
  const numeric = Array.from({ length: cols }, (_, c) => {
    const cells = rawBody.map((r) => r[c] ?? '').filter(Boolean);
    return cells.length > 0 && cells.filter((v) => NUMERIC.test(v)).length >= Math.ceil(cells.length / 2);
  });
  // Step 1: a money column where most cells start with "Rs" moves the unit into
  // the header ("Baqaya (Rs)") and drops it from the cells. Saves ~25px per column.
  const rsCol = Array.from({ length: cols }, (_, c) => {
    if (!numeric[c]) return false;
    const cells = rawBody.map((r) => r[c] ?? '').filter(Boolean);
    return cells.length > 0 && cells.filter((v) => /^\**\s*(rs\.?|₨)\s/i.test(v)).length >= Math.ceil(cells.length / 2);
  });
  const stripRs = (v: string) => v.replace(/^(\**)\s*(rs\.?|₨)\s+/i, '$1');
  const header = rawHeader.map((h, c) => (rsCol[c] && !/\brs\b|₨/i.test(h) ? `${h} (Rs)` : h));
  const body = rawBody.map((r) => r.map((v, c) => (rsCol[c] ? stripRs(v) : v)));
  // Step 2: column width from the longest cell, clamped, then fitted to the bubble.
  const measure = (charPx: number) =>
    Array.from({ length: cols }, (_, c) => {
      const longest = Math.max(header[c]?.length ?? 0, ...body.map((r) => (r[c] ?? '').replace(/\*\*/g, '').length));
      const px = longest * (numeric[c] ? charPx + 0.5 : charPx) + 20;
      return Math.min(numeric[c] ? 160 : 200, Math.max(numeric[c] ? 52 : TEXT_MIN, Math.round(px)));
    });
  const pad = 2 * theme.spacing.sm;
  const inner = Math.max(0, avail - pad);
  // Step 3: text columns shrink to TEXT_MIN (wrapping to two lines) before anything else.
  const fit = (base: number[]) => {
    const total = base.reduce((a, b) => a + b, 0);
    if (avail === 0) return base;
    if (total > inner) {
      const shrinkable = base.reduce((a, b, c) => a + (numeric[c] ? 0 : Math.max(0, b - TEXT_MIN)), 0);
      const k = shrinkable > 0 ? Math.min(1, (total - inner) / shrinkable) : 0;
      return base.map((b, c) => (numeric[c] ? b : Math.round(b - Math.max(0, b - TEXT_MIN) * k)));
    }
    const scale = inner / total;
    return base.map((b) => Math.floor(b * scale));
  };
  let width = fit(measure(7.5));
  // Step 4: still too wide → one size smaller for the whole table.
  const compact = avail > 0 && width.reduce((a, b) => a + b, 0) > inner + 1;
  if (compact) width = fit(measure(6.4));
  // Step 5: last resort, scroll sideways (with a fade hinting at more).
  const overflows = avail > 0 && width.reduce((a, b) => a + b, 0) > inner + 1;
  const size = compact ? 'xs' : 'sm';
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const cell = (c: number, node: React.ReactNode, key: number) => (
    <View key={key} style={[styles.cell, { width: width[c] }]}>
      {node}
    </View>
  );
  return (
    <View style={styles.tableWrap}>
      {/* flexGrow 0 on the ScrollView itself: a nested ScrollView otherwise stretches to the chat's full height inside the outer list. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={styles.tableScroll}
        contentContainerStyle={styles.tableScrollContent}
        onLayout={(e) => setAvail(e.nativeEvent.layout.width)}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          setScrolledToEnd(contentOffset.x + layoutMeasurement.width >= contentSize.width - 2);
        }}
        scrollEventThrottle={32}
      >
      <View style={styles.table}>
        <View style={[styles.tr, styles.trHead]}>
          {Array.from({ length: cols }, (_, c) =>
            cell(
              c,
              <AppText size="xs" weight="bold" color="textSecondary" uppercase numberOfLines={1} style={numeric[c] ? styles.cellNum : undefined}>
                {header[c] ?? ''}
              </AppText>,
              c
            )
          )}
        </View>
        {body.map((r, ri) => {
          // A closing "Total" row (like the foot of a bill) gets a stronger rule above and bold text.
          const isTotal = /^\**\s*(total|kul|jama|sum|grand total|milakar)\b/i.test(r[0] ?? '');
          return (
          <View key={ri} style={[styles.tr, ri > 0 && styles.trRuled, isTotal && styles.trTotal]}>
            {Array.from({ length: cols }, (_, c) =>
              cell(
                c,
                (() => {
                  const raw = r[c] ?? '';
                  const tone = numeric[c] ? undefined : statusTone(raw);
                  if (tone) {
                    return (
                      <View style={styles.statusCell}>
                        <View style={[styles.statusDot, { backgroundColor: theme.colors[tone] }]} />
                        <AppText size={size} weight="semibold" color={tone} numberOfLines={2} style={styles.statusText}>
                          {raw.replace(/\*\*/g, '')}
                        </AppText>
                      </View>
                    );
                  }
                  // Amounts: money is coloured like the rest of the app (out = red, in = green, neutral = dark).
                  const amountTone = numeric[c] ? amountToneFor(header[c] ?? '', raw) : undefined;
                  return (
                    <AppText size={size} weight={numeric[c] || isTotal ? 'bold' : 'regular'} tabular={numeric[c]} color={isTotal && numeric[c] ? 'textPrimary' : amountTone} numberOfLines={2} selectable style={numeric[c] ? styles.cellNum : undefined}>
                      {renderInline(noBreakRupees(raw))}
                    </AppText>
                  );
                })(),
                c
              )
            )}
          </View>
          );
        })}
      </View>
      </ScrollView>
      {overflows && !scrolledToEnd ? (
        // Right-edge fade: "there is more, swipe". Same tint as the table so it reads as one surface.
        <LinearGradient colors={[theme.colors.primarySoft + '00', theme.colors.primarySoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tableFade} pointerEvents="none" />
      ) : null}
    </View>
  );
}

/**
 * Colour for a numeric cell from its column header and sign: explicit signs
 * win; otherwise "to pay / baqaya / kharcha / remaining" columns read as money
 * going out (red) and "received / invested / aamdani / profit" as money in
 * (green). Percentages and counts stay neutral.
 */
function amountToneFor(header: string, cell: string): 'success' | 'danger' | 'textPrimary' {
  const c = cell.replace(/\*\*/g, '').trim();
  if (!/\d/.test(c) || /%$/.test(c) || /^\d+$/.test(c)) return 'textPrimary';
  if (/^[−-]/.test(c)) return 'danger';
  if (/^\+/.test(c)) return 'success';
  const h = header.toLowerCase();
  if (/(to pay|baqaya|remaining|kharcha|expense|spent|cost|owed|due|payable|dena)/.test(h)) return 'danger';
  if (/(received|invested|aamdani|income|profit|paid in|mila|capital|earned|kamai)/.test(h)) return 'success';
  return 'textPrimary';
}

/** Keep "Rs 5,000" on one line inside narrow table cells. */
function noBreakRupees(s: string): string {
  return s.replace(/\b(Rs\.?|PKR)\s+(?=[\d(−-])/g, '$1\u00A0');
}

/** Split "**bold**" spans into nested Text runs. */
function renderInline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  if (parts.length === 1 && !parts[0].startsWith('**')) return s;
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <AppText key={i} size="sm" weight="bold">
        {p.slice(2, -2)}
      </AppText>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    )
  );
}
