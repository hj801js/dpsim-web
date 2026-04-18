import { test, expect } from "@playwright/test";

// P4.1c — login round trip. This suite uses a random email per run so
// multiple iterations don't collide in the in-memory auth store.
//
// Works whether or not the backend requires auth: when DPSIM_AUTH_REQUIRED
// is off the login still succeeds (auth routes always exist); when it's on
// the unauthenticated fetches redirect to /login and this test still passes.
test("signup → auth chip → sign out", async ({ page }) => {
  const unique = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
  const password = "abcdefgh12345";

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  // Toggle into signup mode.
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(
    page.getByRole("heading", { name: /create account/i }),
  ).toBeVisible();

  await page.getByLabel(/^email$/i).fill(unique);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /^sign up$/i }).click();

  // Redirects to /, where the AuthChip shows our email.
  await expect(page).toHaveURL("/");
  await expect(page.getByText(unique)).toBeVisible({ timeout: 5_000 });

  // Sign out returns the "Sign in" link.
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(
    page.getByRole("link", { name: /sign in/i }),
  ).toBeVisible();
});

// Playwright-stable path: a logged-in user can submit a job and see `done`.
// Skipped automatically if the backend isn't on the expected port.
test("logged-in user submits wscc9 and sees done", async ({ page }) => {
  const unique = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;

  await page.goto("/login");
  await page.getByRole("button", { name: /sign up/i }).click();
  await page.getByLabel(/^email$/i).fill(unique);
  await page.getByLabel(/^password/i).fill("abcdefgh12345");
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await expect(page).toHaveURL("/");

  // Defaults wscc9 / DP / MNA / 1 / 1000 — submit straight.
  await page.getByRole("button", { name: /^submit$/i }).click();
  const submittedMsg = page.getByText(/submitted\s*—\s*id=\d+/i);
  await expect(submittedMsg).toBeVisible({ timeout: 15_000 });

  const text = (await submittedMsg.textContent()) ?? "";
  const match = text.match(/id=(\d+)/);
  expect(match, `id not in "${text}"`).not.toBeNull();
  const simId = match![1];

  await page.goto(`/simulations/${simId}`);
  await expect(page.getByText("done", { exact: true })).toBeVisible({
    timeout: 45_000,
  });
});
