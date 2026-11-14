import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Offline fonts (Brief C2 tokens): Newsreader for the site name and the answer, IBM Plex Sans for UI,
// IBM Plex Mono for numbers. Latin subset only.
import '@fontsource/newsreader/latin-400.css'
import '@fontsource/newsreader/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import './styles/tokens.css'
import './index.css'
import './styles/panels.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
