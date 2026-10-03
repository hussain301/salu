import Link from 'next/link'
import { formatDate, mediaUrl } from '@/lib/data'

type NewsDoc = {
  id: number | string
  title: string
  slug: string
  publishedAt?: string | null
  excerpt?: string | null
  categories?: string[] | null
  featuredImage?: unknown
}

export default function NewsCard({ doc, big = false }: { doc: NewsDoc; big?: boolean }) {
  const img = mediaUrl(doc.featuredImage as never, 'card')
  return (
    <article className={`news-card ${big ? 'big' : ''}`} data-tilt>
      <Link href={`/news/${doc.slug}`} className="news-card-link">
        <div className="news-card-media">
          {img ? <img src={img} alt="" loading="lazy" /> : <div className="news-card-ph" aria-hidden>SALU</div>}
          {doc.categories?.[0] && <span className="chip">{doc.categories[0]}</span>}
        </div>
        <div className="news-card-body">
          <time>{formatDate(doc.publishedAt)}</time>
          <h3>{doc.title}</h3>
          {big && doc.excerpt && <p>{doc.excerpt}</p>}
          <span className="read-more">
            Read more <span aria-hidden>→</span>
          </span>
        </div>
        <span className="shine" aria-hidden />
      </Link>
    </article>
  )
}
