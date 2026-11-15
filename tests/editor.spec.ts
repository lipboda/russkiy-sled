import { test, expect } from "@playwright/test";

test("inline editing guards unsaved work, reports save errors, persists notes and refreshes the public SPA", async ({
  page,
  browser,
}) => {
  await page.goto("/dictionary/matryoshka");
  await expect(
    page.getByRole("navigation", { name: "Панель владельца" }),
  ).toHaveCount(0);
  await page.goto("/admin");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(process.env.CMS_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByText(/^\d+ записей в базе$/)).toBeVisible();
  await page.getByRole("link", { name: "Словарь", exact: true }).click();
  await page
    .locator(".word-card")
    .filter({ hasText: "матрёшка" })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Редактировать статью", exact: true })
    .click();
  const note = page.getByLabel("Редакционное примечание", { exact: true });
  const original = await note.inputValue();
  await note.fill(
    "Демонстрационное редакционное примечание — научные данные не изменены.",
  );
  const refused = page
    .waitForEvent("dialog")
    .then((dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Открыть статью", exact: true }).click();
  await refused;
  await expect(page).toHaveURL(/\/admin\?word=/);
  await expect(note).toBeVisible();
  await expect(page.getByText("Есть несохранённые изменения.")).toBeVisible();
  await page.route("**/api/admin/words", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Тест: временный сбой сохранения" }),
      });
    else await route.continue();
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Тест: временный сбой сохранения",
  );
  await expect(note).toHaveValue(/Демонстрационное/);
  await page.unroute("**/api/admin/words");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Версия сохранена. Опубликовано.",
  );
  // A router navigation, without a document reload, must use the new published catalog.
  await page.getByRole("link", { name: "Открыть статью", exact: true }).click();
  await expect(
    page.getByText(/Демонстрационное редакционное примечание/),
  ).toBeVisible();
  const visitor = await browser.newContext();
  const other = await visitor.newPage();
  await other.goto("http://127.0.0.1:5173/dictionary/matryoshka");
  await expect(
    other.getByText(/Демонстрационное редакционное примечание/),
  ).toBeVisible();
  await expect(
    other.getByRole("navigation", { name: "Панель владельца" }),
  ).toHaveCount(0);
  await visitor.close();
  await page
    .getByRole("link", { name: "Редактировать статью", exact: true })
    .click();
  await expect(note).toHaveValue(/Демонстрационное/);
  await page.reload();
  await expect(note).toHaveValue(/Демонстрационное/);
  await note.fill(original);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Версия сохранена");
  await page.getByRole("link", { name: "Открыть статью", exact: true }).click();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Панель владельца" }),
  ).toHaveCount(0);
});

test("research set has exactly eight ordered words and filters only published language cards", async ({
  page,
}) => {
  await page.goto("/research");
  const expected = [
    "матрёшка",
    "калашников",
    "дача",
    "интеллигенция",
    "погром",
    "самиздат",
    "спутник",
    "самовар",
  ];
  await expect(
    page.getByLabel("Слово", { exact: true }).locator("option"),
  ).toHaveText(expected);
  await page.getByLabel("Режим сравнения").selectOption("set");
  await expect(page.locator("tbody th")).toHaveText(expected);
  await page.getByLabel("Язык набора").selectOption("hy-AM");
  await expect(page.locator("tbody")).toContainText("մատրյոշկա");
  await expect(page.getByLabel("Достоверность формы")).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await expect(page.locator("tbody")).not.toContainText("Требует проверки");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
