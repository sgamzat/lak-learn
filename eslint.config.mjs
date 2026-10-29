// ESLint 9, flat config. В Next 16 `next lint` удалён — линтер запускается напрямую: npm run lint
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "parse/**", "coverage/**"])
]);
