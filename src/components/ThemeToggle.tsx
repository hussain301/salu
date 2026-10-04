'use client'

import { useEffect, useState } from 'react'
import { THEME_KEY as KEY } from '@/lib/theme'

type Theme = 'light' | 'dark'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
    read()
    // keep the icon in sync when the OS theme changes (and no manual choice is saved)
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const sys: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    try {
      // choosing the same as the OS clears the override, so the site keeps following the system
      if (next === sys) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {}
    document.documentElement.classList.add('theme-anim')
    document.documentElement.dataset.theme = next
    window.setTimeout(() => document.documentElement.classList.remove('theme-anim'), 500)
  }

  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light mode' : 'Dark mode'}
      suppressHydrationWarning
    >
      <svg className="ico-sun" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </g>
      </svg>
      <svg className="ico-moon" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z" fill="currentColor" />
      </svg>
    </button>
  )
}
