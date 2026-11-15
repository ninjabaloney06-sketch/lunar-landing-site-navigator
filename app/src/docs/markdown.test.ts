import { describe, expect, it } from 'vitest'
import { inlineText, renderMarkdown, slugify } from './markdown'

const html = (src: string, opts = {}) => renderMarkdown(src, opts).html

describe('markdown renderer: blocks', () => {
  it('renders headings with GitHub-style ids and lists them', () => {
    const r = renderMarkdown('# Title\n\n## Part 1 — technical\n\n### Frames and units')
    expect(r.html).toBe('<h1 id="title">Title</h1><h2 id="part-1--technical">Part 1 — technical</h2><h3 id="frames-and-units">Frames and units</h3>')
    expect(r.headings).toEqual([
      { level: 1, text: 'Title', id: 'title' },
      { level: 2, text: 'Part 1 — technical', id: 'part-1--technical' },
      { level: 3, text: 'Frames and units', id: 'frames-and-units' },
    ])
  })

  it('shifts heading levels, prefixes ids and de-duplicates them', () => {
    const r = renderMarkdown('# Credits\n## Data\n## Data', { headingShift: 1, idPrefix: 'credits-' })
    expect(r.headings.map((h) => [h.level, h.id])).toEqual([
      [2, 'credits-credits'],
      [3, 'credits-data'],
      [3, 'credits-data-1'],
    ])
    expect(renderMarkdown('###### six', { headingShift: 2 }).headings[0].level).toBe(6)
  })

  it('joins paragraph lines and separates paragraphs at blank lines', () => {
    expect(html('one\ntwo\n\nthree')).toBe('<p>one\ntwo</p><p>three</p>')
  })

  it('renders bullet and numbered lists, tight and nested, with a start number', () => {
    expect(html('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(html('3. c\n4. d')).toBe('<ol start="3"><li>c</li><li>d</li></ol>')
    expect(html('- a\n  - a1\n  - a2\n- b')).toBe('<ul><li>a\n<ul><li>a1</li><li>a2</li></ul></li><li>b</li></ul>')
    expect(html('- a\n  continued\n- b')).toBe('<ul><li>a\ncontinued</li><li>b</li></ul>')
  })

  it('makes a list with blank lines between items loose (paragraphs in items)', () => {
    expect(html('- a\n\n- b')).toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul>')
  })

  it('ends a list at a paragraph that is not indented', () => {
    expect(html('- a\n\nafter')).toBe('<ul><li>a</li></ul><p>after</p>')
  })

  it('renders a table inside its own scroller, with alignment and numeric cells in mono', () => {
    const out = html('| Name | Value |\n|---|--:|\n| a `x|y` | 12.5 km |\n| b \\| c | — |')
    expect(out).toBe(
      '<div class="md-table" tabindex="0"><table><thead><tr><th>Name</th><th style="text-align:right">Value</th></tr></thead>' +
        '<tbody><tr><td>a <code>x|y</code></td><td class="num" style="text-align:right">12.5 km</td></tr>' +
        '<tr><td>b | c</td><td style="text-align:right">—</td></tr></tbody></table></div>',
    )
  })

  it('keeps a sentence that starts with a number out of mono', () => {
    expect(html('| a |\n|---|\n| 1.75 m above the ground at the site |')).toContain('<td>1.75 m above')
  })

  it('renders fenced code blocks verbatim and escaped', () => {
    expect(html('```ts\nconst a = <b>&c</b>\n  indented\n```')).toBe(
      '<pre><code class="language-ts">const a = &lt;b&gt;&amp;c&lt;/b&gt;\n  indented</code></pre>',
    )
    expect(html('```\nunclosed')).toBe('<pre><code>unclosed</code></pre>')
  })

  it('renders block quotes with nested content, and rules', () => {
    expect(html('> SI marking: **draft**\n> second line\n\n---')).toBe('<blockquote><p>SI marking: <strong>draft</strong>\nsecond line</p></blockquote><hr>')
  })

  it('lets a heading, list or quote interrupt a paragraph', () => {
    expect(html('text\n# H')).toBe('<p>text</p><h1 id="h">H</h1>')
    expect(html('text\n- item')).toBe('<p>text</p><ul><li>item</li></ul>')
  })
})

describe('markdown renderer: inline', () => {
  it('renders emphasis, strong and inline code', () => {
    expect(html('**bold** and *it* and _it2_ and `a*b*c`')).toBe('<p><strong>bold</strong> and <em>it</em> and <em>it2</em> and <code>a*b*c</code></p>')
  })

  it('leaves snake_case words and lone stars alone', () => {
    expect(html('lon_east_180 and 2 * 3')).toBe('<p>lon_east_180 and 2 * 3</p>')
  })

  it('renders external links as new-tab links and bare URLs as links', () => {
    expect(html('[Data Book](https://ntrs.nasa.gov/a%20b.pdf) and https://sfz-bw.de.')).toBe(
      '<p><a href="https://ntrs.nasa.gov/a%20b.pdf" target="_blank" rel="noreferrer">Data Book</a> and ' +
        '<a href="https://sfz-bw.de" target="_blank" rel="noreferrer">https://sfz-bw.de</a>.</p>',
    )
    expect(html('(see https://example.org/x_(y))')).toContain('href="https://example.org/x_(y)"')
  })

  it('renders a link the resolver rejects as plain text', () => {
    expect(html('[validation.md](event/validation.md) and [x](javascript:alert(1))')).toBe('<p>validation.md and x</p>')
  })

  it('passes link targets through the resolver', () => {
    const out = html('[Limits](#limits)', { resolveLink: (h: string) => (h.startsWith('#') ? '#doc-' + h.slice(1) : null) })
    expect(out).toBe('<p><a href="#doc-limits">Limits</a></p>')
  })

  it('renders images as their alt text', () => {
    expect(html('![a chart](chart.png)')).toBe('<p>a chart</p>')
  })

  it('handles backslash escapes and hard breaks', () => {
    expect(html('\\*not em\\* line  \nnext')).toBe('<p>*not em* line<br>next</p>')
  })
})

describe('markdown renderer: escaping', () => {
  it('escapes raw HTML everywhere', () => {
    const out = html('<script>alert(1)</script>\n\n# <img src=x onerror=alert(1)>\n\n| <b> |\n|---|\n| "q" & \'s\' |\n\n- <i>x</i>')
    expect(out).not.toMatch(/<(script|img|b|i)[\s>]/)
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(out).toContain('&quot;q&quot; &amp; &#39;s&#39;')
  })

  it('escapes quotes in link targets so they cannot leave the attribute', () => {
    const out = html('[x](https://a.example/"onmouseover="alert(1))')
    expect(out).not.toContain('"onmouseover')
    expect(out).toContain('&quot;onmouseover=&quot;')
  })
})

describe('slugify and inlineText', () => {
  it('match GitHub anchors used in docs/', () => {
    expect(slugify('Mandatory site assessments — method and evidence (AI, not validated)')).toBe('mandatory-site-assessments--method-and-evidence-ai-not-validated')
    expect(slugify('Validation results')).toBe('validation-results')
    expect(inlineText('Rocket `flight` *now* & [link](https://x.org)')).toBe('Rocket flight now & link')
  })
})
