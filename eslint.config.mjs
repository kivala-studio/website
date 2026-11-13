import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // src/domain is pure TypeScript: no framework, backend SDK or other layer imports.
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*", "@supabase/*", "server-only"],
              message: "src/domain must stay pure TypeScript.",
            },
          ],
        },
      ],
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/domain",
              from: "./src",
              except: ["./domain"],
              message: "src/domain may import only from src/domain.",
            },
          ],
        },
      ],
    },
  },
  {
    // Money, prices, thresholds and ledger values stay Decimal: no conversion to binary floats in the domain.
    files: ["src/domain/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-globals": ["error", { name: "parseFloat", message: "Use new Decimal(text) for financial values." }],
      "no-restricted-properties": [
        "error",
        { object: "Number", property: "parseFloat", message: "Use new Decimal(text) for financial values." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name=/^to(Number|NearestNumber)$/]",
          message: "Keep financial values as Decimal; convert only at the UI edge (e.g. chart coordinates).",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**", ".lighthouseci/**", "public/statement/**"]),
]);

export default eslintConfig;
