import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import Signature, { type SignatureViewRef } from 'react-native-signature-canvas';

import { AppButton, AppHeader, AppText, StickyFooter } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { captureSignature, normalizeSignature } from '@/utils/photo';
import { removeBackground } from '@/utils/removeBg';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Mode = 'draw' | 'photo';

/**
 * Full-page authorized-signature capture. If one is already saved it's shown
 * with Change / Remove; otherwise (or on Change) it drops into capture mode —
 * draw on the canvas, or photograph / pick and crop. Saves a base64 data URL to
 * settings. Offline.
 */
export function SignatureScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const signature = useSettingsStore((s) => s.signature);
  const setSignature = useSettingsStore((s) => s.setSignature);
  const removeBgKey = useSettingsStore((s) => s.removeBgKey);

  const ref = useRef<SignatureViewRef>(null);
  const [editing, setEditing] = useState(!signature);
  const [mode, setMode] = useState<Mode>('draw');
  const [photo, setPhoto] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  const extract = () => {
    if (!photo) return;
    if (!removeBgKey) {
      Alert.alert(t('signature'), t('signNeedKey'));
      return;
    }
    setExtracting(true);
    removeBackground(photo, removeBgKey)
      .then((clean) => setPhoto(clean))
      .catch((e: Error) => {
        const code = e.message;
        const msg = code === 'offline' ? 'signOffline' : code === 'badkey' ? 'signBadKey' : code === 'credits' ? 'signCredits' : 'signFailed';
        Alert.alert(t('signature'), t(msg));
      })
      .finally(() => setExtracting(false));
  };

  const save = (dataUrl: string) => {
    void normalizeSignature(dataUrl)
      .catch(() => dataUrl)
      .then((fixed) => {
        setSignature(fixed);
        setPhoto(null);
        setMode('draw');
        setEditing(false);
      });
  };
  const remove = () =>
    Alert.alert(t('signatureSetting'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { setSignature(null); setEditing(true); } },
    ]);
  const pick = (source: 'camera' | 'gallery') =>
    void captureSignature(source)
      .then((d) => d && setPhoto(d))
      .catch(swallow('signature:photo'));

  const webStyle = `.m-signature-pad--footer{display:none}.m-signature-pad{box-shadow:none;border:none}.m-signature-pad--body{border:none}body,html{background:#fff;margin:0}`;

  // ── Saved: show it with Change / Remove ──────────────────────────────
  if (!editing && signature) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('signature')} onBack={() => navigation.goBack()} />
        <View style={styles.previewWrap}>
          <Image source={{ uri: signature }} style={styles.previewImg} resizeMode="contain" />
          <AppText size="xs" color="textSecondary">{t('signatureSetting')}</AppText>
        </View>
        <StickyFooter>
          <View style={styles.footerRow}>
            <AppButton label={t('delete')} icon="trash" variant="danger" fullWidth={false} onPress={remove} />
            <View style={styles.flex}>
              <AppButton label={t('signChange')} icon="edit" onPress={() => setEditing(true)} />
            </View>
          </View>
        </StickyFooter>
      </View>
    );
  }

  // ── Capture: draw or photo ───────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <AppHeader title={t('signature')} onBack={() => navigation.goBack()} />

      <View style={styles.toggleWrap}>
        <View style={styles.toggle}>
          {(['draw', 'photo'] as Mode[]).map((m) => {
            const on = m === mode;
            return (
              <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="button" style={[styles.toggleBtn, on && styles.toggleOn]}>
                <AppText size="sm" weight="bold" color={on ? 'onAccent' : 'textSecondary'}>
                  {m === 'draw' ? t('signDraw') : t('signPhoto')}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mode === 'draw' ? (
        <View style={styles.pad}>
          <Signature
            ref={ref}
            onOK={save}
            webStyle={webStyle}
            autoClear={false}
            trimWhitespace
            imageType="image/png"
            backgroundColor="#ffffff"
            penColor={theme.colors.textPrimary}
          />
        </View>
      ) : (
        <View style={styles.photoArea}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.preview} resizeMode="contain" />
          ) : (
            <AppText size="sm" color="textSecondary" center>
              {t('signatureHint')}
            </AppText>
          )}
          <View style={styles.photoBtns}>
            <AppButton label={t('signCamera')} icon="camera" variant="secondary" fullWidth={false} onPress={() => pick('camera')} />
            <AppButton label={t('signGallery')} icon="image" variant="secondary" fullWidth={false} onPress={() => pick('gallery')} />
          </View>
          {photo ? (
            <AppButton label={t('signExtract')} icon="check" fullWidth={false} loading={extracting} onPress={extract} />
          ) : null}
        </View>
      )}

      <StickyFooter>
        <View style={styles.footerRow}>
          {mode === 'draw' ? (
            <>
              <AppButton label={t('signClear')} variant="secondary" fullWidth={false} onPress={() => ref.current?.clearSignature()} />
              <View style={styles.flex}>
                <AppButton label={t('save')} icon="check" onPress={() => ref.current?.readSignature()} />
              </View>
            </>
          ) : (
            <View style={styles.flex}>
              <AppButton label={t('save')} icon="check" disabled={!photo} onPress={() => photo && save(photo)} />
            </View>
          )}
        </View>
      </StickyFooter>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    previewWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.lg },
    previewImg: { width: '90%', height: 240, backgroundColor: theme.colors.card, borderRadius: theme.radius.md },
    toggleWrap: { alignItems: 'center', paddingVertical: theme.spacing.md },
    toggle: { flexDirection: 'row', backgroundColor: theme.colors.card, borderRadius: theme.radius.pill, padding: 3 },
    toggleBtn: { paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
    toggleOn: { backgroundColor: theme.colors.accent },
    pad: { flex: 1, marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.border, overflow: 'hidden' },
    photoArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.lg },
    preview: { width: '90%', height: 240, backgroundColor: theme.colors.card, borderRadius: theme.radius.md },
    photoBtns: { flexDirection: 'row', gap: theme.spacing.md },
    footerRow: { flexDirection: 'row', gap: theme.spacing.md },
  });
