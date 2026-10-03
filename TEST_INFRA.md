# Test Infrastructure & Specification Guide (TEST_INFRA)

## 1. Test Philosophy

The Shah Abdul Latif University (SALU) website rebuild test infrastructure is built upon **authoritative specification-driven verification**, **zero-facade execution**, and **dual-track operational validation**. 

Because this production rebuild preserves an entire 2022 historical university web presence while introducing a modern Next.js 16 + Payload CMS architecture, the test suite operates under three core tenets:

1. **Opaque-Box Requirement Derivation**: Tests validate observable contracts derived directly from `ORIGINAL_REQUEST.md`, `PROJECT.md`, and the authoritative Wayback Machine data file (`salu_2022_pages.csv`). Tests assert HTTP response fidelity, DOM semantics, dynamic database persistence, and visual responsive containment without coupling to ephemeral framework internals.
2. **Dual-Track Resilience**: The test harness is designed to execute with full headless browser automation (Playwright Chromium) when visual rendering runtimes are present, while gracefully maintaining 100% testability via headless HTTP + JSDOM DOM simulation when running in constrained headless Windows Server or CI environments.
3. **Zero False Positives & Idempotency**: Admin workflow tests create timestamped test documents, verify live reflection immediately, and execute deterministic cleanup to restore globals and remove temporary records. Every assertion has an explicit authoritative oracle.

---

## 2. Feature Inventory & Coverage Mapping

| Tier | Category | Feature / Requirement | Authoritative Source | Test File | Primary Assertions |
|---|---|---|---|---|---|
| **Tier 1** | System Baseline | Server Connectivity & Admin Surface | `ORIGINAL_REQUEST.md` (R4) | `tests/e2e/run-all.ts` | Next.js server port 3000 reachable, `/admin` endpoint responds (HTTP 200/308) |
| **Tier 2** | Content Integrity | 2022 URL Preservation (>= 95% 200s) | `ORIGINAL_REQUEST.md` (R1, R4.2) | `tests/e2e/crawler.ts` | >= 95% recoverable pages return HTTP 200 with `<title>` and non-trivial body text (>= 40 chars) |
| **Tier 2** | Taxonomy Reachability | 7 Faculties Structure | `PROJECT.md` (§ 4.1.1) | `tests/e2e/crawler.ts` | All 7 faculties reachable (`/natural-sciences`, `/physical-sciences`, `/management-sciences`, `/social-sciences`, `/arts-languages`, `/faculty-of-education`, `/law`) |
| **Tier 2** | Department Reachability | 31 Departments Directory | `PROJECT.md` (§ 4.1.2) | `tests/e2e/crawler.ts` | All 31 departments return HTTP 200 with department profile, chair/programs |
| **Tier 2** | Asset & Link Integrity | Broken Links & Broken Images Scan | `ORIGINAL_REQUEST.md` (R4.2) | `tests/e2e/crawler.ts` | Zero broken internal links (`<a>` tags) or internal images (`<img>` tags) |
| **Tier 3** | Admin Workflow | Staff Authentication at `/admin` | `ORIGINAL_REQUEST.md` (R2) | `tests/e2e/admin.spec.ts` | Staff login succeeds via JWT/session cookie; handles initial bootstrap |
| **Tier 3** | Content Lifecycle | Page Creation & Publishing | `ORIGINAL_REQUEST.md` (R2) | `tests/e2e/admin.spec.ts` | Authenticated staff creates and publishes Page (`_status: 'published'`) |
| **Tier 3** | Media Ingestion | Media Asset Upload | `ORIGINAL_REQUEST.md` (R2) | `tests/e2e/admin.spec.ts` | Multipart upload of image to `/api/media`, DB record created with URL |
| **Tier 3** | Dynamic ISR | Zero-Rebuild Instant Public Reflection | `PROJECT.md` (Feature 8) | `tests/e2e/admin.spec.ts` | Newly published page and news post appear live on public URLs immediately with HTTP 200 and full content |
| **Tier 3** | Navigation Global | Menu Item Update & Reflection | `ORIGINAL_REQUEST.md` (R2) | `tests/e2e/admin.spec.ts` | Navigation global updated via API; changes appear immediately on homepage layout |
| **Tier 4** | Responsive Layout | Multi-Viewport Layout (375, 768, 1440) | `ORIGINAL_REQUEST.md` (R3, R4.4) | `tests/e2e/responsive.ts` | Validates mobile (375px), tablet (768px), desktop (1440px) on Home, Dept, News, and Imported pages |
| **Tier 4** | Layout Safety | Zero Horizontal Overflow | `ORIGINAL_REQUEST.md` (R3) | `tests/e2e/responsive.ts` | `scrollWidth <= clientWidth`, `body { overflow-x: hidden }`, responsive images and containers |
| **Tier 4** | Mobile Navigation | Mobile Drawer & Toggle Interaction | `ORIGINAL_REQUEST.md` (R3) | `tests/e2e/responsive.ts` | Burger button toggles `.mobile-nav.open`, locks body scroll, handles drawer navigation |
| **Tier 4** | A11y & Motion | Reduced Motion Compliance | `ORIGINAL_REQUEST.md` (R3) | `tests/e2e/responsive.ts` | Validates `prefers-reduced-motion` CSS overrides and zero layout shifts |

