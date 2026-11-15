// A small Markdown renderer for the /docs page (D1), for exactly the subset the files in docs/ use: ATX headings,
// paragraphs, bullet and numbered lists (nested by indentation), tables, links, inline code, fenced code blocks,
// emphasis, block quotes and rules. No dependency. Every character of the source is HTML-escaped; the only markup
// in the output is the markup this file writes, and link targets pass through `resolveLink` (which returns null for
// anything that must not become a link), so raw HTML or a `javascript:` URL in a Markdown file renders as text.

export interface Heading {
  /** Output level after `headingShift`, 1–6. */
  level: number
  /** Plain text of the heading (Markdown removed). */
  text: string
  id: string
}

export interface RenderOptions {
  /** Prepended to every heading id (and so to in-file `#fragment` links resolved by the caller). */
  idPrefix?: string
  /** Added to each heading's level (capped at 6), so a file's `#` can become an `<h2>` on the page. */
  headingShift?: number
  /** Maps a link target to the href to write, or null to render the link text as plain text. */
  resolveLink?: (href: string) => string | null
  /** Called for each heading id before it is used; lets the caller keep ids unique across files. */
  uniqueId?: (id: string) => string
}

export interface Rendered {
  html: string
  headings: Heading[]
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c])

/** GitHub's heading anchor: lower case, punctuation removed, each space a hyphen ("Part 1 — technical" → "part-1--technical"). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-')
}

/** Default link policy: web and mail links only. */
export function defaultResolveLink(href: string): string | null {
  return /^(https?:\/\/|mailto:)/i.test(href) ? href : null
}

const isExternal = (href: string) => /^(https?:\/\/|mailto:)/i.test(href)

// ---------------------------------------------------------------- inline

const PUNCT = /[!-/:-@[-`{-~]/

function findCodeEnd(s: string, from: number, ticks: number): number {
  let i = from
  while (i < s.length) {
    const j = s.indexOf('`', i)
    if (j < 0) return -1
    let k = j
    while (s[k] === '`') k++
    if (k - j === ticks) return j
    i = k
  }
  return -1
}

/** Index of the `]` closing the `[` at `open`, honouring nesting and escapes; -1 if none. */
function findBracketEnd(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === '`') {
      let k = i
      while (s[k] === '`') k++
      const end = findCodeEnd(s, k, k - i)
      if (end >= 0) i = end + (k - i) - 1
      continue
    }
    if (c === '[') depth++
    else if (c === ']' && --depth === 0) return i
  }
  return -1
}

