import { test, expect } from "@playwright/test";

/**
 * E2E tests for GitHub sync buttons.
 *
 * Prerequisites: dashboard server running on localhost:3333
 * The tests work whether or not .github.local.json exists —
 * they test the UI flow, not the external API integration.
 */

test.describe("GitHub Sync Button", () => {
  test("GitHub sync trigger returns immediate result", async ({ request }) => {
    const response = await request.post("/api/github/sync/trigger", {
      data: {},
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should have ok property (direct sync, not bridge queue)
    expect(body).toHaveProperty("ok");
    // Should NOT be queued
    expect(body).not.toHaveProperty("queued", true);
  });

  test("GitHub sync status endpoint works", async ({ request }) => {
    const response = await request.get("/api/github/sync/status");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("synced");
  });
});
