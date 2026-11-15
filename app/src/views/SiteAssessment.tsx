// Site assessment section of the Details drawer (add-on Task 1): slope, roughness, nearest permanent shadow and
// Diviner temperature of the selected site, as public/data/assessments.json has them (scripts/assessments.py).
// Collapsed at first; the file is fetched the first time the section is opened (data/assessments.loadAssessments),
// never when the drawer opens. A custom site (site=cap:…) has no record: every block says "Not computed for this
// place", and nothing is fetched. Strings come from views/assessmentView.ts. The drawer's one "Full data" switch
// (top right of the drawer) adds file names, pixel counts, status strings and the file's full texts.
import { useEffect, useRef, useState } from 'react'
import { loadAssessments } from '../data/assessments'
import { MissingDataError } from '../data/load'
import type { Site } from '../data/types'
import { useFullData } from './advanced'
import { NO_DATA, linkParts, mapAssessment, notComputedView, termParts } from './assessmentView'
import type { AssessmentView, Block, Headline, Note } from './assessmentView'
import '../styles/assessment.css'

type Load = { status: 'idle' | 'loading' } | { status: 'ready'; file: unknown } | { status: 'error'; missing: boolean }

/** Text with every abbreviation of assessmentView.TERMS marked <abbr title="long form">. Used by all three sections. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {termParts(text).map((p, i) =>
        'title' in p ? (
          <abbr key={i} title={p.title}>
            {p.text}
          </abbr>
        ) : (
          p.text
        ),
      )}
    </>
  )
}

function Linked({ text }: { text: string }) {
  return (
    <>
      {linkParts(text).map((p, i) =>
        'href' in p ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">
            {p.text}
          </a>
        ) : (
          <Marked key={i} text={p.text} />
        ),
      )}
    </>
  )
}

function NoteLine({ n, full }: { n: Note; full: boolean }) {
  return (
    <li>
      <Marked text={full && n.fullText ? n.fullText : n.text} />
      {n.links.map((u, i) => (
        <span key={u}>
          {' '}
          <a href={u} target="_blank" rel="noopener noreferrer">
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
      <h4>
        <Marked text={b.title} />
      </h4>
      {b.message !== null && (
        <p className="assess-msg" data-testid="assess-message">
          {b.message}
        </p>
      )}
      {rows.length > 0 && (
        <div className="assess-scroll">
          <table className="tbl assess-tbl">
            {b.columns && (
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Value</span>
                  </th>
                  {b.columns.map((c) => {
                    // "Landing disk, 100 m radius": the radius on its own line, never split inside "2 km"
                    const [name, ...rest] = c.split(', ')
                    return (
                      <th key={c} scope="col">
                        {name}
                        {rest.length > 0 && <span className="th-sub">{rest.join(', ')}</span>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((r) => {
                const values = full && r.fullValues ? r.fullValues : r.values
                return (
                  <tr key={r.label}>
                    <th scope="row">
                      <Marked text={r.label} />
                    </th>
                    {b.columns && values.length === 1 ? (
                      <td colSpan={b.columns.length}>
                        <Marked text={values[0]} />
                      </td>
                    ) : (
                      values.map((v, i) => (
                        <td key={i} className={b.columns || /^[\d−-]/.test(v) ? 'mono' : undefined}>
                          <Marked text={v} />
                        </td>
                      ))
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {b.verdict && full && (
        <p className="assess-rule" data-testid="assess-rule-file">
          Landing rule as recorded: <Marked text={b.verdict.rule} />.
        </p>
      )}
      {notes.length > 0 && (
        <ul className="plain assess-notes">
          {notes.map((n, i) => (
            <NoteLine key={i} n={n} full={full} />
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
          {b.method && (
            <p>
              Method: <Marked text={b.method} />
            </p>
          )}
          {b.limitations.length > 0 && (
            <ul>
              {b.limitations.map((l, i) => (
                <li key={i}>
                  <Marked text={l} />
                </li>
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

/** Can a lander set down here: the verdict with its rule, the value that decides it, the project-criteria line. */
function HeadlineView({ h, full }: { h: Headline; full: boolean }) {
  return (
    <div className="assess-head" data-testid="assess-headline">
      <p className="assess-verdict" data-testid="assess-verdict">
        {h.tone ? (
          <>
            <strong className={`is-${h.tone}`} data-tone={h.tone}>
              {h.verdict}
            </strong>{' '}
            the landing rule: {h.rule}.
          </>
        ) : (
          <>
            Landing rule: <strong data-tone="unknown">{h.verdict}</strong>. Rule: {h.rule}.
          </>
        )}
      </p>
      {h.decider && (
        <p className="assess-decider" data-testid="assess-decider">
          {h.decider}.
        </p>
      )}
      {h.criteria && !full && (
        <p className="quiet assess-criteria" data-testid="assess-criteria">
          {h.criteria}
        </p>
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
          <h3 id="sec-assess">Landing site assessment</h3>
        </summary>
        {open && (
          <div className="assess-body" data-state={view ? view.state : 'loading'}>
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
                <HeadlineView h={view.headline} full={full && view.thresholds !== null} />
                <p className="quiet assess-status" data-testid="assess-status">
                  {view.status}.
                </p>
                {/* Full data: the file's rule line, which carries the same project-criteria words */}
                {full && view.thresholds && (
                  <p className="quiet assess-thresholds" data-testid="assess-thresholds">
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
