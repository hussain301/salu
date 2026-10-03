import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { FixedToolbarFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { Users } from './cms/collections/Users'
import { Media } from './cms/collections/Media'
import { Pages } from './cms/collections/Pages'
import { News } from './cms/collections/News'
import { Faculties } from './cms/collections/Faculties'
import { Departments } from './cms/collections/Departments'
import { Documents } from './cms/collections/Documents'
import { Footer, Homepage, Navigation, Settings } from './cms/globals'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const getDatabaseUrl = () => {
  const raw = process.env.DATABASE_URI || 'file:./data/salu.db'
  if (raw.startsWith('file:')) {
    const rawPath = raw.slice(5)
    const absPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath)
    return `file:${absPath.replace(/\\/g, '/')}`
  }
  return raw
}

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SITE_URL || '',
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' — SALU Admin' },
  },
  collections: [Pages, News, Faculties, Departments, Documents, Media, Users],
  globals: [Homepage, Navigation, Footer, Settings],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [...defaultFeatures, FixedToolbarFeature()],
  }),
  secret: process.env.PAYLOAD_SECRET || 'change-me',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: sqliteAdapter({
    client: { url: getDatabaseUrl() },
  }),
  sharp,
  upload: { limits: { fileSize: 50_000_000 } },
})
