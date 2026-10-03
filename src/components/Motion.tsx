'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

/**
 * Snap counters, suppress transforms, and ensure full visibility when
 * prefers-reduced-motion is active.
 */
function applyReducedMotion() {
  document.documentElement.classList.add('reduce-motion')
  // Snap all number counters immediately to final formatted values
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count || 0)
    const suffix = el.dataset.suffix || ''
    el.textContent = end.toLocaleString() + suffix
  })
  // Suppress entrance transforms and ensure elements are visible
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    el.style.opacity = '1'
    el.style.transform = 'none'
    el.style.clipPath = 'none'
    if (el.hasAttribute('data-stagger')) {
      Array.from(el.children).forEach((child) => {
        const c = child as HTMLElement
        c.style.opacity = '1'
        c.style.transform = 'none'
        c.style.clipPath = 'none'
      })
    }
  })
  // Suppress split heading transforms
  document.querySelectorAll<HTMLElement>('[data-split] .wi').forEach((wi) => {
    const el = wi as HTMLElement
    el.style.opacity = '1'
    el.style.transform = 'none'
  })
}

/**
 * Global animation engine. Elements opt in via data attributes:
 *  data-reveal="up|left|right|scale|fade"  (+ data-delay="0.2")
 *  data-stagger                             children animate one by one
 *  data-split                               heading words rise in
 *  data-parallax="0.2"                      vertical parallax speed
 *  data-count="1234"                        number counter (data-suffix)
 *  data-magnetic                            button follows the cursor
 *  data-progress                            reading progress bar (scaleX)
 */
export default function Motion() {
  const pathname = usePathname()

  // Smooth scrolling and dynamic reduced-motion detection
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')

    let lenis: Lenis | null = null
    let tick: ((t: number) => void) | null = null

    const startLenis = () => {
      if (mql.matches) return
      lenis = new Lenis({ duration: 1.1, smoothWheel: true })
      lenis.on('scroll', ScrollTrigger.update)
      tick = (t: number) => lenis?.raf(t * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
      ;(window as unknown as { __lenis?: Lenis }).__lenis = lenis
    }

    const stopLenis = () => {
      if (tick) {
        gsap.ticker.remove(tick)
        tick = null
      }
      if (lenis) {
        lenis.destroy()
        lenis = null
      }
      ;(window as unknown as { __lenis?: Lenis | undefined }).__lenis = undefined
    }

    if (mql.matches) {
      applyReducedMotion()
    } else {
      startLenis()
    }

    const onMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        stopLenis()
        ScrollTrigger.getAll().forEach((st) => st.kill())
        applyReducedMotion()
      } else {
        document.documentElement.classList.remove('reduce-motion')
        startLenis()
        ScrollTrigger.refresh()
      }
    }

    mql.addEventListener('change', onMotionChange)
    return () => {
      mql.removeEventListener('change', onMotionChange)
      stopLenis()
    }
  }, [])

  // Per-page animations
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis

    if (reduce) {
      window.scrollTo(0, 0)
      applyReducedMotion()
      return
    }

    lenis?.scrollTo(0, { immediate: true })
    document.documentElement.classList.add('js-motion')
    document.documentElement.classList.remove('reduce-motion')

    const cleanups: Array<() => void> = []
    const ctx = gsap.context(() => {
      /* split headings */
      document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
        if (!el.dataset.splitDone) {
          const words = (el.textContent || '').trim().split(/\s+/)
          el.innerHTML = words
            .map((w) => `<span class="w"><span class="wi">${w.replace(/</g, '&lt;')}</span></span>`)
            .join(' ')
          el.dataset.splitDone = '1'
        }
        gsap.fromTo(
          el.querySelectorAll('.wi'),
          { yPercent: 110, rotate: 4 },
          {
            yPercent: 0,
            rotate: 0,
            duration: 1,
            ease: 'expo.out',
            stagger: 0.06,
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          },
        )
      })

      /* reveals */
      const from: Record<string, gsap.TweenVars> = {
        up: { y: 60, opacity: 0 },
        down: { y: -40, opacity: 0 },
        left: { x: -70, opacity: 0 },
        right: { x: 70, opacity: 0 },
        scale: { scale: 0.88, opacity: 0 },
        fade: { opacity: 0 },
        clip: { clipPath: 'inset(0 0 100% 0)' },
      }
      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        const kind = el.dataset.reveal || 'up'
        const targets = el.hasAttribute('data-stagger') ? Array.from(el.children) : el
        gsap.fromTo(targets, from[kind] || from.up, {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          clipPath: 'inset(0 0 0% 0)',
          duration: 1.1,
          ease: 'power3.out',
          delay: Number(el.dataset.delay || 0),
          stagger: el.hasAttribute('data-stagger') ? 0.09 : 0,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        })
      })

      /* parallax */
      document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
        const speed = Number(el.dataset.parallax || 0.2)
        gsap.fromTo(
          el,
          { yPercent: -speed * 50 },
          {
            yPercent: speed * 50,
            ease: 'none',
            scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        )
      })

      /* counters */
      document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
        const end = Number(el.dataset.count || 0)
        const suffix = el.dataset.suffix || ''
        const o = { v: 0 }
        gsap.to(o, {
          v: end,
          duration: 2.2,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          onUpdate: () => {
            el.textContent = Math.round(o.v).toLocaleString() + suffix
          },
        })
      })

      /* reading progress */
      document.querySelectorAll<HTMLElement>('[data-progress]').forEach((el) => {
        gsap.fromTo(
          el,
          { scaleX: 0 },
          { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } },
        )
      })
    })

    /* magnetic buttons (pointer devices only and only when reduced motion is off) */
    if (window.matchMedia('(pointer: fine)').matches && !reduce) {
      document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect()
          gsap.to(el, {
            x: (e.clientX - r.left - r.width / 2) * 0.3,
            y: (e.clientY - r.top - r.height / 2) * 0.4,
            duration: 0.4,
            ease: 'power3.out',
          })
        }
        const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerleave', leave)
        cleanups.push(() => {
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerleave', leave)
        })
      })

      /* tilt cards */
      document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width - 0.5
          const py = (e.clientY - r.top) / r.height - 0.5
          el.style.setProperty('--mx', `${(px + 0.5) * 100}%`)
          el.style.setProperty('--my', `${(py + 0.5) * 100}%`)
          gsap.to(el, { rotateY: px * 8, rotateX: -py * 8, duration: 0.5, ease: 'power2.out', transformPerspective: 900 })
        }
        const leave = () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.8, ease: 'power3.out' })
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerleave', leave)
        cleanups.push(() => {
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerleave', leave)
        })
      })
    }

    const refresh = setTimeout(() => ScrollTrigger.refresh(), 400)
    return () => {
      clearTimeout(refresh)
      cleanups.forEach((f) => f())
      ctx.revert()
    }
  }, [pathname])

  return null
}
