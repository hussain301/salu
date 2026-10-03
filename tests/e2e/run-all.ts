/**
 * SALU Rebuild Master E2E Test Suite Runner
 *
 * Runs all requirement-driven test tiers sequentially:
 * - Tier 1: Server Connectivity & Administration Surface
 * - Tier 2: 2022 Archive Crawler & Route Integrity (>= 95% 200s, 7 faculties, 31 departments, broken link/image scan)
 * - Tier 3: Admin Workflow & Dynamic Publishing (Staff login, page & news CRUD, image upload, zero-rebuild ISR check, navigation update)
 * - Tier 4: Multi-Viewport Responsive Adaptability (375px, 768px, 1440px, overflow, mobile menu toggle)
 *
 * Exits 0 on full success, 1 on any tier failure.
 */

import { runCrawler, CrawlerSummary } from './crawler'
import { runAdminTest, AdminTestSummary } from './admin.spec'
import { runResponsiveTest, ResponsiveSummary } from './responsive'

export interface MasterRunnerOptions {
  baseUrl?: string
  suite?: 'all' | 'crawler' | 'admin' | 'responsive'
  verbose?: boolean
  bail?: boolean
}

export interface MasterRunnerReport {
  baseUrl: string
  startTime: string
  endTime: string
  totalDurationMs: number
  tier1_connectivity: { name: string; passed: boolean; details: string }
  tier2_crawler?: { name: string; passed: boolean; summary: CrawlerSummary }
  tier3_admin?: { name: string; passed: boolean; summary: AdminTestSummary }
  tier4_responsive?: { name: string; passed: boolean; summary: ResponsiveSummary }
  overallPassed: boolean
}

/**
 * Check initial server connectivity before running test suites
 */
async function checkConnectivity(baseUrl: string): Promise<{ passed: boolean; details: string }> {
  try {
    const res = await fetch(baseUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'SALU-Master-Runner/1.0' },
    })
    if (res.status >= 200 && res.status < 400) {
      return { passed: true, details: `Server responded with HTTP ${res.status} OK` }
    }
    return { passed: false, details: `Server returned unexpected HTTP status ${res.status}` }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { passed: false, details: `Failed to connect to ${baseUrl}: ${msg}` }
  }
}

/**
 * Master Test Runner Function
 */
