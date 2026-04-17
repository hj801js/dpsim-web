import { test, expect } from "@playwright/test";

// Happy-path: default wscc9 form → submit → detail page renders chart +
// status transitions to done, no errors surfaced.
//
// Requires the backend stack running (make up from repo root). The
// Next dev server is spawned by playwright.config.ts webServer.
test("submit wscc9 DP 1ms/1000ms, detail shows chart and done status", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /submit a simulation/i }))
    .toBeVisible();

  // Defaults already wscc9 / DP / MNA / 1 / 1000 — submit straight.
  await page.getByRole("button", { name: /^submit$/i }).click();

  // Success message contains the new simulation id.
  const submittedMsg = page.getByText(/submitted\s*—\s*id=\d+/i);
  await expect(submittedMsg).toBeVisible({ timeout: 15_000 });
  const text = (await submittedMsg.textContent()) ?? "";
  const match = text.match(/id=(\d+)/);
  expect(match, `id not in "${text}"`).not.toBeNull();
  const simId = match![1];

  // Navigate to the detail page and wait for the chart to render.
  await page.goto(`/simulations/${simId}`);
  await expect(page.getByRole("heading", { name: `Simulation #${simId}` }))
    .toBeVisible();

  // Status starts "running…" or "queued…" and transitions to "done" once
  // the worker has uploaded the CSV. Give the worker up to 45s.
  await expect(page.getByText("done", { exact: true })).toBeVisible({
    timeout: 45_000,
  });

  // Chart section renders. Pick a stable-ish anchor: the view-mode radiogroup.
  await expect(page.getByRole("radiogroup", { name: /view mode/i }))
    .toBeVisible();

  // No failure banner.
  await expect(page.getByText("Simulation failed")).toHaveCount(0);
});
