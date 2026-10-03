import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Content from '@/components/Content'
import NewsCard from '@/components/NewsCard'
import PageHero from '@/components/PageHero'
import { formatDate, getClient, getLatestNews, IS_STATIC, mediaUrl } from '@/lib/data'

export const revalidate = 600

type Props = { params: Promise<{ slug: string }> }

/** Only used by the static (GitHub Pages) export; the server build renders on demand. */
export async function generateStaticParams() {
  if (!IS_STATIC) return []
  const payload = await getClient()
  const res = await payload.find({ collection: 'news', where: { _status: { equals: 'published' } }, limit: 5000, depth: 0, select: { slug: true } })
  return res.docs.map((d) => String(d.slug || '')).filter(Boolean).map((slug) => ({ slug }))
}

async function getPost(slug: string) {
  const payload = await getClient()
  const res = await payload.find({
    collection: 'news',
    where: { slug: { equals: decodeURIComponent(slug) }, _status: { equals: 'published' } },
    limit: 1,
    depth: 1,
  })
  return res.docs[0]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).slug)
  if (!post) return { title: 'Not found' }
  return {
    title: post.seo?.metaTitle || post.title,
    description: post.seo?.metaDescription || post.excerpt || undefined,
    openGraph: { images: mediaUrl(post.featuredImage as never, 'card') },
  }
}

export default async function NewsPost({ params }: Props) {
  const post = await getPost((await params).slug)
  if (!post) notFound()
  const more = (await getLatestNews(4)).docs.filter((d) => d.id !== post.id).slice(0, 3)
  const hero = mediaUrl(post.featuredImage as never, 'hero')

  return (
    <>
      <PageHero
        title={post.title}
        eyebrow={formatDate(post.publishedAt)}
        image={hero}
        crumbs={[{ label: 'News', url: '/news' }, { label: post.title.slice(0, 40) + (post.title.length > 40 ? '…' : '') }]}
      />
      <section className="section page-body">
        <div className="container narrow">
          {!!post.categories?.length && (
            <div className="chips" data-reveal="fade">
              {post.categories.map((c) => (
                <span className="chip" key={c}>
                  {c}
                </span>
              ))}
            </div>
          )}
          <Content content={post.content} legacyHtml={post.legacyHtml} />
          {!!post.gallery?.length && (
            <div className="gallery" data-reveal="up" data-stagger>
              {post.gallery.map((g, i) => {
                const full = mediaUrl(g.image as never)
                return (
                  <a key={i} href={full} target="_blank" rel="noopener noreferrer">
                    <img src={mediaUrl(g.image as never, 'card')} alt="" loading="lazy" />
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </section>
      {!!more.length && (
        <section className="section more-news">
          <div className="container">
            <h2 className="h3" data-split>
              More news
            </h2>
            <div className="news-grid" data-reveal="up" data-stagger>
              {more.map((n) => (
                <NewsCard key={n.id} doc={n as never} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
