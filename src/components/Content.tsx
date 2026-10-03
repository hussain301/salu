import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

/**
 * Prepares and sanitizes legacy WordPress HTML recovered from the 2022 website archive.
 * Ensures modern typography, responsive scrollable tables, lazy-loaded images,
 * and clean WordPress alignment/figure rendering.
 */
function prepareLegacyHtml(rawHtml: string): string {
  if (!rawHtml) return ''

  let html = rawHtml
    // 1. Remove dangerous or interactive tags
    .replace(/<\s*(script|style|iframe(?![^>]*(youtube\.com|google\.com\/maps))|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // 2. Remove inline event handlers
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // 3. Neutralize javascript: protocol
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')

  // 4. Wrap standalone tables in responsive, scrollable container
  // Handle tables that are not already wrapped in .table-wrap or .table-responsive
  html = html.replace(/(?:<div[^>]*class="[^"]*(?:table-wrap|table-responsive)[^"]*"[^>]*>\s*)?(<table[\s\S]*?<\/table>)(?:\s*<\/div>)?/gi, (_match, table) => {
    // Strip obsolete fixed dimensions from table tag
    const cleanTable = table
      .replace(/<table([^>]*)>/i, (_t: string, attrs: string) => {
        const cleanAttrs = attrs
          .replace(/\s*(width|height|border|cellpadding|cellspacing)=("[^"]*"|'[^']*'|\S+)/gi, '')
        return `<table${cleanAttrs} class="legacy-table">`
      })
    return `<div class="table-wrap"><div class="table-responsive">${cleanTable}</div></div>`
  })

  // 5. Ensure images have lazy loading, async decoding, and responsive wrappers
  html = html
    .replace(/<img(?![^>]*\bloading=)([^>]*)>/gi, '<img loading="lazy" decoding="async"$1>')
    .replace(/<p>\s*(<img[^>]+>)\s*<\/p>/gi, '<figure class="content-figure">$1</figure>')

  // 6. Clean empty paragraphs and excess line breaks
  html = html
    .replace(/<p>\s*(?:&nbsp;|<br\s*\/?>|\s)*<\/p>/gi, '')
    .replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')

  // 7. Static (GitHub Pages) build: prefix root-relative URLs with the base path
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '')
  if (base) {
    html = html.replace(/\b(href|src)\s*=\s*(["'])\/(?!\/)/gi, `$1=$2${base}/`)
  }

  return html
}

function hasRichText(v: unknown): v is SerializedEditorState {
  const root = (v as SerializedEditorState | undefined)?.root
  if (!root?.children?.length) return false
  // An "empty" editor has a single empty paragraph
  return !(
    root.children.length === 1 &&
    !((root.children[0] as { children?: unknown[] }).children?.length)
  )
}

export default function Content({ content, legacyHtml }: { content?: unknown; legacyHtml?: string | null }) {
  if (hasRichText(content)) {
    return (
      <div className="prose prose-salu content-article" data-reveal="fade">
        <RichText data={content} />
      </div>
    )
  }
  if (legacyHtml) {
    return (
      <div
        className="prose prose-salu content-article"
        data-reveal="fade"
        dangerouslySetInnerHTML={{ __html: prepareLegacyHtml(legacyHtml) }}
      />
    )
  }
  return null
}

export { hasRichText, prepareLegacyHtml }
