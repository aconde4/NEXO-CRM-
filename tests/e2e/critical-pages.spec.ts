import { expect, test } from "@playwright/test";

import { devLogin } from "./support/auth";

const criticalPages = [
  { heading: "Panel", path: "/dashboard" },
  { heading: "Contactos", path: "/contacts" },
  { heading: "Negocios", path: "/deals?view=list" },
  { heading: "Secuencias", path: "/sequences" },
  { heading: "Campañas", path: "/campaigns" },
  { heading: "Analítica", path: "/analytics" },
  { heading: "Ajustes", path: "/settings" },
];

test("renderiza las páginas críticas autenticadas sin errores 5xx", async ({
  page,
}) => {
  await devLogin(page);

  for (const item of criticalPages) {
    const response = await page.goto(item.path);
    expect(response?.status(), item.path).toBeLessThan(500);
    await expect(
      page.getByRole("heading", { level: 2, name: item.heading }),
      item.path,
    ).toBeVisible();
  }
});
