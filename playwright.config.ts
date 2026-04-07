import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3333",
    headless: true,
  },
  webServer: {
    command: "node dist/index.js",
    port: 3333,
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
