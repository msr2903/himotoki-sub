/** ESLint 8 config. `pnpm lint` must pass with no errors; warnings flag inherited code to tidy over time. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true, webextensions: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  settings: { react: { version: "detect" } },
  ignorePatterns: ["dist/", "node_modules/", "public/", "*.d.ts"],
  rules: {
    // TypeScript already checks props and undefined names.
    "react/prop-types": "off",
    "no-undef": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "off",
    // Parsers loop until an explicit break.
    "no-constant-condition": ["error", { checkLoops: false }],
    // Japanese text handling legitimately matches full-width spaces in strings and regexes.
    "no-irregular-whitespace": ["error", { skipStrings: true, skipRegExps: true, skipTemplates: true, skipComments: true }],
  },
};
