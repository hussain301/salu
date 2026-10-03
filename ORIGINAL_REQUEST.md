# Original User Request

## 2026-10-03T10:41:58Z

Use multiple agents, at least 10, to speed up the work. Finish rebuilding the website of Shah Abdul Latif University Khairpur (salu.edu.pk). The new site must be modern, heavily animated and fully responsive, must have an admin panel where university staff upload and edit all content, and must contain every page of the original 2022 site recovered from the Wayback Machine. It is for production use.

Working directory: c:\Users\Hussain\Desktop\vids-access\salu-website
Integrity mode: development

## Context (existing work — continue it, don't restart)
- Stack already chosen and approved by the user: Next.js 16 + Payload CMS 3.90.2 + SQLite, admin at `/admin`. **WordPress is explicitly rejected.** Target host: the university's own Windows Server / IIS.
- Already written: Payload config, collections (Pages, News, Faculties, Departments, Documents, Media, Users) and globals (Homepage, Navigation, Footer, Settings), admin routes, and a frontend (layout, header mega menu, footer, home, catch-all resolving old 2022 URLs, news, faculties, GSAP/Lenis animation engine, CSS). None of it has been compiled or run yet.
- Scraper: `scraper/scrape.mjs`, output in `scraper/data/` (pages.json, media.json, media/). A full scrape is **currently running** in the background, writing to `scraper/scrape.log`. It finds about 270 pages and 822 media files. `scripts/import.ts` (the CMS importer) is not written yet.
- Reference analysis: `C:\Users\Hussain\.gemini\antigravity\brain\a7b36940-4043-42c9-ba73-77944efbc7b9\salu_site_analysis.md` (2022 structure: 7 faculties, 31 departments, ORIC, QEC, PGS, chairs, news, etc.). The URL list is in `salu_2022_pages.csv` in the same folder.
- Windows notes: use `npm.cmd`, not `npm` (PowerShell blocks npm.ps1). Node v25 is installed.

## Requirements

### R1. Complete content migration
Every HTML page of the 2022 site in the CSV is imported into the CMS:
- the 7 faculties, 31 departments, all about/admissions/exam/research/QEC/ORIC/PGS/chair pages, and all news posts;
- images and PDFs are imported into the media library.

Each page stays reachable at its original 2022 path (e.g. `/chemistry/`, `/news/<slug>/`). Pages the archive cannot recover are listed in a report with the reason.

### R2. Admin panel
Staff can log in at `/admin` and create, edit, publish and delete pages, news, departments (members, programs), faculties, downloads/tenders, the main menu, the footer and homepage sections, and can upload images and PDFs. Changes appear on the public site without a rebuild.

### R3. Modern animated, responsive frontend
Every public page uses a polished modern university design with rich animations (scroll reveals, animated hero, counters, hover effects, smooth scroll, page transitions) and respects `prefers-reduced-motion`. Layouts work from 360px phones to large desktops, including a working mobile menu. Imported 2022 content renders cleanly.

### R4. Production build and IIS deployment
`npm.cmd run build` succeeds with no errors. Provide a README and the needed config files so the site runs on Windows Server behind IIS, including:
- the database setup or migration step;
- running the app as a service;
- backups of the database and media.

## Acceptance Criteria

### Build & run
- [ ] `npm.cmd run build` exits 0; `npm.cmd run start` serves the site, and `/admin` loads the login screen.
- [ ] TypeScript type-check passes.

### Content (programmatic)
- [ ] A script crawls every 2022 page path from the CSV against the running site. At least 95% of recoverable pages return HTTP 200 with their title and non-trivial body text. The rest appear in the unrecoverable report.
- [ ] All 7 faculties and 31 departments have pages; the news index lists all imported posts.
- [ ] No broken internal links or images on a crawl of the site (excluding external archive links).

### Admin (programmatic e2e)
- [ ] An automated browser test logs in to `/admin`, creates a page and a news post with an uploaded image, publishes both, and verifies they appear on the public site. It then edits the menu and sees the change.

### Design & responsiveness (agent-as-judge + screenshots)
- [ ] Screenshots of home, a department, a news post and a long imported page at 375px, 768px and 1440px show:
  - no horizontal overflow;
  - a working mobile menu;
  - a readable layout.

  An independent reviewer scores each against a rubric (modern look, animation presence, consistency) and all pass.
- [ ] Lighthouse accessibility ≥ 90 and performance ≥ 70 on the home page (desktop).

## 2026-10-03T11:59:59Z

The server was restarted. Please resume orchestrating the final milestone (production build, tests, and victory audit). All progress on disk is intact: data/salu.db is 4.04 MB with all 7 faculties, 31 departments, 137 news articles, and pages imported; media has 2,318 files; M1, M2, M3, M5, and M-TEST are complete. Finish the final verification and victory audit.

## 2026-10-03T13:35:06Z

The server was restarted. Please resume the Victory Auditor (1263fe6e-16f1-4ee9-b5a8-fbbb70ff7ca9) to complete the final 3-phase audit and issue the Victory Report. All deliverables, database (4.04 MB), media (2,318 files), and standalone build are complete and verified clean by orchestrator and auditor_final.
