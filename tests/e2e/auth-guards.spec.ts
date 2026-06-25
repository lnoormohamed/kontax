import { expect, test } from "@playwright/test";

test("sync redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/sync");
  await expect(page).toHaveURL(/\/login/);
});
