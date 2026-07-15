import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppHeader, AppIcon, AppText, StickyFooter } from '@/components/ui';
import { createCompany } from '@/db';
import { useTranslation } from '@/i18n';
import { swallow } from '@/utils/log';
import { captureReceipt } from '@/utils/photo';
import type { RootStackParamList } from '@/navigation/types';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Create another company/workspace. `createCompany` seeds its default
 * Cash-in-Hand account (with the opening cash) and makes it active  the
 * store switch re-keys the app so every screen shows the new company's data.
 */
export function NewCompanyScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [name, setName] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);

  const pickLogo = async () => {
    const uri = await captureReceipt().catch(swallow('newCompany:logo'));
    if (uri) setLogoUri(uri);
  };
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [openingCash, setOpeningCash] = useState(0);
  const [saving, setSaving] = useState(false);

  const onCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const company = await createCompany({
        logoUri,
        name,
        ownerName: ownerName.trim() || null,
        phone: phone.trim() || null,
        openingCash,
      });
      // Bump the store: refresh the list and register the switch (re-keys the app).
      await useCompanyStore.getState().refresh();
      await useCompanyStore.getState().switchTo(company.id);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('newCompany')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppText size="sm" color="textSecondary">
            {t('companySetupBody')}
          </AppText>
          {/* Company logo — tap to add/replace (optional). */}
          <Pressable onPress={pickLogo} accessibilityRole="button" accessibilityLabel={t('photo')} style={stylesLogo.picker}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={stylesLogo.logo} />
            ) : (
              <View style={stylesLogo.fallback}>
                <AppIcon name="projects" size={26} color="primary" />
              </View>
            )}
            <View style={stylesLogo.badge}>
              <AppIcon name="camera" size={14} color="onAccent" />
            </View>
          </Pressable>

          <FloatingLabelInput label={t('companyName')} value={name} onChangeText={setName} />
          <FloatingLabelInput label={t('ownerName')} value={ownerName} onChangeText={setOwnerName} />
          <FloatingLabelInput
            label={t('phone')}
            value={phone}
            onChangeText={setPhone}
            mask="phone"
            hint={t('hintPhone')}
          />
          <AmountInput
            floating
            surface={theme.colors.background}
            label={t('openingCash')}
            value={openingCash}
            onChange={setOpeningCash}
          />
        </ScrollView>

        <StickyFooter>
          <AppButton
            label={t('createCompanyLabel')}
            icon="check"
            onPress={onCreate}
            loading={saving}
            disabled={!name.trim()}
          />
        </StickyFooter>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  });

/** Shared look for the tappable company-logo picker (both create forms). */
const stylesLogo = StyleSheet.create({
  picker: { alignSelf: 'center' },
  logo: { width: 72, height: 72, borderRadius: 20 },
  fallback: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(127,127,127,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
