import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const isStatic = process.env.STATIC_EXPORT === '1' || process.env.STATIC_EXPORT === 'true'
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '')

const nextConfig: NextConfig = {
  // Default: standalone output = a self-contained server folder, easiest to run under IIS (HttpPlatformHandler / reverse proxy).
  // STATIC_EXPORT=1: read-only static snapshot (used by the GitHub Pages workflow; no admin/API).
  ...(isStatic
    ? { output: 'export' as const, trailingSlash: true, ...(basePath ? { basePath } : {}) }
    : { output: 'standalone' as const }),
  images: {
    ...(isStatic ? { unoptimized: true } : {}),
    localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/images/**' }],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
