// Cross-platform post-build step.
// Standalone builds don't include static assets: copy .next/static and public/ into
// .next/standalone so `npm start` (node .next/standalone/server.js) serves styled pages.
// Does nothing for the static export (GitHub Pages) build.
import { cpSync, existsSync } from 'node:fs'

const standalone = '.next/standalone'
if (!existsSync(standalone)) {
  console.log('[postbuild] no .next/standalone folder (static export?) - skipping')
  process.exit(0)
}
if (existsSync('.next/static')) cpSync('.next/static', `${standalone}/.next/static`, { recursive: true, force: true })
if (existsSync('public')) cpSync('public', `${standalone}/public`, { recursive: true, force: true })
console.log('[postbuild] copied static assets into .next/standalone')
