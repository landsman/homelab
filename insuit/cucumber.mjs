export default {
  paths: ['tests/bdd/features/**/*.feature'],
  // Bun runs TypeScript as it is, so the steps need no transpiler; run with
  // --bun (package.json), not under Node, it also resolves tsconfig's `@`.
  import: ['tests/bdd/support/**/*.ts', 'tests/bdd/steps/**/*.ts'],
  // The HTML report is one self-contained file; CI keeps it as an artifact.
  format: [process.env.CI ? 'progress' : 'progress-bar', 'summary', 'html:reports/cucumber.html'],
  formatOptions: { snippetInterface: 'async-await' },
}
