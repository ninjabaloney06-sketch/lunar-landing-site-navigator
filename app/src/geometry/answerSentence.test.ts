import { describe, expect, it } from 'vitest'
import { answerSentence, type AnswerState } from './answerSentence'

const base: AnswerState = {
  sunLit: true,
  sunHoursToChange: 60,
  sunChangeInPeriod: true,
  comms: 'covered',
  commsHoursToChange: 96,
  commsChangeInPeriod: true,
  anyCoverageInPeriod: true,
  earthEverRises: true,
}

const with_ = (p: Partial<AnswerState>) => answerSentence({ ...base, ...p })

describe('answerSentence: sunlight rules', () => {
  it('lit, 48 h or more: whole days, rounded down', () => {
    expect(with_({ sunLit: true, sunHoursToChange: 60 }).sun).toBe('Sunlight for 2 more days.')
    expect(with_({ sunLit: true, sunHoursToChange: 48 }).sun).toBe('Sunlight for 2 more days.')
  })

  it('lit, under 48 h: whole hours, rounded down, never minutes', () => {
    expect(with_({ sunLit: true, sunHoursToChange: 47.9 }).sun).toBe('Sunlight for 47 more hours.')
  })

  it('dark, 48 h or more: whole days', () => {
    // waiting time is rounded up: 50 h of darkness left reads 3 days, never fewer than remain
    expect(with_({ sunLit: false, sunHoursToChange: 50 }).sun).toBe('Dark for 3 more days.')
    expect(with_({ sunLit: false, sunHoursToChange: 48 }).sun).toBe('Dark for 2 more days.')
  })

  it('dark, under 48 h: whole hours', () => {
    expect(with_({ sunLit: false, sunHoursToChange: 30.5 }).sun).toBe('Dark for 31 more hours.')
    expect(with_({ sunLit: false, sunHoursToChange: 30 }).sun).toBe('Dark for 30 more hours.')
  })

  it('singular for one day and one hour', () => {
    expect(with_({ sunLit: true, sunHoursToChange: 24 }).sun).toBe('Sunlight for 24 more hours.')
    expect(with_({ sunLit: true, sunHoursToChange: 1.5 }).sun).toBe('Sunlight for 1 more hour.')
    expect(with_({ sunLit: true, sunHoursToChange: 71.9 }).sun).toBe('Sunlight for 2 more days.')
    expect(with_({ sunLit: false, sunHoursToChange: 1 }).sun).toBe('Dark for 1 more hour.')
    expect(with_({ sunLit: false, sunHoursToChange: 1.2 }).sun).toBe('Dark for 2 more hours.')
  })
})

describe('answerSentence: station contact rules', () => {
  it('covered, 48 h or more: whole days', () => {
    expect(with_({ comms: 'covered', commsHoursToChange: 96 }).comms).toBe('Station contact for 4 more days.')
  })

  it('covered, under 48 h: whole hours', () => {
    expect(with_({ comms: 'covered', commsHoursToChange: 5.2 }).comms).toBe('Station contact for 5 more hours.')
  })

  it('not covered: next contact in hours or days', () => {
    expect(with_({ comms: 'none', commsHoursToChange: 30 }).comms).toBe('Next station contact in 30 hours.')
    expect(with_({ comms: 'none', commsHoursToChange: 72 }).comms).toBe('Next station contact in 3 days.')
    // a wait is rounded up: 71.9 h is almost 3 days, not "2 days"
    expect(with_({ comms: 'none', commsHoursToChange: 71.9 }).comms).toBe('Next station contact in 3 days.')
    expect(with_({ comms: 'none', commsHoursToChange: 29.1 }).comms).toBe('Next station contact in 30 hours.')
  })

  it('no selected station reaches the site in the period', () => {
    expect(with_({ anyCoverageInPeriod: false, comms: 'none' }).comms).toBe(
      'No selected station can reach this site in this period.',
    )
  })

  it('all-unknown coverage reads as unknown, not as a definite no', () => {
    expect(with_({ anyCoverageInPeriod: false, comms: 'unknown' }).comms).toBe(
      'Station contact unknown: link inputs are missing.',
    )
  })

  it('Earth never rises at this site', () => {
    expect(with_({ earthEverRises: false }).comms).toBe('Earth never rises here.')
  })

  it('Earth-never-rises overrides the no-coverage and unknown lines', () => {
    expect(with_({ earthEverRises: false, anyCoverageInPeriod: false }).comms).toBe('Earth never rises here.')
    expect(with_({ earthEverRises: false, comms: 'unknown' }).comms).toBe('Earth never rises here.')
  })

  it('earth-never-rises does not change the sunlight line', () => {
    expect(with_({ earthEverRises: false, sunLit: true, sunHoursToChange: 60 }).sun).toBe(
      'Sunlight for 2 more days.',
    )
  })
})

describe('answerSentence: proposed case (a), no change before the period ends', () => {
  it('sun lit or dark for the whole period', () => {
    expect(with_({ sunChangeInPeriod: false, sunLit: true }).sun).toBe('Sunlight throughout this period.')
    expect(with_({ sunChangeInPeriod: false, sunLit: false }).sun).toBe('Dark throughout this period.')
  })

  it('comms covered or not covered for the whole period', () => {
    expect(with_({ commsChangeInPeriod: false, comms: 'covered' }).comms).toBe(
      'Station contact throughout this period.',
    )
    expect(with_({ commsChangeInPeriod: false, comms: 'none' }).comms).toBe(
      'No station contact throughout this period.',
    )
  })

  it('last window of a period that started in another state: "until the end", never "throughout"', () => {
    expect(with_({ sunChangeInPeriod: false, sunSinceStart: false, sunLit: false }).sun).toBe(
      'Dark until the end of this period.',
    )
    expect(with_({ sunChangeInPeriod: false, sunSinceStart: false, sunLit: true }).sun).toBe(
      'Sunlight until the end of this period.',
    )
    expect(with_({ commsChangeInPeriod: false, commsSinceStart: false, comms: 'none' }).comms).toBe(
      'No station contact until the end of this period.',
    )
    expect(with_({ commsChangeInPeriod: false, commsSinceStart: false, comms: 'covered' }).comms).toBe(
      'Station contact until the end of this period.',
    )
  })
})

describe('answerSentence: proposed case (b), station contact unknown', () => {
  it('reads as unknown, never as contact', () => {
    const line = with_({ comms: 'unknown' }).comms
    expect(line).toBe('Station contact unknown: link inputs are missing.')
    expect(line).not.toMatch(/for \d+ more/)
    expect(line).not.toMatch(/^Next station contact/)
  })
})

describe('answerSentence: proposed case (c), under 1 hour to the change', () => {
  it('sun: ends or returns in under 1 hour', () => {
    expect(with_({ sunLit: true, sunHoursToChange: 0.5 }).sun).toBe('Sunlight ends in under 1 hour.')
    expect(with_({ sunLit: false, sunHoursToChange: 0.5 }).sun).toBe('Sunlight returns in under 1 hour.')
  })

  it('comms: contact ends or next contact in under 1 hour', () => {
    expect(with_({ comms: 'covered', commsHoursToChange: 0.25 }).comms).toBe('Station contact ends in under 1 hour.')
    expect(with_({ comms: 'none', commsHoursToChange: 0.25 }).comms).toBe('Next station contact in under 1 hour.')
  })
})
