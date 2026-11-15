// The "Full data" switch (U8): a labelled switch for the top-right corner of every card that has a summary and a
// full data mode. The label is always shown; on/off reads from the knob's position (left = summary, right = full
// data), not from colour alone. It drives the one global setting in advanced.ts, so switching it in one card
// switches every card. Styles: .full-switch in styles/poi.css (loaded app-wide).
import { useFullData } from './advanced'

export function FullDataSwitch({ className }: { className?: string }) {
  const [full, setFull] = useFullData()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={full}
      className={`full-switch${className ? ` ${className}` : ''}`}
      data-testid="full-data-switch"
      title={full ? 'Showing every value of the record. Switch off for the summary.' : 'Show every value of the record, in every card.'}
      onClick={() => setFull(!full)}
    >
      <span className="full-switch-label">Full data</span>
      <span className="full-switch-track" aria-hidden="true">
        <span className="full-switch-knob" />
      </span>
    </button>
  )
}
