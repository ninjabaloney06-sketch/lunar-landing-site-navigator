// The /docs page (D1): a full reading page on a light surface, one column with a table of contents beside it on
// wide screens and a collapsible list on phones. Content comes from docs/*.md at build time (./pages.ts); the HTML
// is produced by ./markdown.ts, which escapes every character of the source, so it is set as inner HTML here.
// main.tsx renders this instead of the app when location.pathname is /docs.
import { useEffect, useState } from 'react'
import '../styles/docs.css'
import { buildDocsPage, DOCS_FILES } from './pages'

const page = buildDocsPage(DOCS_FILES)

export function DocsPage() {
  const [tocOpen, setTocOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('docpage-root')
    document.title = `Documentation — Lunar Landing Site Navigator`
    // A direct load of /docs#some-heading: the text exists only after the first render, so scroll here.
    const id = decodeURIComponent(location.hash.slice(1))
    if (id) document.getElementById(id)?.scrollIntoView()
    return () => document.documentElement.classList.remove('docpage-root')
  }, [])

  return (
    <div className="docpage" data-testid="docpage">
      <header className="docpage-top">
        <a className="docpage-home" href="/">
          Lunar Landing Site Navigator
        </a>
        <button
          type="button"
          className="docpage-toc-toggle"
          aria-expanded={tocOpen}
          aria-controls="docpage-toc"
          onClick={() => setTocOpen((o) => !o)}
        >
          Contents
        </button>
      </header>
      <div className="docpage-layout">
        <nav
          id="docpage-toc"
          className="docpage-toc"
          data-open={tocOpen}
          aria-label="Contents"
          data-testid="docpage-toc"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) setTocOpen(false)
          }}
        >
          <p className="docpage-toc-label">Contents</p>
          <ol>
            {page.toc.map((g) => (
              <li key={g.id}>
                <a href={`#${g.id}`}>{g.text}</a>
                {g.children.length > 0 && (
                  <ol>
                    {g.children.map((c) => (
                      <li key={c.id}>
                        <a href={`#${c.id}`}>{c.text}</a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <main className="docpage-main">
          {page.sections.map((s) => (
            <section key={s.id} id={s.id} className="docpage-section md" data-path={s.path} dangerouslySetInnerHTML={{ __html: s.html }} />
          ))}
        </main>
      </div>
    </div>
  )
}
