import { defineConfig, devices } from '@playwright/test'

// One dev server per agent on its own port (PW_PORT, 5180–5199; 5180 when unset).
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
    // The "How to use" card (App.tsx) shows on a first visit until "Got it"; every test starts with it closed, as for a
    // returning user, so it never covers a point a test clicks. help.spec.ts clears this to test the card itself.
    storageState: { cookies: [], origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: 'lls-help-dismissed', value: '1' }] }] },
    // Default: SwiftShader (software WebGL), the same picture on every machine. PW_GPU=1 renders on the machine's
    // own GPU instead (Direct3D 11 on Windows), for laptops where software WebGL is too slow for the 3D tests
    // (S3 fly picture: about 45 s on a Radeon 860M against a 400 s timeout with SwiftShader).
    launchOptions: {
      args: process.env.PW_GPU
        ? ['--use-angle=' + (process.platform === 'win32' ? 'd3d11' : 'default'), '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization']
        : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
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
