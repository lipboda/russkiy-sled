import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
async function login(page: Page) {
  await page.goto("/admin");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(process.env.CMS_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Редакция словаря", exact: true }),
  ).toBeVisible();
}
async function section(page: Page, title: string) {
  await page
    .getByRole("link", { name: "Раздел CMS: " + title, exact: true })
    .click();
}
async function savePublication(page: Page, state = "published") {
  await page
    .getByLabel("Статус материала", { exact: true })
    .selectOption(state);
  if (["published", "scheduled", "trash", "archived"].includes(state))
    page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Сохранить материал", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
}
test("stage 2A category workflow, single-line editor, duplicate, trash and restore", async ({
  page,
}) => {
  await login(page);
  await section(page, "Тематические категории");
  await page
    .getByRole("button", { name: "Создать категорию", exact: true })
    .click();
  await page
    .getByLabel("Название категории", { exact: true })
    .fill("Тестовая категория CMS");
  await page
    .getByRole("button", { name: "Сохранить категорию", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
  await section(page, "Словарь");
  await page.getByRole("button", { name: "Новое слово", exact: true }).click();
  await expect(
    page.getByLabel("Русское слово", { exact: true }),
  ).toHaveJSProperty("tagName", "INPUT");
  await page
    .getByLabel("Русское слово", { exact: true })
    .fill("Тест категорий");
  await page
    .getByLabel("Краткое определение или описание", { exact: true })
    .fill("Описание тестовой карточки.");
  await page
    .getByText("Адрес и дополнительные настройки", { exact: true })
    .click();
  await page
    .getByLabel("URL (после создания неизменяемый)", { exact: true })
    .fill("test-category-stage-two");

  await page.getByLabel("Тестовая категория CMS", { exact: true }).check();
  await page
    .getByRole("combobox", { name: "Редакционный статус", exact: true })
    .last()
    .selectOption("published");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Версия сохранена");
  await section(page, "Тематические категории");
  await page
    .getByRole("button", { name: /Тестовая категория CMS · записей/ })
    .click();
  await page
    .getByLabel("Название категории", { exact: true })
    .fill("Переименованная категория CMS");
  await page
    .getByRole("button", { name: "Сохранить категорию", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
  await page.goto("/dictionary/test-category-stage-two");
  await expect(
    page.getByText("Переименованная категория CMS", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Редактировать статью", exact: true })
    .click();
  await page
    .getByLabel("Поиск записей", { exact: true })
    .fill("Тест категорий");
  await page.getByText("Действия: Тест категорий", { exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Дублировать", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Операция выполнена");
  await page
    .getByText("Действия: Тест категорий (копия)", { exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "В корзину", exact: true })
    .last()
    .click();
  await expect(page.getByRole("status")).toHaveText("Операция выполнена");
  await section(page, "Корзина");
  await expect(
    page.getByRole("heading", { name: "Тест категорий (копия)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Восстановить слово в черновик", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
});
test("stage 2B editable journal migration, Markdown preview, media, daily archive and scheduled publication", async ({
  page,
  browser,
}) => {
  await login(page);
  await section(page, "Медиатека");
  await page
    .getByLabel("Название изображения", { exact: true })
    .fill("Тестовая обложка");
  await page
    .getByLabel("Альтернативный текст", { exact: true })
    .fill("Белый квадрат для теста");
  const image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Файл изображения", { exact: true })
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: image });
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
  await expect(page.getByAltText("Белый квадрат для теста")).toBeVisible();
  await section(page, "Журнал");
  await expect(
    page.getByRole("button", { name: /Что значит «подтверждено»/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Создать статью", exact: true })
    .click();
  await page
    .getByLabel("Заголовок *", { exact: true })
    .fill("Редакционный тест второго этапа");
  await page
    .getByLabel("URL *", { exact: true })
    .fill("stage-two-journal-test");
  await page
    .getByLabel("Краткое вступление", { exact: true })
    .fill("Редакционная заметка для браузерной проверки.");
  await page
    .getByLabel("Основной текст (Markdown)", { exact: true })
    .fill(
      "## Проверка Markdown\n\n**Жирный текст**, հայերեն /ʃ/.\n\n<script>window.injected = true</script>\n\n| Колонка | Значение |\n| --- | --- |\n| Пример | Текст |",
    );
  await page
    .getByLabel("Обложка", { exact: true })
    .selectOption({ label: "Тестовая обложка" });
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Проверка Markdown", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, "injected"))).toBe(
    false,
  );
  await page.getByRole("button", { name: "К редактору", exact: true }).click();
  await savePublication(page);
  await page.reload();
  await page
    .getByRole("button", {
      name: /Редакционный тест второго этапа.*Опубликовано/,
    })
    .click();
  await expect(
    page.getByLabel("Основной текст (Markdown)", { exact: true }),
  ).toHaveValue(/հայերեն/);
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.goto("http://127.0.0.1:5173/journal/stage-two-journal-test");
  await expect(
    publicPage.getByRole("heading", { name: "Проверка Markdown", exact: true }),
  ).toBeVisible();
  await expect(publicPage.locator(".publication-cover")).toBeVisible();
  await publicPage.goto("http://127.0.0.1:5173/journal/how-to-read");
  await expect(
    publicPage.getByRole("heading", {
      name: "Что значит «подтверждено» в цифровом словаре",
      exact: true,
    }),
  ).toBeVisible();
  await section(page, "Слово дня");
  for (const suffix of ["one", "two"]) {
    await page
      .getByRole("button", { name: "Создать статью", exact: true })
      .click();
    await page
      .getByLabel("Заголовок публикации", { exact: true })
      .fill("Выпуск для теста " + suffix);
    await page
      .getByRole("textbox", { name: "Основной текст статьи", exact: true })
      .fill("Редакционный выпуск для теста, без научных утверждений.");
    await page
      .getByText("Дополнительные настройки публикации", { exact: true })
      .click();
    await page
      .getByLabel("URL публикации", { exact: true })
      .fill("stage-two-daily-" + suffix);
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Опубликовать", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
  }
  await page
    .getByRole("button", { name: "Создать статью", exact: true })
    .click();
  await page
    .getByLabel("Заголовок публикации", { exact: true })
    .fill("Будущий выпуск для теста");
  await page
    .getByRole("textbox", { name: "Основной текст статьи", exact: true })
    .fill("Будущий редакционный текст");
  await page
    .getByText("Дополнительные настройки публикации", { exact: true })
    .click();
  await page
    .getByLabel("Время публикации", { exact: true })
    .fill("2099-01-01T12:00");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Запланировать", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
  await publicPage.goto("http://127.0.0.1:5173/word-of-the-day/archive");
  await expect(
    publicPage.getByRole("link", { name: "Выпуск для теста one", exact: true }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("link", { name: "Выпуск для теста two", exact: true }),
  ).toBeVisible();
  await expect(
    publicPage.getByText("Будущий выпуск для теста", { exact: true }),
  ).toHaveCount(0);
  await publicPage
    .getByRole("link", { name: "Выпуск для теста one", exact: true })
    .click();
  await expect(publicPage).toHaveURL(/issue\/stage-two-daily-one$/);
  await publicPage
    .getByRole("link", { name: "Следующий выпуск →", exact: true })
    .click();
  await expect(
    publicPage.getByRole("heading", {
      name: "Выпуск для теста two",
      exact: true,
    }),
  ).toBeVisible();
  await visitor.close();
});

test("stage 2C shared sources, hidden language cards, comparison edit links and unified history", async ({
  page,
}) => {
  await login(page);
  const original = (
    await (await page.request.get("/api/admin/words")).json()
  ).find((r: { data: { slug: string } }) => r.data.slug === "matryoshka");
  await section(page, "Источники");
  await page
    .getByRole("button", { name: "Добавить источник", exact: true })
    .click();
  await page
    .getByLabel("Название *", { exact: true })
    .fill("Тестовый источник, не научная верификация");
  await page
    .getByLabel("URL *", { exact: true })
    .fill("https://example.org/test");
  await page
    .getByRole("button", { name: "Сохранить источник", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
  await page.goto("/research");
  await page
    .getByRole("link", {
      name: "Редактировать языковые карточки этого слова",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Транскрипция", { exact: true })
    .first()
    .fill("Тестовый ввод /ʃ/ — не научный факт");
  await page.getByRole("button", { name: "Французский", exact: true }).click();
  await page.getByLabel("Скрыть языковую карточку", { exact: true }).check();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Версия сохранена");
  await page.getByRole("link", { name: "Открыть статью", exact: true }).click();
  await expect(page.locator(".language-card")).toHaveCount(2);
  await expect(
    page.getByText("Тестовый ввод /ʃ/ — не научный факт", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Сравнение языков", exact: true })
    .click();
  await page.getByLabel("Параметр", { exact: true }).selectOption("phonetic");
  await expect(page.locator(".comparison-grid")).toContainText(
    "Тестовый ввод /ʃ/ — не научный факт",
  );
  await page.reload();
  await page.getByLabel("Параметр", { exact: true }).selectOption("phonetic");
  await expect(page.locator(".comparison-grid")).toContainText(
    "Тестовый ввод /ʃ/ — не научный факт",
  );
  const current = (
    await (await page.request.get("/api/admin/words")).json()
  ).find((r: { id: string }) => r.id === original.id);
  const restore = await page.request.put("/api/admin/words", {
    data: { ...original, version: current.version },
    headers: { Origin: "http://127.0.0.1:5173" },
  });
  expect(restore.status()).toBe(200);
  await page.goto("/admin?section=history");
  await expect(
    page.getByRole("heading", { name: "История изменений", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("details").filter({ hasText: "матрёшка" }).first(),
  ).toBeVisible();
});
