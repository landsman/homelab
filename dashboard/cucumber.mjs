export default {
  paths: ['tests/bdd/features/**/*.feature'],
  // Node 23+ strips the types itself, so the steps need no transpiler.
  import: ['tests/bdd/support/**/*.ts', 'tests/bdd/steps/**/*.ts'],
  // The HTML report is one self-contained file; CI keeps it as an artifact.
  format: [process.env.CI ? 'progress' : 'progress-bar', 'summary', 'html:reports/cucumber.html'],
  formatOptions: { snippetInterface: 'async-await' },
}
