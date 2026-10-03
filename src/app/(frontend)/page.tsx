import Link from 'next/link'
import HeroSlider, { type Slide } from '@/components/HeroSlider'
import NewsCard from '@/components/NewsCard'
import { formatDate, getFaculties, getHomepage, getLatestNews, href, mediaUrl } from '@/lib/data'

export const revalidate = 600

const FALLBACK_SLIDES: Slide[] = [
  {
    eyebrow: 'Shah Abdul Latif University · Khairpur',
    heading: 'Where knowledge meets the legacy of Latif',
    text: 'A public sector university nurturing thinkers, researchers and leaders across Sindh since 1987.',
    ctaLabel: 'Admissions',
    ctaUrl: '/admissions',
  },
]

const FALLBACK_STATS = [
  { value: 1987, suffix: '', label: 'Established' },
  { value: 7, suffix: '', label: 'Faculties' },
  { value: 31, suffix: '+', label: 'Departments' },
  { value: 20000, suffix: '+', label: 'Students' },
]

export default async function Home() {
  const [home, news, faculties, events] = await Promise.all([
    getHomepage(),
    getLatestNews(7),
    getFaculties(),
    getLatestNews(4, 'events'),
  ])

  const slides: Slide[] = home.slides?.length
    ? home.slides.map((s) => ({
        eyebrow: s.eyebrow,
        heading: s.heading,
        text: s.text,
        image: mediaUrl(s.image as never, 'hero'),
        ctaLabel: s.ctaLabel,
        ctaUrl: s.ctaUrl ? href(s.ctaUrl) : undefined,
      }))
    : FALLBACK_SLIDES
  const stats = home.stats?.length ? home.stats : FALLBACK_STATS
  const ticker = home.ticker?.length
    ? home.ticker
    : news.docs.slice(0, 6).map((n) => ({ text: n.title, url: `/news/${n.slug}` }))
  const [lead, ...rest] = news.docs

  return (
    <>
      <HeroSlider slides={slides} />

      {!!ticker.length && (
        <div className="ticker" aria-label="Announcements">
          <span className="ticker-label">Latest</span>
          <div className="ticker-track">
            <div className="ticker-move">
              {[0, 1].map((dup) => (
                <span key={dup} aria-hidden={dup === 1}>
                  {ticker.map((t, i) => (
                    <Link key={i} href={href(t.url)} tabIndex={dup ? -1 : 0}>
                      {t.text}
                    </Link>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <section className="section stats-section">
        <div className="container stats" data-reveal="up" data-stagger>
          {stats.map((s, i) => (
            <div className="stat" key={i}>
              <strong data-count={s.value} data-suffix={s.suffix || ''}>
                0
              </strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* VC message */}
      <section className="section vc-section">
        <div className="container vc">
          <div className="vc-photo" data-reveal="left">
            <div className="vc-frame">
              {mediaUrl(home.vc?.photo as never, 'card') ? (
                <img src={mediaUrl(home.vc?.photo as never, 'card')} alt={home.vc?.name || 'Vice Chancellor'} data-parallax="0.12" />
              ) : (
                <div className="vc-ph">VC</div>
              )}
            </div>
            <span className="vc-badge">Est. 1987</span>
          </div>
          <div className="vc-copy">
            <span className="eyebrow" data-reveal="fade">
              Message from the {home.vc?.designation || 'Vice Chancellor'}
            </span>
            <h2 className="h2" data-split>
              Shaping minds, serving the nation
            </h2>
            <blockquote data-reveal="up">
              {home.vc?.message ||
                'Shah Abdul Latif University stands as a beacon of higher learning in upper Sindh, committed to excellence in teaching, research and community service.'}
            </blockquote>
            {home.vc?.name && (
              <p className="vc-name" data-reveal="up">
                <strong>{home.vc.name}</strong>
                <span>{home.vc.designation}</span>
              </p>
            )}
            <span data-magnetic className="magnet-wrap" data-reveal="up">
              <Link href={href(home.vc?.url || '/about')} className="btn btn-primary">
                Read full message →
              </Link>
            </span>
          </div>
        </div>
      </section>

      {/* Faculties */}
      {!!faculties.length && (
        <section className="section faculties-section">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow" data-reveal="fade">
                Academics
              </span>
              <h2 className="h2" data-split>
                Our Faculties
              </h2>
              <Link href="/faculties" className="link-arrow" data-reveal="fade">
                All faculties & departments →
              </Link>
            </div>
            <div className="faculty-grid" data-reveal="up" data-stagger>
              {faculties.map((f, i) => (
                <Link
                  key={f.id}
                  href={`/${f.slug}`}
                  className="faculty-card"
                  data-tilt
                  style={{ ['--accent' as string]: f.accent || '#0b6e4f' }}
                >
                  <span className="faculty-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="faculty-icon">{f.icon || '🎓'}</span>
                  <h3>{f.name}</h3>
                  {f.intro && <p>{f.intro.slice(0, 110)}{f.intro.length > 110 ? '…' : ''}</p>}
                  <span className="faculty-go" aria-hidden>
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* News */}
      {!!lead && (
        <section className="section news-section">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow" data-reveal="fade">
                What’s happening
              </span>
              <h2 className="h2" data-split>
                News & Updates
              </h2>
              <Link href="/news" className="link-arrow" data-reveal="fade">
                View all news →
              </Link>
            </div>
            <div className="news-layout">
              <div data-reveal="left">
                <NewsCard doc={lead as never} big />
              </div>
              <div className="news-list" data-reveal="up" data-stagger>
                {rest.slice(0, 6).map((n) => (
                  <NewsCard key={n.id} doc={n as never} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Events */}
      {!!events.docs.length && (
        <section className="section events-section">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow" data-reveal="fade">
                Campus life
              </span>
              <h2 className="h2" data-split>
                Events
              </h2>
            </div>
            <ol className="events" data-reveal="up" data-stagger>
              {events.docs.map((e) => {
                const d = e.publishedAt ? new Date(e.publishedAt) : null
                return (
                  <li key={e.id}>
                    <Link href={`/news/${e.slug}`}>
                      <span className="event-date">
                        <b>{d ? d.getDate() : ''}</b>
                        <small>{d ? d.toLocaleString('en', { month: 'short', year: 'numeric' }) : ''}</small>
                      </span>
                      <span className="event-title">{e.title}</span>
                      <span className="event-meta">{formatDate(e.publishedAt)}</span>
                      <span className="event-go" aria-hidden>
                        ↗
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>
      )}

      {/* Highlights */}
      {!!home.highlights?.length && (
        <section className="section highlights-section">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow" data-reveal="fade">
                Why SALU
              </span>
              <h2 className="h2" data-split>
                Highlights
              </h2>
            </div>
            <div className="highlight-grid" data-reveal="up" data-stagger>
              {home.highlights.map((h, i) => (
                <Link key={i} href={href(h.url)} className="highlight" data-tilt>
                  {mediaUrl(h.image as never, 'card') && <img src={mediaUrl(h.image as never, 'card')} alt="" loading="lazy" />}
                  <div>
                    <h3>{h.title}</h3>
                    {h.text && <p>{h.text}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Campuses */}
      {!!home.campuses?.length && (
        <section className="section campuses-section">
          <div className="container">
            <div className="section-head light">
              <span className="eyebrow" data-reveal="fade">
                Across Sindh
              </span>
              <h2 className="h2" data-split>
                Our Campuses
              </h2>
            </div>
            <div className="campus-rail" data-reveal="right" data-stagger data-lenis-prevent-wheel>
              {home.campuses.map((c, i) => (
                <Link key={i} href={href(c.url)} className="campus">
                  {mediaUrl(c.image as never, 'card') ? (
                    <img src={mediaUrl(c.image as never, 'card')} alt="" loading="lazy" />
                  ) : (
                    <span className="campus-ph" />
                  )}
                  <div className="campus-body">
                    <h3>{c.name}</h3>
                    {c.text && <p>{c.text}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quick links */}
      {!!home.quickLinks?.length && (
        <section className="section quick-section">
          <div className="container">
            <div className="quick" data-reveal="up" data-stagger>
              {home.quickLinks.map((q, i) => (
                <Link key={i} href={href(q.url)} className="quick-link">
                  <span>{q.label}</span>
                  <span aria-hidden>→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
