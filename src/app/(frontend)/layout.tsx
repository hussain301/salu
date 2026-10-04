import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import Header, { type NavItem } from '@/components/Header'
import Footer from '@/components/Footer'
import Motion from '@/components/Motion'
import { getGlobals, mediaUrl } from '@/lib/data'
import { themeInitScript } from '@/lib/theme'
import './styles.css'

const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['opsz'] })
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

export const revalidate = 600

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getGlobals()
  const name = settings.siteName || 'Shah Abdul Latif University'
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: { default: name, template: `%s | ${settings.shortName || 'SALU'}` },
    description: `${name}, Khairpur Mir’s — admissions, faculties, departments, research, news and events.`,
  }
}

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const { settings, navigation, footer } = await getGlobals()
  const siteName = settings.siteName || 'Shah Abdul Latif University'

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body id="top">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="progress-bar" data-progress aria-hidden />
        <Header
          items={(navigation.items || []) as NavItem[]}
          siteName={siteName}
          shortName={settings.shortName || 'SALU'}
          tagline={settings.tagline}
          logo={mediaUrl(settings.logo as never, 'thumbnail')}
          apply={settings.ctas?.applyUrl ? { label: settings.ctas.applyLabel || 'Apply', url: settings.ctas.applyUrl } : undefined}
          portal={settings.ctas?.portalUrl ? { label: settings.ctas.portalLabel || 'Portal', url: settings.ctas.portalUrl } : undefined}
        />
        <main id="main-content">{children}</main>
        <Footer
          siteName={siteName}
          about={footer.about}
          columns={(footer.columns || []) as never}
          bottomText={footer.bottomText}
          contact={settings.contact}
          social={settings.social as never}
        />
        <Motion />
      </body>
    </html>
  )
}
