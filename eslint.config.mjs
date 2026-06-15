import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Repo-generated or local scratch output:
    ".codex-logs/**",
    ".codex-tmp/**",
    "artifacts/**",
    "business-central/**/.alpackages/**",
    "business-central/**/build/**",
    "cdk.out/**",
    "wordpress/scripts/**",
  ]),
]);

export default eslintConfig;
