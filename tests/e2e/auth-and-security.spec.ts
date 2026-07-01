import { expect, request as playwrightRequest, test } from "@playwright/test";

import { devLogin } from "./support/auth";

test("protege la app privada y permite entrar con login de desarrollo", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Nexo CRM" })).toBeVisible();

  await devLogin(page);
  await expect(page.getByRole("link", { name: /Contactos/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Negocios/ })).toBeVisible();
});

test("sirve cabeceras defensivas globales", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.ok()).toBe(true);

  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
});

test("los exports privados exigen sesión y devuelven CSV autenticado", async ({
  page,
}, testInfo) => {
  const anonymousContext = await playwrightRequest.newContext({
    baseURL: String(testInfo.project.use.baseURL),
  });
  try {
    const anonymous = await anonymousContext.get("/api/contacts/export", {
      maxRedirects: 0,
    });
    expect(anonymous.status()).toBe(307);
    expect(anonymous.headers().location).toContain("/login");
  } finally {
    await anonymousContext.dispose();
  }

  await devLogin(page);
  const response = await page.request.get("/api/contacts/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(await response.text()).toContain("Nombre");
});
