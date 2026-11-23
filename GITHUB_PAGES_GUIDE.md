# GitHub Pages: публичная редакция

Публичный адрес после успешного deployment: **https://lipboda.github.io/russkiy-sled/**.

Сборка сохраняет исходные публичные React-компоненты, CSS, 28 финальных статей, 64 языковые формы, 65 источников, журнал, поиск, сравнение и карту. Она создаётся во временном каталоге из Git-версии; рабочая SQLite и файлы приложения не перезаписываются. Механизм hash-навигации (`#/dictionary`) позволяет открывать и перезагружать статьи в подкаталоге Pages без 404. Ресурсы локальные, без внешних CDN.

GitHub Pages — статический хостинг. Node.js API, SQLite, вход владельца, редактирование и публикация через CMS на нём не работают и не имитируются. CMS остаётся на MacBook. Данные публикации берутся из финального файла в Git, а не из недоступной локальной базы MacBook; новые личные правки и изображения из SQLite автоматически на Pages не копируются. Поэтому публичную редакцию из коммита можно воспроизвести точно, но обещать полную работу CMS на Pages технически невозможно.

## Что настроено

- `.github/workflows/pages.yml`: сборка и deployment при push в `feat/homepage-editorial-redesign` или `main`, а также ручной запуск.
- Node 24, `npm ci`, TypeScript, ESLint, модульные и серверные тесты.
- `scripts/export-public.mjs`: отдельный статический снимок без пользовательской базы.
- Проверка 28 страниц, поиска, карты, сравнения, флагов, мобильной ширины и отсутствия обращений к API через Playwright. URL проверяется с префиксом `/russkiy-sled/`.
- `configure-pages`, `upload-pages-artifact`, `deploy-pages`: стандартный GitHub Actions Pages deployment. Токен имеет только `contents: read`, `pages: write`, `id-token: write`; пароли в Git не добавляются.

## Действия владельца, если Pages ещё не включены

Из облачной среды административный API GitHub не доступен: `gh auth status` не подтвердил токен, API настроек Pages и прямой запрос публичного URL блокируются прокси среды. Поэтому факт успешного размещения нельзя подтвердить до проверки в интерфейсе GitHub.

1. Откройте https://github.com/lipboda/russkiy-sled/settings/pages от своего аккаунта.
2. В **Build and deployment → Source** выберите **GitHub Actions**.
3. Откройте https://github.com/lipboda/russkiy-sled/actions, выберите **Publish public dictionary to GitHub Pages** и последний запуск ветки `feat/homepage-editorial-redesign`.
4. Если запуск уже завершился ошибкой до включения Pages, нажмите **Re-run all jobs**. При успешном завершении задания `deploy` появится ссылка на сайт.
5. Если GitHub блокирует именно deployment ветки политикой environment, в **Settings → Environments → github-pages → Deployment branches and tags** разрешите ветку `feat/homepage-editorial-redesign`, затем повторите запуск.
6. Проверьте https://lipboda.github.io/russkiy-sled/ в обычном браузере: главная, словарь, статья, поиск `samovar`, исследование и выбор страны на карте. Не считайте сайт опубликованным, пока задание `deploy` не стало зелёным и публичный адрес не открылся.

Следующие push в настроенную ветку автоматически пересобирают публичную редакцию. Новых ключей, оплаты и ручного копирования HTML не требуется. Внешние библиографические сайты остаются внешними ссылками; переход на них требует сети.

## Локальная проверка экспортера

```sh
npm ci
node scripts/export-public.mjs --out /tmp/russkiy-sled-pages-new
node scripts/check-public.mjs /tmp/russkiy-sled-pages-new
npx playwright install chromium
node scripts/test-pages.mjs /tmp/russkiy-sled-pages-new
```

Путь вывода должен быть новым. Для исторического ZIP от 16.11.2026 добавьте `--ref bc9ad786f292a869312a2e3b0afbaab5dcf6678e --historical`. Ни одна команда не открывает `.cms/content.sqlite` исходного проекта.

Доступность GitHub Pages из России без VPN зависит от провайдера и блокировок GitHub; выбранный хостинг не предоставляет такой гарантии. Из этой среды региональная доступность из России не проверяется.
