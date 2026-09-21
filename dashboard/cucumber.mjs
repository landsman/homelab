export default {
  paths: ['tests/bdd/features/**/*.feature'],
  // Node 23+ strips the types itself, so the steps need no transpiler.
  import: ['tests/bdd/support/**/*.ts', 'tests/bdd/steps/**/*.ts'],
  format: [process.env.CI ? 'progress' : 'progress-bar', 'summary'],
  formatOptions: { snippetInterface: 'async-await' },
}
