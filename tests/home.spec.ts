import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("home published content, search, responsive atlas preview and screenshots", async ({
  page,
  request,
}) => {
  const data = await (await request.get("/api/content")).json();
  await page.goto("/");
  await expect(page.locator(".home-word")).toHaveCount(
    Math.min(6, data.words.length),
  );
  await expect(page.locator("h1")).toHaveText("Русский след");
  await expect(page.locator(".home-metrics dd").first()).toHaveText(
    String(data.words.length),
  );
  await expect(page.locator(".home-map-preview")).toBeVisible();
  expect(
    await page
      .locator(".home-map-preview text,.home-map-preview title")
      .count(),
  ).toBe(0);
  mkdirSync("test-results/home-screenshots", { recursive: true });
  for (const [w, h, name] of [
    [1440, 900, "desktop"],
    [1280, 800, "macbook"],
    [1024, 768, "laptop"],
    [768, 1024, "tablet"],
    [390, 844, "mobile"],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/home-screenshots/" + name + ".png",
      fullPage: name !== "macbook",
    });
  }
  await page.getByRole("textbox", { name: "Поиск по словарю" }).fill("samovar");
  await page.getByRole("textbox", { name: "Поиск по словарю" }).press("Enter");
  await expect(page).toHaveURL(/dictionary\?q=samovar/);
  await expect(page.locator(".word-card").first()).toContainText("самовар");
});
test("home empty and partial/API failure keep static navigation and never show bundled seed", async ({
  page,
}) => {
  const raw = await (await page.request.get("/api/content")).json();
  await page.route("**/api/content", (r) =>
    r.fulfill({ json: { ...raw, words: [] } }),
  );
  await page.route("**/api/editorial", (r) =>
    r.fulfill({
      json: {
        journal: [],
        daily: [],
        categories: [],
        languages: [],
        timezone: "Asia/Novosibirsk",
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".home-word")).toHaveCount(0);
  await expect(
    page.getByText("Словарь формируется.", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/home-screenshots/empty.png",
    fullPage: true,
  });
  await page.unroute("**/api/content");
  await page.route("**/api/content", (r) =>
    r.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Русский след", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "О проекте", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Не удалось обновить словарь.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".home-word")).toHaveCount(0);
});
