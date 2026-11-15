import { test, expect } from "@playwright/test";
test("owner edits real dictionary, previews, publishes, archives and restores a revision", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/admin/words")).status()).toBe(401);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Вход владельца" }),
  ).toBeVisible();
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(process.env.CMS_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByText("58 записей в базе")).toBeVisible();
  await page.getByRole("button", { name: "Новое слово", exact: true }).click();
  await page
    .getByLabel("Русское слово", { exact: true })
    .fill("Тестовое слово");
  await page
    .getByLabel("Краткое определение или описание", { exact: true })
    .fill("Описание тестовой карточки.");
  await page
    .getByText("Адрес и дополнительные настройки", { exact: true })
    .click();
  await page
    .getByLabel("URL (после создания неизменяемый)", { exact: true })
    .fill("cms-browser-test");
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Версия сохранена");
  expect(
    (await (await request.get("/api/content")).json()).words.some(
      (w: { slug: string }) => w.slug === "cms-browser-test",
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Тестовое слово", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "К редактору", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Редакционный статус", exact: true })
    .last()
    .selectOption("published");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(
    page.getByText("На сайте доступна опубликованная версия."),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Поиск записей").fill("Тестовое слово");
  await page
    .getByRole("button", { name: /Тестовое слово.*Опубликовано/ })
    .click();
  await page
    .getByLabel("Русское слово", { exact: true })
    .fill("Изменённое слово");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Версия сохранена");
  await page.goto("/dictionary?q=Изменённое");
  await expect(page.locator(".word-card")).toContainText("Изменённое слово");
  await page.goto("/dictionary/cms-browser-test");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Изменённое слово",
  );
  await page.goto("/admin");
  await page.getByLabel("Поиск записей").fill("Изменённое слово");
  await page
    .getByRole("button", { name: /Изменённое слово.*Опубликовано/ })
    .click();
  await page
    .getByRole("button", { name: "История изменений", exact: true })
    .click();
  await expect(page.getByText(/Версия 1 ·/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Восстановить в черновик" })
    .last()
    .click();
  await page.getByRole("button", { name: "К редактору", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Редакционный статус", exact: true })
    .last()
    .selectOption("archived");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(
    page.getByText("На сайте запись скрыта.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Вход владельца" }),
  ).toBeVisible();
  expect((await request.get("/api/admin/words")).status()).toBe(401);
});
