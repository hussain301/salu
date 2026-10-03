/**
 * Alias entry point for admin workflow test
 */
import { runAdminTest } from './admin.spec'

export * from './admin.spec'

if (process.argv[1] && (process.argv[1].endsWith('admin-test.ts') || process.argv[1].endsWith('admin-test.js'))) {
  const args = process.argv.slice(2)
  const baseUrlArg = args.find((a) => a.startsWith('--url='))?.split('=')[1] || args[0]
  const verbose = args.includes('--verbose')

  runAdminTest({ baseUrl: baseUrlArg, verbose })
    .then((summary) => {
      process.exit(summary.overallPassed ? 0 : 1)
    })
    .catch((err) => {
      console.error('[ADMIN TEST ERROR]', err)
      process.exit(1)
    })
}
