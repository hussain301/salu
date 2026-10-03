import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'scraper', 'data')
const MEDIA_SRC_DIR = path.join(DATA_DIR, 'media')
const MEDIA_DEST_DIR = path.join(ROOT, 'media')

// In-memory lookup tables for token replacement and relational linking
const mediaIdMap = new Map<string, string | number>()
const mediaUrlMap = new Map<string, string>()
const mediaJsonMap = new Map<string, any>()
const failedMediaMap = new Map<string, any>()
const facultyIdMap = new Map<string, string | number>()

interface ScrapedMediaItem {
  id: string
  url: string
  file: string
  bytes: number
  mime: string
  alt: string
  kind: 'image' | 'document'
}

interface ScrapedPageItem {
  key: string
  path: string
  slug: string
  type: 'page' | 'news'
  title: string
  date: string | null
  modified: string | null
  categories: string[]
  featured: string | null
  images: string[]
  html: string
  excerpt: string
  words: number
  source: string
}

/* ------------------------------------------------------------------ */
/* Helper Functions                                                   */
/* ------------------------------------------------------------------ */

function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return 'Untitled'
  let t = rawTitle
    .replace(/\s*[-–|]\s*Shah Abdul Latif University.*$/i, '')
    .replace(/\s*[-–|]\s*SALU.*$/i, '')
    .trim()
  return t || rawTitle.trim()
}

function normalizePagePath(rawPath: string): string {
  if (!rawPath) return '/'
  let p = rawPath.trim()
  let hash = ''
  const hashIdx = p.indexOf('#')
  if (hashIdx !== -1) {
    hash = p.slice(hashIdx)
    p = p.slice(0, hashIdx)
  }

  p = p.replace(/^https?:\/\/[^/]+/i, '')
  p = p.replace(/^\/?(salu\.spftcodic\.com|www\.salu\.edu\.pk|salu\.edu\.pk)\/?/i, '/')
  p = p.replace(/^\/+|\/+$/g, '')

  if (!p) return '/' + hash
  return '/' + p + hash
}

function normalizePageSlug(rawPath: string): string {
  if (!rawPath) return ''
  let p = rawPath.trim()
  const hashIdx = p.indexOf('#')
  if (hashIdx !== -1) p = p.slice(0, hashIdx)
  p = p.replace(/^https?:\/\/[^/]+/i, '')
  p = p.replace(/^\/?(salu\.spftcodic\.com|www\.salu\.edu\.pk|salu\.edu\.pk)\/?/i, '/')
  p = p.replace(/^\/+|\/+$/g, '').toLowerCase()
  return p
}

function slugify(s: string): string {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/(^[-/]+|[-/]+$)/g, '')
}

function slugifyNews(s: string): string {
  return slugify(s).replace(/\//g, '-')
}

function cleanHtml(rawHtml: string): string {

  if (!rawHtml) return ''
  let html = rawHtml

  // 1. Replace {{media:<id>}} tokens
  html = html.replace(/\{\{media:([a-f0-9]+)\}\}/gi, (_match, id) => {
    if (mediaUrlMap.has(id)) {
      return mediaUrlMap.get(id)!
    }
    if (failedMediaMap.has(id)) {
      const item = failedMediaMap.get(id)
      if (item?.url) return `https://web.archive.org/web/2022/${item.url}`
    }
    if (mediaJsonMap.has(id)) {
      const item = mediaJsonMap.get(id)
      if (item?.url) return `https://web.archive.org/web/2022/${item.url}`
    }
    return ''
  })

  // 2. Replace {{page:<path>}} tokens
  html = html.replace(/\{\{page:([^}]+)\}\}/gi, (_match, pagePath) => {
    return normalizePagePath(pagePath)
  })

  // 3. Clean empty paragraphs
  html = html.replace(/<p>\s*(?:&nbsp;|<br\s*\/?>|\s*)*<\/p>/gi, '')

  // 4. Wrap tables for responsiveness
  html = html.replace(/(?<!<div class="table-container">\s*)<table([\s\S]*?)<\/table>/gi, (match) => {
    return `<div class="table-container">${match}</div>`
  })

  // 5. Ensure lazy loading on images
  html = html.replace(/<img(?![^>]*loading=)([^>]*)>/gi, '<img loading="lazy" decoding="async"$1>')

  return html.trim()
}

function deriveDocCategory(item: ScrapedMediaItem): string {
  const text = ((item.alt || '') + ' ' + (item.file || '') + ' ' + (item.url || '')).toLowerCase()
  if (text.includes('prospectus')) return 'prospectus'
  if (text.includes('tender') || text.includes('rfq') || text.includes('quotation') || text.includes('procurement')) return 'tender'
  if (text.includes('admission') || text.includes('form') || text.includes('registration') || text.includes('application')) return 'form'
  if (text.includes('notification') || text.includes('circular') || text.includes('order')) return 'notification'
  if (text.includes('job') || text.includes('career') || text.includes('vacancy') || text.includes('recruitment')) return 'job'
  if (text.includes('result') || text.includes('merit') || text.includes('marks')) return 'result'
  return 'download'
}

function deriveDocTitle(item: ScrapedMediaItem): string {
  if (item.alt && item.alt.trim().length > 3) return item.alt.trim()
  const base = path.parse(item.url || item.file).name
  const cleaned = decodeURIComponent(base).replace(/[-_]+/g, ' ').trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) || 'Document'
}

function normalizeNewsCategories(cats: string[]): string[] {
  const valid = new Set(['news', 'events', 'announcement', 'notification', 'exam', 'oric', 'pgs'])
  const res: string[] = []
  for (const c of cats || []) {
    const lower = c.toLowerCase()
    if (lower.includes('event')) res.push('events')
    else if (lower.includes('announc')) res.push('announcement')
    else if (lower.includes('notif') || lower.includes('circular')) res.push('notification')
    else if (lower.includes('exam')) res.push('exam')
    else if (lower.includes('oric')) res.push('oric')
    else if (lower.includes('pgs') || lower.includes('postgrad')) res.push('pgs')
    else if (valid.has(lower)) res.push(lower)
  }
  if (res.length === 0) res.push('news')
  return Array.from(new Set(res))
}

