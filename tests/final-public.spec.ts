import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
test.skip(
  process.env.CMS_E2E_FINAL !== "1",
  "Use npm run test:e2e:final with its isolated published database",
);
const forbidden =
  /Требует (?:утверждения|проверки)|На проверке|Черновик|Предварительная версия|Ожидает подтверждения|Не проверено редактором|Редакционная проверка не выполнена|\bpending\b|\bprovisional\b|\bunknown\b|\bdraft\b|\breview\b|sourceTableCells|originalResearchCard|final-source-|source-\d+|WORD-/i;

test("actual final publication: 28 dictionary articles, eight by three, local flags, clean public presentation, responsive screenshots", async ({
  page,
  request,
}) => {
  const data = await (await request.get("/api/content")).json();
  expect(data.words).toHaveLength(28);
  expect(
    data.words.filter((w: { researchIncluded: boolean }) => w.researchIncluded),
  ).toHaveLength(8);
  const folder = resolve("test-results/final-demo");
  mkdirSync(folder, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [route, name] of [
    ["/", "home"],
    ["/dictionary", "dictionary"],
    ["/dictionary/matryoshka", "detailed"],
    ["/dictionary/babushka", "compact"],
    ["/research", "research"],
    ["/journey/matryoshka", "journey"],
    ["/word-of-the-day", "daily"],
  ] as const) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main")).not.toContainText(forbidden);
    if (route === "/dictionary")
      await expect(page.locator(".word-card")).toHaveCount(28);
    if (route === "/dictionary/matryoshka")
      await expect(page.locator(".language-card")).toHaveCount(3);
    await expect(page.locator("img.country-flag").first()).toBeVisible();
    for (const img of await page.locator("img.country-flag").all())
      expect(
        await img.evaluate(
          (i: HTMLImageElement) => i.complete && i.naturalWidth > 0,
        ),
      ).toBe(true);
    await page.screenshot({
      path: resolve(folder, name + ".png"),
      fullPage: true,
      animations: "disabled",
    });
  }
  for (const w of data.words) {
    await page.goto("/dictionary/" + w.slug);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main")).not.toContainText(forbidden);
    if (w.researchIncluded)
      await expect(page.locator(".language-card")).toHaveCount(3);
    else await expect(page.getByRole("tab")).toHaveCount(w.languages.length);
  }
  await page.goto("/dictionary");
  await page.getByRole("textbox", { name: "Поиск по словарю" }).fill("samovar");
  await expect(page.locator(".word-card").first()).toContainText("самова");
  await page.goto("/research");
  await page.getByLabel("Режим сравнения").selectOption("set");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await expect(page.getByLabel("Язык набора").locator("option")).toHaveCount(3);
  await page.screenshot({
    path: resolve(folder, "research-table.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Область сравнения").selectOption("dictionary");
  await expect(
    page.getByLabel("Слово", { exact: true }).locator("option"),
  ).toHaveCount(28);
  await expect(page.getByLabel("Язык набора").locator("option")).toHaveCount(9);
  await page.goto("/map");
  await expect(
    page.locator("path.country.focus-country").first(),
  ).toBeVisible();
  await expect(page.locator(".world-map text,.world-map title")).toHaveCount(0);
  await page.screenshot({ path: resolve(folder, "map.png"), fullPage: true });
  await page.getByLabel("Выбрать страну").selectOption("250");
  await expect(page.locator(".map-panel h2")).toContainText("Франция");
  await expect(
    page.locator(".map-panel img.country-flag").first(),
  ).toBeVisible();
  await expect(page.locator(".map-panel a").first()).toBeVisible();
  await page.screenshot({
    path: resolve(folder, "map-selected.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Слой карты").selectOption("borrowings");
  await expect(page.locator("path.country.focus-country")).toHaveCount(0);
  await expect(page.locator(".map-panel")).toContainText(
    "Пока нет подтверждённых слов",
  );
  await expect(page.locator("main")).not.toContainText(forbidden);
  await page.getByLabel("Слой карты").selectOption("correspondences");
  await page.getByRole("button", { name: "Закрыть панель страны" }).click();
  await expect(page.locator(".map-panel")).toHaveCount(0);
  for (const width of [1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "/",
      "/dictionary",
      "/dictionary/matryoshka",
      "/dictionary/babushka",
      "/research",
      "/map",
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (width === 390) {
      await page.goto("/");
      await page.screenshot({
        path: resolve(folder, "mobile.png"),
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  expect(errors).toEqual([]);
});
