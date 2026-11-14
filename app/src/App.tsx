import { useEffect, useState } from 'react'
import { loadSites } from './data/load'
import type { Site } from './data/types'

// Shell only. Track C fills scene3d/ (3D view) and views/ (overlay UI) per build-plan §5.
export default function App() {
  const [sites, setSites] = useState<Site[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSites().then(setSites, (e: Error) => setError(e.message))
  }, [])

  if (error) return <p>Could not load sites: {error}</p>
  if (!sites) return <p>Loading…</p>
  return (
    <main style={{ padding: 16 }}>
      <h1>{sites[0]?.name ?? 'No sites'}</h1>
      <p style={{ color: 'var(--muted)' }}>{sites.length} site(s) loaded.</p>
    </main>
  )
}
