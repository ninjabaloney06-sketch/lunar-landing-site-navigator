import { describe, expect, it } from 'vitest'
import { buildDocsPage, DOCS_FILES, isPagePath, linkResolver, resolveRepoPath } from './pages'

describe('docs page: which files', () => {
  it('reads docs/documentation.md into the build', () => {
    expect(Object.keys(DOCS_FILES)).toContain('docs/documentation.md')
    expect(DOCS_FILES['docs/documentation.md']).toMatch(/^# /)
  })

  it('never includes planning notes, personal data or root files', () => {
    for (const p of Object.keys(DOCS_FILES)) expect(isPagePath(p), p).toBe(true)
    for (const p of ['docs/event/validation.md', 'docs/reference/decisions.md', 'docs/archive/x.md', 'docs/POIs/a.md', 'README.md', 'docs/scientific-proof/sub/x.md', 'docs/other.md'])
      expect(isPagePath(p), p).toBe(false)
    const page = buildDocsPage({ 'docs/documentation.md': '# T', 'docs/event/plan.md': '# Secret plan' })
    expect(page.sections.map((s) => s.path)).toEqual(['docs/documentation.md'])
  })
})

describe('docs page: assembly', () => {
  const files = {
    'docs/credits.md': '# Credits\n\n## Libraries\n\nSee [the docs](documentation.md#limits).',
    'docs/documentation.md': '# Navigator — documentation\n\n## Part 1\n\n### Limits\n\nSee [validation](event/validation.md), [proof](scientific-proof/sunlight.md) and [Limits](#limits).',
    'docs/why-ours.md': '# Why ours is better\n\n## Claim 1',
    'docs/scientific-proof/sunlight.md': '# Sunlight\n\n## Equation',
    'docs/scientific-proof/10-descent.md': '# Descent',
    'docs/scientific-proof/2-ranking.md': '# Ranking',
  }
  const page = buildDocsPage(files)

  it('orders documentation, why ours, the proofs, then credits', () => {
    // Proof files in numeric-aware name order; the page adds the "Scientific proof" heading before them.
    expect(page.sections.map((s) => s.path)).toEqual([
      'docs/documentation.md',
      'docs/why-ours.md',
      'docs/scientific-proof/',
      'docs/scientific-proof/2-ranking.md',
      'docs/scientific-proof/10-descent.md',
      'docs/scientific-proof/sunlight.md',
      'docs/credits.md',
    ])
  })

  it('takes the title from documentation.md and builds a two-level table of contents', () => {
    expect(page.title).toBe('Navigator — documentation')
    expect(page.toc.map((g) => g.text)).toEqual(['Part 1', 'Why ours is better', 'Scientific proof', 'Credits'])
    expect(page.toc[0].children).toEqual([{ id: 'limits', text: 'Limits' }])
    expect(page.toc[2].children.map((c) => c.text)).toEqual(['Ranking', 'Descent', 'Sunlight'])
    expect(page.toc[3].children.map((c) => c.id)).toEqual(['credits-libraries'])
  })

  it('turns links between included files into in-page links and other repository links into text', () => {
    const doc = page.sections[0].html
    expect(doc).toContain('See validation, <a href="#doc-proof-sunlight">proof</a> and <a href="#limits">Limits</a>.')
    expect(page.sections.at(-1)!.html).toContain('<a href="#limits">the docs</a>')
  })

  it('keeps heading ids unique across files', () => {
    const ids = page.sections.flatMap((s) => s.headings.map((h) => h.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('builds without the optional files', () => {
    const p = buildDocsPage({ 'docs/documentation.md': files['docs/documentation.md'] })
    expect(p.sections).toHaveLength(1)
    expect(p.toc.map((g) => g.text)).toEqual(['Part 1'])
  })

  it('uses a scientific-proof README as the section intro', () => {
    const p = buildDocsPage({ 'docs/documentation.md': '# T', 'docs/scientific-proof/README.md': '# Scientific proof\n\nIntro.', 'docs/scientific-proof/a.md': '# A' })
    expect(p.toc.map((g) => [g.text, g.children.map((c) => c.text)])).toEqual([['Scientific proof', ['A']]])
  })
})

describe('docs page: links', () => {
  const included = new Set(['docs/documentation.md', 'docs/credits.md'])
  const r = linkResolver('docs/documentation.md', included)
  it('resolves relative paths', () => {
    expect(resolveRepoPath('docs/documentation.md', '../README.md')).toBe('README.md')
    expect(resolveRepoPath('docs/scientific-proof/a.md', '../credits.md')).toBe('docs/credits.md')
  })
  it('applies the policy', () => {
    expect(r('https://naif.jpl.nasa.gov/')).toBe('https://naif.jpl.nasa.gov/')
    expect(r('../README.md')).toBeNull()
    expect(r('reference/data-sources.md')).toBeNull()
    expect(r('credits.md')).toBe('#doc-credits')
    expect(r('credits.md#fonts')).toBe('#credits-fonts')
    expect(r('#validation-results')).toBe('#validation-results')
    expect(r('javascript:alert(1)')).toBeNull()
    expect(r('//evil.example')).toBeNull()
  })
})
