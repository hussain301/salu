import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Content from '@/components/Content'
import DocList, { DOC_PAGES } from '@/components/DocList'
import PageHero from '@/components/PageHero'
import { getClient, getDepartments, IS_STATIC, mediaUrl, resolvePath } from '@/lib/data'
import { SECTIONS } from '@/cms/collections/Pages'

export const revalidate = 600

type Props = { params: Promise<{ slug: string[] }> }

const pathOf = async (params: Props['params']) => (await params).slug.map(decodeURIComponent).join('/')

const RESERVED = new Set(['news', 'faculties', 'admin', 'api', '_next'])

/** Only used by the static (GitHub Pages) export; the server build renders on demand. */
export async function generateStaticParams() {
  if (!IS_STATIC) return []
  const payload = await getClient()
  const [pages, deps, facs] = await Promise.all([
    payload.find({ collection: 'pages', where: { _status: { equals: 'published' } }, limit: 5000, depth: 0, select: { slug: true } }),
    payload.find({ collection: 'departments', limit: 1000, depth: 0, select: { slug: true } }),
    payload.find({ collection: 'faculties', limit: 200, depth: 0, select: { slug: true } }),
  ])
  const all = new Set<string>(Object.keys(DOC_PAGES))
  for (const d of [...pages.docs, ...deps.docs, ...facs.docs]) {
    const s = String((d as { slug?: string | null }).slug || '').replace(/^\/+|\/+$/g, '').toLowerCase()
    if (s) all.add(s)
  }
  return [...all]
    .filter((s) => !RESERVED.has(s.split('/')[0]))
    .map((s) => ({ slug: s.split('/') }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolvePath(await pathOf(params))
  if (!r) return { title: 'Not found' }
  const d = r.doc as { title?: string; name?: string; summary?: string; intro?: string; seo?: { metaTitle?: string; metaDescription?: string } }
  return {
    title: d.seo?.metaTitle || d.title || d.name,
    description: d.seo?.metaDescription || d.summary || d.intro || undefined,
  }
}

export default async function CatchAll({ params }: Props) {
  const path = await pathOf(params)
  const r = await resolvePath(path)
  const docPage = DOC_PAGES[path.toLowerCase()]
  if (!r && docPage) {
    return (
      <>
        <PageHero title={docPage.title} crumbs={[{ label: docPage.title }]} />
        <section className="section page-body">
          <div className="container narrow">
            <DocList category={docPage.category} />
          </div>
        </section>
      </>
    )
  }
  if (!r) notFound()

  if (r.type === 'department') return <DepartmentView doc={r.doc} />
  if (r.type === 'faculty') return <FacultyView doc={r.doc} />

  const page = r.doc
  const section = SECTIONS.find((s) => s.value === page.section)
  const siblings = await (await getClient()).find({
    collection: 'pages',
    where: { section: { equals: page.section }, _status: { equals: 'published' } },
    limit: 40,
    sort: 'title',
    depth: 0,
    select: { title: true, slug: true },
  })
  const showSide = page.section && page.section !== 'other' && siblings.docs.length > 1

  return (
    <>
      <PageHero
        title={page.title}
        eyebrow={section && section.value !== 'other' ? section.label : undefined}
        summary={page.summary}
        image={mediaUrl(page.heroImage as never, 'hero')}
        crumbs={[...(section && section.value !== 'other' ? [{ label: section.label }] : []), { label: page.title }]}
      />
      <section className="section page-body">
        <div className={`container ${showSide ? 'with-side' : 'narrow'}`}>
          <article>
            <Content content={page.content} legacyHtml={page.legacyHtml} />
            {docPage && <DocList category={docPage.category} />}
          </article>
          {showSide && (
            <aside className="side-nav" data-reveal="right">
              <h3>{section?.label}</h3>
              <ul>
                {siblings.docs.map((s) => (
                  <li key={s.id} className={s.slug === page.slug ? 'active' : ''}>
                    <Link href={`/${s.slug}`}>{s.title}</Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </section>
    </>
  )
}

/* ---------------- Department ---------------- */

type Dep = Awaited<ReturnType<typeof getDepartments>>[number]

async function DepartmentView({ doc }: { doc: Dep }) {
  const faculty = typeof doc.faculty === 'object' ? doc.faculty : null
  const all = faculty ? (await getDepartments()).filter((d) => (typeof d.faculty === 'object' ? d.faculty?.id : d.faculty) === faculty.id) : []
  const chair = doc.chairperson

  return (
    <>
      <PageHero
        title={doc.name}
        eyebrow={faculty?.name || 'Department'}
        summary={doc.intro}
        image={mediaUrl(doc.heroImage as never, 'hero')}
        accent={faculty?.accent}
        crumbs={[{ label: 'Faculties', url: '/faculties' }, ...(faculty ? [{ label: faculty.name, url: `/${faculty.slug}` }] : []), { label: doc.name }]}
      />
      <section className="section page-body">
        <div className={`container ${all.length > 1 ? 'with-side' : 'narrow'}`}>
          <article>
            {chair?.name && (
              <div className="person-feature" data-reveal="up">
                {mediaUrl(chair.photo as never, 'card') && <img src={mediaUrl(chair.photo as never, 'card')} alt={chair.name} />}
                <div>
                  <span className="eyebrow">{chair.designation || 'Chairperson'}</span>
                  <h3>{chair.name}</h3>
                  {chair.message && <p>{chair.message}</p>}
                </div>
              </div>
            )}

            <Content content={doc.content} legacyHtml={doc.legacyHtml} />

            {!!doc.programs?.length && (
              <div className="block">
                <h2 className="h3" data-split>
                  Programs offered
                </h2>
                <div className="program-grid" data-reveal="up" data-stagger>
                  {doc.programs.map((p, i) => (
                    <div className="program" key={i}>
                      {p.level && <span className="chip">{p.level}</span>}
                      <h4>{p.name}</h4>
                      {p.duration && <small>{p.duration}</small>}
                      {p.description && <p>{p.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!doc.members?.length && (
              <div className="block">
                <h2 className="h3" data-split>
                  Faculty members
                </h2>
                <div className="people-grid" data-reveal="up" data-stagger>
                  {doc.members.map((m, i) => (
                    <div className="person" key={i} data-tilt>
                      <div className="person-photo">
                        {mediaUrl(m.photo as never, 'thumbnail') ? (
                          <img src={mediaUrl(m.photo as never, 'thumbnail')} alt={m.name} loading="lazy" />
                        ) : (
                          <span>{m.name.replace(/^(dr|prof|mr|ms|mrs|miss)\.?\s+/i, '').slice(0, 1)}</span>
                        )}
                      </div>
                      <h4>{m.name}</h4>
                      {m.designation && <p className="muted">{m.designation}</p>}
                      {m.qualification && <p className="small">{m.qualification}</p>}
                      <div className="person-links">
                        {m.email && <a href={`mailto:${m.email}`}>Email</a>}
                        {mediaUrl(m.cv as never) && (
                          <a href={mediaUrl(m.cv as never)} target="_blank" rel="noopener noreferrer">
                            CV
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(doc.contact?.email || doc.contact?.phone || doc.contact?.location) && (
              <div className="contact-card" data-reveal="up">
                <h3>Contact the department</h3>
                {doc.contact.location && <p>📍 {doc.contact.location}</p>}
                {doc.contact.phone && <p>📞 {doc.contact.phone}</p>}
                {doc.contact.email && (
                  <p>
                    ✉️ <a href={`mailto:${doc.contact.email}`}>{doc.contact.email}</a>
                  </p>
                )}
              </div>
            )}
          </article>
          {all.length > 1 && (
            <aside className="side-nav" data-reveal="right">
              <h3>{faculty?.name}</h3>
              <ul>
                {all.map((d) => (
                  <li key={d.id} className={d.id === doc.id ? 'active' : ''}>
                    <Link href={`/${d.slug}`}>{d.name}</Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </section>
    </>
  )
}

/* ---------------- Faculty ---------------- */

type Fac = { id: number | string; name: string; slug: string; intro?: string | null; accent?: string | null; heroImage?: unknown; content?: unknown; legacyHtml?: string | null; dean?: { name?: string | null; designation?: string | null; photo?: unknown; message?: string | null } | null }

async function FacultyView({ doc }: { doc: Fac }) {
  const deps = (await getDepartments()).filter((d) => (typeof d.faculty === 'object' ? d.faculty?.id : d.faculty) === doc.id)
  return (
    <>
      <PageHero
        title={doc.name}
        eyebrow="Faculty"
        summary={doc.intro}
        image={mediaUrl(doc.heroImage as never, 'hero')}
        accent={doc.accent}
        crumbs={[{ label: 'Faculties', url: '/faculties' }, { label: doc.name }]}
      />
      <section className="section page-body">
        <div className="container narrow">
          {doc.dean?.name && (
            <div className="person-feature" data-reveal="up">
              {mediaUrl(doc.dean.photo as never, 'card') && <img src={mediaUrl(doc.dean.photo as never, 'card')} alt={doc.dean.name} />}
              <div>
                <span className="eyebrow">{doc.dean.designation || 'Dean'}</span>
                <h3>{doc.dean.name}</h3>
                {doc.dean.message && <p>{doc.dean.message}</p>}
              </div>
            </div>
          )}
          <Content content={doc.content} legacyHtml={doc.legacyHtml} />
        </div>
        {!!deps.length && (
          <div className="container">
            <h2 className="h3 center" data-split>
              Departments
            </h2>
            <div className="dept-grid" data-reveal="up" data-stagger>
              {deps.map((d) => (
                <Link key={d.id} href={`/${d.slug}`} className="dept-card" data-tilt style={{ ['--accent' as string]: doc.accent || '#0b6e4f' }}>
                  {mediaUrl(d.heroImage as never, 'card') && <img src={mediaUrl(d.heroImage as never, 'card')} alt="" loading="lazy" />}
                  <div>
                    <h3>{d.name}</h3>
                    {d.intro && <p>{d.intro.slice(0, 120)}…</p>}
                  </div>
                  <span className="dept-go" aria-hidden>
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
