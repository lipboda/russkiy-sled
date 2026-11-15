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
async function publishWord(page: Page) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Версия сохранена");
}
async function publishDaily(page: Page) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
}
async function addTestLanguage(page: Page, name: string, form: string) {
  await page
    .getByRole("button", { name: "Добавить язык", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать новый язык", exact: true })
    .click();
  await page.getByLabel("Название языка *", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Сохранить и добавить язык", exact: true })
    .click();
  await expect(page.getByRole("group", { name, exact: true })).toBeVisible();
  await page.getByLabel("Иностранная форма", { exact: true }).fill(form);
  await page
    .getByLabel("Значение или краткое описание", { exact: true })
    .fill("Описание тестового соответствия");
  await page
    .getByRole("combobox", { name: "Тип языкового соответствия" })
    .selectOption("translation");
}

test("compact dictionary: inline new theme by Enter, URL links, arbitrary languages, correspondence filters and lossless format switch", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Новое слово", exact: true }).click();
  await page
    .getByRole("button", { name: "Краткая карточка", exact: true })
    .click();
  await page
    .getByLabel("Русское слово", { exact: true })
    .fill("Карточка для проверки редактора");
  await page
    .getByLabel("Краткое определение или описание", { exact: true })
    .fill("Тестовая справочная карточка без научных утверждений.");
  await page
    .getByLabel("Добавить тему", { exact: true })
    .fill("Совершенно новая тема");
  await page.getByLabel("Добавить тему", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Убрать категорию Совершенно новая тема",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Источники статьи", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить ещё ссылку", exact: true })
    .click();
  await page
    .getByLabel("URL источника", { exact: true })
    .fill("https://example.org/stage-three");
  await page
    .getByLabel("Название ссылки (необязательно)", { exact: true })
    .fill("Источник для проверки");
  await page
    .getByLabel("Комментарий к ссылке", { exact: true })
    .fill("Пояснение к конкретной ссылке");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Версия сохранена");
  await page.reload();
  await page
    .getByLabel("Поиск записей", { exact: true })
    .fill("Карточка для проверки редактора");
  await page
    .getByRole("button", { name: /Карточка для проверки редактора.*Черновик/ })
    .click();
  await page
    .getByRole("button", { name: "Источники статьи", exact: true })
    .click();
  await expect(page.getByLabel("URL источника", { exact: true })).toHaveValue(
    "https://example.org/stage-three",
  );
  await page
    .getByRole("button", { name: "Языковые карточки", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить язык", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Американский английский", exact: true })
    .click();
  await page.getByLabel("Иностранная форма", { exact: true }).fill("test form");
  await page
    .getByRole("combobox", { name: "Тип языкового соответствия" })
    .selectOption("translation");
  await addTestLanguage(page, "Новый язык для проверки", "مثال");
  await publishWord(page);
  await page.getByRole("link", { name: "Открыть статью", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Новый язык для проверки", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Новый язык для проверки", exact: true })
    .click();
  await expect(page.getByRole("tabpanel")).toContainText("مثال");
  await expect(page.getByRole("tabpanel")).toContainText(
    "Переводной эквивалент",
  );
  await page.goto("/dictionary");
  await page
    .getByLabel("Тип соответствия", { exact: true })
    .selectOption("translation");
  await expect(
    page
      .locator(".word-card")
      .filter({ hasText: "Карточка для проверки редактора" }),
  ).toBeVisible();
  await page
    .locator(".word-card")
    .filter({ hasText: "Карточка для проверки редактора" })
    .click();
  await page
    .getByRole("link", { name: "Редактировать статью", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Подробная статья", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Лингвистический анализ", exact: true })
    .click();
  await page
    .getByLabel("Историко-культурный контекст", { exact: true })
    .fill("Сохранённый расширенный текст для теста");
  await publishWord(page);
  await page
    .getByRole("button", { name: "Краткая карточка", exact: true })
    .click();
  await publishWord(page);
  await page
    .getByRole("button", { name: "Подробная статья", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Лингвистический анализ", exact: true })
    .click();
  await expect(
    page.getByLabel("Историко-культурный контекст", { exact: true }),
  ).toHaveValue("Сохранённый расширенный текст для теста");
});

test("WYSIWYG articles publish without summary/date and permit multiple materials per day", async ({
  page,
  browser,
}) => {
  await login(page);
  await section(page, "Медиатека");
  await page
    .getByLabel("Название изображения", { exact: true })
    .fill("Изображение третьего этапа");
  await page
    .getByLabel("Альтернативный текст", { exact: true })
    .fill("Тестовая картинка");
  const image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#ddd" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Файл изображения", { exact: true })
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: image });
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
  await section(page, "Слово дня");
  await page
    .getByRole("button", { name: "Создать статью", exact: true })
    .click();
  await page
    .getByLabel("Заголовок публикации", { exact: true })
    .fill("Визуальная статья для проверки");
  const editor = page.getByRole("textbox", {
    name: "Основной текст статьи",
    exact: true,
  });
  await editor.fill("Текст визуального редактора");
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Жирный", exact: true }).click();
  page.once("dialog", (d) => d.accept("https://example.org/visual"));
  await page
    .getByRole("button", { name: "Вставить ссылку", exact: true })
    .click();
  await editor.press("ArrowRight");
  await editor.press("Enter");
  await page.getByRole("button", { name: "Заголовок 2", exact: true }).click();
  await page.keyboard.type("Подзаголовок документа");
  await editor.press("Enter");
  await page
    .getByRole("button", { name: "Маркированный список", exact: true })
    .click();
  await page.keyboard.type("Первый пункт");
  await page
    .getByRole("combobox", { name: "Изображение из медиатеки" })
    .selectOption({ label: "Изображение третьего этапа" });
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Изменения сохранены");
  const draft = (
    await (await page.request.get("/api/admin/publications/daily")).json()
  ).find(
    (r: { data: { title: string } }) =>
      r.data.title === "Визуальная статья для проверки",
  );
  const visitor = await browser.newContext();
  const other = await visitor.newPage();
  await other.goto(
    "http://127.0.0.1:5173/word-of-the-day/issue/" + draft.data.slug,
  );
  await expect(
    other.getByRole("heading", {
      name: "Эта страница не найдена",
      exact: true,
    }),
  ).toBeVisible();
  await publishDaily(page);
  const after = (
    await (await page.request.get("/api/admin/publications/daily")).json()
  ).find((r: { id: string }) => r.id === draft.id);
  expect(after.data.publishedAt).toBeTruthy();
  expect(after.data.intro).toBe("");
  await other.goto(
    "http://127.0.0.1:5173/word-of-the-day/issue/" + draft.data.slug,
  );
  await expect(
    other
      .locator(".rich-document strong")
      .filter({ hasText: "Текст визуального редактора" })
      .first(),
  ).toContainText("Текст визуального редактора");
  await expect(other.locator(".rich-document a").first()).toHaveAttribute(
    "href",
    "https://example.org/visual",
  );
  await expect(other.locator(".rich-document img")).toBeVisible();
  await page
    .getByRole("button", { name: "Создать статью", exact: true })
    .click();
  await page
    .getByLabel("Заголовок публикации", { exact: true })
    .fill("Вторая статья в этот же день");
  await page
    .getByRole("textbox", { name: "Основной текст статьи", exact: true })
    .fill("Второй содержательный текст.");
  await publishDaily(page);
  await other.goto("http://127.0.0.1:5173/word-of-the-day");
  await expect(
    other.getByRole("link", {
      name: "Визуальная статья для проверки",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    other.getByRole("link", {
      name: "Вторая статья в этот же день",
      exact: true,
    }),
  ).toBeVisible();
  await visitor.close();
});

test("inline word-card creation, explicit separate word publication, live shared languages and guarded daily-only cleanup", async ({
  page,
}) => {
  await login(page);
  await section(page, "Слово дня");
  await page
    .getByRole("button", { name: "Создать карточку слова", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать новое слово здесь", exact: true })
    .click();
  await page
    .getByLabel("Русское слово", { exact: true })
    .fill("Встроенная тестовая карточка");
  await page
    .getByLabel("Краткое определение или описание", { exact: true })
    .fill("Описание карточки, созданной внутри публикации");
  await page
    .getByRole("button", { name: "Языковые карточки", exact: true })
    .click();
  await addTestLanguage(page, "Язык встроенной карточки", "test-inline");
  await page
    .getByRole("button", {
      name: "Сохранить слово и использовать",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Слово сохранено как черновик",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Сначала явно опубликуйте",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Опубликовать связанное слово", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "выпуск ещё не опубликован",
  );
  await publishDaily(page);
  const result = (
    await (await page.request.get("/api/admin/publications/daily")).json()
  ).find(
    (r: { data: { title: string } }) =>
      r.data.title === "Встроенная тестовая карточка",
  );
  await page.goto("/word-of-the-day/issue/" + result.data.slug);
  await expect(
    page.getByRole("tab", { name: "Язык встроенной карточки", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Добавить язык / редактировать языковую карточку",
      exact: true,
    })
    .click();
  await addTestLanguage(page, "Ещё один язык карточки", "second form");
  await publishWord(page);
  await page.goto("/word-of-the-day/issue/" + result.data.slug);
  await expect(
    page.getByRole("tab", { name: "Ещё один язык карточки", exact: true }),
  ).toBeVisible();
  const latest = (
    await (await page.request.get("/api/admin/publications/daily")).json()
  ).find((r: { id: string }) => r.id === result.id);
  expect(latest.data.publishedAt).toBe(result.data.publishedAt);
  const before = await (await page.request.get("/api/content")).json();
  const journalBefore = (
    await (await page.request.get("/api/editorial")).json()
  ).journal;
  await page.goto("/admin?section=daily");
  await page
    .getByText("Управление прежними выпусками", { exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Удалить все публикации «Слова дня»",
      exact: true,
    })
    .click();
  page.once("dialog", (d) => d.accept("В КОРЗИНУ"));
  await page
    .getByRole("button", {
      name: "Переместить все выпуски в корзину",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("Операция выполнена");
  expect(await (await page.request.get("/api/content")).json()).toEqual(before);
  expect(
    (await (await page.request.get("/api/editorial")).json()).journal,
  ).toEqual(journalBefore);
  await page.goto("/word-of-the-day");
  await expect(
    page.getByRole("heading", {
      name: "Новые публикации скоро появятся",
      exact: true,
    }),
  ).toBeVisible();
});
