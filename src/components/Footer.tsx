import Link from 'next/link'
import { href, isExternal } from '@/lib/data'

type L = { label: string; url?: string | null }

const icons: Record<string, string> = {
  facebook: 'M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z',
  twitter: 'M4 4l7 9-7 7h2l6-6 4 6h4l-7-10 6-6h-2l-5 5-4-5z',
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  youtube: 'M22 8s-.2-1.6-.8-2.3c-.8-.8-1.7-.8-2.1-.9C16.2 4.6 12 4.6 12 4.6s-4.2 0-7.1.2c-.4.1-1.3.1-2.1.9C2.2 6.4 2 8 2 8s-.2 1.9-.2 3.8v1.7c0 1.9.2 3.8.2 3.8s.2 1.6.8 2.3c.8.8 1.9.8 2.4.9 1.7.2 7 .2 7 .2s4.2 0 7.1-.2c.4-.1 1.3-.1 2.1-.9.6-.7.8-2.3.8-2.3s.2-1.9.2-3.8v-1.7C22.2 9.9 22 8 22 8zM10 15V9l5 3-5 3z',
  instagram: 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5a4 4 0 100 8 4 4 0 000-8zm5.5-1.5a1 1 0 100 2 1 1 0 000-2z',
  linkedin: 'M4 9h4v12H4zM6 3a2 2 0 110 4 2 2 0 010-4zm4 6h4v2c.6-1 2-2.2 4-2.2 4 0 4 3 4 6V21h-4v-5.5c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21h-4z',
  globe: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
}

function A({ url, children }: { url?: string | null; children: React.ReactNode }) {
  return isExternal(url) ? (
    <a href={href(url)} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href(url)}>{children}</Link>
  )
}

export default function Footer({
  siteName,
  about,
  columns,
  bottomText,
  contact,
  social,
}: {
  siteName: string
  about?: string | null
  columns: { heading: string; links?: L[] | null }[]
  bottomText?: string | null
  contact?: { address?: string | null; phone?: string | null; email?: string | null } | null
  social?: { platform: string; url: string }[] | null
}) {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="footer-glow" aria-hidden />
      <div className="container">
        <div className="footer-cta" data-reveal="up">
          <h2 data-split>Begin your journey at {siteName.split(' ').slice(0, 3).join(' ')}</h2>
          <span data-magnetic className="magnet-wrap">
            <Link href="/admissions" className="btn btn-gold btn-lg">
              Explore Admissions →
            </Link>
          </span>
        </div>

        <div className="footer-grid" data-reveal="up" data-stagger>
          <div className="footer-about">
            <strong className="footer-brand">{siteName}</strong>
            {about && <p>{about}</p>}
            {contact && (
              <ul className="footer-contact">
                {contact.address && <li>📍 {contact.address}</li>}
                {contact.phone && (
                  <li>
                    📞 <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>{contact.phone}</a>
                  </li>
                )}
                {contact.email && (
                  <li>
                    ✉️ <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </li>
                )}
              </ul>
            )}
            {!!social?.length && (
              <div className="socials" aria-label="Social media links">
                {social.map((s, i) => {
                  const key = s.platform.toLowerCase()
                  const iconPath = icons[key] || icons.globe
                  return (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${siteName} on ${s.platform}`}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
                        <path d={iconPath} />
                      </svg>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
          {columns.map((col, i) => (
            <nav key={i} className="footer-col" aria-label={col.heading}>
              <h3>{col.heading}</h3>
              <ul>
                {col.links?.map((l, k) => (
                  <li key={k}>
                    <A url={l.url}>{l.label}</A>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="footer-bottom">
          <span>{bottomText || `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`}</span>
          <a href="#top" className="to-top" aria-label="Back to top of page">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  )
}
