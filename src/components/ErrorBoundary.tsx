import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { reportError } from '@/utils/log';

interface FallbackProps {
  onRetry: () => void;
}

/** The recovery screen shown in place of a crashed subtree (also used for boot failures). */
export function ErrorFallback({ onRetry }: FallbackProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <AppIcon name="close" size={40} color="danger" />
      <AppText size="lg" weight="bold" center>
        {t('errorTitle')}
      </AppText>
      <AppText size="sm" color="textSecondary" center>
        {t('errorBody')}
      </AppText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}
      >
        <AppText size="sm" weight="bold" color="onPrimary">
          {t('retry')}
        </AppText>
      </Pressable>
    </View>
  );
}

interface BoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time throws anywhere below it and shows a recovery screen
 * instead of crashing the whole app. "Try again" re-mounts the subtree.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    reportError('ErrorBoundary', error);
    reportError('ErrorBoundary:componentStack', info.componentStack);
  }

  private retry = () => this.setState({ hasError: false });

  render(): React.ReactNode {
    if (this.state.hasError) return <ErrorFallback onRetry={this.retry} />;
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  button: {
    paddingHorizontal: 28,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
});