/** Parses `(target "title")` at `open`; returns the target and the index after `)`. */
function parseLinkTarget(s: string, open: number): { href: string; end: number } | null {
  if (s[open] !== '(') return null
  let depth = 0
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === '(') depth++
    else if (c === ')' && --depth === 0) {
      let inner = s.slice(open + 1, i).trim()
      const titled = /^(\S+)\s+(".*"|'.*'|\(.*\))$/.exec(inner)
      if (titled) inner = titled[1]
      if (inner.startsWith('<') && inner.endsWith('>')) inner = inner.slice(1, -1)
      return { href: inner.replace(/\\([!-/:-@[-`{-~])/g, '$1'), end: i + 1 }
    }
  }
  return null
}

const BARE_URL = /^https?:\/\/[^\s<>]+/i

function trimUrl(url: string): string {
  // Trailing sentence punctuation is not part of a bare URL; a closing parenthesis only when unbalanced.
  let u = url.replace(/[.,;:!?'"*_]+$/, '')
  while (u.endsWith(')') && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0)) u = u.slice(0, -1).replace(/[.,;:!?'"*_]+$/, '')
  return u
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c)

interface InlineCtx {
  resolve: (href: string) => string | null
  inLink: boolean
}

function anchor(href: string, inner: string): string {
  const ext = isExternal(href)
  return `<a href="${escapeHtml(href)}"${ext ? ' target="_blank" rel="noreferrer"' : ''}>${inner}</a>`
}

function renderInline(s: string, ctx: InlineCtx): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    // Backslash escape, and backslash at line end = hard break.
    if (c === '\\') {
      const n = s[i + 1]
      if (n === '\n') {
        out += '<br>'
        i += 2
        continue
      }
      if (n && PUNCT.test(n)) {
        out += escapeHtml(n)
        i += 2
        continue
      }
    }
    if (c === ' ' && s.startsWith('  \n', i)) {
      let k = i
      while (s[k] === ' ') k++
      if (s[k] === '\n') {
        out += '<br>'
        i = k + 1
        continue
      }
    }
    if (c === '`') {
      let k = i
      while (s[k] === '`') k++
      const ticks = k - i
      const end = findCodeEnd(s, k, ticks)
      if (end >= 0) {
        let code = s.slice(k, end).replace(/\n/g, ' ')
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1)
        out += `<code>${escapeHtml(code)}</code>`
        i = end + ticks
        continue
      }
      out += escapeHtml(s.slice(i, k))
      i = k
      continue
    }
    // Image: rendered as its alt text (the docs page shows no images from the repository).
    if (c === '!' && s[i + 1] === '[') {
      const close = findBracketEnd(s, i + 1)
      const target = close >= 0 ? parseLinkTarget(s, close + 1) : null
      if (target) {
        out += renderInline(s.slice(i + 2, close), ctx)
        i = target.end
        continue
      }
    }
    if (c === '[') {
      const close = findBracketEnd(s, i)
      const target = close >= 0 ? parseLinkTarget(s, close + 1) : null
      if (target) {
        const inner = renderInline(s.slice(i + 1, close), { ...ctx, inLink: true })
        const href = ctx.inLink ? null : ctx.resolve(target.href)
        out += href == null ? inner : anchor(href, inner)
        i = target.end
        continue
      }
    }
    if (c === '<') {
      const m = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(s.slice(i))
      if (m) {
        const href = ctx.inLink ? null : ctx.resolve(m[1])
        out += href == null ? escapeHtml(m[1]) : anchor(href, escapeHtml(m[1]))
        i += m[0].length
        continue
      }
    }
    if ((c === 'h' || c === 'H') && !isWordChar(s[i - 1])) {
      const m = BARE_URL.exec(s.slice(i))
      if (m) {
        const url = trimUrl(m[0])
        const href = ctx.inLink ? null : ctx.resolve(url)
        out += href == null ? escapeHtml(url) : anchor(href, escapeHtml(url))
        i += url.length
        continue
      }
    }
    if (c === '*' || c === '_') {
      const dbl = s[i + 1] === c
      const delim = dbl ? c + c : c
      const after = s[i + delim.length]
      const leftOk = after !== undefined && !/\s/.test(after) && (c === '*' || !isWordChar(s[i - 1]))
      if (leftOk) {
        let j = i + delim.length
        let found = -1
        while ((j = s.indexOf(delim, j)) >= 0) {
          const before = s[j - 1]
          const next = s[j + delim.length]
          const single = dbl || (s[j + 1] !== c && s[j - 1] !== c)
          if (j > i + delim.length && single && !/\s/.test(before) && (c === '*' || !isWordChar(next))) {
            found = j
            break
          }
          j += delim.length
        }
        if (found >= 0) {
          const tag = dbl ? 'strong' : 'em'
          out += `<${tag}>${renderInline(s.slice(i + delim.length, found), ctx)}</${tag}>`
          i = found + delim.length
          continue
        }
      }
      out += escapeHtml(delim)
      i += delim.length
      continue
    }
    out += escapeHtml(c)
    i++
  }
  return out
}

/** Plain text of inline Markdown (for heading ids and the table of contents). */
export function inlineText(s: string): string {
  const html = renderInline(s, { resolve: () => null, inLink: false })
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]!)
}

// ---------------------------------------------------------------- blocks

