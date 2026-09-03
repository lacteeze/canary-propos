import { defineConfig } from 'vitest/config'
import path from 'path'
import {
  hasSupabaseTestEnv,
  SUPABASE_TEST_SKIP_REASON,
} from './tests/helpers/supabase-env'

if (!hasSupabaseTestEnv()) {
  console.warn(`\n${SUPABASE_TEST_SKIP_REASON}\n`)
}

export default defineConfig({
  test: {
    env: {
      TZ: 'UTC',
    },
    environment: 'node',
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
