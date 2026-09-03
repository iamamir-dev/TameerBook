import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/ProgressBar';
import { AppButton, AppCard, AppHeader, AppIcon, AppText } from '@/components/ui';
import {
  clearAllData,
  clearPurchaseOrders,
  clearStressData,
  estimateAttendance,
  estimateTransactions,
  getTableCounts,
  loadDemoData,
  measureStorage,
  runDataAudit,
  runDbTests,
  runStressBenchmark,
  seedStressData,
  STRESS_PRESETS,
  TABLE_NAMES,
  type AuditRow,
  type BenchRow,
  type StorageReport,
  type StressPreset,
  type StressProgress,
  type StressReport,
  type TestResult,
} from '@/db';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Which long-running job holds the screen. `null` = idle. */
type Busy =
  | 'demo' | 'tests' | 'clear' | 'clearPo' | 'stress' | 'bench' | 'storage' | 'clearStress' | 'audit';

type SectionKey = 'tables' | 'stress' | 'audit' | 'perf' | 'storage' | 'tests' | 'danger';

const mb = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

const secs = (ms: number): string => (ms >= 60_000 ? `${(ms / 60_000).toFixed(1)}m` : `${(ms / 1000).toFixed(1)}s`);

/**
 * Hidden developer tools (reached via a long-press on the Settings app
 * version). Table counts, the demo dataset, the stress-data generator, the
 * screen profiler, storage breakdown, and the DB self-tests — each in its own
 * collapsible section so the screen stays readable. Strings are intentionally
 * English/dev-only — not user-facing.
 */
