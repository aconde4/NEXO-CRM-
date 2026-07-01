import { expect, type Page } from "@playwright/test";

export async function devLogin(page: Page) {
  await page.goto("/api/dev-login", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Panel" }),
  ).toBeVisible();
}
