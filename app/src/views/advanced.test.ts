// The global "Full data" setting (U8): default summary, kept in localStorage, summary when storage fails.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function fakeWindow(storage: Partial<Storage> | 'throws') {
  const store = new Map<string, string>()
  const ls =
    storage === 'throws'
      ? {
          getItem: () => {
            throw new Error('SecurityError')
          },
          setItem: () => {
            throw new Error('QuotaExceededError')
          },
        }
      : { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), ...storage }
  vi.stubGlobal('window', { localStorage: ls, addEventListener() {}, removeEventListener() {} })
  return store
}

describe('advanced.ts (Full data setting)', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to summary and keeps the choice in localStorage', async () => {
    const store = fakeWindow({})
    const m = await import('./advanced')
    expect(m.getFullData()).toBe(false)
    m.setFullData(true)
    expect(store.get(m.FULL_DATA_KEY)).toBe('1')
    expect(m.getFullData()).toBe(true)
    // A reload: a fresh module reads the stored value.
    vi.resetModules()
    const again = await import('./advanced')
    expect(again.getFullData()).toBe(true)
    again.setFullData(false)
    expect(store.get(m.FULL_DATA_KEY)).toBe('0')
    expect(again.getFullData()).toBe(false)
  })

  it('anything unexpected in storage means summary', async () => {
    const store = fakeWindow({})
    store.set('llsn.fullData', 'yes please')
    const m = await import('./advanced')
    expect(m.getFullData()).toBe(false)
  })

  it('storage that throws: summary by default, the switch still works for this page', async () => {
    fakeWindow('throws')
    const m = await import('./advanced')
    expect(m.getFullData()).toBe(false)
    expect(() => m.setFullData(true)).not.toThrow()
    expect(m.getFullData()).toBe(true)
  })
})
