import { expect, test } from "@playwright/test";

test("login, modules, multi-channel planning and mobile containment", async ({ page }) => {
  const html = await (await page.request.get("/")).text();
  expect(html).toContain('class="brand-loader"');
  expect((await page.request.get("/favicon.svg")).ok()).toBeTruthy();
  expect((await page.request.get("/brand/wave-momentum-mark.svg")).ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator(".login-brand .wave-lockup")).toHaveAttribute("aria-label", "wave");
  await expect(page.locator(".brand-mark")).toHaveCount(0);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg");
  await page.screenshot({ path: "test-results/wave-login.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".login-mobile-brand img")).toBeVisible();
  await page.screenshot({ path: "test-results/wave-login-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator("#loginName").fill("Vishal Dudhal");
  await page.getByRole("button", { name: /Continue to wave/i }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.locator(".sidebar-brand .momentum-mark")).toBeVisible();
  await expect(page.locator(".sidebar-brand .brand-copy strong")).toHaveText("wave");
  await expect(page.locator("#viewRoot").getByRole("button", { name: /Add activity/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open planner", exact: true })).toHaveCount(0);
  await expect(page.locator(".app-main > .footer")).toHaveCount(0);
  const liveMetrics = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("growth30.planner.v1"));
    const current = new Date();
    const date = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    const progress = (activity) => activity.manualDone ? 100 : activity.items.length ? Math.round(activity.items.filter((item) => item.done).length / activity.items.length * 100) : 0;
    const todayItems = data.activities.filter((activity) => activity.date === date);
    return {
      planned: todayItems.length,
      remaining: todayItems.filter((activity) => progress(activity) < 100).length,
      completed: todayItems.filter((activity) => progress(activity) === 100).length,
      followUps: data.activities.filter((activity) => activity.followUpDate && activity.followUpDate <= date && !activity.followUpDone).length,
    };
  });
  await expect(page.locator(".snapshot-metric.calendar strong")).toHaveText(String(liveMetrics.planned));
  await expect(page.locator(".snapshot-metric.remaining strong")).toHaveText(String(liveMetrics.remaining));
  await expect(page.locator(".snapshot-metric.completed strong")).toHaveText(String(liveMetrics.completed));
  await expect(page.locator(".snapshot-metric.followups strong")).toHaveText(String(liveMetrics.followUps));
  await expect(page.locator("#notificationButton svg")).toBeVisible();
  await page.locator("#notificationButton").click();
  await expect(page.locator("#notificationsPopover").getByText("Notifications", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Daily briefing/ })).toHaveCount(0);
  await page.screenshot({ path: "test-results/wave-notifications.png" });
  await page.locator("#notificationButton").click();
  await page.locator("#sidebarToggle").click();
  await expect(page.locator(".saas-shell")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar-brand .momentum-mark")).toBeVisible();
  await expect(page.locator('[data-module="planner"]')).toHaveAttribute("data-tooltip", "Planner");
  await page.waitForTimeout(250);
  await page.screenshot({ path: "test-results/wave-sidebar-collapsed.png", fullPage: true });
  await page.locator("#sidebarToggle").click();
  await page.screenshot({ path: "test-results/wave-overview.png", fullPage: true });

  await page.getByRole("button", { name: /New activity/ }).click();
  await page.getByRole("button", { name: /Plan Content/ }).click();
  await page.screenshot({ path: "test-results/wave-content-form.png", fullPage: true });
  await page.locator("#activityTitle").fill("Multi-channel launch proof");
  await page.locator('[data-publish-channel="LinkedIn"]').check();
  await page.locator('[data-publish-channel="YouTube"]').check();
  await page.locator("#overlay").getByRole("button", { name: "Plan content", exact: true }).click();

  await page.getByRole("button", { name: /Planner/ }).click();
  await expect(page.getByText("Connected execution board")).toBeVisible();
  await expect(page.getByText("Publishing channel", { exact: true })).toHaveCount(6);
  await expect(page.locator('[data-inline-title][value="Multi-channel launch proof"]')).toHaveCount(2);
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem("growth30.planner.v1")));
  const created = data.activities.filter((activity) => activity.title === "Multi-channel launch proof");
  expect(created).toHaveLength(1);
  expect(created[0].kind).toBe("content");
  expect(created[0].contentStatus).toBe("Planned");
  expect(created[0].contentFormat).toBe("Social post");
  expect(created[0].publicationTargets.map((target) => target.channel).sort()).toEqual(["LinkedIn", "YouTube"]);
  expect(created[0].publicationTargets.every((target) => target.status === "Planned")).toBeTruthy();
  await page.locator('.week-card:has([data-inline-title][value="Multi-channel launch proof"]):has([data-channel="LinkedIn"]) select').selectOption("Published");
  const published = await page.evaluate(() => JSON.parse(localStorage.getItem("growth30.planner.v1")).activities.find((activity) => activity.title === "Multi-channel launch proof"));
  expect(published.publicationTargets.find((target) => target.channel === "LinkedIn").status).toBe("Published");
  await page.screenshot({ path: "test-results/wave-planner.png", fullPage: true });

  await page.getByRole("button", { name: "All Activities" }).click();
  await page.locator("#activitySearch").fill("launch proof");
  await expect(page.getByText("Multi-channel launch proof", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "All Activities" })).toHaveClass(/active/);
  await expect(page.locator("#activitySearch")).toHaveValue("launch proof");
  await expect(page.getByText("Multi-channel launch proof", { exact: true })).toBeVisible();
  const dismissBriefing = page.getByRole("button", { name: "Dismiss", exact: true });
  if (await dismissBriefing.isVisible()) await dismissBriefing.click();

  await page.getByRole("button", { name: /Settings/ }).click();
  await page.getByRole("button", { name: "Data Management" }).click();
  await expect(page.getByRole("heading", { name: "Data Management" })).toBeVisible();
  await page.locator("#openDataTools").click();
  await expect(page.locator("#overlay").getByRole("heading", { name: "Backup & restore", exact: true })).toBeVisible();
  await page.locator("#overlay").getByRole("button", { name: "×" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#loadDemoData").click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  const demo = await page.evaluate(() => JSON.parse(localStorage.getItem("growth30.planner.v1")));
  expect(demo.activities.length).toBeGreaterThanOrEqual(23);
  expect(demo.activities.some((activity) => activity.title === "Multi-channel launch proof")).toBe(false);
  expect(demo.profile.name).toBe("Vishal Dudhal");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/wave-mobile-viewport.png" });
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
  expect(migrated.schemaVersion).toBe(5);
  expect(migrated.activities[0].publicationTargets).toEqual([{ channel: "LinkedIn", status: "Scheduled" }]);
});

test("planner view, period and filters persist across reloads", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("webster.wave.session.v1", "active"));
  await page.goto("/");
  const dismissBriefing = page.getByRole("button", { name: "Dismiss", exact: true });
  if (await dismissBriefing.isVisible()) await dismissBriefing.click();

  await page.getByRole("button", { name: /Planner/ }).click();
  await page.getByRole("button", { name: "Monthly Calendar" }).click();
  await page.getByRole("button", { name: "Marketing", exact: true }).click();
  await page.locator("#ownerFilter").selectOption("Aisha");
  await page.locator("#statusFilter").selectOption("In progress");
  await page.locator("#nextPeriod").click();
  const visibleMonth = await page.locator(".calendar-panel h2").textContent();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Monthly Calendar" })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: "Marketing", exact: true })).toHaveClass(/active/);
  await expect(page.locator("#ownerFilter")).toHaveValue("Aisha");
  await expect(page.locator("#statusFilter")).toHaveValue("In progress");
  await expect(page.locator(".calendar-panel h2")).toHaveText(visibleMonth);
});

test("contextual activity flow and categorized settings remain integration-ready", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("webster.wave.session.v1", "active"));
  await page.goto("/");
  const dismissBriefing = page.getByRole("button", { name: "Dismiss", exact: true });
  if (await dismissBriefing.isVisible()) await dismissBriefing.click();

  await page.getByRole("button", { name: /New activity/ }).click();
  await page.getByRole("button", { name: /Plan an Activity/ }).click();
  await expect(page.getByRole("heading", { name: "Plan an Activity" })).toBeVisible();
  await expect(page.locator("#publishingSection")).toBeHidden();
  await expect(page.locator(".additional-details")).not.toHaveAttribute("open", "");
  await page.screenshot({ path: "test-results/wave-activity-form.png", fullPage: true });
  await page.locator("#activityType").selectOption("Follow-up");
  await expect(page.locator("#checklistEditor .check-edit")).toHaveCount(5);
  await page.locator("#activityTitle").fill("Follow up after discovery call");
  await page.locator("#overlay").getByRole("button", { name: "Plan activity", exact: true }).click();
  const created = await page.evaluate(() => JSON.parse(localStorage.getItem("growth30.planner.v1")).activities.find((item) => item.title === "Follow up after discovery call"));
  expect(created.kind).toBe("activity");
  expect(created.publicationTargets).toEqual([]);

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator(".settings-nav button")).toHaveCount(7);
  await page.getByRole("button", { name: "Integrations" }).click();
  await expect(page.locator(".integration-card")).toHaveCount(6);
  await expect(page.getByText("No connection is active.")).toBeVisible();
  await expect(page.getByText("Connected", { exact: true })).toHaveCount(0);
  const readability = await page.evaluate(() => {
    const size = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const lineHeight = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).lineHeight);
    return {
      settingsNav: size(".settings-nav button"),
      settingsHeading: size(".settings-page-head h2"),
      settingsCopy: size(".settings-page-head p"),
      integrationTitle: size(".integration-card h3"),
      integrationCopy: size(".integration-card p"),
      integrationCopyLineHeight: lineHeight(".integration-card p"),
      sidebarProfile: size(".sidebar-profile strong"),
    };
  });
  expect(readability.settingsNav).toBeGreaterThanOrEqual(12);
  expect(readability.settingsHeading).toBeGreaterThanOrEqual(20);
  expect(readability.settingsCopy).toBeGreaterThanOrEqual(12);
  expect(readability.integrationTitle).toBeGreaterThanOrEqual(13);
  expect(readability.integrationCopy).toBeGreaterThanOrEqual(11);
  expect(readability.integrationCopyLineHeight).toBeGreaterThanOrEqual(readability.integrationCopy * 1.4);
  expect(readability.sidebarProfile).toBeGreaterThanOrEqual(12);
  await page.screenshot({ path: "test-results/wave-settings-integrations.png", fullPage: true });
});

