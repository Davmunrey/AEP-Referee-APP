import { expect, test } from "@playwright/test";

test("unauthenticated users land on sign-in", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
});

test("invalid login gives clear error", async ({ page }) => {
  await page.goto("/sign-in");

  await page.getByLabel("Email").fill("invalid@example.com");
  await page.getByLabel("Contraseña").fill("invalid-password");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText(/Email o contraseña|Invalid/i)).toBeVisible();
});
