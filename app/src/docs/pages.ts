// The /docs page's content (D1): the Markdown files in the repository's docs/ folder, read into the build by Vite
// (`import.meta.glob` with `?raw`, so nothing is fetched at run time) and rendered once by ./markdown.ts.
// Single source: a file added under docs/scientific-proof/, or docs/credits.md and docs/why-ours.md once they exist,
// appears on the page at the next build without editing this code. Only the files named below are read; the
// planning notes and personal data under docs/event, docs/reference, docs/archive, docs/POIs and the repository
// root are never part of the page.
import { renderMarkdown, uniqueIds, type Heading } from './markdown'

export interface DocSection {
  /** Repository path, e.g. "docs/credits.md". */
  path: string
  /** Id of the section element; a link to the file without a fragment goes here. */
  id: string
  html: string
  headings: Heading[]
}

export interface DocsPage {
  /** The page heading: the first `#` heading of docs/documentation.md. */
  title: string
  sections: DocSection[]
  /** Table-of-contents groups: one per top-level part (level-2 headings), each with its level-3 headings. */
  toc: TocGroup[]
}

export interface TocGroup {
  id: string
  text: string
  children: { id: string; text: string }[]
}

export const PROOF_DIR = 'docs/scientific-proof/'
const PROOF_INTRO = /^(readme|index)\.md$/i

/** Which repository paths the page includes. Anything else passed in is ignored. */
export function isPagePath(path: string): boolean {
  return (
    path === 'docs/documentation.md' ||
    path === 'docs/credits.md' ||
    path === 'docs/why-ours.md' ||
    (path.startsWith(PROOF_DIR) && /^[^/]+\.md$/.test(path.slice(PROOF_DIR.length)))
  )
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '')

/** Prefix for a file's heading ids. docs/documentation.md keeps plain GitHub anchors. */
function idPrefix(path: string): string {
  if (path === 'docs/documentation.md') return ''
  if (path.startsWith(PROOF_DIR)) return `proof-${baseName(path).toLowerCase()}-`
  return `${baseName(path).toLowerCase()}-`
}

const sectionId = (path: string) => `doc-${idPrefix(path).replace(/-$/, '') || 'documentation'}`

/** Resolves `href` written in `from` (both repository paths) against the folder of `from`. */
export function resolveRepoPath(from: string, href: string): string {
  const parts = from.split('/').slice(0, -1)
  for (const seg of href.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

/**
 * Link policy for the page: web and mail links stay links; a link to another included Markdown file (or a heading in
 * it) becomes an in-page link; a link to any other repository file is not on the page and renders as plain text.
 */
export function linkResolver(from: string, included: Set<string>): (href: string) => string | null {
  return (href) => {
    if (/^(https?:\/\/|mailto:)/i.test(href)) return href
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return null
    const hash = href.indexOf('#')
    const file = hash >= 0 ? href.slice(0, hash) : href
    const frag = hash >= 0 ? decodeURIComponent(href.slice(hash + 1)) : ''
    const target = file ? resolveRepoPath(from, file) : from
    if (!included.has(target)) return null
    return frag ? `#${idPrefix(target)}${frag}` : `#${sectionId(target)}`
  }
}

function minLevel(src: string): number {
  let min = 6
  let fenced = false
  for (const line of src.split(/\r?\n/)) {
    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) fenced = !fenced
    const m = !fenced && /^ {0,3}(#{1,6})\s/.exec(line)
    if (m) min = Math.min(min, m[1].length)
  }
  return min
}

const proofOrder = (a: string, b: string) => {
  const ai = PROOF_INTRO.test(baseName(a) + '.md') ? 0 : 1
  const bi = PROOF_INTRO.test(baseName(b) + '.md') ? 0 : 1
  return ai - bi || a.localeCompare(b, 'en', { numeric: true })
}

/** Builds the page from repository path → Markdown source. */
export function buildDocsPage(files: Record<string, string>): DocsPage {
  const paths = Object.keys(files).filter(isPagePath)
  const included = new Set(paths)
  const proofs = paths.filter((p) => p.startsWith(PROOF_DIR)).sort(proofOrder)
  const hasProofIntro = proofs.length > 0 && PROOF_INTRO.test(baseName(proofs[0]) + '.md')
  // Reading order: what it is, why it is better, the detailed proofs, then who made it and with what.
  const order = [
    ...['docs/documentation.md', 'docs/why-ours.md'].filter((p) => included.has(p)),
    ...proofs,
    ...['docs/credits.md'].filter((p) => included.has(p)),
  ]
  const uniqueId = uniqueIds()
  const sections: DocSection[] = []
  let title = 'Documentation'

  for (const path of order) {
    const src = files[path]
    const isProof = path.startsWith(PROOF_DIR)
    const isIntro = isProof && hasProofIntro && path === proofs[0]
    // documentation.md keeps its levels (its "#" is the page title). Other files start at h2; each proof file at h3,
    // under the "Scientific proof" heading (the intro file's own heading, or one the page adds).
    const top = path === 'docs/documentation.md' ? minLevel(src) : isProof && !isIntro ? 3 : 2
    if (isProof && !hasProofIntro && path === proofs[0]) {
      const id = uniqueId('scientific-proof')
      sections.push({
        path: PROOF_DIR,
        id: `doc-proof`,
        html: `<h2 id="${id}">Scientific proof</h2><p>One file per calculation: equation, inputs with source, assumptions, uncertainty, the test that checks it, and its validation status.</p>`,
        headings: [{ level: 2, text: 'Scientific proof', id }],
      })
    }
    const r = renderMarkdown(src, {
      idPrefix: idPrefix(path),
      headingShift: top - minLevel(src),
      resolveLink: linkResolver(path, included),
      uniqueId,
    })
    if (path === 'docs/documentation.md') {
      const h1 = r.headings.find((h) => h.level === 1)
      if (h1) title = h1.text
    }
    sections.push({ path, id: sectionId(path), html: r.html, headings: r.headings })
  }

  const toc: TocGroup[] = []
  for (const s of sections) {
    for (const h of s.headings) {
      if (h.level === 2) toc.push({ id: h.id, text: h.text, children: [] })
      else if (h.level === 3 && toc.length) toc[toc.length - 1].children.push({ id: h.id, text: h.text })
    }
  }
  return { title, sections, toc }
}

/** Vite's glob keys are relative to this file ("../../../docs/x.md"); the page works with repository paths. */
export function toRepoPaths(globbed: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, src] of Object.entries(globbed)) {
    const i = key.indexOf('docs/')
    if (i >= 0) out[key.slice(i)] = src
  }
  return out
}

// Read at build time. A pattern that matches nothing (a file not written yet) simply adds nothing.
const globbed = import.meta.glob<string>(
  ['../../../docs/documentation.md', '../../../docs/credits.md', '../../../docs/why-ours.md', '../../../docs/scientific-proof/*.md'],
  { query: '?raw', import: 'default', eager: true },
)

export const DOCS_FILES: Record<string, string> = toRepoPaths(globbed)
