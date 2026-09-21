import type { Reporter, Suite } from '@playwright/test/reporter'

/**
 * Publishes the test count so the on-screen label can say "(3/13)". Only the
 * reporter knows the total, and workers inherit the environment they are
 * spawned with — which happens after onBegin.
 */
class TotalReporter implements Reporter {
  onBegin(_config: unknown, suite: Suite) {
    process.env.E2E_TOTAL = String(suite.allTests().length)
  }
}

export default TotalReporter
