import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
// Offline fonts (Brief C2 tokens): Newsreader for the site name and the answer, IBM Plex Sans for UI,
// IBM Plex Mono for numbers, Michroma for the mission's name. Latin subset only.
import '@fontsource/newsreader/latin-400.css'
import '@fontsource/newsreader/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/michroma/latin-400.css'
import './styles/tokens.css'
import './index.css'
import './styles/panels.css'

// /docs is the documentation page (D1), a separate chunk; every other path is the app. The Worker serves index.html
// for any path (SPA fallback in wrangler.jsonc), so a direct load of /docs arrives here.
const isDocs = /^\/docs\/?$/.test(location.pathname)

const render = (node: ReactNode) => createRoot(document.getElementById('root')!).render(<StrictMode>{node}</StrictMode>)

if (isDocs) void import('./docs/DocsPage').then(({ DocsPage }) => render(<DocsPage />))
else void import('./App').then(({ default: App }) => render(<App />))
