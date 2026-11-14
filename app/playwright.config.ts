import { defineConfig, devices } from '@playwright/test'

// One dev server per agent: orchestrator 5180, C1 5181, C2 5182 (PW_PORT).
// reuseExistingServer stays false so a test never hits another track's server.
const PORT = Number(process.env.PW_PORT ?? 5180)

export default defineConfig({
  testDir: 'e2e',
  // Playwright wipes outputDir on every run; screenshots go to test-results/*.png beside it.
  outputDir: 'test-results/pw',
  timeout: 90_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
