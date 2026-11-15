// Documentation view: a reading panel over the app with a contents list. Content in ./content.tsx.
// The app keeps its state in the URL hash, so the contents links scroll in place and never change location.hash.
import { useEffect, useRef } from 'react'
import type { JSX, MouseEvent } from 'react'
import { DOC_INTRO, DOC_SECTIONS } from './content'
import '../styles/docs.css'

export function DocsView({ onClose }: { onClose(): void }): JSX.Element {
  const closeBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true })
  }, [])

  const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
    // keyboard users continue reading from the section they chose
    document.getElementById(`${id}-h`)?.focus({ preventScroll: true })
  }

  return (
    <aside
      className="docs"
      role="dialog"
      aria-labelledby="docs-title"
      data-testid="docs"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <header className="docs-head">
        <h2 id="docs-title" className="docs-title">
          Documentation
        </h2>
        <a className="link" href="/docs" data-testid="docs-page-link">
          Full documentation
        </a>
        <button ref={closeBtn} className="btn" type="button" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="docs-body">
        <nav className="docs-toc" aria-label="Contents" data-testid="docs-toc">
          <p className="docs-toc-label" aria-hidden="true">
            Contents
          </p>
          <ol className="plain">
            {DOC_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} onClick={(e) => jump(e, s.id)}>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="docs-text">
          {DOC_INTRO}
          {DOC_SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="docs-sec" aria-labelledby={`${s.id}-h`}>
              <h3 id={`${s.id}-h`} tabIndex={-1}>
                {s.title}
              </h3>
              {s.body}
            </section>
          ))}
        </article>
      </div>
    </aside>
  )
}
