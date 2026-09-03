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
 *   - lines starting with "- ", "• " or "* " → bullets
 * Anything else is a plain paragraph line. No library, no HTML.
 */
export function RichText({ text }: { text: string }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View style={styles.wrap}>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <View key={i} style={styles.gap} />;
        const bullet = /^([-•*]|\d+[.)])\s+/.exec(line);
        const heading = /^#{1,3}\s+/.test(line) || (/[:：]$/.test(line) && line.length <= 40 && !bullet);
        if (heading) {
          return (
            <AppText key={i} size="xs" weight="bold" color="textSecondary" uppercase style={styles.heading}>
              {line.replace(/^#{1,3}\s+/, '').replace(/[:：]$/, '')}
            </AppText>
          );
        }
        const body = bullet ? line.slice(bullet[0].length) : line;
        return (
          <View key={i} style={bullet ? styles.bulletRow : undefined}>
            {bullet ? (
              <AppText size="sm" color="accent" style={styles.dot}>
                •
              </AppText>
            ) : null}
            <AppText size="sm" style={styles.para}>
              {renderInline(body)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
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