export function DevToolsScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tests, setTests] = useState<TestResult[]>([]);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [progress, setProgress] = useState<StressProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [bench, setBench] = useState<BenchRow[]>([]);
  const [storage, setStorage] = useState<StorageReport | null>(null);
  const [report, setReport] = useState<StressReport | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [showEmptyTables, setShowEmptyTables] = useState(false);
  // Only one section open at a time — the screen has a lot on it.
  const [open, setOpen] = useState<SectionKey | null>('stress');

  const refreshProjects = useProjectsStore((s) => s.refresh);
  const activeCompany = useCompanyStore(
    (s) => s.companies.find((c) => c.id === s.activeCompanyId)?.name
  );

  const refreshCounts = useCallback(async () => {
    setCounts(await getTableCounts());
  }, []);

  useEffect(() => {
    refreshCounts().catch(swallow('devtools:load'));
  }, [refreshCounts]);

  // Live elapsed timer while a long job runs — a seed can take many minutes and
  // a spinner alone gives no sense of whether it's still moving.
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, [busy]);

  /** Wrap a job with the busy flag so every button disables together. */
  const run = useCallback(
    (kind: Busy, fn: () => Promise<void>) => async () => {
      setBusy(kind);
      setElapsed(0);
      try {
        await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // A failed seed leaves a half-built company behind and the app switched
        // to it — say so, rather than leaving the user to work it out.
        Alert.alert(
          'Failed',
          kind === 'stress'
            ? `${msg}\n\nA partly-built stress company was left behind. Use "Clear stress companies" before retrying.`
            : msg
        );
      } finally {
        setProgress(null);
        setBusy(null);
      }
    },
    []
  );

  const onLoadDemo = run('demo', async () => {
    await loadDemoData();
    await refreshCounts();
    await refreshProjects();
  });

  const onRunTests = run('tests', async () => {
    setTests(await runDbTests());
    await refreshCounts();
  });

  const onAudit = run('audit', async () => {
    setAudit(await runDataAudit());
  });

  const onBenchmark = run('bench', async () => {
    setBench(await runStressBenchmark());
  });

  const onMeasureStorage = run('storage', async () => {
    setStorage(await measureStorage());
  });

  const confirm = useCallback(
    (title: string, message: string, action: string, destructive: boolean, onGo: () => void) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: action, style: destructive ? 'destructive' : 'default', onPress: onGo },
      ]);
    },
    []
  );

  const onClearData = useCallback(() => {
    confirm(
      'Clear all data?',
      'This permanently deletes every project, transaction, investor, document and payment. This cannot be undone.',
      'Clear everything',
      true,
      run('clear', async () => {
        await clearAllData();
        setTests([]);
        setReport(null);
        setBench([]);
        setAudit([]);
        await refreshCounts();
        await refreshProjects();
        // No companies remain → the app gate drops back to onboarding.
        await useCompanyStore.getState().hydrate();
      })
    );
  }, [confirm, run, refreshCounts, refreshProjects]);

  const onClearPo = useCallback(() => {
    confirm(
      'Clear purchase orders?',
      'Deletes every purchase order, its deliveries and supplier payments. The rest of the data stays.',
      'Clear POs',
      true,
      run('clearPo', async () => {
        await clearPurchaseOrders();
        await refreshCounts();
        await refreshProjects();
      })
    );
  }, [confirm, run, refreshCounts, refreshProjects]);

  /**
   * Seed a stress preset. Every row goes through the real repositories, so this
   * is slow by design — the dialog spells out what it will produce.
   */
  const onSeedStress = useCallback(
    (preset: StressPreset) => {
      confirm(
        preset.label,
        `${preset.note}\n\n` +
          `≈${estimateTransactions(preset).toLocaleString()} transactions\n` +
          `≈${estimateAttendance(preset).toLocaleString()} attendance rows\n` +
          `${preset.projects} projects · ${preset.standalonePlots + preset.projects} plots · ` +
          `${preset.investors} investors · ${preset.laborers} workers · ${preset.photos} photos\n\n` +
          'Creates a separate "Stress Test" company and switches to it. Your real books stay untouched.',
        'Seed',
        false,
        run('stress', async () => {
          setProgress({ step: 'Starting', done: 0, total: 1 });
          setReport(await seedStressData(preset, setProgress));
          await refreshCounts();
          await refreshProjects();
          // The generator created + activated a new company.
          await useCompanyStore.getState().hydrate();
          // Verify immediately — the point of seeding is data the screens can
          // actually read, so show that verdict without a second tap.
          setProgress({ step: 'Auditing the result', done: 0, total: 1 });
          setAudit(await runDataAudit());
          setOpen('audit');
        })
      );
    },
    [confirm, run, refreshCounts, refreshProjects]
  );

  const onClearStress = useCallback(() => {
    confirm(
      'Clear stress data?',
      'Deletes every "Stress Test" company with its whole object graph and photos, then VACUUMs the file. Real books are untouched.',
      'Clear',
      true,
      run('clearStress', async () => {
        await clearStressData();
        setBench([]);
        setReport(null);
        setStorage(null);
        setAudit([]);
        await refreshCounts();
        await refreshProjects();
        await useCompanyStore.getState().hydrate();
      })
    );
  }, [confirm, run, refreshCounts, refreshProjects]);

  const totalRows = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);
  const visibleTables = useMemo(
    () => TABLE_NAMES.filter((n) => showEmptyTables || (counts[n] ?? 0) > 0),
    [counts, showEmptyTables]
  );
  const allPassed = tests.length > 0 && tests.every((t) => t.passed);
  const disabled = busy !== null;

  /** Collapsible section header with a right-aligned status hint. */
  const Section = ({ id, title, hint }: { id: SectionKey; title: string; hint?: string }) => (
    <Pressable
      onPress={() => setOpen((cur) => (cur === id ? null : id))}
      accessibilityRole="button"
      accessibilityState={{ expanded: open === id }}
      style={styles.sectionHeader}
    >
      <AppIcon name={open === id ? 'chevronDown' : 'forward'} size={18} color="textSecondary" />
      <AppText size="md" weight="bold" style={styles.flex}>
        {title}
      </AppText>
      {hint ? (
        <AppText size="xs" color="textSecondary" tabular>
          {hint}
        </AppText>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Dev Tools"
        subtitle={activeCompany ? `${activeCompany} · ${totalRows.toLocaleString()} rows` : 'No company'}
        onBack={() => navigation.goBack()}
      />

      {/* Sticky job banner — a seed runs for minutes, so its state must be
          visible no matter where the user has scrolled to. */}
      {busy ? (
        <View style={styles.banner}>
          <View style={styles.bannerTop}>
            <AppText size="sm" weight="bold" color="onPrimary" style={styles.flex} numberOfLines={1}>
              {progress?.step ?? BUSY_LABEL[busy]}
            </AppText>
            <AppText size="xs" color="onPrimary" tabular>
              {secs(elapsed)}
            </AppText>
          </View>
          {progress ? (
            <>
              <ProgressBar percent={(progress.done / progress.total) * 100} tone="onPrimary" />
              <AppText size="xs" color="onPrimary" tabular>
                {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
              </AppText>
            </>
          ) : null}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---------------- Stress data ---------------- */}
        <Section id="stress" title="Stress data" hint={report ? `seeded in ${secs(report.ms)}` : undefined} />
        {open === 'stress' ? (
          <>
            <AppText size="xs" color="textSecondary">
              Every row is written through the same repository functions the screens use, so totals,
              statuses and links come out exactly as real entry produces them. That makes it slow —
              budget minutes, not seconds.
            </AppText>

            {STRESS_PRESETS.map((p) => (
              <AppCard key={p.key} compact onPress={disabled ? undefined : () => onSeedStress(p)}>
                <View style={styles.presetRow}>
                  <View style={styles.flex}>
                    <AppText size="sm" weight="bold">
                      {p.label}
                    </AppText>
                    <AppText size="xs" color="textSecondary">
                      {p.note}
                    </AppText>
                    <AppText size="xs" color="textSecondary" tabular>
                      ≈{estimateTransactions(p).toLocaleString()} txns · {p.projects} projects ·{' '}
                      {p.standalonePlots + p.projects} plots · {p.laborers} workers
                    </AppText>
                  </View>
                  <AppIcon name="add" size={22} color={disabled ? 'textSecondary' : 'primary'} />
                </View>
              </AppCard>
            ))}

            {report ? (
              <AppCard compact>
                <AppText size="sm" weight="bold">
                  Last seed — {secs(report.ms)}
                </AppText>
                {Object.entries(report.written)
                  .sort((a, b) => b[1] - a[1])
                  .map(([kind, n]) => (
                    <View key={kind} style={styles.countRow}>
                      <AppText size="sm" color="textSecondary">
                        {kind}
                      </AppText>
                      <AppText size="sm" weight="bold" tabular>
                        {n.toLocaleString()}
                      </AppText>
                    </View>
                  ))}
                {report.skipped > 0 ? (
                  <>
                    <View style={styles.divider} />
                    <AppText size="xs" color="textSecondary">
                      {report.skipped.toLocaleString()} writes rejected by a guard (over-cap,
                      insufficient funds, once-only milestone) — expected at the edges of a
                      generated plan.
                    </AppText>
                    {report.skipReasons.map((r) => (
                      <AppText key={r} size="xs" color="textSecondary">
                        · {r}
                      </AppText>
                    ))}
                  </>
                ) : null}
              </AppCard>
            ) : null}

            <AppButton
              label="Clear stress companies"
              icon="close"
              variant="danger"
              onPress={onClearStress}
              loading={busy === 'clearStress'}
              disabled={disabled}
            />
          </>
        ) : null}

        {/* ---------------- Data audit ---------------- */}
        <Section
          id="audit"
          title="Data audit"
          hint={audit.length ? `${audit.filter((a) => a.ok).length}/${audit.length}` : undefined}
        />
        {open === 'audit' ? (
          <>
            <AppText size="xs" color="textSecondary">
              Reads the active company the way each screen does and checks the derived numbers
              reconcile — so "nothing showing on the Transactions page" becomes a specific failing
              line instead of a hunt.
            </AppText>
            <AppButton
              label="Run data audit"
              icon="checkCircle"
              variant="secondary"
              onPress={onAudit}
              loading={busy === 'audit'}
              disabled={disabled}
            />
            {audit.length > 0 ? (
              <AppCard compact>
                {audit.map((a, i) => (
                  <View key={a.label}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.testRow}>
                      <AppIcon
                        name={a.ok ? 'checkCircle' : 'close'}
                        size={20}
                        color={a.ok ? 'success' : 'danger'}
                      />
                      <View style={styles.testText}>
                        <AppText size="sm" weight="semibold">
                          {a.label}
                        </AppText>
                        <AppText size="xs" color="textSecondary">
                          {a.detail}
                        </AppText>
                      </View>
                    </View>
                  </View>
                ))}
              </AppCard>
            ) : null}
          </>
        ) : null}

        {/* ---------------- Performance ---------------- */}
        <Section
          id="perf"
          title="Performance"
          hint={bench.length ? `${Math.max(...bench.map((b) => b.ms)).toLocaleString()}ms worst` : undefined}
        />
        {open === 'perf' ? (
          <>
            <AppText size="xs" color="textSecondary">
              Times each screen's real focus-load path against whatever is in the database right now.
            </AppText>
            <AppButton
              label="Run benchmark"
              icon="checkCircle"
              variant="secondary"
              onPress={onBenchmark}
              loading={busy === 'bench'}
              disabled={disabled}
            />
            {bench.length > 0 ? (
              <AppCard compact>
                {bench.map((b, i) => (
                  <View key={b.label}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.benchRow}>
                      <View style={styles.flex}>
                        <AppText size="sm" weight="semibold">
                          {b.label}
                        </AppText>
                        <AppText size="xs" color="textSecondary">
                          {b.rows.toLocaleString()} rows{b.note ? ` — ${b.note}` : ''}
                        </AppText>
                      </View>
                      <AppText size="sm" weight="bold" tabular color={b.ms > 500 ? 'danger' : 'success'}>
                        {b.ms.toLocaleString()}ms
                      </AppText>
                    </View>
                    {/* Bar relative to a 2s "unusable" ceiling. */}
                    <ProgressBar percent={(b.ms / 2000) * 100} tone={b.ms > 500 ? 'danger' : 'success'} />
                  </View>
                ))}
              </AppCard>
            ) : null}
          </>
        ) : null}

        {/* ---------------- Storage ---------------- */}
        <Section id="storage" title="Storage" hint={storage ? mb(storage.dbBytes) : undefined} />
        {open === 'storage' ? (
          <>
            <AppButton
              label="Measure storage"
              icon="receipt"
              variant="secondary"
              onPress={onMeasureStorage}
              loading={busy === 'storage'}
              disabled={disabled}
            />
            {storage ? (
              <AppCard compact>
                {(
                  [
                    ['SQLite database', mb(storage.dbBytes)],
                    ['↳ reclaimable (free pages)', mb(storage.freeBytes)],
                    ['WAL journal', mb(storage.walBytes)],
                    [`Photos on disk (${storage.photoCount})`, mb(storage.photoBytes)],
                    ['Documents dir (total)', mb(storage.documentsBytes)],
                    ['Cache dir (total)', mb(storage.cacheBytes)],
                  ] as const
                ).map(([label, value], i) => (
                  <View key={label}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.countRow}>
                      <AppText size="sm" color="textSecondary">
                        {label}
                      </AppText>
                      <AppText size="sm" weight="bold" tabular>
                        {value}
                      </AppText>
                    </View>
                  </View>
                ))}
                {storage.missingPhotos > 0 ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.countRow}>
                      <AppText size="sm" color="danger">
                        Missing photo files
                      </AppText>
                      <AppText size="sm" weight="bold" tabular color="danger">
                        {storage.missingPhotos}
                      </AppText>
                    </View>
                    <AppText size="xs" color="textSecondary">
                      Photos are saved to the CACHE directory, which Android reclaims under storage
                      pressure — these document rows now point at files that are gone.
                    </AppText>
                  </>
                ) : null}
                <AppText size="xs" color="textSecondary">
                  {storage.dbPath}
                </AppText>
              </AppCard>
            ) : null}
          </>
        ) : null}

        {/* ---------------- Tables ---------------- */}
        <Section id="tables" title="Tables" hint={`${totalRows.toLocaleString()} rows`} />
        {open === 'tables' ? (
          <>
            <AppCard compact>
              {visibleTables.map((name, i) => (
                <View key={name}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.countRow}>
                    <AppText size="sm" color="textSecondary">
                      {name}
                    </AppText>
                    <AppText size="sm" weight="bold" tabular>
                      {(counts[name] ?? 0).toLocaleString()}
                    </AppText>
                  </View>
                </View>
              ))}
              {visibleTables.length === 0 ? (
                <AppText size="sm" color="textSecondary" center>
                  Every table is empty.
                </AppText>
              ) : null}
            </AppCard>
            <AppButton
              label={showEmptyTables ? 'Hide empty tables' : `Show all ${TABLE_NAMES.length} tables`}
              icon="forward"
              variant="secondary"
              onPress={() => setShowEmptyTables((v) => !v)}
              disabled={disabled}
            />
            <AppButton
              label="Load demo data"
              icon="add"
              variant="secondary"
              onPress={onLoadDemo}
              loading={busy === 'demo'}
              disabled={disabled}
            />
          </>
        ) : null}

        {/* ---------------- Self-tests ---------------- */}
        <Section
          id="tests"
          title="Self-tests"
          hint={tests.length ? `${tests.filter((t) => t.passed).length}/${tests.length}` : undefined}
        />
        {open === 'tests' ? (
          <>
            <AppButton
              label="Run DB tests"
              icon="checkCircle"
              variant="secondary"
              onPress={onRunTests}
              loading={busy === 'tests'}
              disabled={disabled}
            />
            {tests.length > 0 ? (
              <AppCard compact>
                <View style={styles.countRow}>
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
          </>
        ) : null}

        {/* ---------------- Danger zone ---------------- */}
        <Section id="danger" title="Danger zone" />
        {open === 'danger' ? (
          <>
            <AppButton
              label="Clear purchase orders"
              icon="close"
              variant="secondary"
              onPress={onClearPo}
              loading={busy === 'clearPo'}
              disabled={disabled}
            />
            <AppButton
              label="Clear ALL data"
              icon="close"
              variant="danger"
              onPress={onClearData}
              loading={busy === 'clear'}
              disabled={disabled}
            />
            <AppText size="xs" color="textSecondary">
              "Clear ALL data" wipes real books too and drops the app back to onboarding.
            </AppText>
          </>
        ) : null}

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

/** Banner text for jobs that report no step-level progress. */
const BUSY_LABEL: Record<Busy, string> = {
  demo: 'Loading demo data…',
  tests: 'Running self-tests…',
  clear: 'Clearing all data…',
  clearPo: 'Clearing purchase orders…',
  stress: 'Seeding stress data…',
  audit: 'Auditing data…',
  bench: 'Benchmarking screens…',
  storage: 'Measuring storage…',
  clearStress: 'Clearing stress companies…',
};

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, paddingHorizontal: theme.spacing.page, gap: theme.spacing.md },
    banner: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    bannerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: 48,
      marginTop: theme.spacing.sm,
    },
    presetRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    benchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
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