const RE_FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/
const RE_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const RE_HR = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
const RE_QUOTE = /^ {0,3}> ?/
const RE_ITEM = /^( *)([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/
const RE_TABLE_SEP = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/

const blank = (l: string) => /^\s*$/.test(l)
const indentOf = (l: string) => l.length - l.trimStart().length

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  let inCode = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
      continue
    }
    if (ch === '`') {
      let k = i
      while (s[k] === '`') k++
      const n = k - i
      if (inCode === 0 && findCodeEnd(s, k, n) >= 0) inCode = n
      else if (inCode === n) inCode = 0
      cur += s.slice(i, k)
      i = k - 1
      continue
    }
    if (ch === '|' && !inCode) {
      cells.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  cells.push(cur.trim())
  return cells
}

const isTableStart = (lines: string[], i: number) =>
  lines[i].includes('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')

/** A line that starts a new block, so it ends a paragraph. */
function interrupts(lines: string[], i: number): boolean {
  const l = lines[i]
  if (RE_FENCE.test(l) || RE_HR.test(l) || RE_QUOTE.test(l)) return true
  const h = RE_HEADING.exec(l)
  if (h) return true
  const it = RE_ITEM.exec(l)
  if (it && it[4].trim() && indentOf(l) < 4 && (!/^\d/.test(it[2]) || /^1[.)]$/.test(it[2]))) return true
  return isTableStart(lines, i)
}

interface BlockCtx {
  inline: InlineCtx
  shift: number
  prefix: string
  uniqueId: (id: string) => string
  headings: Heading[]
}

const NUMERIC = /^[−+\-±~≈<>≤≥]?\s?\d/

function renderBlocks(lines: string[], ctx: BlockCtx, tight = false): string {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (blank(line)) {
      i++
      continue
    }

    const fence = RE_FENCE.exec(line)
    if (fence) {
      const mark = fence[1]
      const indent = indentOf(line)
      const body: string[] = []
      i++
      while (i < lines.length && !new RegExp(`^ {0,3}${mark[0] === '`' ? '`' : '~'}{${mark.length},}\\s*$`).test(lines[i])) {
        body.push(lines[i].replace(new RegExp(`^ {0,${indent}}`), ''))
        i++
      }
      i++ // closing fence (or end of input)
      const lang = fence[2] ? ` class="language-${escapeHtml(fence[2])}"` : ''
      out.push(`<pre><code${lang}>${escapeHtml(body.join('\n'))}</code></pre>`)
      continue
    }

    const h = RE_HEADING.exec(line)
    if (h) {
      const level = Math.min(6, h[1].length + ctx.shift)
      const src = (h[2] ?? '').trim()
      const text = inlineText(src)
      const id = ctx.uniqueId(ctx.prefix + slugify(text))
      ctx.headings.push({ level, text, id })
      out.push(`<h${level} id="${escapeHtml(id)}">${renderInline(src, ctx.inline)}</h${level}>`)
      i++
      continue
    }

    if (RE_HR.test(line)) {
      out.push('<hr>')
      i++
      continue
    }

    if (isTableStart(lines, i)) {
      const head = splitRow(line)
      const align = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''))
      i += 2
      const rows: string[][] = []
      while (i < lines.length && !blank(lines[i]) && lines[i].includes('|')) rows.push(splitRow(lines[i++]))
      const cell = (tag: 'th' | 'td', text: string, col: number) => {
        // A value cell (a number with its unit, "12.5 km", "0.0763°") is set in mono; a sentence that starts with a number is not.
        const plain = inlineText(text)
        const cls = tag === 'td' && NUMERIC.test(plain) && plain.length <= 20 ? ' class="num"' : ''
        const al = align[col] ? ` style="text-align:${align[col]}"` : ''
        return `<${tag}${cls}${al}>${renderInline(text, ctx.inline)}</${tag}>`
      }
      const thead = `<thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead>`
      const tbody = rows.length
        ? `<tbody>${rows.map((r) => `<tr>${head.map((_, k) => cell('td', r[k] ?? '', k)).join('')}</tr>`).join('')}</tbody>`
        : ''
      out.push(`<div class="md-table" tabindex="0"><table>${thead}${tbody}</table></div>`)
      continue
    }

    if (RE_QUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length && !blank(lines[i])) {
        if (RE_QUOTE.test(lines[i])) body.push(lines[i].replace(RE_QUOTE, ''))
        else if (body.length && !interrupts(lines, i)) body.push(lines[i]) // lazy continuation
        else break
        i++
      }
      out.push(`<blockquote>${renderBlocks(body, ctx)}</blockquote>`)
      continue
    }

    const item = RE_ITEM.exec(line)
    if (item && indentOf(line) < 4) {
      const [html, next] = renderList(lines, i, ctx)
      out.push(html)
      i = next
      continue
    }

    // Paragraph.
    const para: string[] = [line.trimStart()]
    i++
    while (i < lines.length && !blank(lines[i]) && !interrupts(lines, i)) para.push(lines[i++].replace(/^\s+/, ''))
    const inner = renderInline(para.join('\n').replace(/\s+$/, ''), ctx.inline)
    out.push(tight ? inner : `<p>${inner}</p>`)
  }
  return out.join(tight ? '\n' : '')
}

