import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
const out = process.env.EXPORT_DIR;
let html = readFileSync("index.html", "utf8")
  .replace(
    '<script type="module" src="/src/main.tsx"></script>',
    '<script defer src="./assets/site.js"></script>',
  )
  .replace(
    "</head>",
    '<meta http-equiv="Content-Security-Policy" content="connect-src \'none\'; object-src \'none\'" />\n    <link rel="stylesheet" href="./assets/site.css" />\n  </head>',
  )
  .replace(
    '<div id="root"></div>',
    '<div id="root"></div>\n    <noscript>Для поиска, навигации и интерактивной карты включите JavaScript в браузере.</noscript>',
  );
writeFileSync(join(out, "index.html"), html);
mkdirSync(join(out, "data"), { recursive: true });
mkdirSync(join(out, "sources"), { recursive: true });
for (const name of ["catalog.json", "editorial.json"])
  copyFileSync(join("src/offline", name), join(out, "data", name));
const audit = readFileSync(
  "research/reports/INITIAL_RESEARCH_AUDIT.md",
  "utf8",
);
copyFileSync(
  "research/reports/INITIAL_RESEARCH_AUDIT.md",
  join(out, "sources", "INITIAL_RESEARCH_AUDIT.md"),
);
writeFileSync(
  join(out, "sources", "audit.html"),
  '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Исходный аудит — Русский след</title><link rel="stylesheet" href="../assets/site.css"><body><main style="max-width:1000px;margin:auto;padding:2rem"><a href="../index.html#/journal">← Журнал «Русский след»</a><p>Исходный исторический аудит от 3 ноября 2026 года. Текст сохранён без содержательных изменений; это документ исследования, а не текущая инструкция редакции.</p><article class="markdown">' +
    renderToStaticMarkup(
      React.createElement(
        ReactMarkdown,
        { remarkPlugins: [remarkGfm], skipHtml: true },
        audit,
      ),
    ) +
    "</article></main></body></html>",
);
const names = {
  matryoshka: "Матрёшка",
  kalashnikov: "Калашников",
  dacha: "Дача",
  intelligentsia: "Интеллигенция",
  pogrom: "Погром",
  samizdat: "Самиздат",
  sputnik: "Спутник",
  samovar: "Самовар",
};
for (const name of Object.keys(names))
  copyFileSync(
    join("research/original_pdfs", name + "_dossier.pdf"),
    join(out, "sources", name + "_dossier.pdf"),
  );
const guide = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Как открыть — Русский след</title><link rel="stylesheet" href="assets/site.css"><body><main style="max-width:900px;margin:auto;padding:2rem"><h1>«Русский след» — автономная версия для экспертов</h1><p>Редакция от 16 ноября 2026 года, исходный коммит <code>bc9ad786f292a869312a2e3b0afbaab5dcf6678e</code>.</p><p>Распакуйте весь ZIP в одну папку. Откройте <a href="index.html">index.html</a> двойным щелчком в Safari, Chrome, Edge или Firefox. Node.js, SQLite, сервер и интернет не нужны. Не открывайте HTML прямо внутри ZIP или в предпросмотре файла: сначала извлеките всю папку.</p><p><a class="button" href="index.html">Открыть сайт →</a></p><p>Сохранены исходные оформление, CSS, тексты, 28 словарных статей, 24 исследовательские карточки, 40 дополнительных форм, 9 языков, 65 источников, три статьи журнала, поиск, фильтры, сравнение, путешествия слов и интерактивная карта. Навигация использует адреса вида <code>index.html#/dictionary</code>, совместимые с локальным файлом. «Слово дня» зафиксировано алгоритмом исходного сайта на 16 ноября 2026 года.</p><p>Это публичная копия для чтения. CMS, вход владельца, изменения базы и публикация в неё не включены. Формы предложений и сообщений, как в оригинале, скачивают текст локально и ничего не отправляют.</p><p>Научные статусы не повышались. Слой карты «Словарные соответствия» отличается от слоя подтверждённых заимствований. Внешние словарные сайты, DOI и иные внешние библиографические ссылки сохранены; переход на них требует интернет. Их названия и библиографические описания доступны в статьях офлайн.</p><h2>Исходные материалы в архиве</h2><p>Это дополнительные оригинальные PDF-досье из того же коммита. Они не заменяют словари, указанные в библиографии отдельных форм.</p><ul>${Object.entries(
  names,
)
  .map(
    ([id, name]) =>
      `<li><a href="sources/${id}_dossier.pdf">${name} — PDF-досье</a></li>`,
  )
  .join(
    "",
  )}<li><a href="sources/audit.html">Исторический исходный аудит</a></li></ul><p>Публичные материалы сформированы штатными преобразованием и публикацией на отдельной временной базе из файлов указанного коммита. Личная база и файлы исходного проекта не изменялись. JSON-копии публичных данных для сверки находятся в <code>data/</code>; приложение не загружает их по сети — данные уже встроены в JavaScript.</p><p>Флаги: flag-icons, MIT, лицензия в <code>flags/LICENSE.txt</code>. Картография: Natural Earth / world-atlas, public domain. Исходные системные шрифты сохраняются; конкретное начертание может зависеть от ОС. Результаты браузерных проверок: <a href="verification.json">verification.json</a>.</p></main></body></html>`;
writeFileSync(
  join(out, "ОТКРОЙТЕ_СНАЧАЛА.html"),
  process.env.EXPORT_HISTORICAL === "1"
    ? guide
    : guide.replace(
        "«Слово дня» зафиксировано алгоритмом исходного сайта на 16 ноября 2026 года.",
        "«Слово дня» использует исходный алгоритм и текущую дату браузера.",
      ),
);
writeFileSync(
  join(out, "README.txt"),
  "«Русский след» — автономная публичная редакция от 16.11.2026\n\n1. Полностью распакуйте ZIP.\n2. Откройте index.html в обычном браузере (Safari/Chrome/Edge/Firefox).\n3. Не перемещайте index.html отдельно от assets, flags, data и sources.\n\nНикакая установка не требуется. Сайт, поиск, статьи и карта работают без интернета. Для поиска и карты нужен включённый JavaScript. Внешние библиографические сайты требуют интернет, но ссылки и описания сохранены. Восемь оригинальных PDF-досье доступны в sources.\n\nПодробности: ОТКРОЙТЕ_СНАЧАЛА.html\nИсходный коммит: bc9ad786f292a869312a2e3b0afbaab5dcf6678e\nCMS и пользовательская база в архив не входят.\n",
);
console.log("Offline HTML, snapshot, source PDFs and guide prepared");
