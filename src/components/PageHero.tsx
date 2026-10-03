import Link from 'next/link'

export type Crumb = { label: string; url?: string }

export default function PageHero({
  title,
  eyebrow,
  summary,
  image,
  crumbs = [],
  accent,
}: {
  title: string
  eyebrow?: string
  summary?: string | null
  image?: string
  crumbs?: Crumb[]
  accent?: string | null
}) {
  return (
    <section className={`page-hero ${image ? 'has-image' : ''}`} style={accent ? ({ ['--accent' as string]: accent } as React.CSSProperties) : undefined}>
      {image && (
        <div className="page-hero-media" aria-hidden>
          <img src={image} alt="" data-parallax="0.25" />
        </div>
      )}
      <div className="page-hero-shapes" aria-hidden>
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="grid-lines" />
      </div>
      <div className="container page-hero-inner">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          {crumbs.map((c, i) => (
            <span key={i}>
              <span className="sep">/</span>
              {c.url ? <Link href={c.url}>{c.label}</Link> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
        {eyebrow && <span className="eyebrow hero-in" style={{ ['--d' as string]: '0.05s' }}>{eyebrow}</span>}
        <h1 className="hero-title hero-in" style={{ ['--d' as string]: '0.12s' }}>
          {title}
        </h1>
        {summary && (
          <p className="hero-summary hero-in" style={{ ['--d' as string]: '0.24s' }}>
            {summary}
          </p>
        )}
      </div>
    </section>
  )
}
