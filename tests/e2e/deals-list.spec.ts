import { expect, test } from "@playwright/test";

import { devLogin } from "./support/auth";

test("permite seleccionar contactos visibles en la lista de negocios", async ({
  page,
}) => {
  await devLogin(page);
  await page.goto("/deals?view=list");
  await expect(
    page.getByRole("heading", { level: 2, name: "Negocios" }),
  ).toBeVisible();

  const emptyState = page.getByText(/Aún no tienes negocios|Sin resultados/);
  if (await emptyState.isVisible().catch(() => false)) {
    await expect(emptyState).toBeVisible();
    return;
  }

  const selectAll = page.getByLabel("Seleccionar todos los contactos visibles");
  await expect(selectAll).toBeVisible();

  if (!(await selectAll.isEnabled())) {
    await expect(selectAll).toBeDisabled();
    return;
  }

  await selectAll.click();
  await expect(page.getByText(/contactos? seleccionados?/)).toBeVisible();
  await expect(
    page.getByLabel("Añadir contactos seleccionados a secuencia"),
  ).toBeVisible();
});
