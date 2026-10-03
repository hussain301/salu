import type { Metadata } from 'next'
import Link from 'next/link'
import NewsCard from '@/components/NewsCard'
import PageHero from '@/components/PageHero'
import { getLatestNews, IS_STATIC } from '@/lib/data'
import { NEWS_CATEGORIES } from '@/cms/collections/News'

export const revalidate = 600
export const metadata: Metadata = { title: 'News & Events' }

type Props = { searchParams: Promise<{ category?: string; page?: string }> }

export default async function NewsIndex({ searchParams }: Props) {
  // Static export (GitHub Pages) has no query strings: show every post on one page, no filters.
  const sp: Awaited<Props['searchParams']> = IS_STATIC ? {} : await searchParams
  const category = NEWS_CATEGORIES.some((c) => c.value === sp.category) ? sp.category : undefined
  const page = Math.max(1, Number(sp.page) || 1)
  const res = await getLatestNews(IS_STATIC ? 1000 : 12, category, page)
  const q = (p: number) => `/news?${new URLSearchParams({ ...(category ? { category } : {}), page: String(p) })}`

  return (
    <>
      <PageHero title="News & Events" eyebrow="Newsroom" summary="Announcements, achievements, events and notifications from across the university." crumbs={[{ label: 'News' }]} />
      <section className="section">
        <div className="container">
          {!IS_STATIC && (
            <div className="filters" data-reveal="fade">
              <Link href="/news" className={!category ? 'active' : ''}>
                All
              </Link>
              {NEWS_CATEGORIES.map((c) => (
                <Link key={c.value} href={`/news?category=${c.value}`} className={category === c.value ? 'active' : ''}>
                  {c.label}
                </Link>
              ))}
            </div>
          )}
          {res.docs.length ? (
            <div className="news-grid" data-reveal="up" data-stagger>
              {res.docs.map((n) => (
                <NewsCard key={n.id} doc={n as never} />
              ))}
            </div>
          ) : (
            <p className="empty">No posts yet.</p>
          )}
          {res.totalPages > 1 && (
            <nav className="pager" aria-label="Pagination">
              {res.hasPrevPage && <Link href={q(page - 1)}>← Newer</Link>}
              <span>
                Page {page} of {res.totalPages}
              </span>
              {res.hasNextPage && <Link href={q(page + 1)}>Older →</Link>}
            </nav>
          )}
        </div>
      </section>
    </>
  )
}
