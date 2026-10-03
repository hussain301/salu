# Project: Shah Abdul Latif University (SALU) Website Rebuild

## Architecture
- **Framework**: Next.js 16.3.8 (App Router, Standalone output)
- **CMS**: Payload CMS 3.90.2 (Local API + REST/GraphQL, Lexical editor)
- **Database**: SQLite (`@payloadcms/db-sqlite` / `@libsql/client`) at `data/salu.db` with WAL mode
- **UI & Design**: Pure bespoke CSS (`styles.css`, 2,355 lines) with Fraunces serif display and Inter sans-serif typography, custom design tokens (Emerald `#064e3b`, Navy `#0f172a`, Gold `#d97706`)
- **Animation Engine**: GSAP 3.15 + Lenis 1.3 smooth scrolling, ScrollTrigger reveals, word splitting, counter animations, 3D tilt, with strict `prefers-reduced-motion` compliance
- **Content Catch-All**: `[...slug]` route normalizing legacy 2022 URLs, resolving against `pages`, `departments`, `faculties`, and document archives
- **Host Target**: Windows Server / IIS behind Application Request Routing (ARR) / URL Rewrite reverse proxy, managed via NSSM Windows Service

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Baseline TypeCheck & Build Readiness | Fix `src/cms/globals/index.ts` `as const` typing, ensure `./data` and `./media` directories exist, achieve clean `npx.cmd tsc --noEmit` pass | M1 | explorer_survey_1 |
| 2 | Media Pipeline Ingestion | Ingest 563 scraped media assets from `scraper/data/media/` into Payload `Media` collection, generate thumbnails and WebP sizes | M2 | explorer_survey_2 |
| 3 | CMS Database Importer (`scripts/import.ts`) | Relational importer mapping 259 pages: 7 faculties, 30/31 departments, 122 pages, 137 news posts, documents, footer, navigation | M2 | explorer_survey_2 |
| 4 | URL Preservation & Token Substitution | Resolve 2022 paths, replace `{{media:<id>}}` with Payload URLs, replace `{{page:<path>}}` with internal routes, produce unrecoverable report | M2 | explorer_survey_2 |
| 5 | Modern Responsive Frontend & UI Polish | Responsive layouts (360px-1440px+), mobile navigation drawer, clean legacy HTML rendering, accessible contrasts, typography | M3 | spec_miner_survey_1 |
| 6 | GSAP / Lenis Animation Polish & Reduced Motion | Smooth scrolling, scroll reveals, ticker, counters, tilt effects, instant snap on `prefers-reduced-motion: reduce` | M3 | spec_miner_survey_1 |
| 7 | Admin Authentication & RBAC | Staff login at `/admin`, setup mode for first admin user, role-based access (admin vs editor) | M4 | spec_miner_survey_1 |
| 8 | Dynamic CMS Publishing (Zero Rebuild) | Instant public reflection of CMS changes via `revalidatePath('/', 'layout')` on collection/global mutate hooks | M4 | spec_miner_survey_1 |
| 9 | Windows Server / IIS Deployment Configuration | Standalone Next.js build, IIS `web.config` reverse proxy rules, NSSM service wrapper setup, and PowerShell backup script `scripts/backup.ps1` | M5 | spec_miner_survey_1 |
| 10 | Production Documentation & Runbook | Comprehensive `README.md` covering Windows Server deployment, IIS ARR setup, service management, SQLite maintenance | M5 | spec_miner_survey_1 |
| 11 | E2E 2022 URL Crawler Test Suite | Crawl all 2022 URLs against running site, verify >= 95% recoverable pages return HTTP 200 with non-trivial body and title | M-TEST | ORIGINAL_REQUEST |
| 12 | Admin Workflow Automated E2E Test | Programmatic test logging into `/admin`, creating/publishing a page and news post with media, verifying on public site, updating navigation | M-TEST | ORIGINAL_REQUEST |
| 13 | Responsive & Accessibility Test Suite | Automated screenshot capture at 375px, 768px, 1440px verifying no overflow and working mobile menu; Lighthouse audit (Perf >= 70, A11y >= 90) | M-TEST | ORIGINAL_REQUEST |
| 14 | Final Verification & Hardening | Execute 100% of E2E test suite, perform adversarial testing, forensic integrity audit verification | M-FINAL | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Build & Typecheck Resolution | Patch `src/cms/globals/index.ts`, ensure `./data` and `./media` dirs, verify clean `tsc --noEmit` | none | DONE (`index.ts` typed, `data/` and `media/` created, tsc passes) |
| M2 | Media Pipeline & CMS Importer | Implement `scripts/import.ts`, seed SQLite DB with 7 faculties, 30/31 departments, 122 pages, 137 news, documents, unrecoverable report | M1 | DONE (`salu.db` 4.04MB, 2,318 media, 7 fac, 31 dept, 137 news, 86 pages) |
| M3 | Frontend UI & Animation Polish | Mobile menu, responsive styling (360px-1440px), GSAP/Lenis animations, `prefers-reduced-motion`, legacy HTML styling | M1 | DONE (Header syntax fixed, reduced motion, responsive prose & tables) |
| M4 | Admin Operations & Dynamic Publishing | Verify `/admin` login, user bootstrap, CRUD operations, test instant ISR updates without rebuild | M1, M2 | DONE (Admin bootstrap `admin@salu.edu.pk`, zero-rebuild ISR verified) |
| M5 | Production Build & IIS Deployment Package | Standalone build verification, IIS `web.config`, NSSM service setup, `scripts/backup.ps1`, production README.md | M1, M2, M3 | DONE (IIS reverse proxy web.config, setup-service.ps1, backup.ps1, README.md) |
| M-TEST | Dual Track E2E Testing Suite | Requirement-driven test harness, 2022 URL crawler, Playwright admin E2E test, multi-viewport screenshot test, publish `TEST_READY.md` | none | DONE (TEST_READY.md published, 4 test tiers implemented) |
| M-FINAL | Final Acceptance & Adversarial Hardening | Execute full test suite, verify 100% pass across Tiers 1-4, Phase 2 adversarial coverage hardening, forensic integrity audit | M2, M3, M4, M5, M-TEST | DONE (Standalone build `.next/standalone/server.js`, tsc 0, audit CLEAN) |

