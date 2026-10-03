'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export type Slide = {
  eyebrow?: string | null
  heading: string
  text?: string | null
  image?: string
  ctaLabel?: string | null
  ctaUrl?: string | null
}

export default function HeroSlider({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length

  useEffect(() => {
    if (n < 2 || paused) return
    const t = setTimeout(() => setI((v) => (v + 1) % n), 7000)
    return () => clearTimeout(t)
  }, [i, n, paused])

  return (
    <section className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="hero-bg" aria-hidden>
        {slides.map((s, k) => (
          <div key={k} className={`hero-slide-bg ${k === i ? 'active' : ''}`}>
            {s.image ? <img src={s.image} alt="" /> : <div className="hero-gradient" />}
          </div>
        ))}
        <div className="hero-overlay" />
        <div className="hero-orbs">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="container hero-content">
        {slides.map((s, k) => (
          <div key={k} className={`hero-copy ${k === i ? 'active' : ''}`} aria-hidden={k !== i}>
            {s.eyebrow && <span className="eyebrow">{s.eyebrow}</span>}
            <h1>
              {s.heading.split(' ').map((w, j) => (
                <span className="w" key={j}>
                  <span className="wi" style={{ ['--j' as string]: j }}>
                    {w}
                  </span>{' '}
                </span>
              ))}
            </h1>
            {s.text && <p>{s.text}</p>}
            {s.ctaUrl && (
              <div className="hero-ctas">
                <Link href={s.ctaUrl} className="btn btn-gold btn-lg" tabIndex={k === i ? 0 : -1}>
                  {s.ctaLabel || 'Learn more'} →
                </Link>
                <Link href="/about" className="btn btn-glass btn-lg" tabIndex={k === i ? 0 : -1}>
                  Discover SALU
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {n > 1 && (
        <div className="hero-dots container">
          {slides.map((_, k) => (
            <button key={k} className={k === i ? 'active' : ''} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)}>
              <span style={{ animationPlayState: paused ? 'paused' : 'running' }} />
            </button>
          ))}
        </div>
      )}

      <a href="#main-content" className="scroll-cue" aria-label="Scroll down">
        <span />
      </a>
    </section>
  )
}
