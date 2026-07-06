import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { AppButton, AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { type ExportFormat, saveReport, shareReport } from '@/utils/exporter';

interface ReportPreviewProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  html: string;
  csv: string;
  baseName: string;
}

/**
 * Full-screen in-app preview of a report, rendered from its HTML in a WebView
 * (so it looks exactly like the exported PDF). A PDF/CSV toggle picks the
 * export format; Share opens the OS share sheet, Download saves to the device.
 */
export function ReportPreview({
  visible,
  onClose,
  title,
  html,
  csv,
  baseName,
}: ReportPreviewProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [busy, setBusy] = useState<null | 'share' | 'save'>(null);
  const [saved, setSaved] = useState(false);

  const payload = { html, csv, baseName };

  const onShare = async () => {
    setBusy('share');
    try {
      await shareReport(payload, format);
    } finally {
      setBusy(null);
    }
  };
  const onDownload = async () => {
    setBusy('save');
    try {
      const ok = await saveReport(payload, format);
      if (ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Top bar */}
        <View style={styles.bar}>
          <Pressable onPress={onClose} hitSlop={theme.touch.hitSlop} accessibilityRole="button" accessibilityLabel={t('cancel')} style={styles.iconBtn}>
            <AppIcon name="close" size={26} color="onPrimary" />
          </Pressable>
          <AppText size="lg" weight="bold" color="onPrimary" numberOfLines={1} style={styles.flex}>
            {title}
          </AppText>
          {/* PDF / CSV toggle */}
          <View style={styles.toggle}>
            {(['pdf', 'csv'] as ExportFormat[]).map((f) => {
              const active = f === format;
              return (
                <Pressable key={f} onPress={() => setFormat(f)} accessibilityRole="button" style={[styles.toggleBtn, active && styles.toggleActive]}>
                  <AppText size="xs" weight="bold" color={active ? 'primary' : 'onPrimary'}>
                    {f.toUpperCase()}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Preview */}
        <WebView originWhitelist={['*']} source={{ html }} style={styles.web} />

        {saved ? (
          <View style={[styles.toast, { bottom: insets.bottom + 92 }]}>
            <AppIcon name="checkCircle" size={18} color="onPrimary" />
            <AppText size="sm" weight="bold" color="onPrimary">
              {t('savedToDevice')}
            </AppText>
          </View>
        ) : null}

        {/* Actions */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          <View style={styles.flex}>
            <AppButton label={t('shareLabel')} icon="share" variant="secondary" onPress={onShare} loading={busy === 'share'} />
          </View>
          <View style={styles.flex}>
            <AppButton label={t('download')} icon="download" onPress={onDownload} loading={busy === 'save'} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.primary },
    flex: { flex: 1 },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    toggle: {
      flexDirection: 'row',
      backgroundColor: theme.colors.onPrimaryChip,
      borderRadius: theme.radius.pill,
      padding: 2,
    },
    toggleBtn: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radius.pill },
    toggleActive: { backgroundColor: theme.colors.card },
    web: { flex: 1, backgroundColor: theme.colors.card },
    footer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.card,
    },
    toast: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.success,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      ...theme.shadows.raised,
    },
  });
