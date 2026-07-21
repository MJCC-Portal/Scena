import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom (not "node") because the routing tests (src/app/*.test.tsx)
    // render real React Router trees via @testing-library/react — the
    // pure-logic tests (validation/errors/resolveDisplayState) run fine
    // under jsdom too, so one environment covers both.
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/vitest.setup.ts"],
    // @testing-library/react's automatic DOM cleanup between tests
    // (unmounting the previous test's render()) only self-registers when
    // it detects vitest's globals (afterEach etc.) on globalThis — without
    // this, DOM from one test's render() leaks into the next test in the
    // same file, causing order-dependent false results.
    globals: true,
  },
});
