import { useState } from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";
import { languageNames, words, type Language } from "../domain/catalog";
import { searchWords } from "../domain/search";
import {
  Badge,
  Notice,
  PageTitle,
  ResearchNotes,
  SearchBox,
  SourceLink,
  WordCard,
} from "../components/Common";
export function Dictionary() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [languages, setLanguages] = useState<Language[]>([]);
  const [mode, setMode] = useState<"any" | "all">("any");
  const [theme, setTheme] = useState("");
  const [depth, setDepth] = useState("");
  const [status, setStatus] = useState("");
  const [research, setResearch] = useState(false);
  const [sort, setSort] = useState("asc");
  const result = searchWords({
    query,
    languages,
    mode,
    theme,
    depth,
    status,
    research,
    sort,
  });
  return (
    <>
      <PageTitle
        eyebrow="Лексикографическая коллекция"
        title="Электронный словарь"
      >
        Слова, пересекающие границы. Формы, источники и вопросы, на которые ещё
        предстоит ответить.
      </PageTitle>
      <Notice />
      <SearchBox
        initial={query}
        onChange={(v) => setParams(v ? { q: v } : {}, { replace: true })}
      />
      <div className="dictionary-layout">
        <aside className="filters">
          <h2>Уточнить поиск</h2>
          <fieldset>
            <legend>Принимающий язык</legend>
            {Object.entries(languageNames).map(([code, label]) => (
              <label className="check" key={code}>
                <input
                  type="checkbox"
                  checked={languages.includes(code as Language)}
                  onChange={(e) =>
                    setLanguages(
                      e.target.checked
                        ? [...languages, code as Language]
                        : languages.filter((l) => l !== code),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label>
            Режим языков
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "any" | "all")}
            >
              <option value="any">Хотя бы в одном</option>
              <option value="all">Во всех — подтверждённые</option>
            </select>
          </label>
          <label>
            Тема
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="">Все темы</option>
              {[...new Set(words.flatMap((w) => w.themes))].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Полнота статьи
            <select value={depth} onChange={(e) => setDepth(e.target.value)}>
              <option value="">Любая</option>
              <option value="short">Краткая запись</option>
              <option value="full">Подробный разбор</option>
            </select>
          </label>
          <label>
            Статус публикации
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все статусы</option>
              <option value="draft">Материал собирается</option>
              <option value="provisional">Предварительный разбор</option>
              <option value="verified">Подтверждённые</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={research}
              onChange={(e) => setResearch(e.target.checked)}
            />
            С подробным исследованием
          </label>
          <button
            className="text-button"
            onClick={() => {
              setLanguages([]);
              setMode("any");
              setTheme("");
              setDepth("");
              setStatus("");
              setResearch(false);
              setSort("asc");
              setParams({});
            }}
          >
            Сбросить фильтры
          </button>
        </aside>
        <section>
          <div className="results-bar">
            <p role="status">Найдено записей: {result.length}</p>
            <label>
              Сортировка
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="asc">По алфавиту: А–Я</option>
                <option value="desc">По алфавиту: Я–А</option>
                <option value="relevance">По релевантности</option>
              </select>
            </label>
          </div>
          {result.length ? (
            <div className="word-grid">
              {result.map((w) => (
                <WordCard key={w.id} word={w} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>Пока ничего не найдено</h2>
              <p>
                Попробуйте другое написание или уберите фильтры. Режим «во всех»
                учитывает только подтверждённые формы.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
export function Article() {
  const { slug } = useParams();
  const w = words.find((w) => w.slug === slug);
  const [language, setLanguage] = useState("");
  if (!w) return <Missing />;
  return (
    <>
      <Link className="back" to="/dictionary">
        ← К словарю
      </Link>
      <PageTitle
        eyebrow={
          w.articleDepth === "full"
            ? "Подробный исследовательский разбор"
            : "Краткая исследовательская запись"
        }
        title={w.russianLemma}
      >
        <Badge /> Русский → иностранные языки
      </PageTitle>
      <Notice />
      <div className="article-meta">
        <span>Тема: {w.themes.join(", ")}</span>
        <span>Происхождение: требует проверки</span>
        <span>Аудит: 3 ноября 2026 · не дата внешней верификации</span>
      </div>
      <ResearchNotes word={w} fields={["origin"]} />
      <section className="section">
        <div className="section-heading">
          <h2>Иностранные формы</h2>
          <label>
            Язык статьи
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="">Все языки</option>
              {Object.entries(languageNames).map(([c, n]) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>
          Ниже воспроизводятся сообщения досье и реестра. Написания и их
          нормативный статус не проверены заново.
        </p>
        {w.languages
          .filter((l) => !language || l.languageCode === language)
          .map((l) => (
            <details className="language-card" key={l.languageCode} open>
              <summary>
                <span>{languageNames[l.languageCode]}</span>
                <Badge>
                  {l.reportedForms.length
                    ? "Требует проверки"
                    : "Материал собирается"}
                </Badge>
              </summary>
              <div className="language-content">
                {l.reportedForms.length ? (
                  <ul>
                    {l.reportedForms.map((f, i) => (
                      <li key={i} lang={l.languageCode}>
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Подтверждённая форма не установлена в текущем аудите.</p>
                )}
                {l.references.map((r, i) => (
                  <SourceLink key={i} id={r.sourceId} pages={r.pages} />
                ))}
                {!l.references.length &&
                  l.sourceIds.map((id) => <SourceLink key={id} id={id} />)}
              </div>
            </details>
          ))}
      </section>
      <ResearchNotes
        word={w}
        fields={[
          "semantic",
          "graphic",
          "phonetic",
          "grammar",
          "chronology",
          "issues",
          "sources",
        ]}
      />
      <section className="section">
        <h2>Источники записи</h2>
        <p>
          Полные атрибуции сохранены в досье. Ссылки ведут к материалам
          конкретной версии репозитория.
        </p>
        {w.sourceIds.map((id) => (
          <SourceLink key={id} id={id} />
        ))}
      </section>
      <Link
        className="button secondary"
        to={"/report-error?word=" + encodeURIComponent(w.russianLemma)}
      >
        Сообщить об ошибке в статье ↗
      </Link>
    </>
  );
}
export function Comparison() {
  const [slug, setSlug] = useState("samovar");
  const [field, setField] = useState("graphic");
  const w = words.find((w) => w.slug === slug)!;
  return (
    <>
      <PageTitle
        eyebrow="Три языка · одна исследовательская рамка"
        title="Сравнительное исследование"
      >
        Сопоставляйте написания и изучайте оговорки аудита. Не считайте пробелы
        доказательством отсутствия заимствования.
      </PageTitle>
      <Notice />
      <div className="toolbar">
        <label>
          Слово
          <select
            aria-label="Слово"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          >
            {words
              .filter((w) => w.researchIncluded)
              .map((w) => (
                <option key={w.id} value={w.slug}>
                  {w.russianLemma}
                </option>
              ))}
          </select>
        </label>
        <label>
          Параметр
          <select
            aria-label="Параметр"
            value={field}
            onChange={(e) => setField(e.target.value)}
          >
            <option value="graphic">Графика</option>
            <option value="phonetic">Фонетика</option>
            <option value="semantic">Семантика</option>
            <option value="grammar">Грамматика</option>
            <option value="issues">Освоенность и ограничения</option>
          </select>
        </label>
      </div>
      <div className="comparison-grid">
        {w.languages.map((l) => (
          <section className="paper" key={l.languageCode}>
            <p className="eyebrow">{l.languageCode}</p>
            <h2>{languageNames[l.languageCode]}</h2>
            <Badge />
            {l.reportedForms.length ? (
              <ul>
                {l.reportedForms.map((f, i) => (
                  <li key={i} lang={l.languageCode}>
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Подтверждённая форма не установлена.</p>
            )}
          </section>
        ))}
      </div>
      <div className="paper">
        <p className="eyebrow">
          Сводный комментарий аудита · не отдельный вывод для каждого языка
        </p>
        <ResearchNotes word={w} fields={[field]} />
      </div>
      <Link className="button" to={"/dictionary/" + slug}>
        Все материалы о слове ↗
      </Link>
    </>
  );
}
export function Missing() {
  return (
    <>
      <PageTitle eyebrow="404" title="Эта страница не найдена">
        Возможно, адрес изменился. Вернитесь в словарь, чтобы продолжить поиск.
      </PageTitle>
      <Link className="button" to="/dictionary">
        Открыть словарь
      </Link>
    </>
  );
}
