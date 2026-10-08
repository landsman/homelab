export default {
  paths: ["tests/bdd/features/**/*.feature"],
  // Bun runs TypeScript as it is, so the steps need no transpiler; run with
  // --bun (package.json), not under Node, it also resolves tsconfig's `@`.
  import: ["tests/bdd/support/**/*.ts", "tests/bdd/steps/**/*.ts"],
  format: [process.env.CI ? "progress" : "progress-bar", "summary"],
  formatOptions: { snippetInterface: "async-await" },
};
