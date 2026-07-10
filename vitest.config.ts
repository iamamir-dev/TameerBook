import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Unit tests for PURE modules only (src/utils, exit-preview math). Anything
 * importing react-native stays covered by the in-app DB suite (Dev Tools →
 * Run DB tests), which exercises the repositories against real SQLite.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
