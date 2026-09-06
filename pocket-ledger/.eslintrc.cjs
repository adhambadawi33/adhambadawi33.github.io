/* ESLint 8 config — React + hooks, Vitest globals in tests. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  settings: { react: { version: "detect" } },
  plugins: ["react", "react-hooks"],
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  rules: {
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react/no-unescaped-entities": "off",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-empty": ["error", { allowEmptyCatch: true }],
  },
  overrides: [{ files: ["src/test/**"], globals: { describe: "readonly", it: "readonly", expect: "readonly", vi: "readonly", beforeEach: "readonly", afterEach: "readonly", test: "readonly" } }],
  ignorePatterns: ["dist/", "node_modules/", "public/sw.js"],
};
