import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

export const getClient = cache(async () => getPayload({ config }))

/* ---------------- media helpers ---------------- */

type MediaLike = {
  url?: string | null
  alt?: string | null
  sizes?: Record<string, { url?: string | null } | undefined> | null
} | number | string | null | undefined

/** Base path (e.g. "/salu" on GitHub Pages). Empty for the normal server deployment. */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '')
export const IS_STATIC = process.env.STATIC_EXPORT === '1' || process.env.STATIC_EXPORT === 'true'

/** Returns a root-relative URL for an upload, optionally a resized variant. */
export function mediaUrl(m: MediaLike, size?: 'thumbnail' | 'card' | 'hero'): string | undefined {
  if (!m || typeof m !== 'object') return undefined
  const raw = (size && m.sizes?.[size]?.url) || m.url || undefined
  if (!raw) return undefined
  try {
    // strip absolute origin so it works behind any host / reverse proxy
    const u = new URL(raw, 'http://x')
    // static export: files are copied as plain files, so drop the query string
    let p = u.pathname
    if (BASE_PATH && (p === BASE_PATH || p.startsWith(BASE_PATH + '/'))) p = p.slice(BASE_PATH.length)
    if (IS_STATIC) p = p.replace(/\/+$/, '')
    return BASE_PATH + p + (IS_STATIC ? '' : u.search)
  } catch {
    return raw
  }
}

export const mediaAlt = (m: MediaLike, fallback = '') =>
  (m && typeof m === 'object' && m.alt) || fallback

/** Normalise CMS link values: "about" -> "/about", keeps absolute URLs. */
export function href(url?: string | null): string {
  if (!url) return '#'
  if (/^(https?:|mailto:|tel:|#)/i.test(url)) return url
  return '/' + url.replace(/^\/+/, '')
}

export const isExternal = (url?: string | null) => !!url && /^https?:/i.test(url)

/* ---------------- cached queries ---------------- */

export const getGlobals = cache(async () => {
  const payload = await getClient()
  const [settings, navigation, footer] = await Promise.all([
    payload.findGlobal({ slug: 'settings', depth: 1 }),
    payload.findGlobal({ slug: 'navigation', depth: 0 }),
    payload.findGlobal({ slug: 'footer', depth: 0 }),
  ])
  return { settings, navigation, footer }
})

export const getHomepage = cache(async () => {
  const payload = await getClient()
  return payload.findGlobal({ slug: 'homepage', depth: 1 })
})

export const getLatestNews = cache(async (limit = 6, category?: string, page = 1) => {
  const payload = await getClient()
  return payload.find({
    collection: 'news',
    limit,
    page,
    sort: '-publishedAt',
    depth: 1,
    where: {
      _status: { equals: 'published' },
      ...(category ? { categories: { contains: category } } : {}),
    },
  })
})

export const getFaculties = cache(async () => {
  const payload = await getClient()
  const res = await payload.find({ collection: 'faculties', limit: 50, sort: 'order', depth: 1 })
  return res.docs
})

export const getDepartments = cache(async () => {
  const payload = await getClient()
  const res = await payload.find({ collection: 'departments', limit: 200, sort: 'name', depth: 1 })
  return res.docs
})

/** Resolve a URL path to a page, department or faculty. */
export const resolvePath = cache(async (path: string) => {
  const payload = await getClient()
  const slug = path.replace(/^\/+|\/+$/g, '').toLowerCase()
  if (!slug) return null

  const page = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug }, _status: { equals: 'published' } },
    limit: 1,
    depth: 1,
  })
  if (page.docs[0]) return { type: 'page' as const, doc: page.docs[0] }

  if (!slug.includes('/')) {
    const dep = await payload.find({ collection: 'departments', where: { slug: { equals: slug } }, limit: 1, depth: 2 })
    if (dep.docs[0]) return { type: 'department' as const, doc: dep.docs[0] }

    const fac = await payload.find({ collection: 'faculties', where: { slug: { equals: slug } }, limit: 1, depth: 1 })
    if (fac.docs[0]) return { type: 'faculty' as const, doc: fac.docs[0] }
  }
  return null
})

export const getDocuments = cache(async (category: string, page = 1) => {
  const payload = await getClient()
  return payload.find({
    collection: 'documents',
    where: { category: { equals: category } },
    sort: '-publishedAt',
    limit: 30,
    page,
    depth: 1,
  })
})

export const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
