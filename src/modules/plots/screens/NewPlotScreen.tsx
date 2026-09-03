import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppHeader, StickyFooter } from '@/components/ui';
import { createPlot, includePlotInProject } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { PlotFormFields } from '../components/PlotFormFields';
import { usePlotForm } from '../hooks/usePlotForm';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type NewPlotRoute = RouteProp<RootStackParamList, 'NewPlot'>;

/** Record a new plot purchase: location, size, deal price, and the seller. */
export function NewPlotScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const params = useRoute<NewPlotRoute>().params;
  const forProjectId = params?.forProjectId;
  const returnAfterCreate = params?.returnAfterCreate ?? false;
  const styles = makeStyles(theme);

  const { form, patch, canSave, buildInput } = usePlotForm();
  const { saving, run: runSave } = useSaveAction();

  const onCreate = async () => {
    if (!canSave || saving) return;
    let plotId: string | null = null;
    const ok = await runSave(async () => {
      const plot = await createPlot(buildInput());
      plotId = plot.id;
      // Created from a project's "Add plot" flow → include it now so the user
      // lands back on the project with the plot already attached.
      if (forProjectId) await includePlotInProject(plot.id, forProjectId);
    });
    if (!ok || !plotId) return;
    // From a project's add-plot flow / the wizard → return to the caller (it
    // refetches on focus). Otherwise open the created plot's detail.
    if (forProjectId || returnAfterCreate) navigation.goBack();
    else navigation.replace('PlotDetail', { plotId });
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('newPlot')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PlotFormFields form={form} patch={patch} />
        </ScrollView>

        <StickyFooter>
          <AppButton label={t('create')} icon="check" onPress={onCreate} loading={saving} disabled={!canSave} />
        </StickyFooter>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, paddingHorizontal: theme.spacing.page, gap: theme.spacing.md },
  });
