import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Common convention: underscore-prefixed destructures are intentionally
    // unused (e.g. `const { passwordHash: _ph, ...safe } = user`).
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Data-maintenance scripts (importers/backfills/migrations) are loose
    // one-off tools — keep the app code strict, but don't fail the lint pass
    // on script-only typing (row maps are typed `any` on purpose there).
    files: ["scripts/**/*.ts", "scripts/lib/**/*.ts", "prisma/seed.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "no-console": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
