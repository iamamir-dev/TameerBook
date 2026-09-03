import React from 'react';
import { View } from 'react-native';

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
        .map((c) => c.trim());
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
        const heading = /^#{1,3}\s+/.test(line) || (/[:：]$/.test(line) && line.length <= 40 && !marker);
        if (heading) {
          return (
            <AppText key={i} size="sm" weight="bold" style={styles.heading}>
              {line.replace(/^#{1,3}\s+/, '').replace(/[:：]$/, '')}
            </AppText>
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

/** A compact table: header row, ruled body, numeric columns right-aligned. */
function Table({ rows }: { rows: string[][] }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const cols = Math.max(...rows.map((r) => r.length));
  const [header, ...body] = rows;
  // A column is numeric when most of its body cells look like numbers.
  const numeric = Array.from({ length: cols }, (_, c) => {
    const cells = body.map((r) => r[c] ?? '').filter(Boolean);
    return cells.length > 0 && cells.filter((v) => NUMERIC.test(v)).length >= Math.ceil(cells.length / 2);
  });
  const cellStyle = (c: number) => [styles.cell, c === 0 ? styles.cellFirst : undefined, numeric[c] ? styles.cellNum : undefined];
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.trHead]}>
        {Array.from({ length: cols }, (_, c) => (
          <AppText key={c} size="xs" weight="bold" color="textSecondary" uppercase numberOfLines={1} style={cellStyle(c)}>
            {header[c] ?? ''}
          </AppText>
        ))}
      </View>
      {body.map((r, ri) => (
        <View key={ri} style={[styles.tr, ri > 0 && styles.trRuled]}>
          {Array.from({ length: cols }, (_, c) => (
            <AppText key={c} size="sm" weight={numeric[c] ? 'bold' : 'regular'} tabular={numeric[c]} numberOfLines={2} selectable style={cellStyle(c)}>
              {renderInline(noBreakRupees(r[c] ?? ''))}
            </AppText>
          ))}
        </View>
      ))}
    </View>
  );
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