function classifySection(slug: string): string {
  const s = slug.toLowerCase()
  if (s.startsWith('about') || s.startsWith('university') || s.startsWith('statutory') || s.startsWith('vision') || s.startsWith('mission') || s.startsWith('objectives') || s.startsWith('vc-')) return 'about'
  if (s.startsWith('admission') || s.startsWith('procedure') || s.startsWith('scholarship') || s.startsWith('semester-rules') || s.startsWith('eligibility')) return 'admissions'
  if (s.startsWith('examination') || s.startsWith('improver')) return 'examinations'
  if (s.startsWith('oric') || s.startsWith('research')) return 'research'
  if (s.startsWith('qec') || s.startsWith('icqec')) return 'qec'
  if (s.startsWith('directorate-of-postgraduate') || s.startsWith('dpgs')) return 'academics'
  if (s.startsWith('ghotki') || s.startsWith('campus')) return 'campuses'
  if (s.startsWith('student') || s.startsWith('sports') || s.startsWith('alumni')) return 'students'
  if (s.startsWith('vice-chancellor') || s.startsWith('registrar') || s.startsWith('administration') || s.startsWith('directorate-of-evening') || s.startsWith('directorate-of-media')) return 'administration'
  if (s.startsWith('cbc') || s.startsWith('dpri') || s.includes('chair') || s.startsWith('the-central-library') || s.startsWith('library')) return 'institutes'
  return 'other'
}

/* ------------------------------------------------------------------ */
/* Canonical Entities Data                                            */
/* ------------------------------------------------------------------ */

const FACULTIES_DATA = [
  {
    name: 'Faculty of Natural Sciences',
    slug: 'natural-sciences',
    order: 1,
    accent: '#0b6e4f',
    icon: '🌿',
    path: '/natural-sciences/',
  },
  {
    name: 'Faculty of Physical Sciences',
    slug: 'physical-sciences',
    order: 2,
    accent: '#1e3a8a',
    icon: '🔬',
    path: '/physical-sciences/',
  },
  {
    name: 'Faculty of Management Sciences',
    slug: 'management-sciences',
    order: 3,
    accent: '#b45309',
    icon: '📊',
    path: '/management-sciences/',
  },
  {
    name: 'Faculty of Social Sciences',
    slug: 'social-sciences',
    order: 4,
    accent: '#7c2d12',
    icon: '🌍',
    path: '/social-sciences/',
  },
  {
    name: 'Faculty of Arts & Languages',
    slug: 'arts-languages',
    order: 5,
    accent: '#6b21a8',
    icon: '📚',
    path: '/arts-languages/',
  },
  {
    name: 'Faculty of Education',
    slug: 'faculty-of-education',
    order: 6,
    accent: '#047857',
    icon: '🎓',
    path: '/faculty-of-education/',
  },
  {
    name: 'Faculty of Law',
    slug: 'law',
    order: 7,
    accent: '#1e293b',
    icon: '⚖️',
    path: '/law/',
  },
]

const DEPARTMENTS_DATA = [
  // Natural Sciences (6)
  { name: 'Department of Biochemistry', slug: 'biochemistry', faculty: 'natural-sciences', path: '/biochemistry/' },
  { name: 'Department of Botany', slug: 'botany', faculty: 'natural-sciences', path: '/botany/' },
  { name: 'Department of Chemistry', slug: 'chemistry', faculty: 'natural-sciences', path: '/chemistry/' },
  { name: 'Department of Microbiology', slug: 'microbiology', faculty: 'natural-sciences', path: '/microbiology/' },
  { name: 'Institute of Pharmacy', slug: 'pharmacy', faculty: 'natural-sciences', path: '/pharmacy/' },
  { name: 'Department of Zoology', slug: 'zoology', faculty: 'natural-sciences', path: '/zoology/' },

  // Physical Sciences (6)
  { name: 'Department of Archaeology', slug: 'archaeology', faculty: 'physical-sciences', path: '/archaeology/' },
  { name: 'Department of Computer Science', slug: 'computer-science-2', faculty: 'physical-sciences', path: '/computer-science-2/' },
  { name: 'Department of Geography', slug: 'geography', faculty: 'physical-sciences', path: '/geography/' },
  { name: 'Department of Mathematics', slug: 'mathematics', faculty: 'physical-sciences', path: '/mathematics/' },
  { name: 'Department of Physics & Electronics', slug: 'physics-and-electronics', faculty: 'physical-sciences', path: '/physics-and-electronics/' },
  { name: 'Department of Statistics', slug: 'statistics', faculty: 'physical-sciences', path: '/statistics/' },

  // Management Sciences (3)
  { name: 'Institute of Business Administration', slug: 'business-administration', faculty: 'management-sciences', path: '/business-administration/' },
  { name: 'Department of Commerce', slug: 'commerce', faculty: 'management-sciences', path: '/commerce/' },
  { name: 'Department of Public Administration', slug: 'public-administration', faculty: 'management-sciences', path: '/public-administration/' },

  // Social Sciences (9)
  { name: 'Department of Economics', slug: 'economics', faculty: 'social-sciences', path: '/economics/' },
  { name: 'Department of Gender Studies', slug: 'gender-studies', faculty: 'social-sciences', path: '/gender-studies/' },
  { name: 'Department of International Relations', slug: 'international-relations', faculty: 'social-sciences', path: '/international-relations/' },
  { name: 'Department of Islamic Studies', slug: 'islamic-studies', faculty: 'social-sciences', path: '/islamic-studies/' },
  { name: 'Department of Media & Communication Studies', slug: 'media-and-communication', faculty: 'social-sciences', path: '/media-and-communication/' },
  { name: 'Department of Pakistan Studies', slug: 'pakistan-studies', faculty: 'social-sciences', path: '/pakistan-studies/' },
  { name: 'Department of Physical Education', slug: 'physical-education', faculty: 'social-sciences', path: '/physical-education/' },
  { name: 'Department of Political Science', slug: 'political-science', faculty: 'social-sciences', path: '/political-science/' },
  { name: 'Department of Sociology', slug: 'sociology', faculty: 'social-sciences', path: '/sociology/' },

  // Arts & Languages (4)
  { name: 'Department of English Language & Literature', slug: 'english-language-and-literature', faculty: 'arts-languages', path: '/english-language-and-literature/' },
  { name: 'Department of Sindhi', slug: 'department-of-sindhi', faculty: 'arts-languages', path: '/department-of-sindhi/' },
  { name: 'Department of Urdu', slug: 'department-of-urdu', faculty: 'arts-languages', path: '/department-of-urdu/' },
  { name: 'Department of Foreign Languages', slug: 'foreign-languages', faculty: 'arts-languages', path: '/foreign-languages/' },

  // Education (2)
  { name: 'Department of Teacher Education', slug: 'teacher-education', faculty: 'faculty-of-education', path: '/teacher-education/' },
  { name: 'Department of Special Education', slug: 'special-education', faculty: 'faculty-of-education', path: '/special-education/' },

  // Law (1) - 31st academic teaching department
  { name: 'Shaheed Zulfiqar Ali Bhutto School of Law', slug: 'school-of-law', faculty: 'law', path: '/law/' },
]