## Interface Contracts
### Scraper Data ↔ CMS Importer (`scripts/import.ts`)
- `scraper/data/pages.json` items containing `title`, `path`, `category`, `html`, `date`, `images` ingested into Payload collections:
  - Faculties: `name: item.title`, `slug: item.path.replace(/^\/|\/$/g, '')`, `legacyHtml: item.html`
  - Departments: `name: item.title`, `slug: item.path.replace(/^\/|\/$/g, '')`, `faculty: facultyId`, `legacyHtml: item.html`
  - News: `title: item.title`, `slug: item.path.replace(/^\/news\/|\/$/g, '')`, `publishedAt: item.date`, `legacyHtml: item.html`
  - Pages: `title: item.title`, `slug: item.path.replace(/^\/|\/$/g, '')`, `section: auto-classified`, `legacyHtml: item.html`
- Token replacement:
  - `{{media:<id>}}` → `/api/media/file/<filename>` or Media ID
  - `{{page:<path>}}` → `<path>`

### Payload CMS ↔ Next.js Frontend
- Catch-all route `src/app/(frontend)/[...slug]/page.tsx` calls `resolvePath(slug)` in `src/lib/data.ts`
- Direct database query via `getPayload({ config })`
- On mutate: `revalidatePath('/', 'layout')` purges Next.js full cache tree

### IIS Reverse Proxy ↔ Standalone Next.js
- IIS ARR forwards all HTTP requests to `http://localhost:3000`
- `HTTP_X_FORWARDED_PROTO` and `HTTP_X_FORWARDED_HOST` passed to preserve HTTPS and domain context
- Next.js server run via `node.exe .next/standalone/server.js` with `PORT=3000`

## Code Layout
- `src/cms/`: Payload configuration, collections (`Pages.ts`, `News.ts`, `Faculties.ts`, `Departments.ts`, `Documents.ts`, `Media.ts`, `Users.ts`), globals (`index.ts`)
- `src/app/(frontend)/`: Next.js public routes, layouts, `styles.css`
- `src/app/(payload)/`: Admin panel routes, custom SCSS
- `src/components/`: Frontend UI components (`Header.tsx`, `Footer.tsx`, `Motion.tsx`, `Content.tsx`, `Hero.tsx`, etc.)
- `src/lib/`: CMS queries (`data.ts`), utilities
- `scripts/`: Importer (`import.ts`), backup script (`backup.ps1`), test scripts
- `tests/e2e/`: Requirement-driven test suites (crawler, admin e2e, screenshots)
