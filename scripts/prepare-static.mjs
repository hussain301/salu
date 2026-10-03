// Prepares a CI checkout for the read-only static export (GitHub Pages).
// !! Destructive: run ONLY in CI / a throwaway copy, never in your working tree. !!
//  - removes the Payload admin + API routes (they need a Node server and can't be exported)
//  - strips `export const revalidate = ...` (ISR is not supported by `output: 'export'`)
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

if (!process.env.CI && !process.argv.includes('--force')) {
  console.error('[prepare-static] refusing to run outside CI (pass --force on a throwaway copy)')
  process.exit(1)
}

const payloadRoutes = join('src', 'app', '(payload)')
if (existsSync(payloadRoutes)) {
  rmSync(payloadRoutes, { recursive: true, force: true })
  console.log('[prepare-static] removed', payloadRoutes)
}

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

for (const file of walk(join('src', 'app')).filter((f) => /\.(t|j)sx?$/.test(f))) {
  const src = readFileSync(file, 'utf8')
  const out = src.replace(/^export const (revalidate|dynamic)\s*=.*$/gm, '')
  if (out !== src) {
    writeFileSync(file, out)
    console.log('[prepare-static] stripped route config in', file)
  }
}
