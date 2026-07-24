import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppHeader, StickyFooter } from '@/components/ui';
import { getPlot, updatePlot } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';

import { PlotFormFields } from '../components/PlotFormFields';
import { usePlotForm } from '../hooks/usePlotForm';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type EditPlotRoute = RouteProp<RootStackParamList, 'EditPlot'>;

/** Edit an existing plot: correct its location, size, deal price, seller, and
 *  set the transfer deadline (which drives the Home deadline reminder). */
export function EditPlotScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { plotId } = useRoute<EditPlotRoute>().params;
  const styles = makeStyles(theme);

  const { form, patch, prefill, canSave, buildInput } = usePlotForm();
  const [loaded, setLoaded] = useState(false);
  const { saving, run: runSave } = useSaveAction();

  // Prefill once from the stored plot (don't reload on data bumps mid-edit).
  useEffect(() => {
    let alive = true;
    getPlot(plotId)
      .then((p) => {
        if (!alive || !p) return;
        prefill(p);
        setLoaded(true);
      })
      .catch(swallow('EditPlot:load'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotId]);

  const onSave = async () => {
    if (!loaded || !canSave || saving) return;
    const ok = await runSave(() => updatePlot(plotId, buildInput()));
    if (ok) navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('editPlot')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PlotFormFields form={form} patch={patch} />
        </ScrollView>

        <StickyFooter>
          <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!loaded || !canSave} />
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
