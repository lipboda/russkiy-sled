import { CompactWord, ContextLinks } from "../components/CompactWord";
import { correspondenceNames } from "../domain/universal";
import { PublishedImage } from "../components/PublishedImage";
import { useSession } from "../domain/session";
import { useState } from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";
import { languageNames, words, type Language } from "../domain/catalog";
import {
  mainResearchWords,
  comparisonFields,
  languageComparison,
  type ComparisonField,
} from "../domain/research";
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
  const [theme, setTheme] = useState(params.get("theme") ?? "");
  const [correspondenceType, setCorrespondenceType] = useState("");
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
    correspondenceType,
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
      <p className="notice">
        Общий словарь включает заимствования, переводы и другие языковые
        соответствия. Тип соответствия и достоверность формы указываются
        отдельно.
      </p>
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
            Тип соответствия
            <select
              aria-label="Тип соответствия"
              value={correspondenceType}
              onChange={(e) => setCorrespondenceType(e.target.value)}
            >
              <option value="">Все типы</option>
              {Object.entries(correspondenceNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
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
              setCorrespondenceType("");
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
export function Article({
  previewWord,
}: { previewWord?: (typeof words)[number] } = {}) {
  const { slug } = useParams();
  const w = previewWord ?? words.find((w) => w.slug === slug);
  const [language, setLanguage] = useState("");
  if (!w) return <Missing />;
  if (
    (w.format ?? (w.articleDepth === "short" ? "compact" : "detailed")) ===
    "compact"
  )
    return (
      <>
        <Link className="back" to="/dictionary">
          ← К словарю
        </Link>
        <CompactWord word={w} />
        {w.notes.length > 0 && (
          <details>
            <summary>Сохранённые исследовательские материалы</summary>
            <ResearchNotes word={w} />
          </details>
        )}
      </>
    );
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
        <Badge /> Словарная статья · языковые соответствия
      </PageTitle>
      <Notice />
      {w.coverId && <PublishedImage id={w.coverId} fallback={w.russianLemma} />}
      {w.russianStress && <p>Написание и ударение: {w.russianStress}</p>}
      {w.shortDescription && <p className="preline">{w.shortDescription}</p>}
      {w.editorialNotes && (
        <aside className="paper preline">
          <strong>Редакционное примечание: </strong>
          {w.editorialNotes}
        </aside>
      )}
      {w.culturalContext && <p className="preline">{w.culturalContext}</p>}
      {w.checkedAt && <p>Последняя проверка: {w.checkedAt}</p>}
      {w.scientificStatus && (
        <Badge>
          {
            {
              confirmed: "Подтверждено",
              partial: "Частично подтверждено",
              pending: "Требует проверки",
              disputed: "Спорно",
              unconfirmed: "Не подтверждено",
              insufficient: "Недостаточно данных",
            }[w.scientificStatus]
          }
        </Badge>
      )}
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
              {w.languages
                .filter((l) => !l.hidden && !l.unpublished)
                .map((l) => [l.languageCode, languageNames[l.languageCode]])
                .map(([c, n]) => (
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
          .filter(
            (l) =>
              !l.hidden &&
              !l.unpublished &&
              (!language || l.languageCode === language),
          )
          .map((l) => (
            <details className="language-card" key={l.languageCode} open>
              <summary>
                <span>{languageNames[l.languageCode]}</span>
                <Badge>
                  {!l.reportedForms.length
                    ? "Материал собирается"
                    : {
                        verified: "Подтверждено",
                        partial: "Частично подтверждено",
                        presumed: "Предположительно",
                        pending: "Требует проверки",
                        disputed: "Спорно",
                        unknown: "Недостаточно данных",
                      }[l.attestationStatus]}
                </Badge>
              </summary>
              <div className="language-content">
                <p>{correspondenceNames[l.correspondenceType ?? "unknown"]}</p>
                <ContextLinks links={l.links} ids={[]} />
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
                {(
                  [
                    ["Транскрипция", l.ipa],
                    ["Графическая адаптация", l.graphic],
                    ["Фонетическая адаптация", l.phonetic],
                    ["Семантическая адаптация", l.semantic],
                    ["Грамматика", l.grammar],
                    ["Значения", l.meaning],
                    ["Регистр", l.register],
                    ["Частотность", l.frequency],
                    ["Примеры", l.examples],
                    ["Степень освоения", l.integration],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <p className="preline" key={label}>
                      <strong>{label}: </strong>
                      {value}
                    </p>
                  ))}
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
      <ContextLinks links={w.links} ids={[]} />
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
  const logged = useSession();
  const [slug, setSlug] = useState("matryoshka");
  const [field, setField] = useState<ComparisonField>("graphic");
  const [mode, setMode] = useState("word");
  const [language, setLanguage] = useState<Language>("en-US");
  const [theme, setTheme] = useState("");
  const [status, setStatus] = useState("");
  const candidates = mainResearchWords();
  const w = candidates.find((w) => w.slug === slug) ?? candidates[0];
  if (!w) return <p>Пока нет опубликованных записей для сравнения.</p>;
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
      {logged && (
        <Link className="button" to={"/admin?word=" + w.id + "&tab=languages"}>
          Редактировать языковые карточки этого слова
        </Link>
      )}
      <p>
        Основной набор: Матрёшка → Калашников → Дача → Интеллигенция → Погром →
        Самиздат → Спутник → Самовар. Другие материалы остаются в общем словаре.
      </p>
      <label>
        Режим сравнения
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="word">Одно слово</option>
          <option value="set">Исследовательский набор</option>
        </select>
      </label>
      <div className="toolbar">
        <label>
          Слово
          <select
            aria-label="Слово"
            value={w.slug}
            onChange={(e) => setSlug(e.target.value)}
          >
            {candidates.map((w) => (
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
            onChange={(e) => setField(e.target.value as ComparisonField)}
          >
            {Object.entries(comparisonFields).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mode === "set" ? (
        <>
          <div className="toolbar">
            <label>
              Язык набора
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                {["en-US", "fr-FR", "hy-AM"]
                  .map((code) => [code, languageNames[code]])
                  .map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Тема набора
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="">Все темы</option>
                {[...new Set(candidates.flatMap((w) => w.themes))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Достоверность формы
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Все статусы</option>
                <option value="verified">Подтверждено</option>
                <option value="pending">Требует проверки</option>
                <option value="disputed">Спорно</option>
                <option value="unknown">Не установлено</option>
              </select>
            </label>
          </div>
          <div
            className="research-table"
            role="region"
            aria-label="Сравнительная таблица"
            tabIndex={0}
          >
            <table>
              <caption>
                {languageNames[language]} · {comparisonFields[field]}. Только
                опубликованные данные.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Слово</th>
                  <th scope="col">{comparisonFields[field]}</th>
                  <th scope="col">Достоверность формы</th>
                </tr>
              </thead>
              <tbody>
                {candidates
                  .filter(
                    (entry) =>
                      (!theme || entry.themes.includes(theme)) &&
                      (!status ||
                        entry.languages.find((l) => l.languageCode === language)
                          ?.attestationStatus === status),
                  )
                  .map((entry) => {
                    const card = entry.languages.find(
                      (l) => l.languageCode === language,
                    );
                    return (
                      <tr key={entry.id}>
                        <th scope="row">
                          <Link to={"/dictionary/" + entry.slug}>
                            {entry.russianLemma}
                          </Link>
                        </th>
                        <td className="preline">
                          {card
                            ? field === "sources"
                              ? card.sourceIds.map((id) => (
                                  <SourceLink key={id} id={id} />
                                ))
                              : languageComparison(card, field) ||
                                "Не установлено для этого языка; см. сводные замечания в статье."
                            : "Данные пока не собраны"}
                        </td>
                        <td>
                          {card
                            ? {
                                verified: "Подтверждено",
                                partial: "Частично подтверждено",
                                presumed: "Предположительно",
                                pending: "Требует проверки",
                                disputed: "Спорно",
                                unknown: "Не установлено",
                              }[card.attestationStatus]
                            : "Нет карточки"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="comparison-grid">
            {["en-US", "fr-FR", "hy-AM"].map((code) => {
              const l = w.languages.find((l) => l.languageCode === code);
              if (!l)
                return (
                  <section className="paper" key={code}>
                    <h2>{languageNames[code as Language]}</h2>
                    <p>Данные пока не собраны.</p>
                  </section>
                );
              return (
                <section className="paper" key={l.languageCode}>
                  <p className="eyebrow">{l.languageCode}</p>
                  <h2>{languageNames[l.languageCode]}</h2>
                  <Badge>
                    {
                      {
                        verified: "Подтверждено",
                        partial: "Частично подтверждено",
                        presumed: "Предположительно",
                        pending: "Требует проверки",
                        disputed: "Спорно",
                        unknown: "Не установлено",
                      }[l.attestationStatus]
                    }
                  </Badge>
                  <p className="preline">
                    {languageComparison(l, field) ||
                      (field === "sources"
                        ? ""
                        : "Отдельное наблюдение для языка не установлено.")}
                  </p>
                  {field === "sources" &&
                    l.sourceIds.map((id) => <SourceLink key={id} id={id} />)}
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
              );
            })}
          </div>
          <div className="paper">
            <p className="eyebrow">
              Сводный комментарий аудита · не отдельный вывод для каждого языка
            </p>
            <ResearchNotes
              word={w}
              fields={[field === "integration" ? "issues" : field]}
            />
          </div>
          <Link className="button" to={"/dictionary/" + w.slug}>
            Все материалы о слове ↗
          </Link>
        </>
      )}
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
