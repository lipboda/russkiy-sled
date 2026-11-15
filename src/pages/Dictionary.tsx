import { CompactWord, ContextLinks } from "../components/CompactWord";
import {
  publicCards,
  publicProse,
  correspondenceText,
} from "../domain/publicPresentation";
import { LanguageLabel } from "../components/LanguageLabel";
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
  const [research, setResearch] = useState(false);
  const [sort, setSort] = useState("asc");
  const result = searchWords({
    query,
    languages,
    mode,
    theme,
    depth,
    correspondenceType,
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
            {Object.entries(languageNames).map(([code]) => (
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
                <LanguageLabel code={code} />
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
      </>
    );
  const cards = publicCards(w);
  return (
    <>
      <Link className="back" to="/dictionary">
        ← К словарю
      </Link>
      <PageTitle eyebrow="Сравнительное исследование" title={w.russianLemma}>
        {w.russianStress && (
          <span className="stress-word">{w.russianStress}</span>
        )}
      </PageTitle>
      {w.coverId && <PublishedImage id={w.coverId} fallback={w.russianLemma} />}
      {w.shortDescription && (
        <p className="article-definition">{w.shortDescription}</p>
      )}
      <p className="eyebrow">{w.themes.join(" · ")}</p>
      <ResearchNotes word={w} fields={["origin"]} />
      {w.culturalContext && (
        <p className="preline">{publicProse(w.culturalContext)}</p>
      )}
      {publicProse(w.editorialNotes) && (
        <p className="scientific-context preline">
          {publicProse(w.editorialNotes)}
        </p>
      )}
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
              {cards.map((l) => (
                <option key={l.languageCode} value={l.languageCode}>
                  {languageNames[l.languageCode]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {cards
          .filter((l) => !language || l.languageCode === language)
          .map((l) => (
            <details className="language-card" key={l.languageCode} open>
              <summary>
                <LanguageLabel code={l.languageCode} country={l.countryCode} />
                <span>{l.reportedForms[0]}</span>
              </summary>
              <div className="language-content">
                <p className="foreign-form" lang={l.languageCode}>
                  {l.reportedForms.join(" · ")}
                </p>
                {correspondenceText(l) && <p>{correspondenceText(l)}</p>}
                {publicProse(l.comment) && (
                  <p className="scientific-context">{publicProse(l.comment)}</p>
                )}
                {(
                  [
                    ["Значение", l.meaning],
                    ["Происхождение", l.origin],
                    ["Транскрипция", l.ipa],
                    ["Графическая адаптация", l.graphic],
                    ["Фонетическая адаптация", l.phonetic],
                    ["Семантическая адаптация", l.semantic],
                    ["Грамматическая адаптация", l.grammar],
                    ["Сфера употребления", l.register],
                    ["Частотность", l.frequency],
                    ["Примеры", l.examples],
                    ["Степень освоенности", l.integration],
                  ] as const
                )
                  .filter(([, v]) => publicProse(v))
                  .map(([label, value]) => (
                    <p className="preline" key={label}>
                      <strong>{label}: </strong>
                      {publicProse(value)}
                    </p>
                  ))}
                <ContextLinks links={l.links} ids={l.sourceIds} />
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
          "conclusion",
        ]}
      />
      <section className="section">
        <h2>Источники статьи</h2>
        <ContextLinks links={w.links} ids={w.sourceIds} />
      </section>
      <Link
        className="text-link"
        to={"/report-error?word=" + encodeURIComponent(w.russianLemma)}
      >
        Сообщить об ошибке в статье →
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
  const [scope, setScope] = useState("research");
  const candidates = scope === "research" ? mainResearchWords() : words;
  const codes =
    scope === "research"
      ? ["en-US", "fr-FR", "hy-AM"]
      : [
          ...new Set(
            candidates.flatMap((w) => w.languages.map((l) => l.languageCode)),
          ),
        ];
  const scopeControl = (
    <label>
      Область сравнения
      <select
        value={scope}
        onChange={(e) => {
          setScope(e.target.value);
          setLanguage("en-US");
          setTheme("");
        }}
      >
        <option value="research">Основное исследование: 8 слов, 3 языка</option>
        <option value="dictionary">
          Общий словарь: все опубликованные формы
        </option>
      </select>
    </label>
  );
  const w = candidates.find((w) => w.slug === slug) ?? candidates[0];
  if (!w)
    return (
      <>
        {scopeControl}
        <p>Пока нет опубликованных записей для сравнения.</p>
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="Три языка · одна исследовательская рамка"
        title="Сравнительное исследование"
      >
        Сопоставляйте форму, значение и способы адаптации. Словарная фиксация и
        степень освоения рассматриваются отдельно.
      </PageTitle>
      {scopeControl}
      {logged && (
        <Link className="button" to={"/admin?word=" + w.id + "&tab=languages"}>
          Редактировать языковые карточки этого слова
        </Link>
      )}
      <p>
        {scope === "research"
          ? "Основной набор: Матрёшка → Калашников → Дача → Интеллигенция → Погром → Самиздат → Спутник → Самовар. Другие материалы остаются в общем словаре."
          : "Общее словарное сравнение включает опубликованные языковые формы. Переводы, собственные имена и другие соответствия рассматриваются отдельно от заимствований; основная исследовательская выборка сохраняется."}
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
                {codes
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
          </div>
          <div
            className="research-table"
            role="region"
            aria-label="Сравнительная таблица"
            tabIndex={0}
          >
            <table>
              <caption>
                <LanguageLabel code={language} /> · {comparisonFields[field]}.
                Только опубликованные данные.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Слово</th>
                  <th scope="col">{comparisonFields[field]}</th>
                  <th scope="col">Иностранная форма</th>
                </tr>
              </thead>
              <tbody>
                {candidates
                  .filter((entry) => !theme || entry.themes.includes(theme))
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
                              : publicProse(languageComparison(card, field)) ||
                                "Не установлено для этого языка; см. сводные замечания в статье."
                            : "Данные пока не собраны"}
                        </td>
                        <td>{card?.reportedForms.join(" · ") || "—"}</td>
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
            {(scope === "research"
              ? codes
              : w.languages.map((l) => l.languageCode)
            ).map((code) => {
              const l = w.languages.find((l) => l.languageCode === code);
              if (!l)
                return (
                  <section className="paper" key={code}>
                    <h2>
                      <LanguageLabel code={code} />
                    </h2>
                    <p>Данные пока не собраны.</p>
                  </section>
                );
              return (
                <section className="paper" key={l.languageCode}>
                  <h2>
                    <LanguageLabel
                      code={l.languageCode}
                      country={l.countryCode}
                    />
                  </h2>
                  <p className="preline">
                    {publicProse(languageComparison(l, field)) ||
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
          <ResearchNotes
            word={w}
            fields={[field === "integration" ? "conclusion" : field]}
          />
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
