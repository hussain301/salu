'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import ThemeToggle from './ThemeToggle'

export type NavLink = { label: string; url?: string | null }
export type NavItem = NavLink & {
  columns?: { heading?: string | null; url?: string | null; links?: NavLink[] | null }[] | null
}

const norm = (url?: string | null) => {
  if (!url) return '#'
  if (/^(https?:|mailto:|tel:|#)/i.test(url)) return url
  return '/' + url.replace(/^\/+/, '')
}

function SmartLink({ url, children, className, onClick }: { url?: string | null; children: React.ReactNode; className?: string; onClick?: () => void }) {
  const h = norm(url)
  if (/^https?:/i.test(h))
    return (
      <a href={h} className={className} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {children}
      </a>
    )
  return (
    <Link href={h} className={className} onClick={onClick}>
      {children}
    </Link>
  )
}

export default function Header({
  items,
  siteName,
  shortName,
  tagline,
  logo,
  apply,
  portal,
}: {
  items: NavItem[]
  siteName: string
  shortName: string
  tagline?: string | null
  logo?: string
  apply?: NavLink
  portal?: NavLink
}) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  // Hover intent: close the dropdown only after a short delay, so moving the
  // mouse from the menu item down into the dropdown never closes it.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(null), 300)
  }
  useEffect(() => cancelClose, [])

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 30)
      setHidden(y > 400 && y > last)
      last = y
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobile(false)
    setOpen(null)
  }, [pathname])

  // Lock body scroll and pause Lenis when mobile drawer is open
  useEffect(() => {
    if (mobile) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      document.body.classList.add('nav-open')
      document.documentElement.classList.add('nav-open')
      const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis
      lenis?.stop()
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.classList.remove('nav-open')
        document.documentElement.classList.remove('nav-open')
        lenis?.start()
      }
    } else {
      document.body.style.overflow = ''
      document.body.classList.remove('nav-open')
      document.documentElement.classList.remove('nav-open')
      const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis
      lenis?.start()
    }
  }, [mobile])

  // Close menus on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null)
        setMobile(false)
      }
    }
    const onResize = () => {
      if (window.innerWidth > 1180) {
        setMobile(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Close desktop mega menu when clicking outside
  useEffect(() => {
    if (open === null) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('.main-nav')) {
        setOpen(null)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open])

  const close = () => {
    setOpen(null)
    setMobile(false)
  }

  return (
    <header
      className={`site-header ${scrolled ? 'is-scrolled' : ''} ${hidden && open === null && !mobile ? 'is-hidden' : ''} ${mobile ? 'is-mobile-open' : ''}`}
    >
      <div className="header-inner container">
        <Link href="/" className="brand" aria-label={siteName}>
          {logo ? <img src={logo} alt="" className="brand-logo" /> : <span className="brand-mark">{shortName.slice(0, 1)}</span>}
          <span className="brand-text">
            <strong>{siteName}</strong>
            {tagline && <small>{tagline}</small>}
          </span>
        </Link>

        <nav className="main-nav" aria-label="Main">
          <ul onMouseLeave={scheduleClose} onMouseEnter={cancelClose}>
            {items.map((item, i) => {
              const hasMenu = !!item.columns?.length
              return (
                <li
                  key={i}
                  className={open === i ? 'open' : ''}
                  onMouseEnter={() => {
                    cancelClose()
                    setOpen(hasMenu ? i : null)
                  }}
                >
                  {hasMenu ? (
                    <button
                      className="nav-top"
                      aria-expanded={open === i}
                      aria-haspopup="true"
                      onClick={() => setOpen(open === i ? null : i)}
                    >
                      {item.label}
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                        <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </button>
                  ) : (
                    <SmartLink url={item.url} className="nav-top">
                      {item.label}
                    </SmartLink>
                  )}
                  {hasMenu && (
                    <div className="mega" role="menu">
                      <div className={`mega-inner cols-${Math.min(item.columns!.length, 4)}`}>
                        {item.columns!.map((col, c) => (
                          <div className="mega-col" key={c} style={{ ['--i' as string]: c }}>
                            {col.heading &&
                              (col.url ? (
                                <SmartLink url={col.url} className="mega-heading" onClick={close}>
                                  {col.heading}
                                </SmartLink>
                              ) : (
                                <span className="mega-heading">{col.heading}</span>
                              ))}
                            <ul>
                              {col.links?.map((l, k) => (
                                <li key={k}>
                                  <SmartLink url={l.url} onClick={close}>
                                    {l.label}
                                  </SmartLink>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="header-actions">
          {portal?.url && (
            <SmartLink url={portal.url} className="btn btn-ghost hide-sm">
              {portal.label}
            </SmartLink>
          )}
          {apply?.url && (
            <span data-magnetic className="magnet-wrap hide-sm">
              <SmartLink url={apply.url} className="btn btn-gold">
                {apply.label}
              </SmartLink>
            </span>
          )}
          <ThemeToggle />
          <button
            className={`burger ${mobile ? 'active' : ''}`}
            aria-label={mobile ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobile}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMobile(!mobile)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Mobile backdrop */}
      <div
        className={`mobile-backdrop ${mobile ? 'open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <div
        id="mobile-nav-drawer"
        className={`mobile-nav ${mobile ? 'open' : ''}`}
        aria-hidden={!mobile}
        role="dialog"
        aria-modal={mobile}
        aria-label="Navigation Menu"
      >
        <div className="mobile-scroll" data-lenis-prevent>
          <div className="mobile-drawer-head">
            <span className="mobile-drawer-title">{shortName}</span>
            <button
              className="mobile-drawer-close"
              onClick={close}
              aria-label="Close navigation menu"
            >
              ✕
            </button>
          </div>
          <ul>
            {items.map((item, i) => (
              <li key={i} style={{ ['--i' as string]: i }}>
                {item.columns?.length ? (
                  <details>
                    <summary>{item.label}</summary>
                    {item.columns.map((col, c) => (
                      <div key={c} className="m-col">
                        {col.heading && (
                          <SmartLink url={col.url || undefined} className="m-heading" onClick={close}>
                            {col.heading}
                          </SmartLink>
                        )}
                        {col.links?.map((l, k) => (
                          <SmartLink key={k} url={l.url} onClick={close}>
                            {l.label}
                          </SmartLink>
                        ))}
                      </div>
                    ))}
                  </details>
                ) : (
                  <SmartLink url={item.url} className="m-top" onClick={close}>
                    {item.label}
                  </SmartLink>
                )}
              </li>
            ))}
          </ul>
          <div className="mobile-ctas">
            {apply?.url && (
              <SmartLink url={apply.url} className="btn btn-gold" onClick={close}>
                {apply.label}
              </SmartLink>
            )}
            {portal?.url && (
              <SmartLink url={portal.url} className="btn btn-ghost" onClick={close}>
                {portal.label}
              </SmartLink>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