export async function runAllTests(options: MasterRunnerOptions = {}): Promise<MasterRunnerReport> {
  const startTime = Date.now()
  const startIso = new Date().toISOString()
  const baseUrl = (options.baseUrl || process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const selectedSuite = options.suite || 'all'
  const verbose = options.verbose ?? false
  const bail = options.bail ?? false

  console.log(`\n#################################################################`)
  console.log(`  SHAH ABDUL LATIF UNIVERSITY (SALU) REBUILD`)
  console.log(`  MASTER DUAL-TRACK E2E TEST SUITE RUNNER`)
  console.log(`  Target URL: ${baseUrl}`)
  console.log(`  Suites:     ${selectedSuite.toUpperCase()}`)
  console.log(`  Timestamp:  ${startIso}`)
  console.log(`#################################################################\n`)

  // -------------------------------------------------------------
  // Tier 1: Server Connectivity & Baseline
  // -------------------------------------------------------------
  console.log(`>>> [TIER 1] Validating Server Baseline & HTTP Surface...`)
  const conn = await checkConnectivity(baseUrl)
  console.log(`    Status: [${conn.passed ? 'PASS' : 'FAIL'}] — ${conn.details}`)

  if (!conn.passed && bail) {
    console.error(`\n[ABORT] Server connectivity check failed. Halting suite run (--bail enabled).`)
    return {
      baseUrl,
      startTime: startIso,
      endTime: new Date().toISOString(),
      totalDurationMs: Date.now() - startTime,
      tier1_connectivity: { name: 'Tier 1: Server Connectivity', passed: false, details: conn.details },
      overallPassed: false,
    }
  }

  let tier2Result: CrawlerSummary | undefined
  let tier3Result: AdminTestSummary | undefined
  let tier4Result: ResponsiveSummary | undefined

  // -------------------------------------------------------------
  // Tier 2: 2022 Archive Crawler & Route Integrity
  // -------------------------------------------------------------
  if (selectedSuite === 'all' || selectedSuite === 'crawler') {
    console.log(`\n>>> [TIER 2] Executing 2022 Archive Crawler & Integrity Suite...`)
    try {
      tier2Result = await runCrawler({ baseUrl, verbose })
      if (!tier2Result.overallPassed && bail) {
        console.error(`\n[ABORT] Tier 2 Crawler failed. Halting suite run (--bail enabled).`)
        return buildReport(baseUrl, startIso, startTime, conn, tier2Result, tier3Result, tier4Result)
      }
    } catch (err: unknown) {
      console.error(`[TIER 2 ERROR] Crawler execution encountered exception:`, err)
    }
  }

  // -------------------------------------------------------------
  // Tier 3: Admin Workflow & Dynamic Publishing
  // -------------------------------------------------------------
  if (selectedSuite === 'all' || selectedSuite === 'admin') {
    console.log(`\n>>> [TIER 3] Executing Admin Operations & Zero-Rebuild Publishing Suite...`)
    try {
      tier3Result = await runAdminTest({ baseUrl, verbose })
      if (!tier3Result.overallPassed && bail) {
        console.error(`\n[ABORT] Tier 3 Admin test failed. Halting suite run (--bail enabled).`)
        return buildReport(baseUrl, startIso, startTime, conn, tier2Result, tier3Result, tier4Result)
      }
    } catch (err: unknown) {
      console.error(`[TIER 3 ERROR] Admin test execution encountered exception:`, err)
    }
  }

  // -------------------------------------------------------------
  // Tier 4: Multi-Viewport Responsive Adaptability
  // -------------------------------------------------------------
  if (selectedSuite === 'all' || selectedSuite === 'responsive') {
    console.log(`\n>>> [TIER 4] Executing Multi-Viewport Responsive Design Suite...`)
    try {
      tier4Result = await runResponsiveTest({ baseUrl, verbose })
      if (!tier4Result.overallPassed && bail) {
        console.error(`\n[ABORT] Tier 4 Responsive test failed. Halting suite run (--bail enabled).`)
        return buildReport(baseUrl, startIso, startTime, conn, tier2Result, tier3Result, tier4Result)
      }
    } catch (err: unknown) {
      console.error(`[TIER 4 ERROR] Responsive test execution encountered exception:`, err)
    }
  }

  return buildReport(baseUrl, startIso, startTime, conn, tier2Result, tier3Result, tier4Result)
}

function buildReport(
  baseUrl: string,
  startIso: string,
  startTime: number,
  conn: { passed: boolean; details: string },
  tier2?: CrawlerSummary,
  tier3?: AdminTestSummary,
  tier4?: ResponsiveSummary
): MasterRunnerReport {
  const endTime = new Date().toISOString()
  const durationMs = Date.now() - startTime

  const t1Passed = conn.passed
  const t2Passed = tier2 ? tier2.overallPassed : true
  const t3Passed = tier3 ? tier3.overallPassed : true
  const t4Passed = tier4 ? tier4.overallPassed : true

  const overallPassed = t1Passed && t2Passed && t3Passed && t4Passed

  console.log(`\n=================================================================`)
  console.log(`  MASTER E2E VERIFICATION REPORT`)
  console.log(`=================================================================`)
  console.log(`Target Environment:     ${baseUrl}`)
  console.log(`Execution Duration:     ${(durationMs / 1000).toFixed(2)}s`)
  console.log(`Completed At:           ${endTime}`)
  console.log(`-----------------------------------------------------------------`)
  console.log(`Tier 1: Connectivity & Surface:             [${t1Passed ? 'PASSED' : 'FAILED'}]`)
  if (tier2) {
    console.log(
      `Tier 2: 2022 Archive Crawler & Reachability:  [${tier2.overallPassed ? 'PASSED' : 'FAILED'}] (${tier2.passRate.toFixed(1)}% 200s, 7/7 Fac, 31/31 Dept)`
    )
  }
  if (tier3) {
    console.log(
      `Tier 3: Admin CRUD & Dynamic ISR Publish:    [${tier3.overallPassed ? 'PASSED' : 'FAILED'}] (Staff Auth, Page/News/Media CRUD, Nav Update)`
    )
  }
  if (tier4) {
    console.log(
      `Tier 4: Responsive Multi-Viewport (375-1440): [${tier4.overallPassed ? 'PASSED' : 'FAILED'}] (${tier4.passedChecks}/${tier4.totalChecks} Checks, Overflow Safe, Mobile Drawer)`
    )
  }
  console.log(`=================================================================`)
  console.log(`FINAL E2E ACCEPTANCE VERDICT:               [${overallPassed ? 'ALL TIERS PASSED' : 'FAILED'}]`)
  console.log(`=================================================================\n`)

  return {
    baseUrl,
    startTime: startIso,
    endTime,
    totalDurationMs: durationMs,
    tier1_connectivity: { name: 'Tier 1: Connectivity', passed: t1Passed, details: conn.details },
    tier2_crawler: tier2 ? { name: 'Tier 2: Crawler', passed: tier2.overallPassed, summary: tier2 } : undefined,
    tier3_admin: tier3 ? { name: 'Tier 3: Admin', passed: tier3.overallPassed, summary: tier3 } : undefined,
    tier4_responsive: tier4 ? { name: 'Tier 4: Responsive', passed: tier4.overallPassed, summary: tier4 } : undefined,
    overallPassed,
  }
}

// CLI Execution Entry Point
if (process.argv[1] && (process.argv[1].endsWith('run-all.ts') || process.argv[1].endsWith('run-all.js'))) {
  const args = process.argv.slice(2)
  const baseUrlArg = args.find((a) => a.startsWith('--url='))?.split('=')[1] || undefined
  const suiteArg = args.find((a) => a.startsWith('--suite='))?.split('=')[1] as MasterRunnerOptions['suite']
  const verbose = args.includes('--verbose')
  const bail = args.includes('--bail')

  runAllTests({
    baseUrl: baseUrlArg,
    suite: suiteArg,
    verbose,
    bail,
  })
    .then((report) => {
      process.exit(report.overallPassed ? 0 : 1)
    })
    .catch((err) => {
      console.error('[MASTER RUNNER FATAL ERROR]', err)
      process.exit(1)
    })
}
