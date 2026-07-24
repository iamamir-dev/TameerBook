import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppHeader, AppIcon, AppText } from '@/components/ui';
import { clearAllData, clearPurchaseOrders, getTableCounts, loadDemoData, runDbTests, TABLE_NAMES, type TestResult } from '@/db';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Hidden developer tools (reached via a long-press on the Settings app
 * version). Shows table row counts, loads demo data, and runs the DB
 * self-tests. Strings are intentionally English/dev-only  not user-facing.
 */
export function DevToolsScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tests, setTests] = useState<TestResult[]>([]);
  const [busy, setBusy] = useState<null | 'demo' | 'tests' | 'clear' | 'clearPo'>(null);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const refreshCounts = useCallback(async () => {
    setCounts(await getTableCounts());
  }, []);

  useEffect(() => {
    refreshCounts().catch(swallow('devtools:load'));
  }, [refreshCounts]);

  const onLoadDemo = useCallback(async () => {
    setBusy('demo');
    try {
      await loadDemoData();
      await refreshCounts();
    } finally {
      setBusy(null);
    }
  }, [refreshCounts]);

  const onClearData = useCallback(() => {
    Alert.alert(
      'Clear all data?',
      'This permanently deletes every project, transaction, investor, document and payment. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear everything',
          style: 'destructive',
          onPress: async () => {
            setBusy('clear');
            try {
              await clearAllData();
              setTests([]);
              await refreshCounts();
              await refreshProjects();
              // No companies remain → the app gate drops back to onboarding.
              await useCompanyStore.getState().hydrate();
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }, [refreshCounts, refreshProjects]);

  const onClearPo = useCallback(() => {
    Alert.alert(
      'Clear purchase orders?',
      'Deletes every purchase order, its deliveries and supplier payments. The rest of the data stays. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear POs',
          style: 'destructive',
          onPress: async () => {
            setBusy('clearPo');
            try {
              await clearPurchaseOrders();
              await refreshCounts();
              await refreshProjects();
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }, [refreshCounts, refreshProjects]);

  const onRunTests = useCallback(async () => {
    setBusy('tests');
    try {
      const results = await runDbTests();
      setTests(results);
      await refreshCounts();
    } finally {
      setBusy(null);
    }
  }, [refreshCounts]);

  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  const allPassed = tests.length > 0 && tests.every((t) => t.passed);

  return (
    <View style={styles.screen}>
      <AppHeader title="Dev Tools" subtitle="Database" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Table counts */}
        <AppText size="lg" weight="bold">
          Tables ({totalRows} rows)
        </AppText>
        <AppCard compact>
          {TABLE_NAMES.map((name, i) => (
            <View key={name}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.countRow}>
                <AppText size="sm" color="textSecondary">
                  {name}
                </AppText>
                <AppText size="sm" weight="bold" tabular>
                  {counts[name] ?? 0}
                </AppText>
              </View>
            </View>
          ))}
        </AppCard>

        <AppButton
          label="Load demo data"
          icon="add"
          onPress={onLoadDemo}
          loading={busy === 'demo'}
          disabled={busy !== null}
        />
        <AppButton
          label="Clear purchase orders"
          icon="close"
          variant="secondary"
          onPress={onClearPo}
          loading={busy === 'clearPo'}
          disabled={busy !== null}
        />
        <AppButton
          label="Clear all data"
          icon="close"
          variant="danger"
          onPress={onClearData}
          loading={busy === 'clear'}
          disabled={busy !== null}
        />

        {/* Self-tests */}
        <AppText size="lg" weight="bold">
          Self-tests
        </AppText>
        <AppButton
          label="Run DB tests"
          icon="checkCircle"
          variant="secondary"
          onPress={onRunTests}
          loading={busy === 'tests'}
          disabled={busy !== null}
        />

        {tests.length > 0 ? (
          <AppCard compact>
            <View style={styles.summaryRow}>
              <AppText size="md" weight="bold" color={allPassed ? 'success' : 'danger'}>
                {allPassed ? 'All passed' : 'Some failed'}
              </AppText>
              <AppText size="sm" color="textSecondary" tabular>
                {tests.filter((t) => t.passed).length}/{tests.length}
              </AppText>
            </View>
            {tests.map((t, i) => (
              <View key={t.name}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.testRow}>
                  <AppIcon
                    name={t.passed ? 'checkCircle' : 'close'}
                    size={20}
                    color={t.passed ? 'success' : 'danger'}
                  />
                  <View style={styles.testText}>
                    <AppText size="sm" weight="semibold">
                      {t.name}
                    </AppText>
                    <AppText size="xs" color="textSecondary">
                      {t.detail}
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
          </AppCard>
        ) : null}

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
    },
    testRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    testText: { flex: 1, gap: 2 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
    },
    footer: { height: theme.spacing.xxxl },
  });
