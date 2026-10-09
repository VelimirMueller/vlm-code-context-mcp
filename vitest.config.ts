import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Never let the suite write into the developer's real overdrive session
    // log; test/sessionlog.test.ts re-enables it against a temp dir.
    env: { OVERDRIVE_SESSION_LOG: "0", OVERDRIVE_FLAIR: "0" },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
    },
  },
});
