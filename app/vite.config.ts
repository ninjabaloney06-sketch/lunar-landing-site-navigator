import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Unit tests only; Playwright specs in e2e/ run with `npx playwright test`.
  test: { include: ['src/**/*.test.ts'] },
})
