// A folded section of a panel (science lead, 15 Nov: "easy, readable, intuitive and cleaner"): the heading and a
// one-line summary stay in view; the content opens on a press. Full data opens every fold, as it shows every value.
// `hint` says in plain words what the section is for (ninja, 15 Nov: "all functions should explain themselves").
import type { ReactNode } from 'react'
import { useFullData } from './advanced'

interface Props {
  id: string // the heading's id (aria-labelledby of the section)
  title: string
  hint?: string // what this section is for, in plain words; always in view under the heading
  summary?: ReactNode // the section's current value, one short line
  testId?: string
  className?: string
  onToggle?(open: boolean): void // a section that computes only once it is opened
  children: ReactNode
}

export function Fold({ id, title, hint, summary, testId, className, onToggle, children }: Props) {
  const [full] = useFullData()
  return (
    <details
      className={`drawer-sec drawer-fold${className ? ` ${className}` : ''}`}
      open={full || undefined}
      data-testid={testId}
      aria-labelledby={id}
      onToggle={onToggle && ((e) => onToggle(e.currentTarget.open))}
    >
      <summary className="assess-summary drawer-fold-sum">
        <h3 id={id}>{title}</h3>
        {hint && <span className="drawer-fold-hint">{hint}</span>}
        {summary && <span className="drawer-fold-val">{summary}</span>}
      </summary>
      <div className="drawer-fold-body">{children}</div>
    </details>
  )
}
