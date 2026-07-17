import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  SelectSheet,
  type IconKey,
} from '@/components/ui';
import type { ExitScenario } from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { InvestorPersonSheet } from '../components/InvestorPersonSheet';
import { useExitWizard } from '../hooks/useExitWizard';
import { makeStyles } from '../styled/ExitWizardScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ExitRoute = RouteProp<RootStackParamList, 'ExitWizard'>;

const SCENARIOS: { id: ExitScenario; labelKey: TranslationKey; icon: IconKey }[] = [
  { id: 'PARTNER_BUY', labelKey: 'scPartnerBuy', icon: 'investors' },
  { id: 'NEW_INVESTOR', labelKey: 'scNewInvestor', icon: 'investor' },
  { id: 'OWNER_BUY', labelKey: 'scOwnerBuy', icon: 'balance' },
  { id: 'PARTIAL', labelKey: 'scPartial', icon: 'moneyOut' },
  { id: 'COMMITTED_UNPAID', labelKey: 'scCommitted', icon: 'empty' },
];

export function ExitWizardScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { investorId } = useRoute<ExitRoute>().params;
  const styles = makeStyles(theme);
  const w = useExitWizard(investorId);

  const [buyerSheet, setBuyerSheet] = useState(false);
  const [personSheet, setPersonSheet] = useState(false);

  const goBack = () => (w.isFirstStep ? navigation.goBack() : w.goBackStep());

  return (
    <View style={styles.screen}>
      <AppHeader title={t('exitTitle')} subtitle={`${w.step + 1} / 5`} onBack={goBack} />
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.dot, i === w.step ? styles.dotActive : i < w.step ? styles.dotDone : null]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Step 1 — who + which project */}
        {w.step === 0 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('exitWho')}
            </AppText>
            {w.parts.map((p) => {
              const active = p.id === w.piId;
              return (
                <Pressable key={p.id} onPress={() => w.setPiId(p.id)} style={[styles.optCard, active && styles.optActive]} accessibilityRole="button">
                  <AppIcon name="project" size={20} color={active ? 'accent' : 'textSecondary'} />
                  <AppText size="md" weight="semibold" style={styles.flex}>
                    {p.projectName}
                  </AppText>
                  {active ? <AppIcon name="checkCircle" size={20} color="accent" /> : null}
                </Pressable>
              );
            })}
            {w.leaverShare ? (
              <AppCard>
                <AppText size="sm" color="textSecondary">
                  {w.investor?.name} · {w.selectedPart?.projectName}
                </AppText>
                <View style={styles.snapRow}>
                  <AppText size="sm">{t('paidInCapital')}</AppText>
                  <AppText size="md" weight="bold" tabular>
                    {formatRupees(w.leaverShare.capital)}
                  </AppText>
                </View>
                <View style={styles.snapRow}>
                  <AppText size="sm">{t('ownershipPct')}</AppText>
                  <AppText size="md" weight="bold" color="gold" tabular>
                    {w.leaverShare.ownershipPct.toFixed(1)}%
                  </AppText>
                </View>
              </AppCard>
            ) : null}
          </>
        ) : null}

        {/* Step 2 — scenario */}
        {w.step === 1 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('exitScenario')}
            </AppText>
            {SCENARIOS.map((sc) => {
              const active = sc.id === w.scenario;
              return (
                <Pressable key={sc.id} onPress={() => w.setScenario(sc.id)} style={[styles.optCard, active && styles.optActive]} accessibilityRole="button">
                  <View style={[styles.scIcon, active && styles.scIconActive]}>
                    <AppIcon name={sc.icon} size={20} color={active ? 'onAccent' : 'primary'} />
                  </View>
                  <AppText size="md" weight="semibold" style={styles.flex}>
                    {t(sc.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {/* Step 3 — value + consent */}
        {w.step === 2 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('exitValue')}
            </AppText>
            <AmountInput value={w.valuation} onChange={w.setValuation} autoFocus />
            <View style={styles.noteBox}>
              <AppText size="sm" color="textSecondary">
                {t('exitValueNote')}
              </AppText>
            </View>
            <Pressable onPress={() => w.setAgreed(!w.agreed)} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: w.agreed }}>
              <View style={[styles.checkbox, w.agreed && styles.checkboxOn]}>
                {w.agreed ? <AppIcon name="check" size={16} color="onPrimary" strokeWidth={2.6} /> : null}
              </View>
              <AppText size="sm" weight="semibold" style={styles.flex}>
                {t('confirmAgreed')}
              </AppText>
            </Pressable>
          </>
        ) : null}

        {/* Step 4 — buyer / portion */}
        {w.step === 3 ? (
          <>
            {w.scenario === 'PARTNER_BUY' ? (
              <Pressable onPress={() => setBuyerSheet(true)} style={styles.optCard} accessibilityRole="button">
                <AppIcon name="investor" size={20} color="primary" />
                <AppText size="md" weight="semibold" style={styles.flex} color={w.buyerPiId ? 'textPrimary' : 'textSecondary'}>
                  {w.shares.find((s) => s.projectInvestorId === w.buyerPiId)?.name ?? t('buyer')}
                </AppText>
                <AppIcon name="forward" size={18} color="textSecondary" />
              </Pressable>
            ) : null}
            {w.scenario === 'NEW_INVESTOR' ? (
              <Pressable onPress={() => setPersonSheet(true)} style={styles.optCard} accessibilityRole="button">
                <AppIcon name="investor" size={20} color="primary" />
                <AppText size="md" weight="semibold" style={styles.flex} color={w.newInvestor ? 'textPrimary' : 'textSecondary'}>
                  {w.newInvestor?.name ?? t('addInvestor')}
                </AppText>
                <AppIcon name={w.newInvestor ? 'checkCircle' : 'add'} size={18} color={w.newInvestor ? 'accent' : 'textSecondary'} />
              </Pressable>
            ) : null}
            {w.scenario === 'PARTIAL' ? (
              <>
                <AppText size="sm" color="textSecondary">
                  {t('paidInCapital')}: {formatRupees(w.leaverShare?.capital ?? 0)}
                </AppText>
                <AmountInput
                  label={t('portionAmount')}
                  value={w.portion}
                  onChange={w.setPortion}
                  autoFocus
                  error={w.portion > 0 && w.portion > (w.leaverShare?.capital ?? 0) ? t('exceedsRemaining') : null}
                />
              </>
            ) : null}
            {w.scenario === 'OWNER_BUY' || w.scenario === 'COMMITTED_UNPAID' ? (
              <AppCard>
                <AppText size="sm" color="textSecondary">
                  {w.scenario === 'OWNER_BUY' ? t('scOwnerBuy') : t('scCommitted')}
                </AppText>
              </AppCard>
            ) : null}
          </>
        ) : null}

        {/* Step 5 — review */}
        {w.step === 4 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('beforeLabel')} → {t('afterLabel')}
            </AppText>
            <AppCard compact>
              <View style={styles.tblHead}>
                <AppText size="xs" weight="bold" color="textSecondary" style={styles.flex}>
                  {t('investors')}
                </AppText>
                <AppText size="xs" weight="bold" color="textSecondary" style={styles.tblCol}>
                  {t('beforeLabel')}
                </AppText>
                <AppText size="xs" weight="bold" color="textSecondary" style={styles.tblCol}>
                  {t('afterLabel')}
                </AppText>
              </View>
              {w.after.map((a, i) => {
                const b = i < w.before.length ? w.before[i] : undefined;
                return (
                  <View key={a.name + i} style={styles.tblRow}>
                    <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex}>
                      {a.name}
                    </AppText>
                    <AppText size="sm" color="textSecondary" tabular style={styles.tblCol}>
                      {(b?.ownership ?? 0).toFixed(1)}%
                    </AppText>
                    <AppText size="sm" weight="bold" color="gold" tabular style={styles.tblCol}>
                      {a.ownership.toFixed(1)}%
                    </AppText>
                  </View>
                );
              })}
            </AppCard>
            <View style={styles.noteBox}>
              <AppText size="sm" color="textSecondary">
                {t('exitValue')}: {formatRupees(w.valuation)}
              </AppText>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.flex}>
          <AppButton label={t('back')} icon="back" variant="secondary" onPress={goBack} />
        </View>
        <View style={styles.flex2}>
          {w.step < 4 ? (
            <AppButton label={t('next')} icon="forward" onPress={w.goNext} disabled={!w.canNext} />
          ) : (
            <AppButton label={t('confirm')} icon="check" onPress={() => w.confirm(() => navigation.goBack())} loading={w.saving} />
          )}
        </View>
      </View>

      <SelectSheet visible={buyerSheet} onClose={() => setBuyerSheet(false)} options={w.partnerOptions} selectedId={w.buyerPiId ?? undefined} title={t('buyer')} onSelect={(o) => w.setBuyerPiId(o.id)} />

      {/* NEW_INVESTOR buyer — created through the ONE shared person sheet. */}
      <InvestorPersonSheet
        visible={personSheet}
        onClose={() => setPersonSheet(false)}
        onSaved={(inv) => {
          w.setNewInvestor(inv);
          setPersonSheet(false);
        }}
      />
    </View>
  );
}
