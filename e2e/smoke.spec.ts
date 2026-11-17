import { expect, test } from "@playwright/test";

test("unauthenticated root redirects to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.env).toMatch(/configured|partial/);
  expect(body.correlationId).toBeTruthy();
});
