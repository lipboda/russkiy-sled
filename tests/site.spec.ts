import { test, expect } from "@playwright/test";
test("search, source attribution, filters and comparison", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Русский след",
  );
  await page.getByRole("textbox", { name: "Поиск по словарю" }).fill("samovar");
  await expect(page.locator(".suggestions")).toContainText("самовар");
  await page.locator(".suggestions").getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("самовар");
  await expect(page.locator(".language-card")).toHaveCount(3);
  await page.locator(".language-card summary").first().click();
  await expect(page.locator(".language-card").first()).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator("a.source-link").first()).toHaveAttribute(
    "href",
    /github.com.*samovar_dossier.pdf/,
  );
  await page.goto("/dictionary");
  await page.getByLabel("Полнота статьи").selectOption("full");
  await expect(page.locator(".word-card")).toHaveCount(9);
  await page.getByLabel("Режим языков").selectOption("all");
  await page.getByLabel("Американский английский", { exact: true }).check();
  await expect(
    page.getByRole("heading", { name: "Пока ничего не найдено" }),
  ).toBeVisible();
  await page.goto("/research");
  await page.getByLabel("Слово", { exact: true }).selectOption("sputnik");
  await page.getByLabel("Параметр").selectOption("semantic");
  await expect(page.locator(".comparison-grid")).toContainText("spoutnik");
  await expect(page.locator(".notes")).toContainText("Семантика");
  expect(errors).toEqual([]);
});
test("map zoom and country panel", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator("path.country").first()).toBeVisible();
  await expect(page.locator("path.country")).toHaveCount(177);
  await page.getByRole("button", { name: "Увеличить карту" }).click();
  await expect(page.getByText("Масштаб 1.5×")).toBeVisible();
  const map = page.locator("svg.world-map");
  const bounds = (await map.boundingBox())!;
  const transformBefore = await map
    .locator(":scope > g")
    .getAttribute("transform");
  await page.mouse.move(bounds.x + 50, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 100, bounds.y + 55, { steps: 8 });
  await page.mouse.up();
  expect(await map.locator(":scope > g").getAttribute("transform")).not.toBe(
    transformBefore,
  );
  await page.getByLabel("Выбрать страну").selectOption("051");
  await expect(page.locator(".map-panel h2")).toHaveText("Армения");
  await expect(page.locator(".map-panel")).toContainText(
    "Пока нет подтверждённых слов",
  );
  await page.getByRole("button", { name: "Закрыть панель страны" }).click();
  await expect(page.locator(".map-panel")).toHaveCount(0);
});
test("editorial routes, honest daily word, form download and 404", async ({
  page,
}) => {
  for (const route of [
    "/journal/how-to-read",
    "/journey/samovar",
    "/word-of-the-day",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Новые публикации скоро появятся" }),
  ).toBeVisible();
  await page.goto("/contribute");
  await page.getByLabel("Русское слово").fill("Тест");
  await page.getByLabel("Принимающий язык").fill("Французский");
  await page
    .getByLabel("Форма слова и ваши наблюдения")
    .fill("Описание для редакционной проверки");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать текст сообщения" }).click();
  expect((await download).suggestedFilename()).toBe(
    "russkiy-sled-proposal.txt",
  );
  await expect(page.getByRole("status")).toContainText("не отправлено");
  await page.goto("/unknown");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "не найдена",
  );
});
test("mobile navigation and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/",
    "/dictionary",
    "/dictionary/samovar",
    "/research",
    "/map",
    "/journey",
    "/journal",
    "/contribute",
  ]) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Словарь", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Электронный словарь",
  );
  await expect(
    page.getByRole("button", { name: "Открыть меню" }),
  ).toBeVisible();
});