test("typography remains readable and contained at 100% zoom", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("webster.wave.session.v1", "active"));
  await page.goto("/");
  const dismissBriefing = page.getByRole("button", { name: "Dismiss", exact: true });
  if (await dismissBriefing.isVisible()) await dismissBriefing.click();

  const typeStyles = await page.evaluate(() => {
    const read = (selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return { size: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight), weight: Number(style.fontWeight) };
    };
    return {
      page: read(".page-heading h1"),
      navigation: read(".side-nav button"),
      activityTitle: read(".focus-copy > strong"),
      activityMeta: read(".focus-copy > small"),
      label: read(".snapshot-metric span"),
    };
  });
  expect(typeStyles.page.size).toBeGreaterThanOrEqual(24);
  expect(typeStyles.navigation.size).toBeGreaterThanOrEqual(13);
  expect(typeStyles.activityTitle.size).toBeGreaterThanOrEqual(13);
  expect(typeStyles.activityTitle.weight).toBeGreaterThanOrEqual(500);
  expect(typeStyles.activityMeta.size).toBeGreaterThanOrEqual(11);
  expect(typeStyles.label.size).toBeGreaterThanOrEqual(11);
  expect(typeStyles.activityMeta.lineHeight).toBeGreaterThanOrEqual(typeStyles.activityMeta.size * 1.35);

  for (const module of ["planner", "settings", "overview"]) {
    await page.locator(`[data-module="${module}"]`).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(mobileOverflow).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
});