function renderList(lines: string[], start: number, ctx: BlockCtx): [string, number] {
  const first = RE_ITEM.exec(lines[start])!
  const ordered = /^\d/.test(first[2])
  const delim = first[2].slice(-1)
  const baseIndent = first[1].length
  const items: string[][] = []
  let loose = false
  let i = start
  while (i < lines.length) {
    const m = RE_ITEM.exec(lines[i])
    if (!m || m[1].length !== baseIndent || /^\d/.test(m[2]) !== ordered || m[2].slice(-1) !== delim) break
    const contentCol = m[1].length + m[2].length + (m[3].length > 4 || !m[4] ? 1 : m[3].length)
    const body = [m[4]]
    i++
    let sawBlank = false
    while (i < lines.length) {
      const l = lines[i]
      if (blank(l)) {
        sawBlank = true
        body.push('')
        i++
        continue
      }
      const ind = indentOf(l)
      if (ind >= contentCol || (ind > baseIndent && RE_ITEM.test(l))) {
        if (sawBlank) loose = true
        body.push(l.slice(Math.min(ind, contentCol)))
        sawBlank = false
        i++
        continue
      }
      // Lazy continuation of the item's paragraph.
      if (!sawBlank && !interrupts(lines, i) && ind > baseIndent - 1 && !RE_ITEM.test(l)) {
        body.push(l.trim())
        i++
        continue
      }
      break
    }
    while (body.length && blank(body[body.length - 1])) body.pop()
    items.push(body)
    // A blank line between two items makes the list loose.
    if (i < lines.length && sawBlank) {
      const n = RE_ITEM.exec(lines[i])
      if (n && n[1].length === baseIndent) loose = true
    }
  }
  const tag = ordered ? 'ol' : 'ul'
  const num = ordered ? parseInt(first[2], 10) : 1
  const startAttr = ordered && num !== 1 ? ` start="${num}"` : ''
  const html = `<${tag}${startAttr}>${items.map((b) => `<li>${renderBlocks(b, ctx, !loose)}</li>`).join('')}</${tag}>`
  return [html, i]
}

/** Renders a Markdown document to escaped HTML and lists its headings. */
export function renderMarkdown(src: string, opts: RenderOptions = {}): Rendered {
  const headings: Heading[] = []
  const lines = src.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')
  const ctx: BlockCtx = {
    inline: { resolve: opts.resolveLink ?? defaultResolveLink, inLink: false },
    shift: opts.headingShift ?? 0,
    prefix: opts.idPrefix ?? '',
    uniqueId: opts.uniqueId ?? uniqueIds(),
    headings,
  }
  return { html: renderBlocks(lines, ctx), headings }
}

/** GitHub-style de-duplication: the second "Limits" becomes "limits-1". */
export function uniqueIds(): (id: string) => string {
  const seen = new Map<string, number>()
  return (id: string) => {
    const n = seen.get(id)
    if (n === undefined) {
      seen.set(id, 0)
      return id
    }
    let k = n + 1
    while (seen.has(`${id}-${k}`)) k++
    seen.set(id, k)
    seen.set(`${id}-${k}`, 0)
    return `${id}-${k}`
  }
}