---

## 3. Test Architecture & Directory Structure

```
salu-website/
├── tests/
│   └── e2e/
│       ├── crawler.ts         # Tier 2: 2022 Archive Crawler & Broken Asset Scanner
│       ├── admin.spec.ts      # Tier 3: Admin Auth, CRUD, Image Upload, Zero-Rebuild ISR
│       ├── admin-test.ts      # Tier 3: CLI alias entry point
│       ├── responsive.ts      # Tier 4: Multi-Viewport Responsive & Navigation Drawer Test
│       └── run-all.ts         # Master Test Runner orchestrating all tiers
├── TEST_INFRA.md              # Test Architecture and Specification (This file)
└── TEST_READY.md              # Test Execution Guide and Verification Checklist
```

### 3.1 Design Patterns & Key Components

1. **Crawler Engine (`tests/e2e/crawler.ts`)**:
   - Parses `salu_2022_pages.csv` from default environment paths or `PAGES_CSV`.
   - Filters out external subdomains (`Subdomain: ...`) and isolates main-site 2022 routes.
   - Concurrently crawls paths (default batch concurrency: 6) with request timeout guard (10s).
   - Uses JSDOM to inspect parsed DOM trees for `<title>`, body length, links, and images.
   - Calculates pass rates and verifies exact reachability for 7 faculties and 31 departments.

2. **Admin & ISR Engine (`tests/e2e/admin.spec.ts`)**:
   - Programmatically handles authentication with fallback credentials and first-user bootstrap.
   - Posts multipart media payload to test binary asset handling.
   - Publishes test Page and News post with unique timestamp identifiers.
   - Requests public URLs using `cache: 'no-store'` to verify zero-rebuild on-demand cache revalidation.
   - Modifies and verifies the Navigation global.
   - Safely cleans up all generated database records and restores navigation items.

3. **Responsive Engine (`tests/e2e/responsive.ts`)**:
   - Defines standard responsive checkpoints: Mobile (375px), Tablet (768px), Desktop (1440px).
   - If Playwright Chromium is present: launches headless browser, resizes viewport, verifies `scrollWidth`, triggers mobile menu interactions, and saves optional screenshots.
   - If Playwright is absent: executes DOM contract analysis using JSDOM and stylesheet inspection to guarantee responsive rules, burger toggles, and image containment.

4. **Master Runner (`tests/e2e/run-all.ts`)**:
   - Sequentially executes all tiers.
   - Supports `--bail` flag for immediate halt on failure.
   - Supports `--suite=<name>` to execute targeted subsets.
   - Aggregates metrics and returns exit code `0` on full success, `1` on failure.

---

## 4. Coverage Thresholds & Quality Gates

The test harness enforces the following strict non-negotiable pass criteria:

| Metric | Target Threshold | Rationale |
|---|---|---|
| **2022 Recoverable Pages Pass Rate** | **>= 95.0%** | Mandated by user request R4.2 |
| **Faculties Reachable** | **7 / 7 (100%)** | All 7 university faculties must be accessible |
| **Departments Reachable** | **31 / 31 (100%)** | All 31 university academic departments must be accessible |
| **Broken Internal Links** | **0** | No internal dead links on crawled pages |
| **Broken Internal Images** | **0** | No missing internal images on crawled pages |
| **Admin Login & CRUD** | **100% Pass** | Staff must be able to log in, create, and edit content |
| **Zero-Rebuild Reflection** | **100% Pass** | Newly published content must appear on public site without restart |
| **Responsive Viewports** | **100% Pass** | All 4 key pages must adapt to 375px, 768px, and 1440px |
| **Horizontal Overflow** | **0 Violations** | Zero horizontal scrollbars or overflow at 375px/768px |

---

## 5. Execution Protocols

### 5.1 Prerequisites
- Next.js application server running locally:
  ```powershell
  npm.cmd run dev
  # or
  npm.cmd run build; npm.cmd run start
  ```
- Target base URL: `http://localhost:3000` (or configured via `BASE_URL`).

### 5.2 Commands

```powershell
# 1. Run Complete Master Test Suite (All Tiers)
npx.cmd tsx tests/e2e/run-all.ts

# 2. Run Only 2022 Archive Crawler Suite
npx.cmd tsx tests/e2e/crawler.ts

# 3. Run Only Admin Panel & Dynamic Publishing Suite
npx.cmd tsx tests/e2e/admin.spec.ts

# 4. Run Only Multi-Viewport Responsive Suite
npx.cmd tsx tests/e2e/responsive.ts

# 5. Run with custom base URL or verbose logging
npx.cmd tsx tests/e2e/run-all.ts --url=http://localhost:3000 --verbose
```
