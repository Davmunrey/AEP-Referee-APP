import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke");

test("authenticated dashboard fits 14-inch viewport", async ({ page }) => {
  await page.goto("/sign-in");

  await page.getByPlaceholder("Email").fill(email!);
  await page.getByPlaceholder("Contraseña").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Radar operativo")).toBeVisible();
  await expect(page.getByText("Previsión de cobertura")).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
});
