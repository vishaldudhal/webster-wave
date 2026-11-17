import { expect, test } from "@playwright/test";

test("login, modules, multi-channel planning and mobile containment", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.screenshot({ path: "test-results/wave-login.png", fullPage: true });
  await page.locator("#loginName").fill("Vishal Dudhal");
  await page.getByRole("button", { name: /Continue to WAVE/ }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/wave-overview.png", fullPage: true });

  await page.getByRole("button", { name: /New activity/ }).click();
  await page.locator("#activityTitle").fill("Multi-channel launch proof");
  await page.locator("#activityVertical").selectOption("Marketing");
  await page.locator('[data-publish-channel="LinkedIn"]').check();
  await page.locator('[data-publish-channel="YouTube"]').check();
  await page.getByRole("button", { name: "Add activity", exact: true }).click();

  await page.getByRole("button", { name: /Planner/ }).click();
  await expect(page.getByText("Connected execution board")).toBeVisible();
  await expect(page.getByText("Publishing channel", { exact: true })).toHaveCount(6);
  await expect(page.locator('[data-inline-title][value="Multi-channel launch proof"]')).toHaveCount(2);
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem("growth30.planner.v1")));
  const created = data.activities.filter((activity) => activity.title === "Multi-channel launch proof");
  expect(created).toHaveLength(1);
  expect(created[0].publicationTargets.map((target) => target.channel).sort()).toEqual(["LinkedIn", "YouTube"]);
  await page.locator('[data-publish-status][data-channel="LinkedIn"]').last().selectOption("Published");
  const published = await page.evaluate(() => JSON.parse(localStorage.getItem("growth30.planner.v1")).activities.find((activity) => activity.title === "Multi-channel launch proof"));
  expect(published.publicationTargets.find((target) => target.channel === "LinkedIn").status).toBe("Published");
  await page.screenshot({ path: "test-results/wave-planner.png", fullPage: true });

  await page.getByRole("button", { name: /Activities/ }).click();
  await page.locator("#activitySearch").fill("launch proof");
  await expect(page.getByText("Multi-channel launch proof", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Settings/ }).click();
  await expect(page.getByRole("heading", { name: "Data backup & restore" })).toBeVisible();
  await page.locator("#openDataTools").click();
  await expect(page.getByRole("heading", { name: "Backup & restore", exact: true })).toBeVisible();
  await page.locator("#overlay").getByRole("button", { name: "×" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.screenshot({ path: "test-results/wave-mobile.png", fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("version 3 plans migrate without losing activities", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("webster.wave.session.v1", "active");
    localStorage.setItem("growth30.planner.v1", JSON.stringify({ schemaVersion: 3, activities: [{ id: "legacy", title: "Legacy activity", date: "2026-11-17", vertical: "Marketing", owner: "Vishal", platform: "LinkedIn", items: [] }], recurrences: [], team: ["Vishal"], verticals: ["Marketing"] }));
  });
  await page.goto("/");
  await expect(page.getByText("Legacy activity", { exact: true }).first()).toBeVisible();
  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem("growth30.planner.v1")));
  expect(migrated.schemaVersion).toBe(4);
  expect(migrated.activities[0].publicationTargets).toEqual([{ channel: "LinkedIn", status: "Scheduled" }]);
});
