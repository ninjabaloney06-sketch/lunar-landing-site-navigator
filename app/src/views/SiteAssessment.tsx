// Site assessment section of the Details drawer (add-on Task 1): slope, roughness, nearest permanent shadow and
// Diviner temperature of the selected site, as public/data/assessments.json has them (scripts/assessments.py).
// Collapsed at first; the file is fetched the first time the section is opened (data/assessments.loadAssessments),
// never when the drawer opens. A custom site (site=cap:…) has no record: every block says "Not computed for this
// place", and nothing is fetched. Strings come from views/assessmentView.ts.
import { useEffect, useRef, useState } from 'react'
import { loadAssessments } from '../data/assessments'
import { MissingDataError } from '../data/load'
import type { Site } from '../data/types'
import { useFullData } from './advanced'
import { FullDataSwitch } from './FullDataSwitch'
import { NO_DATA, linkParts, mapAssessment, notComputedView } from './assessmentView'
import type { AssessmentView, Block, Note } from './assessmentView'
import '../styles/assessment.css'

type Load = { status: 'idle' | 'loading' } | { status: 'ready'; file: unknown } | { status: 'error'; missing: boolean }

function Linked({ text }: { text: string }) {
  return (
    <>
      {linkParts(text).map((p, i) =>
        'href' in p ? (
          <a key={i} href={p.href} target="_blank" rel="noreferrer">
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

function NoteLine({ n }: { n: Note }) {
  return (
    <li>
      {n.text}
      {n.links.map((u, i) => (
        <span key={u}>
          {' '}
          <a href={u} target="_blank" rel="noreferrer">
            Source{n.links.length > 1 ? ` ${i + 1}` : ''}
          </a>
        </span>
      ))}
    </li>
  )
}

function BlockView({ b, full }: { b: Block; full: boolean }) {
  const rows = b.rows.filter((r) => full || !r.full)
  const notes = b.notes.filter((n) => full || !n.full)
  const described = b.source || b.method || b.limitations.length > 0 || b.extra.length > 0
  return (
    <div className="assess-block" data-testid={`assess-${b.id}`}>
      <h4>{b.title}</h4>
      {b.message !== null && (
        <p className="assess-msg" data-testid="assess-message">
          {b.message}
        </p>
      )}
      {rows.length > 0 && (
        <table className="tbl assess-tbl">
          {b.columns && (
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Value</span>
                </th>
                {b.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {b.columns && r.values.length === 1 ? (
                  <td colSpan={b.columns.length}>{r.values[0]}</td>
                ) : (
                  r.values.map((v, i) => (
                    <td key={i} className={b.columns ? 'mono' : undefined}>
                      {v}
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {b.verdict && (
        <p className="assess-verdict" data-testid="assess-verdict">
          Landing rule:{' '}
          <strong className={b.verdict.tone ? `is-${b.verdict.tone}` : undefined} data-tone={b.verdict.tone ?? 'unknown'}>
            {b.verdict.label}
          </strong>
          . <span className="quiet">Rule: {b.verdict.rule}.</span>
        </p>
      )}
      {notes.length > 0 && (
        <ul className="plain assess-notes">
          {notes.map((n, i) => (
            <NoteLine key={i} n={n} />
          ))}
        </ul>
      )}
      {described && (
        <details className="assess-src">
          <summary>Source, method and limitations</summary>
          {b.source && (
            <p>
              Source: <Linked text={b.source} />
            </p>
          )}
          {b.method && <p>Method: {b.method}</p>}
          {b.limitations.length > 0 && (
            <ul>
              {b.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
          {b.extra.map((x, i) => (
            <p key={i}>
              <Linked text={x} />
            </p>
          ))}
        </details>
      )}
    </div>
  )
}

export function SiteAssessment({ site }: { site: Site }) {
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<Load>({ status: 'idle' })
  const [full] = useFullData()
  const custom = site.group === 'custom'
  const now = useRef(load)
  now.current = load
  useEffect(() => {
    if (!open || custom || now.current.status === 'ready' || now.current.status === 'loading') return
    let alive = true
    setLoad({ status: 'loading' })
    loadAssessments().then(
      (file) => alive && setLoad({ status: 'ready', file }),
      (e: unknown) => alive && setLoad({ status: 'error', missing: e instanceof MissingDataError }),
    )
    return () => {
      alive = false
      // an answer that arrives after unmount or a re-run is dropped; let the next opening start again
      if (now.current.status === 'loading') now.current = { status: 'idle' }
    }
  }, [open, custom])

  let view: AssessmentView | null = null
  if (custom) view = notComputedView()
  else if (load.status === 'ready') view = mapAssessment(load.file, site.id)
  else if (load.status === 'error') view = { state: 'no-data', message: NO_DATA }

  return (
    <section className="drawer-sec assess" aria-labelledby="sec-assess" data-testid="site-assessment">
      <details open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="assess-summary">
          <h3 id="sec-assess">Site assessment</h3>
        </summary>
        {open && (
          <div className="assess-body" data-state={view ? view.state : 'loading'}>
            <div className="assess-tools">
              <FullDataSwitch />
            </div>
            {!view && (
              <p className="quiet" role="status">
                Loading the site assessment…
              </p>
            )}
            {view?.state === 'no-data' && (
              <p className="quiet" role="status" data-testid="assess-no-data">
                {view.message}
              </p>
            )}
            {view?.state === 'ready' && (
              <>
                <p className="assess-status" data-testid="assess-status">
                  {view.status}.
                </p>
                {view.thresholds && (
                  <p className="quiet" data-testid="assess-thresholds">
                    {view.thresholds}
                  </p>
                )}
              </>
            )}
            {view && view.state !== 'no-data' && view.blocks.map((b) => <BlockView key={b.id} b={b} full={full} />)}
          </div>
        )}
      </details>
    </section>
  )
}
