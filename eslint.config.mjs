import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // API responses and better-sqlite3 rows are intentionally decoded at runtime.
    // Keep the rest of the TypeScript rules strict without forcing unsafe fake types
    // at these dynamic transport boundaries.
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "node_modules/**", ".uv-cache/**", "**/.venv/**", "next-env.d.ts", "brand/**/*.cjs"]),
]);

export default config;
