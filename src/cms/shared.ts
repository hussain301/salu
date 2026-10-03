import type { Access, CollectionAfterChangeHook, CollectionAfterDeleteHook, Field, GlobalAfterChangeHook } from 'payload'

/* ------------------------------------------------------------------ */
/* Access control                                                      */
/* ------------------------------------------------------------------ */

export const isLoggedIn: Access = ({ req }) => Boolean(req.user)

export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'

/** Public sees published docs only; logged-in staff see drafts too. */
export const publishedOrLoggedIn: Access = ({ req }) => {
  if (req.user) return true
  return { _status: { equals: 'published' } }
}

export const anyone: Access = () => true

/* ------------------------------------------------------------------ */
/* Cache revalidation (pages are statically cached; refreshed on edit) */
/* ------------------------------------------------------------------ */

async function revalidateAll() {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/', 'layout')
  } catch {
    // Not running inside Next (e.g. import scripts) — nothing to revalidate.
  }
}

export const revalidateAfterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (!req.context?.skipRevalidate) await revalidateAll()
  return doc
}

export const revalidateAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (!req.context?.skipRevalidate) await revalidateAll()
  return doc
}

export const revalidateGlobal: GlobalAfterChangeHook = async ({ doc, req }) => {
  if (!req.context?.skipRevalidate) await revalidateAll()
  return doc
}

/* ------------------------------------------------------------------ */
/* Reusable fields                                                     */
/* ------------------------------------------------------------------ */

export const slugify = (s: string) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/(^[-/]+|[-/]+$)/g, '')

/** URL slug. Pages may contain "/" for nested paths (e.g. "qec/icqec"). */
export const slugField = (from = 'title', { allowSlash = false } = {}): Field => ({
  name: 'slug',
  type: 'text',
  index: true,
  unique: true,
  required: true,
  admin: {
    position: 'sidebar',
    description: allowSlash
      ? 'Web address after the domain, e.g. "about" or "qec/the-team". Leave empty to generate from the title.'
      : 'Web address, e.g. "chemistry". Leave empty to generate from the name.',
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        const raw = value || (data?.[from] as string) || ''
        const s = slugify(raw)
        return allowSlash ? s : s.replace(/\//g, '-')
      },
    ],
  },
})

export const seoFields: Field = {
  name: 'seo',
  type: 'group',
  label: 'SEO',
  admin: { position: 'sidebar' },
  fields: [
    { name: 'metaTitle', type: 'text', label: 'Meta title' },
    { name: 'metaDescription', type: 'textarea', label: 'Meta description' },
  ],
}

/** HTML recovered from the 2022 website. Shown when the rich-text content is empty. */
export const legacyHtmlField: Field = {
  name: 'legacyHtml',
  type: 'code',
  label: 'Imported content (HTML)',
  admin: {
    language: 'html',
    description:
      'Content recovered from the 2022 website. It is displayed only while the "Content" field above is empty — write new content above to replace it.',
    condition: (data) => Boolean(data?.legacyHtml),
  },
}

export const sourceUrlField: Field = {
  name: 'sourceUrl',
  type: 'text',
  label: 'Archive source',
  admin: { position: 'sidebar', readOnly: true, condition: (data) => Boolean(data?.sourceUrl) },
}

export const linkFields: Field[] = [
  { name: 'label', type: 'text', required: true },
  {
    name: 'url',
    type: 'text',
    admin: { description: 'Internal path like "/admissions" or a full link like "https://…"' },
  },
]
