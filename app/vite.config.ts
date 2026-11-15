import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { searchForWorkspaceRoot } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// In an agent worktree app/node_modules is a link to the main checkout's folder, which lies outside this root:
// the dev server would refuse the font files under it (the page then renders with fallback fonts). Allow the
// link's real target too. Dev server only; the build is unchanged.
const nodeModules = fs.existsSync('node_modules') ? fs.realpathSync('node_modules') : null
// The /docs page (D1) imports the repository's docs/*.md with `?raw` (src/docs/pages.ts); the folder lies outside
// app/, so the dev server must be allowed to read it. The build reads it without this.
const repoDocs = fileURLToPath(new URL('../docs', import.meta.url))

export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...(nodeModules ? [nodeModules] : []), repoDocs] } },
  // Unit tests only; Playwright specs in e2e/ run with `npx playwright test`.
  test: { include: ['src/**/*.test.ts'] },
})