/* ------------------------------------------------------------------ */
/* Main Import Runner                                                 */
/* ------------------------------------------------------------------ */

async function run() {
  console.log('================================================================')
  console.log('🚀 SALU Content Importer starting...')
  console.log('================================================================')

  // Ensure media destination directory exists
  if (!fs.existsSync(MEDIA_DEST_DIR)) {
    fs.mkdirSync(MEDIA_DEST_DIR, { recursive: true })
  }

  const payload: Payload = await getPayload({ config })

  // ----------------------------------------------------------------
  // Pass 0: Admin User Bootstrap
  // ----------------------------------------------------------------
  console.log('\n--- Pass 0: Bootstrapping Admin User ---')
  const existingAdmin = await payload.find({
    collection: 'users',
    where: { email: { equals: 'admin@salu.edu.pk' } },
    limit: 1,
    overrideAccess: true,
  })

  if (existingAdmin.docs.length > 0) {
    console.log(`✓ Admin user already exists: ${existingAdmin.docs[0].email} (ID: ${existingAdmin.docs[0].id})`)
  } else {
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Salu2024!'
    const createdAdmin = await payload.create({
      collection: 'users',
      data: {
        email: 'admin@salu.edu.pk',
        password: adminPassword,
        name: 'SALU Administrator',
        role: 'admin',
      },
      overrideAccess: true,
      context: { skipRevalidate: true },
    })
    console.log(`✓ Admin user created: ${createdAdmin.email} (ID: ${createdAdmin.id})`)
  }

  // ----------------------------------------------------------------
  // Load Scraped Data Artifacts
  // ----------------------------------------------------------------
  const mediaJsonPath = path.join(DATA_DIR, 'media.json')
  const failedMediaJsonPath = path.join(DATA_DIR, 'failed-media.json')
  const pagesJsonPath = path.join(DATA_DIR, 'pages.json')
  const footerJsonPath = path.join(DATA_DIR, 'footer.json')

  const mediaItems: ScrapedMediaItem[] = fs.existsSync(mediaJsonPath)
    ? JSON.parse(fs.readFileSync(mediaJsonPath, 'utf8'))
    : []

  const failedMediaItems: any[] = fs.existsSync(failedMediaJsonPath)
    ? JSON.parse(fs.readFileSync(failedMediaJsonPath, 'utf8'))
    : []

  const pageItems: ScrapedPageItem[] = fs.existsSync(pagesJsonPath)
    ? JSON.parse(fs.readFileSync(pagesJsonPath, 'utf8'))
    : []

  for (const m of mediaItems) mediaJsonMap.set(m.id, m)
  for (const m of failedMediaItems) failedMediaMap.set(m.id, m)

  console.log(`Loaded dataset: ${mediaItems.length} media items, ${failedMediaItems.length} failed media items, ${pageItems.length} pages`)

  // ----------------------------------------------------------------
  // Pass 1: Media Library Ingestion
  // ----------------------------------------------------------------
  console.log('\n--- Pass 1: Ingesting Media Library ---')
  const existingMediaDocs = await payload.find({
    collection: 'media',
    limit: 3000,
    overrideAccess: true,
    select: { filename: true, url: true },
  })

  const existingMediaByFilename = new Map<string, any>()
  for (const doc of existingMediaDocs.docs) {
    if (doc.filename) existingMediaByFilename.set(doc.filename, doc)
  }
  console.log(`Found ${existingMediaDocs.docs.length} existing media items in CMS database`)

  let mediaUploadedCount = 0
  let mediaReusedCount = 0
  let mediaFailedCount = 0

  for (const m of mediaItems) {
    const srcFilePath = path.join(MEDIA_SRC_DIR, m.file)

    // Check if already in Payload
    const existing = existingMediaByFilename.get(m.file)
    if (existing) {
      mediaIdMap.set(m.id, existing.id)
      mediaUrlMap.set(m.id, existing.url || `/api/media/file/${existing.filename}`)
      mediaReusedCount++
      continue
    }

    if (!fs.existsSync(srcFilePath)) {
      mediaFailedCount++
      continue
    }

    try {
      const doc = await payload.create({
        collection: 'media',
        data: {
          alt: m.alt || path.parse(m.file).name,
          caption: '',
        },
        filePath: srcFilePath,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
      mediaIdMap.set(m.id, doc.id)
      mediaUrlMap.set(m.id, doc.url || `/api/media/file/${doc.filename}`)
      existingMediaByFilename.set(doc.filename as string, doc)
      mediaUploadedCount++
      if (mediaUploadedCount % 50 === 0) {
        console.log(`  Uploaded ${mediaUploadedCount} media files...`)
      }
    } catch (err: any) {
      mediaFailedCount++
      // Still map fallback url
      mediaUrlMap.set(m.id, m.url)
    }
  }

  console.log(`✓ Media ingestion complete: ${mediaUploadedCount} newly uploaded, ${mediaReusedCount} reused, ${mediaFailedCount} fallback/failed. Total mapped: ${mediaIdMap.size}`)

  // ----------------------------------------------------------------
  // Pass 2: Documents Ingestion
  // ----------------------------------------------------------------
  console.log('\n--- Pass 2: Ingesting Documents Collection ---')
  const existingDocs = await payload.find({
    collection: 'documents',
    limit: 1000,
    overrideAccess: true,
    select: { file: true },
  })
  const existingDocFileIds = new Set<string | number>()
  for (const d of existingDocs.docs) {
    const fileId = typeof d.file === 'object' ? (d.file as any)?.id : d.file
    if (fileId) existingDocFileIds.add(fileId)
  }

  let docImportedCount = 0
  for (const m of mediaItems) {
    const isDoc = m.kind === 'document' || /\.(pdf|docx?|xlsx?|pptx?)$/i.test(m.file)
    if (!isDoc) continue

    const mediaId = mediaIdMap.get(m.id)
    if (!mediaId) continue
    if (existingDocFileIds.has(mediaId)) continue

    const title = deriveDocTitle(m)
    const category = deriveDocCategory(m)

    try {
      await payload.create({
        collection: 'documents',
        data: {
          title,
          category: category as any,
          file: mediaId as any,
          publishedAt: new Date().toISOString(),
          description: m.alt || '',
        },
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
      existingDocFileIds.add(mediaId)
      docImportedCount++
    } catch (err: any) {
      console.warn(`  Warning: failed to create document for ${m.file}: ${err.message}`)
    }
  }
  console.log(`✓ Documents ingestion complete: ${docImportedCount} new documents created (Total existing: ${existingDocFileIds.size})`)

  // ----------------------------------------------------------------
  // Index scraped pages for rapid access
  // ----------------------------------------------------------------
  const pagesByPath = new Map<string, ScrapedPageItem>()
  const pagesBySlug = new Map<string, ScrapedPageItem>()

  for (const p of pageItems) {
    pagesByPath.set(p.path, p)
    pagesByPath.set(p.key, p)
    const cleanS = normalizePageSlug(p.path)
    if (cleanS) pagesBySlug.set(cleanS, p)
  }

  // ----------------------------------------------------------------
  // Pass 3: Ingest Academic Faculties (7)
  // ----------------------------------------------------------------
  console.log('\n--- Pass 3: Ingesting Academic Faculties (7) ---')
  for (const fac of FACULTIES_DATA) {
    const scraped = pagesByPath.get(fac.path) || pagesBySlug.get(fac.slug)
    const heroImageId = scraped?.featured ? mediaIdMap.get(scraped.featured) : undefined
    const intro = scraped?.excerpt || `${fac.name} at Shah Abdul Latif University Khairpur.`
    const legacyHtml = scraped ? cleanHtml(scraped.html) : ''

    const existing = await payload.find({
      collection: 'faculties',
      where: { slug: { equals: fac.slug } },
      limit: 1,
      overrideAccess: true,
    })

    const facData = {
      name: fac.name,
      slug: fac.slug,
      order: fac.order,
      accent: fac.accent,
      icon: fac.icon,
      intro,
      ...(heroImageId ? { heroImage: heroImageId as any } : {}),
      legacyHtml,
      seo: {
        metaTitle: scraped?.title ? cleanTitle(scraped.title) : fac.name,
        metaDescription: intro,
      },
    }

    let docId: string | number
    if (existing.docs.length > 0) {
      const updated = await payload.update({
        collection: 'faculties',
        id: existing.docs[0].id,
        data: facData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
      docId = updated.id
      console.log(`  Updated faculty: ${fac.name} (${fac.slug})`)
    } else {
      const created = await payload.create({
        collection: 'faculties',
        data: facData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
      docId = created.id
      console.log(`  Created faculty: ${fac.name} (${fac.slug})`)
    }
    facultyIdMap.set(fac.slug, docId)
  }
  console.log(`✓ All 7 academic faculties ingested and mapped`)

  // ----------------------------------------------------------------
  // Pass 4: Ingest Academic Departments (31)
  // ----------------------------------------------------------------
  console.log('\n--- Pass 4: Ingesting Academic Departments (31) ---')
  let deptImportedCount = 0

  for (const dept of DEPARTMENTS_DATA) {
    const parentFacultyId = facultyIdMap.get(dept.faculty)
    if (!parentFacultyId) {
      console.warn(`  Warning: parent faculty ${dept.faculty} not found for department ${dept.name}`)
      continue
    }

    const scraped = pagesByPath.get(dept.path) || pagesBySlug.get(dept.slug)
    const heroImageId = scraped?.featured ? mediaIdMap.get(scraped.featured) : undefined
    const intro = scraped?.excerpt || `${dept.name} offers accredited undergraduate and graduate degree programs.`
    const legacyHtml = scraped ? cleanHtml(scraped.html) : ''

    const existing = await payload.find({
      collection: 'departments',
      where: { slug: { equals: dept.slug } },
      limit: 1,
      overrideAccess: true,
    })

    const deptData = {
      name: dept.name,
      slug: dept.slug,
      faculty: parentFacultyId as any,
      intro,
      ...(heroImageId ? { heroImage: heroImageId as any } : {}),
      legacyHtml,
      sourceUrl: scraped?.source || '',
      seo: {
        metaTitle: scraped?.title ? cleanTitle(scraped.title) : dept.name,
        metaDescription: intro,
      },
    }

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'departments',
        id: existing.docs[0].id,
        data: deptData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
    } else {
      await payload.create({
        collection: 'departments',
        data: deptData,
        overrideAccess: true,
        context: { skipRevalidate: true },
      })
    }
    deptImportedCount++
  }
  console.log(`✓ All ${deptImportedCount} academic departments ingested successfully`)

  // ----------------------------------------------------------------
  // Pass 5: Ingest News Posts (137)
  // ----------------------------------------------------------------
  console.log('\n--- Pass 5: Ingesting News Posts (137) ---')
  const newsItems = pageItems.filter((p) => p.type === 'news')
  let newsCount = 0
  const usedNewsSlugs = new Set<string>()

  for (let i = 0; i < newsItems.length; i++) {
    const p = newsItems[i]
    let baseSlug = slugifyNews(p.slug || p.title) || `news-${i + 1}`
    let finalSlug = baseSlug
    let suffix = 2
    while (usedNewsSlugs.has(finalSlug)) {
      finalSlug = `${baseSlug}-${suffix++}`
    }
    usedNewsSlugs.add(finalSlug)

    const title = cleanTitle(p.title)
    const heroImageId = p.featured ? mediaIdMap.get(p.featured) : undefined
    const categories = normalizeNewsCategories(p.categories)
    const legacyHtml = cleanHtml(p.html)

    // Build photo gallery from remaining images
    const gallery = (p.images || [])
      .filter((imgId) => imgId !== p.featured && mediaIdMap.has(imgId))
      .slice(0, 8)
      .map((imgId) => ({ image: mediaIdMap.get(imgId) as any }))

    const newsData = {
      title,
      slug: finalSlug,
      publishedAt: p.date || new Date().toISOString(),
      categories: categories as any,
      ...(heroImageId ? { featuredImage: heroImageId as any } : {}),
      excerpt: p.excerpt || '',
      legacyHtml,
      gallery,
      sourceUrl: p.source || '',
      seo: {
        metaTitle: p.title,
        metaDescription: p.excerpt || '',
      },
      _status: 'published' as const,
    }

    const existing = await payload.find({
      collection: 'news',
      where: { slug: { equals: finalSlug } },
      limit: 1,
      overrideAccess: true,
    })

    try {
      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'news',
          id: existing.docs[0].id,
          data: newsData,
          overrideAccess: true,
          context: { skipRevalidate: true },
        })
      } else {
        await payload.create({
          collection: 'news',
          data: newsData,
          overrideAccess: true,
          context: { skipRevalidate: true },
        })
      }
    } catch (err: any) {
      console.warn(`  Warning on news item [${i}] "${p.title}": ${err?.data?.errors?.[0]?.message || err.message}`)
      const fallbackSlug = `${finalSlug}-${i + 1}`
      newsData.slug = fallbackSlug
      try {
        await payload.create({
          collection: 'news',
          data: newsData,
          overrideAccess: true,
          context: { skipRevalidate: true },
        })
      } catch (retryErr: any) {
        console.warn(`  Retry failed on news item [${i}]: ${retryErr.message}`)
      }
    }

    // If path is not standard /news/<slug>/ (e.g. /2021/07/30/...), also register as a page
    if (!p.path.startsWith('/news/')) {
      const pageSlug = normalizePageSlug(p.path)
      if (pageSlug) {
        const existingPage = await payload.find({
          collection: 'pages',
          where: { slug: { equals: pageSlug } },
          limit: 1,
          overrideAccess: true,
        })
        const pageData = {
          title,
          slug: pageSlug,
          section: 'research' as any,
          legacyHtml,
          sourceUrl: p.source || '',
          summary: p.excerpt || '',
          _status: 'published' as const,
        }
        if (existingPage.docs.length > 0) {
          await payload.update({
            collection: 'pages',
            id: existingPage.docs[0].id,
            data: pageData,
            overrideAccess: true,
            context: { skipRevalidate: true },
          })
        } else {
          await payload.create({
            collection: 'pages',
            data: pageData,
            overrideAccess: true,
            context: { skipRevalidate: true },
          })
        }
      }
    }

    newsCount++
    if (newsCount % 30 === 0) {
      console.log(`  Imported ${newsCount}/${newsItems.length} news items...`)
    }
  }
  console.log(`✓ News ingestion complete: ${newsCount} news articles published`)

  // ----------------------------------------------------------------
  // Pass 6: Ingest Institutional Pages (Statutory, VC, Admissions, etc.)
  // ----------------------------------------------------------------
  console.log('\n--- Pass 6: Ingesting Institutional Pages ---')
  const facultySlugs = new Set(FACULTIES_DATA.map((f) => f.slug))
  const deptSlugs = new Set(DEPARTMENTS_DATA.map((d) => d.slug))

  // Additional aliases for computer-science
  deptSlugs.add('computer-science')

  const institutionalPages = pageItems.filter((p) => {
    if (p.type !== 'page') return false
    const s = normalizePageSlug(p.path)
    if (!s || s === 'home') return false
    // Do not shadow faculties or single-segment departments
    if (facultySlugs.has(s)) return false
    if (!s.includes('/') && deptSlugs.has(s)) return false
    return true
  })

  let pageImportedCount = 0
  const usedPageSlugs = new Set<string>()

  for (let i = 0; i < institutionalPages.length; i++) {
    const p = institutionalPages[i]
    let baseSlug = normalizePageSlug(p.path) || slugify(p.title) || `page-${i + 1}`
    let finalSlug = baseSlug
    let suffix = 2
    while (usedPageSlugs.has(finalSlug)) {
      finalSlug = `${baseSlug}-${suffix++}`
    }
    usedPageSlugs.add(finalSlug)

    const title = cleanTitle(p.title)
    const section = classifySection(finalSlug)
    const heroImageId = p.featured ? mediaIdMap.get(p.featured) : undefined
    const legacyHtml = cleanHtml(p.html)

    const pageData = {
      title,
      slug: finalSlug,
      section: section as any,
      summary: p.excerpt || '',
      ...(heroImageId ? { heroImage: heroImageId as any } : {}),
      legacyHtml,
      sourceUrl: p.source || '',
      seo: {
        metaTitle: p.title,
        metaDescription: p.excerpt || '',
      },
      _status: 'published' as const,
    }

    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: finalSlug } },
      limit: 1,
      overrideAccess: true,
    })

    try {
      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'pages',
          id: existing.docs[0].id,
          data: pageData,
          overrideAccess: true,
          context: { skipRevalidate: true },
        })
      } else {
        await payload.create({
          collection: 'pages',
          data: pageData,
          overrideAccess: true,
          context: { skipRevalidate: true },
        })
      }
    } catch (err: any) {
      console.warn(`  Warning on page [${i}] "${p.title}": ${err?.data?.errors?.[0]?.message || err.message}`)
      const fallbackSlug = `${finalSlug}-${i + 1}`
      pageData.slug = fallbackSlug
      try {
        await payload.create({
          collection: 'pages',
          data: pageData,
          overrideAccess: true,
          context: { skipRevalidate: true },
        })
      } catch (retryErr: any) {
        console.warn(`  Retry failed on page [${i}]: ${retryErr.message}`)
      }
    }

    pageImportedCount++
    if (pageImportedCount % 20 === 0) {
      console.log(`  Imported ${pageImportedCount}/${institutionalPages.length} institutional pages...`)
    }
  }

  // Also ensure computer-science alias page exists for backward compatibility
  const csExisting = await payload.find({
    collection: 'pages',
    where: { slug: { equals: 'computer-science' } },
    limit: 1,
    overrideAccess: true,
  })
  const csScraped = pagesByPath.get('/computer-science-2/')
  if (csExisting.docs.length === 0 && csScraped) {
    await payload.create({
      collection: 'pages',
      data: {
        title: 'Department of Computer Science',
        slug: 'computer-science',
        section: 'academics' as any,
        summary: csScraped.excerpt || '',
        legacyHtml: cleanHtml(csScraped.html),
        sourceUrl: csScraped.source || '',
        _status: 'published' as const,
      },
      overrideAccess: true,
      context: { skipRevalidate: true },
    })
    pageImportedCount++
  }

  console.log(`✓ Institutional pages ingestion complete: ${pageImportedCount} pages published`)

  // ----------------------------------------------------------------
  // Pass 7: Globals Seeding (Footer, Navigation, Homepage, Settings)
  // ----------------------------------------------------------------
  console.log('\n--- Pass 7: Seeding Globals ---')

  // 7.1 Seed Footer Global
  console.log('  Seeding Footer global...')
  const footerColumns = [
    {
      heading: 'Academic Faculties',
      links: [
        { label: 'Faculty of Natural Sciences', url: '/natural-sciences' },
        { label: 'Faculty of Physical Sciences', url: '/physical-sciences' },
        { label: 'Faculty of Management Sciences', url: '/management-sciences' },
        { label: 'Faculty of Social Sciences', url: '/social-sciences' },
        { label: 'Faculty of Arts & Languages', url: '/arts-languages' },
        { label: 'Faculty of Education', url: '/faculty-of-education' },
        { label: 'Faculty of Law', url: '/law' },
      ],
    },
    {
      heading: 'University & Governance',
      links: [
        { label: 'About University', url: '/about' },
        { label: 'Vice Chancellor’s Message', url: '/vc-message' },
        { label: 'Statutory Bodies (Senate & Syndicate)', url: '/statutory-bodies' },
        { label: 'Central Library', url: '/the-central-library' },
        { label: 'Ghotki Sub-Campus', url: '/ghotki-campus-home' },
        { label: 'SALU Alumni Association', url: '/alumni' },
      ],
    },
    {
      heading: 'Admissions & Examinations',
      links: [
        { label: 'Directorate of Admissions', url: '/directorate-of-admissions' },
        { label: 'Procedure & Eligibility Criteria', url: '/procedure-eligibility-criteria' },
        { label: 'Scholarships & Financial Aid', url: '/scholarships' },
        { label: 'Semester Rules & Regulations', url: '/semester-rules-regulations' },
        { label: 'Examinations Department', url: '/examination' },
        { label: 'Forms & Circulars', url: '/downloads' },
        { label: 'Tenders & RFQs', url: '/tenders-rfqs' },
      ],
    },
    {
      heading: 'Research & Quality',
      links: [
        { label: 'ORIC (Research Support)', url: '/oric' },
        { label: 'Quality Enhancement Cell (QEC)', url: '/qec' },
        { label: 'Postgraduate Studies (PGS)', url: '/directorate-of-postgraduate-studies' },
        { label: 'Benazir Research Chair', url: '/benazir-chair' },
        { label: 'Sachal Sarmast Chair', url: '/sachal-chair' },
        { label: 'Biodiversity Centre (CBC)', url: '/cbc' },
      ],
    },
  ]

  await payload.updateGlobal({
    slug: 'footer',
    data: {
      about:
        'Shah Abdul Latif University (SALU), Khairpur Mir’s is a premier public research university in Upper Sindh, Pakistan, committed to accessible education, innovative research, and regional cultural preservation.',
      columns: footerColumns,
      bottomText: '© Shah Abdul Latif University, Khairpur. All rights reserved.',
    },
    overrideAccess: true,
    context: { skipRevalidate: true },
  })
  console.log('  ✓ Footer global seeded')

  // 7.2 Seed Navigation Global
  console.log('  Seeding Navigation global...')
  const navigationItems = [
    {
      label: 'About',
      url: '/about',
      columns: [
        {
          heading: 'University Overview',
          url: '/about',
          links: [
            { label: 'About Us', url: '/about' },
            { label: 'University at a Glance', url: '/university-at-a-glance' },
            { label: 'VC Message', url: '/vc-message' },
            { label: 'VC Secretariat', url: '/vice-chancellors-secretariat' },
          ],
        },
        {
          heading: 'Administration',
          url: '/statutory-bodies',
          links: [
            { label: 'Statutory Bodies', url: '/statutory-bodies' },
            { label: 'Evening Program', url: '/directorate-of-evening-program' },
            { label: 'Media & Public Relations', url: '/directorate-of-media-and-public-relations' },
            { label: 'Ghotki Campus', url: '/ghotki-campus-home' },
          ],
        },
      ],
    },
    {
      label: 'Academics',
      url: '/faculties',
      columns: [
        {
          heading: 'Academic Faculties',
          url: '/faculties',
          links: [
            { label: 'Natural Sciences', url: '/natural-sciences' },
            { label: 'Physical Sciences', url: '/physical-sciences' },
            { label: 'Management Sciences', url: '/management-sciences' },
            { label: 'Social Sciences', url: '/social-sciences' },
            { label: 'Arts & Languages', url: '/arts-languages' },
            { label: 'Education', url: '/faculty-of-education' },
            { label: 'Faculty of Law', url: '/law' },
          ],
        },
        {
          heading: 'Featured Departments',
          url: '/faculties',
          links: [
            { label: 'Chemistry', url: '/chemistry' },
            { label: 'Computer Science', url: '/computer-science-2' },
            { label: 'Business Administration', url: '/business-administration' },
            { label: 'Economics', url: '/economics' },
            { label: 'Pharmacy', url: '/pharmacy' },
            { label: 'Archaeology', url: '/archaeology' },
          ],
        },
      ],
    },
    {
      label: 'Admissions',
      url: '/directorate-of-admissions',
      columns: [
        {
          heading: 'Admissions Information',
          url: '/directorate-of-admissions',
          links: [
            { label: 'Directorate of Admissions', url: '/directorate-of-admissions' },
            { label: 'Procedure & Eligibility', url: '/procedure-eligibility-criteria' },
            { label: 'Scholarships & Financial Aid', url: '/scholarships' },
            { label: 'Semester Regulations', url: '/semester-rules-regulations' },
          ],
        },
        {
          heading: 'Downloads & Circulars',
          url: '/downloads',
          links: [
            { label: 'Forms & Prospectus', url: '/downloads' },
            { label: 'Tenders & Procurement', url: '/tenders-rfqs' },
            { label: 'Notifications', url: '/notification' },
          ],
        },
      ],
    },
    {
      label: 'Research',
      url: '/oric',
      columns: [
        {
          heading: 'Research Support & Quality',
          url: '/oric',
          links: [
            { label: 'ORIC Research Centre', url: '/oric' },
            { label: 'Postgraduate Studies (PGS)', url: '/directorate-of-postgraduate-studies' },
            { label: 'Quality Enhancement Cell (QEC)', url: '/qec' },
            { label: 'Biodiversity Centre (CBC)', url: '/cbc' },
          ],
        },
        {
          heading: 'Research Chairs',
          url: '/benazir-chair',
          links: [
            { label: 'Shaheed Mohtarma Benazir Bhutto Chair', url: '/benazir-chair' },
            { label: 'Sachal Sarmast Chair', url: '/sachal-chair' },
            { label: 'Shaikh Ayaz Chair', url: '/shaikh-ayaz-chair' },
            { label: 'Rozay Dhani Chair', url: '/rozay-dhani' },
            { label: 'Tanveer Abbasi Chair', url: '/tanveer-chair' },
          ],
        },
      ],
    },
    {
      label: 'Examinations',
      url: '/examination',
      columns: [
        {
          heading: 'Exams & Results',
          url: '/examination',
          links: [
            { label: 'Examinations Directorate', url: '/examination' },
            { label: 'Failure / Improver Forms', url: '/improver-failure-semester-form' },
          ],
        },
      ],
    },
    {
      label: 'News & Events',
      url: '/news',
      columns: [],
    },
  ]

  await payload.updateGlobal({
    slug: 'navigation',
    data: { items: navigationItems },
    overrideAccess: true,
    context: { skipRevalidate: true },
  })
  console.log('  ✓ Navigation global seeded')

  // 7.3 Seed Settings Global
  console.log('  Seeding Settings global...')
  const logoId = mediaIdMap.get('739afa9dec93')
  await payload.updateGlobal({
    slug: 'settings',
    data: {
      siteName: 'Shah Abdul Latif University',
      shortName: 'SALU',
      tagline: 'Khairpur Mir’s, Sindh — Pakistan',
      ...(logoId ? { logo: logoId as any } : {}),
      contact: {
        address: 'Shah Abdul Latif University, Khairpur Mir’s, Sindh, Pakistan',
        phone: '+92-243-9280001',
        email: 'info@salu.edu.pk',
      },
      social: [
        { platform: 'facebook' as const, url: 'https://facebook.com/saluofficial' },
        { platform: 'twitter' as const, url: 'https://twitter.com/saluofficial' },
        { platform: 'youtube' as const, url: 'https://youtube.com/saluofficial' },
      ],
      ctas: {
        applyLabel: 'Apply Online',
        applyUrl: '/admissions',
        portalLabel: 'Student Portal',
        portalUrl: 'https://salu.edu.pk',
      },
    },
    overrideAccess: true,
    context: { skipRevalidate: true },
  })
  console.log('  ✓ Settings global seeded')

  // 7.4 Seed Homepage Global
  console.log('  Seeding Homepage global...')
  const vcPhotoId = mediaIdMap.get('2a9b1b788312')
  const heroImage1 = mediaIdMap.get('13187929ecda') || logoId
  const heroImage2 = mediaIdMap.get('58572b22f399')

  await payload.updateGlobal({
    slug: 'homepage',
    data: {
      slides: [
        {
          eyebrow: 'Welcome to Upper Sindh’s Premier Seat of Higher Learning',
          heading: 'Shah Abdul Latif University, Khairpur',
          text: 'Fostering quality higher education, cutting-edge research, and cultural heritage across 7 faculties and 31 academic departments.',
          ...(heroImage1 ? { image: heroImage1 as any } : {}),
          ctaLabel: 'Explore Academic Programs',
          ctaUrl: '/faculties',
        },
        {
          eyebrow: 'Admissions Open 2024–2025',
          heading: 'Shape Your Future at SALU Khairpur',
          text: 'Over 15,000 students enrolled in undergraduate, postgraduate, and doctoral degree disciplines.',
          ...(heroImage2 ? { image: heroImage2 as any } : {}),
          ctaLabel: 'Apply Online Now',
          ctaUrl: '/directorate-of-admissions',
        },
      ],
      ticker: [
        { text: 'Circular: Admissions General Schedule Extended — Online Portal Open', url: '/directorate-of-admissions' },
        { text: 'Examinations Directorate: Annual and Semester Examination Updates', url: '/examination' },
        { text: 'ORIC: Research Grant Proposal Applications Invited from Faculty Members', url: '/oric' },
      ],
      stats: [
        { value: 15000, suffix: '+', label: 'Enrolled Students' },
        { value: 7, suffix: '', label: 'Academic Faculties' },
        { value: 31, suffix: '', label: 'Teaching Departments' },
        { value: 150, suffix: '+', label: 'PhD Qualified Faculty' },
      ],
      vc: {
        name: 'Prof. Dr. Khalil Ahmed Ibupoto',
        designation: 'Vice Chancellor, SALU Khairpur',
        ...(vcPhotoId ? { photo: vcPhotoId as any } : {}),
        message:
          'I feel immense pleasure to congratulate you for choosing Shah Abdul Latif University Khairpur for your higher studies. At this noble seat of learning, we provide a brilliant platform integrated with innovative learning practices and state-of-the-art research facilities.',
        url: '/vc-message',
      },
      highlights: [
        {
          title: 'Allama I.I. Kazi Central Library',
          text: 'Extensive repository of over 100,000 academic books, research journals, and access to HEC Digital Library.',
          url: '/the-central-library',
        },
        {
          title: 'Office of Research, Innovation & Commercialization (ORIC)',
          text: 'Catalyzing industry linkages, innovation hubs, software technology park, and international research collaborations.',
          url: '/oric',
        },
        {
          title: 'Centre for Biodiversity & Conservation (CBC)',
          text: 'Botanical garden and herbarium dedicated to preserving the native flora and fauna of the Indus basin.',
          url: '/cbc',
        },
      ],
      campuses: [
        {
          name: 'Main Campus, Khairpur Mir’s',
          text: 'Sprawling 302-acre lush green campus equipped with modern laboratories, computing facilities, and student hostels.',
          url: '/about',
        },
        {
          name: 'Ghotki Sub-Campus',
          text: 'Offering undergraduate degrees in Computer Science, Business Administration, and Education for regional empowerment.',
          url: '/ghotki-campus-home',
        },
      ],
      quickLinks: [
        { label: 'Admissions Portal', url: '/directorate-of-admissions' },
        { label: 'Statutory Bodies', url: '/statutory-bodies' },
        { label: 'Examination Circulars', url: '/examination' },
        { label: 'Tenders & RFQs', url: '/tenders-rfqs' },
        { label: 'Scholarships', url: '/scholarships' },
      ],
    },
    overrideAccess: true,
    context: { skipRevalidate: true },
  })
  console.log('  ✓ Homepage global seeded')

  // ----------------------------------------------------------------
  // Final Verification and Database Summary
  // ----------------------------------------------------------------
  console.log('\n================================================================')
  console.log('📊 DATABASE INGESTION SUMMARY')
  console.log('================================================================')

  const countUsers = await payload.count({ collection: 'users', overrideAccess: true })
  const countMedia = await payload.count({ collection: 'media', overrideAccess: true })
  const countDocuments = await payload.count({ collection: 'documents', overrideAccess: true })
  const countFaculties = await payload.count({ collection: 'faculties', overrideAccess: true })
  const countDepartments = await payload.count({ collection: 'departments', overrideAccess: true })
  const countNews = await payload.count({ collection: 'news', overrideAccess: true })
  const countPages = await payload.count({ collection: 'pages', overrideAccess: true })

  console.log(`  • Admin Users:       ${countUsers.totalDocs}`)
  console.log(`  • Media Files:       ${countMedia.totalDocs}`)
  console.log(`  • Documents:         ${countDocuments.totalDocs}`)
  console.log(`  • Faculties:         ${countFaculties.totalDocs} (Target: 7)`)
  console.log(`  • Departments:       ${countDepartments.totalDocs} (Target: 31)`)
  console.log(`  • News Articles:     ${countNews.totalDocs} (Target: 137)`)
  console.log(`  • Institutional Pages: ${countPages.totalDocs}`)
  console.log('  • Globals:           Footer, Navigation, Homepage, Settings (All Seeded)')
  console.log('================================================================')
  console.log('✨ SALU Content Importer completed successfully!')
  console.log('================================================================\n')

  process.exit(0)
}

try {
  await run()
} catch (err) {
  console.error('\n❌ Import script encountered fatal error:', err)
  process.exit(1)
}

