# TEST_READY — Dual-Track E2E Test Suite (Milestone M-TEST)

**Document Status:** PUBLISHED & READY FOR EXECUTION  
**Project:** Shah Abdul Latif University (SALU) Website Rebuild  
**Milestone:** M-TEST (Dual-Track Requirement-Driven E2E Test Suite)  
**Author:** test_writer_e2e_1  
**Execution Engine:** TypeScript (`tsx`) / Node.js 20+ / Windows Server & Developer Workstation  

---

## 1. Test Suite Execution Command

To execute the entire automated test suite across all 4 tiers against the running server (`http://localhost:3000`):

```powershell
npx.cmd tsx tests/e2e/run-all.ts
```

### Targeted Suite Commands

```powershell
# Tier 2: 2022 Archive Crawler & Link/Image Integrity
npx.cmd tsx tests/e2e/crawler.ts

# Tier 3: Admin Authentication, CRUD & Zero-Rebuild Dynamic Publishing
npx.cmd tsx tests/e2e/admin.spec.ts

# Tier 4: Multi-Viewport Responsive Layout & Navigation Drawer
npx.cmd tsx tests/e2e/responsive.ts

# Run with custom server URL or verbose output
npx.cmd tsx tests/e2e/run-all.ts --url=http://localhost:3000 --verbose
```

---

## 2. Test Files Inventory

| File Path | Purpose | Key Assertions |
|---|---|---|
| `tests/e2e/crawler.ts` | Opaque-box crawler against running server reading `salu_2022_pages.csv` | >= 95% recoverable pages return HTTP 200 with `<title>` & body text; all 7 faculties and 31 departments reachable; 0 broken internal links/images |
| `tests/e2e/admin.spec.ts` | Automated Admin panel & instant ISR publishing test | Staff login at `/admin`; creates & publishes Page; uploads Media image; creates & publishes News post; asserts instant public reflection without rebuild; updates Navigation global; cleans up artifacts |
| `tests/e2e/admin-test.ts` | CLI entry point alias for admin suite | Re-exports and runs `runAdminTest` |
| `tests/e2e/responsive.ts` | Multi-viewport responsive layout & navigation drawer test | Evaluates Home, Dept, News, and Imported pages at 375px, 768px, 1440px; asserts 0 horizontal overflow; asserts hamburger toggle & mobile drawer open/close/scroll-lock |
| `tests/e2e/run-all.ts` | Master Test Runner | Runs Tiers 1-4 sequentially; outputs aggregated summary table; exits 0 on complete pass, 1 on failure |
| `TEST_INFRA.md` | Infrastructure & Architecture Specification | Documents test philosophy, feature inventory, coverage thresholds, and failure recovery protocols |
| `TEST_READY.md` | Test Execution Guide & Checklist | Published milestone acceptance guide (this document) |

---

## 3. Tier Acceptance Checklist

### Tier 1: Server Baseline & Administrative Surface
- [x] Next.js HTTP server responds on port 3000 with valid HTTP status (200/308).
- [x] Admin endpoint `/admin` is accessible and responds to HTTP requests.
- [x] API endpoints `/api/users/login`, `/api/pages`, `/api/news`, `/api/media`, `/api/globals/navigation` are mounted.

### Tier 2: 2022 Archive Crawler & Route Integrity
- [x] Reads `salu_2022_pages.csv` and parses main-site 2022 URLs.
- [x] >= 95% of recoverable pages return HTTP 200 with valid `<title>` and non-trivial body text (>= 40 characters).
- [x] All 7 Faculties reachable:
  - [x] Natural Sciences (`/natural-sciences/`)
  - [x] Physical Sciences (`/physical-sciences/`)
  - [x] Management Sciences (`/management-sciences/`)
  - [x] Social Sciences (`/social-sciences/`)
  - [x] Arts & Languages (`/arts-languages/`)
  - [x] Faculty of Education (`/faculty-of-education/`)
  - [x] Faculty of Law (`/law/`)
- [x] All 31 Departments reachable:
  - [x] Biochemistry (`/biochemistry/`)
  - [x] Botany (`/botany/`)
  - [x] Chemistry (`/chemistry/`)
  - [x] Microbiology (`/microbiology/`)
  - [x] Pharmacy (`/pharmacy/`)
  - [x] Zoology (`/zoology/`)
  - [x] Archaeology (`/archaeology/`)
  - [x] Computer Science (`/computer-science-2/`)
  - [x] Geography (`/geography/`)
  - [x] Mathematics (`/mathematics/`)
  - [x] Physics and Electronics (`/physics-and-electronics/`)
  - [x] Statistics (`/statistics/`)
  - [x] Business Administration (`/business-administration/`)
  - [x] Commerce (`/commerce/`)
  - [x] Public Administration (`/public-administration/`)
  - [x] Economics (`/economics/`)
  - [x] Gender Studies (`/gender-studies/`)
  - [x] International Relations (`/international-relations/`)
  - [x] Islamic Studies (`/islamic-studies/`)
  - [x] Media and Communication (`/media-and-communication/`)
  - [x] Pakistan Studies (`/pakistan-studies/`)
  - [x] Physical Education (`/physical-education/`)
  - [x] Political Science (`/political-science/`)
  - [x] Sociology (`/sociology/`)
  - [x] English Language and Literature (`/english-language-and-literature/`)
  - [x] Department of Sindhi (`/department-of-sindhi/`)
  - [x] Department of Urdu (`/department-of-urdu/`)
  - [x] Foreign Languages (`/foreign-languages/`)
  - [x] Teacher Education (`/teacher-education/`)
  - [x] Special Education (`/special-education/`)
  - [x] Law (`/law/`)
- [x] Scans for broken internal links (`<a>`) and images (`<img>`) with 0 failure tolerance.

### Tier 3: Admin Workflow & Dynamic Publishing (Zero Rebuild)
- [x] Programmatically authenticates staff user via JWT/session cookie.
- [x] Creates and publishes a test page via Payload API (`_status: 'published'`).
- [x] Uploads binary image asset to Media collection (`/api/media`).
- [x] Creates and publishes a test news post referencing the uploaded image.
- [x] Requests public URLs immediately and verifies both appear live without any server rebuild (`revalidatePath` hook).
- [x] Updates a navigation menu item in the Navigation global and verifies presence on public layout.
- [x] Executes cleanup removing all created test documents and restoring original navigation.

### Tier 4: Multi-Viewport Responsive Adaptability
- [x] Evaluates Home (`/`), Department (`/chemistry`), News (`/news`), and Imported (`/about`) pages.
- [x] Tests across Mobile (375px), Tablet (768px), and Desktop (1440px) viewports.
- [x] Verifies zero horizontal overflow (`scrollWidth <= clientWidth`, `body { overflow-x: hidden }`).
- [x] Verifies mobile navigation drawer interactions (hamburger toggle `.active`, `.mobile-nav.open`, body scroll lock `overflow: hidden`, drawer close).
- [x] Verifies desktop navigation visibility at 1440px.

---

## 4. Verification Protocol for Downstream Workers & Orchestrator

1. **Start the local server**:
   Ensure the server is running on port 3000 (`npm.cmd run dev` or `npm.cmd run start`).
2. **Execute the runner**:
   Run `npx.cmd tsx tests/e2e/run-all.ts`.
3. **Check exit code**:
   Exit code `0` confirms 100% compliance across all 4 tiers.
   Exit code `1` prints a detailed diagnosis of the failing checkpoint.
