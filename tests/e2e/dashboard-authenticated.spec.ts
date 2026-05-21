import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke");
test.skip(
  !supabaseUrl || !supabaseAnonKey,
  "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run authenticated smoke",
);

test.beforeAll(async () => {
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Supabase auth preflight timed out")), 25_000);
  });
  const result = await Promise.race([
    supabase.auth.signInWithPassword({ email: email!, password: password! }),
    timeout,
  ]);

  if (result.error) {
    throw new Error(`Supabase auth preflight failed: ${result.error.message}`);
  }
});

test("authenticated dashboard fits 14-inch viewport", async ({ page }) => {
  await page.goto("/sign-in");

  await page.getByPlaceholder("Email").fill(email!);
  await page.getByPlaceholder("Contraseña").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();

  try {
    await page.waitForURL(/\/$/, { timeout: 30_000 });
  } catch (error) {
    const errorText = await page.getByRole("alert").textContent().catch(() => "");
    const suffix = errorText?.trim() ? `: ${errorText.trim()}` : "";
    throw new Error(`Browser login did not reach dashboard${suffix}`, { cause: error });
  }
  await expect(page.getByText("Radar operativo")).toBeVisible();
  await expect(page.getByText("Previsión de cobertura")).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
});
