// Date control: the named periods from periods.json plus a custom UTC date and time. A time inside the
// current period moves the cursor; any other time opens a 14-day period starting that day.
import { useEffect, useRef, useState } from 'react'
import type { Period } from '../data/types'
import { COVERAGE_END_MS, COVERAGE_START_MS, isoMinute } from '../state'

interface Props {
  periods: Period[]
  currentPeriodId: string
  cursorMs: number
  onPeriod(id: string): void
  onCustom(ms: number): void
  onClose(): void
}

export function DateMenu({ periods, currentPeriodId, cursorMs, onPeriod, onCustom, onClose }: Props) {
  const iso = isoMinute(cursorMs)
  const [date, setDate] = useState(iso.slice(0, 10))
  const [time, setTime] = useState(iso.slice(11, 16))
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const first = useRef<HTMLButtonElement>(null)

  useEffect(() => first.current?.focus(), [])
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (root.current && !root.current.contains(t) && !t.closest?.('[data-menu-trigger]')) onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose])

  const apply = (e: React.FormEvent) => {
    e.preventDefault()
    const ms = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? Date.parse(`${date}T${time}:00Z`) : NaN
    if (!Number.isFinite(ms)) {
      setError('Enter a date and a time, for example 2027-08-16 and 12:00.')
      return
    }
    if (ms < COVERAGE_START_MS || ms >= COVERAGE_END_MS) {
      setError('Dates from 1 November 2026 to 31 December 2030 (UTC) are supported.')
      return
    }
    setError(null)
    onCustom(ms)
  }

  return (
    <div
      ref={root}
      className="popover menu date-menu"
      role="dialog"
      aria-label="Choose a period or a date"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="menu-group">Periods</div>
      <ul className="plain">
        {periods.map((p, i) => (
          <li key={p.id}>
            <button
              ref={i === 0 ? first : undefined}
              type="button"
              aria-current={p.id === currentPeriodId ? 'true' : undefined}
              className={`opt${p.id === currentPeriodId ? ' is-selected' : ''}`}
              onClick={() => onPeriod(p.id)}
            >
              <span className="opt-name">{p.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <form className="date-form" onSubmit={apply} noValidate>
        <div className="menu-group">Date and time, UTC</div>
        <div className="date-row">
          <input className="field mono" type="date" aria-label="Date (UTC)" value={date} min="2026-11-01" max="2030-12-31" onChange={(e) => setDate(e.target.value)} />
          <input className="field mono" type="time" aria-label="Time (UTC)" value={time} step={1800} onChange={(e) => setTime(e.target.value)} />
          <button className="btn" type="submit">
            Show
          </button>
        </div>
        {error && (
          <p className="menu-msg is-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
