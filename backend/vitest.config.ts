import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 15000,
    // npm run build compiles test files into dist/ too (tsconfig includes
    // all of src) -- without this, Vitest's default glob picks up both the
    // .ts sources and the stale compiled .js copies and runs everything twice.
    include: ["src/**/*.test.ts"],
  },
});
