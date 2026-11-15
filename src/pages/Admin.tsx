import { CategoryPicker } from "../components/CategoryPicker";
import { editorial } from "../domain/editorial";
import {
  Management,
  MediaSelect,
  SourceSelect,
  WordSelect,
} from "./Management";
import { useEffect, useRef, useState } from "react";
import {
  sources,
  wordSchema,
  refreshPublicCatalog,
  languageNames,
  type WordEntry,
} from "../domain/catalog";
import { Article } from "./Dictionary";
import "./admin.css";
import { Link, useBlocker, useSearchParams } from "react-router-dom";
import { wordSlug } from "../domain/slug";
import { api, setSession, useSession } from "../domain/session";

type Value = string | number | boolean | Value[] | { [key: string]: Value };
type Row = {
  id: string;
  data: WordEntry;
  state: string;
  version: number;
  updated: string;
  published: boolean;
};
const editorSections = {
  main: {
    title: "Основная информация",
    keys: [
      "slug",
      "russianLemma",
      "russianStress",
      "shortDescription",
      "themes",
      "articleDepth",
      "researchIncluded",
      "isDemo",
      "editorialNotes",
    ],
  },
  languages: { title: "Языковые карточки", keys: ["languages"] },
  science: {
    title: "Лингвистический анализ",
    keys: [
      "originKind",
      "culturalContext",
      "scientificStatus",
      "publicationStatus",
      "auditStatus",
      "checkedAt",
      "notes",
    ],
  },
  sources: { title: "Источники статьи", keys: ["sourceIds"] },
  examples: { title: "Примеры употребления", keys: ["languages"] },
  related: {
    title: "Связанные материалы",
    keys: ["coverId", "relatedWordIds"],
  },
  technical: { title: "Дополнительные настройки", keys: ["id", "slug"] },
} as const;
const states: Record<string, string> = {
  draft: "Черновик",
  review: "На проверке",
  published: "Опубликовано",
  archived: "Архивировано",
  unpublished: "Снято с публикации",
  trash: "В корзине",
};
const options: Record<string, Record<string, string>> = {
  articleDepth: { short: "Краткая запись", full: "Подробная статья" },
  publicationStatus: {
    draft: "Недостаточно данных",
    provisional: "Требует проверки",
    verified: "Подтверждены формы и источники",
  },
  scientificStatus: {
    confirmed: "Подтверждено",
    partial: "Частично подтверждено",
    pending: "Требует проверки",
    disputed: "Спорно",
    unconfirmed: "Не подтверждено",
    insufficient: "Недостаточно данных",
  },
  originKind: {
    "native-russian": "Исконно русское",
    "via-russian": "Через русский",
    disputed: "Спорно",
    unknown: "Не установлено",
  },
  languageCode: languageNames,
  status: {
    verified: "Подтверждено",
    partial: "Частично подтверждено",
    presumed: "Предположительно",
    pending: "Требует проверки",
    disputed: "Спорно",
    unknown: "Недостаточно данных",
  },
};
options.attestationStatus = options.status;
const labels: Record<string, string> = {
  id: "Идентификатор (неизменяемый)",
  slug: "URL (после создания неизменяемый)",
  russianLemma: "Русское слово",
  russianStress: "Нормативное написание и ударение",
  shortDescription: "Значения",
  culturalContext: "Историко-культурный контекст",
  checkedAt: "Дата последней проверки",
  scientificStatus: "Общий научный статус",
  originKind: "Происхождение",
  themes: "Тематические категории",
  articleDepth: "Полнота статьи",
  publicationStatus: "Научный допуск к карте и слову дня",
  researchIncluded: "Включено в сравнение",
  isDemo: "Демонстрационная запись",
  auditStatus: "Статус аудита",
  sourceIds: "Источники",
  languages: "Иностранные языки",
  languageCode: "Язык",
  countryCode: "Код страны ISO (US, FR, AM)",
  reportedForms: "Иностранные формы и варианты",
  attestationStatus: "Достоверность формы",
  references: "Ссылки на доказательства",
  sourceId: "Источник",
  pages: "Страницы",
  notes: "Исследовательские наблюдения",
  field: "Раздел",
  text: "Текст наблюдения",
  status: "Достоверность утверждения",
  bibliography: "Библиография",
  ipa: "Транскрипция",
  graphic: "Графическая адаптация",
  phonetic: "Фонетическая адаптация",
  semantic: "Семантическая адаптация",
  grammar: "Грамматические характеристики",
  meaning: "Значения формы",
  register: "Регистр",
  frequency: "Частотность и основание",
  examples: "Примеры с атрибуцией",
  integration: "Степень освоения",
  editorialNotes: "Редакционное примечание",
  form: "Иностранная форма",
  theme: "Тема",
  citation: "Библиографическая запись",
  page: "Номер страницы",
  hidden: "Скрыть языковую карточку",
  coverId: "Обложка из медиатеки",
  relatedWordIds: "Связанные словарные статьи",
};
options.field = {
  origin: "Этимология",
  semantic: "Семантика",
  phonetic: "Фонетика",
  graphic: "Графика",
  grammar: "Грамматика",
  chronology: "Хронология",
  sources: "Библиография",
  issues: "Открытые вопросы",
};
const templates: Record<string, Value> = {
  languages: {
    hidden: false,
    languageCode: "en-US",
    countryCode: "US",
    reportedForms: [],
    attestationStatus: "unknown",
    sourceIds: [],
    references: [],
    ipa: "",
    graphic: "",
    phonetic: "",
    semantic: "",
    grammar: "",
    meaning: "",
    register: "",
    frequency: "",
    examples: "",
    integration: "",
  },
  notes: {
    field: "issues",
    text: "",
    status: "unknown",
    references: [],
    bibliography: [],
  },
  references: { sourceId: sources[0]?.id ?? "", pages: [] },
  pages: 1,
};
function Editor({
  name,
  value,
  change,
  locked = false,
}: {
  name: string;
  value: Value;
  change: (v: Value) => void;
  locked?: boolean;
}) {
  const label = labels[name] || name;
  if (name === "relatedWordIds" && Array.isArray(value))
    return <WordSelect value={value as string[]} change={change} />;
  if (name === "sourceIds" && Array.isArray(value))
    return <SourceSelect value={value as string[]} change={change} />;
  if (name === "themes" && Array.isArray(value))
    return <CategoryPicker value={value as string[]} change={change} />;
  if (Array.isArray(value))
    return (
      <fieldset>
        <legend>{label}</legend>
        {value.map((v, i) => (
          <div className="cms-item" key={i}>
            <Editor
              name={
                name === "sourceIds"
                  ? "sourceId"
                  : name === "pages"
                    ? "page"
                    : name === "reportedForms"
                      ? "form"
                      : name === "themes"
                        ? "theme"
                        : name === "bibliography"
                          ? "citation"
                          : name
              }
              value={v}
              change={(next) =>
                change(value.map((x, j) => (i === j ? next : x)))
              }
            />
            {name === "languages" && i > 0 && (
              <button
                type="button"
                onClick={() => {
                  const next = [...value];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  change(next);
                }}
              >
                Переместить язык выше
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Удалить элемент? Изменение вступит в силу после сохранения.",
                  )
                )
                  change(value.filter((_, j) => i !== j));
              }}
            >
              Удалить элемент
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            change([...value, structuredClone(templates[name] ?? "")])
          }
        >
          Добавить: {label}
        </button>
      </fieldset>
    );
  if (value !== null && typeof value === "object")
    return (
      <div className="cms-fields">
        {Object.entries(value).map(([k, v]) => (
          <Editor
            key={k}
            name={k}
            value={v}
            change={(next) =>
              change({
                ...value,
                [k]: next,
                ...(k === "russianLemma" &&
                !locked &&
                (!value.slug ||
                  value.slug === wordSlug(String(value.russianLemma)))
                  ? { slug: wordSlug(String(next)) }
                  : {}),
                ...(k === "languageCode"
                  ? {
                      countryCode:
                        editorial.languages.find((l) => l.code === next)
                          ?.country || "",
                    }
                  : {}),
              })
            }
            locked={k === "id" || (k === "slug" && locked)}
          />
        ))}
      </div>
    );
  if (typeof value === "boolean")
    return (
      <label>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => change(e.target.checked)}
        />{" "}
        {label}
      </label>
    );
  if (options[name] || name === "sourceId")
    return (
      <label>
        {label}
        <select value={String(value)} onChange={(e) => change(e.target.value)}>
          {Object.entries(
            options[name] ??
              Object.fromEntries(sources.map((s) => [s.id, s.title])),
          ).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <label>
      {label}
      {typeof value === "number" ? (
        <input
          type="number"
          min="1"
          value={value}
          onChange={(e) => change(Number(e.target.value))}
        />
      ) : name === "russianLemma" ? (
        <input
          required
          aria-label="Русское слово"
          value={String(value)}
          onChange={(e) => change(e.target.value)}
        />
      ) : name === "coverId" ? (
        <MediaSelect value={String(value)} change={change} />
      ) : locked ? (
        <input value={String(value)} readOnly />
      ) : (
        <textarea
          aria-label={label}
          rows={name === "text" ? 5 : 2}
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }
          }}
          value={String(value)}
          onChange={(e) => change(e.target.value)}
        />
      )}
    </label>
  );
}
function blank(): WordEntry {
  return {
    id: crypto.randomUUID(),
    slug: "",
    russianLemma: "",
    originKind: "unknown",
    themes: [],
    articleDepth: "short",
    publicationStatus: "draft",
    researchIncluded: false,
    isDemo: false,
    auditStatus: "Материал собирается",
    sourceIds: [],
    languages: [],
    notes: [],
    russianStress: "",
    shortDescription: "",
    editorialNotes: "",
    coverId: "",
    relatedWordIds: [],
    culturalContext: "",
    checkedAt: "",
    scientificStatus: "insufficient",
  };
}
function enriched(data: WordEntry): WordEntry {
  return {
    ...blank(),
    ...data,
    languages: data.languages.map((l) => ({
      ...(templates.languages as object),
      ...l,
    })),
  };
}
function WordAdmin() {
  const logged = useSession();
  const setLogged = setSession;
  const [params] = useSearchParams();
  const target = params.get("word"),
    creating = params.get("new") === "1";
  const [loading, setLoading] = useState(true),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState("");
  const [rows, setRows] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row>(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [preview, setPreview] = useState(false),
    [history, setHistory] = useState<Row[]>([]),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [theme, setTheme] = useState(""),
    [language, setLanguage] = useState(""),
    [checked, setChecked] = useState<string[]>([]),
    [sort, setSort] = useState("name"),
    [editorSection, setEditorSection] = useState<keyof typeof editorSections>(
      params.get("tab") === "languages" ? "languages" : "main",
    );
  const blocker = useBlocker(dirty);
  const handlingNavigation = useRef(false);
  useEffect(() => {
    if (blocker.state !== "blocked") handlingNavigation.current = false;
    else if (!handlingNavigation.current) {
      handlingNavigation.current = true;
      if (
        confirm(
          "Отменить несохранённые изменения и перейти на другую страницу?",
        )
      )
        blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    api("auth/session")
      .then(() => setLogged(true))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (logged)
      api("admin/words")
        .then((data: Row[]) => {
          setRows(data);
          if (dirty) return; // Keep the unsaved form when a session is renewed.
          const row = target ? data.find((r) => r.id === target) : undefined;
          if (row) setSelected({ ...row, data: enriched(row.data) });
          else if (creating)
            setSelected({
              id: "",
              data: blank(),
              version: 0,
              state: "draft",
              updated: "",
              published: false,
            });
          else if (target)
            setMessage("Запись не найдена. Выберите статью из списка.");
        })
        .catch((e) => setMessage(e.message));
  }, [logged, target, creating]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const select = (row: Row) => {
    if (dirty && !confirm("Отменить несохранённые изменения?")) return;
    setSelected({ ...row, data: enriched(row.data) });
    setDirty(false);
    setPreview(false);
    setEditorSection("main");
    setHistory([]);
    setMessage("");
  };
  const wordAction = async (
    action: string,
    targets: Row[],
    categoryIds?: string[],
  ) => {
    if (dirty && !confirm("Продолжить без сохранения текущей формы?")) return;
    if (
      !confirm(
        "Выполнить действие для записей: " +
          targets.map((r) => r.data.russianLemma).join(", ") +
          "?",
      )
    )
      return;
    try {
      await api("admin/word-actions", "POST", {
        ids: targets.map((r) => r.id),
        versions: Object.fromEntries(targets.map((r) => [r.id, r.version])),
        action,
        confirm: "CONFIRM",
        categoryIds,
      });
      setRows(await api("admin/words"));
      setDirty(false);
      setSelected(undefined);
      setChecked([]);
      await refreshPublicCatalog();
      setMessage("Операция выполнена");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  if (loading) return <p role="status">Проверка сессии…</p>;
  if (!logged)
    return (
      <section className="cms">
        <h1>Вход владельца</h1>
        <p>
          Регистрация отключена. Первоначальное создание владельца — только на
          сервере.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("auth/login", "POST", { password });
              setPassword("");
              setLogged(true);
              setMessage("");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button">Войти</button>
        </form>
        <p role="status">{message}</p>
      </section>
    );
  return (
    <section className="cms">
      <div className="cms-actions">
        <h1>Редакция словаря</h1>
        <button
          onClick={async () => {
            if (dirty && !confirm("Выйти без сохранения?")) return;
            try {
              await api("auth/logout", "POST", {});
              setLogged(false);
              setSelected(undefined);
              setRows([]);
              setDirty(false);
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Выйти
        </button>
      </div>
      <p>
        Редакционный статус независим от научной достоверности. Черновик
        опубликованной статьи не меняет публичную версию до следующей
        публикации.
      </p>
      <p role="status">{message}</p>
      <section className="cms-overview" aria-label="Обзор базы">
        <h2>Обзор</h2>
        <p>
          {rows.length} записей · опубликовано:{" "}
          {rows.filter((r) => r.published).length} · черновиков:{" "}
          {rows.filter((r) => r.state === "draft").length}
        </p>
        <p>
          Языков в базе:{" "}
          {
            new Set(
              rows.flatMap((r) => r.data.languages.map((l) => l.languageCode)),
            ).size
          }{" "}
          · источников: {sources.length} · требуют научной проверки:{" "}
          {rows.filter((r) => r.data.publicationStatus !== "verified").length}
        </p>
        <details>
          <summary>Последние изменения</summary>
          <ul>
            {[...rows]
              .sort((a, b) => b.updated.localeCompare(a.updated))
              .slice(0, 5)
              .map((r) => (
                <li key={r.id}>
                  {r.data.russianLemma} ·{" "}
                  {new Date(r.updated).toLocaleString("ru")}
                </li>
              ))}
          </ul>
        </details>
        <Link to="/research">Открыть сравнительное исследование</Link> ·{" "}
        <Link to="/">Публичный сайт</Link>
      </section>
      <div className="cms-layout">
        <aside>
          <button
            className="button"
            onClick={() =>
              select({
                id: "",
                data: blank(),
                version: 0,
                state: "draft",
                updated: "",
                published: false,
              })
            }
          >
            Новое слово
          </button>
          <label>
            Поиск записей
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            Редакционный статус
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Все</option>
              {Object.entries(states).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Категория
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="">Все категории</option>
              {[...new Set(rows.flatMap((r) => r.data.themes))].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Язык карточки
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="">Все языки</option>
              {Object.entries(languageNames).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Сортировка записей
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">По названию</option>
              <option value="updated">По последнему изменению</option>
            </select>
          </label>
          <p>{rows.length} записей в базе</p>
          {checked.length > 0 && (
            <fieldset>
              <legend>Выбрано: {checked.length}</legend>
              {Object.entries({
                publish: "Опубликовать выбранные",
                archive: "Архивировать выбранные",
                trash: "В корзину выбранные",
              }).map(([action, title]) => (
                <button
                  key={action}
                  onClick={() =>
                    void wordAction(
                      action,
                      rows.filter((r) => checked.includes(r.id)),
                    )
                  }
                >
                  {title}
                </button>
              ))}
              <label>
                Назначить категорию
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value)
                      void wordAction(
                        "categories",
                        rows.filter((r) => checked.includes(r.id)),
                        [e.target.value],
                      );
                  }}
                >
                  <option value="">Выберите категорию</option>
                  {editorial.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}
          <div className="cms-list">
            {rows
              .filter(
                (r) =>
                  r.state !== "trash" &&
                  (!filter || r.state === filter) &&
                  (!theme || r.data.themes.includes(theme)) &&
                  (!language ||
                    r.data.languages.some(
                      (l) => l.languageCode === language,
                    )) &&
                  [
                    r.data.russianLemma,
                    r.data.slug,
                    ...r.data.languages.flatMap((l) => l.reportedForms),
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .sort((a, b) =>
                sort === "updated"
                  ? b.updated.localeCompare(a.updated)
                  : a.data.russianLemma.localeCompare(
                      b.data.russianLemma,
                      "ru",
                    ),
              )
              .map((r) => (
                <div key={r.id}>
                  <input
                    type="checkbox"
                    aria-label={"Выбрать " + r.data.russianLemma}
                    checked={checked.includes(r.id)}
                    onChange={(e) =>
                      setChecked(
                        e.target.checked
                          ? [...checked, r.id]
                          : checked.filter((id) => id !== r.id),
                      )
                    }
                  />
                  <button
                    key={r.id}
                    onClick={() => select(r)}
                    aria-pressed={r.id === selected?.id}
                  >
                    {r.data.russianLemma}
                    <small>
                      {states[r.state]} · v{r.version}
                      <br />
                      {r.data.languages.length} языковых карточек ·{" "}
                      {r.data.articleDepth === "full" ? "Подробная" : "Краткая"}
                      <br />
                      {r.data.themes.join(", ")}
                      <br />
                      {new Date(r.updated).toLocaleDateString("ru")}
                    </small>
                  </button>
                  <details>
                    <summary>Действия: {r.data.russianLemma}</summary>
                    {Object.entries({
                      duplicate: "Дублировать",
                      draft: "Сохранить черновик",
                      publish: "Опубликовать",
                      unpublish: "Снять с публикации",
                      archive: "Архивировать",
                      trash: "В корзину",
                    }).map(([action, label]) => (
                      <button
                        key={action}
                        onClick={() => void wordAction(action, [r])}
                      >
                        {label}
                      </button>
                    ))}
                  </details>
                </div>
              ))}
          </div>
        </aside>
        <div>
          {selected ? (
            <>
              <div className="cms-actions cms-sticky">
                <button
                  className="button"
                  disabled={saving}
                  onClick={() => document.getElementById("save-word")?.click()}
                >
                  Сохранить
                </button>
                <button
                  onClick={() => {
                    const original = rows.find(
                      (r) => r.id === selected.data.id,
                    );
                    if (confirm("Отменить введённые изменения?")) {
                      if (original) {
                        setSelected({
                          ...original,
                          data: enriched(original.data),
                        });
                        setDirty(false);
                        setMessage("");
                      } else {
                        setSelected(undefined);
                        setDirty(false);
                      }
                    }
                  }}
                >
                  Отменить редактирование
                </button>
                <span>
                  Последнее сохранение:{" "}
                  {selected.updated
                    ? new Date(selected.updated).toLocaleString("ru")
                    : "ещё не сохранено"}
                </span>
                {selected.published && (
                  <Link to={"/dictionary/" + selected.data.slug}>
                    Открыть статью
                  </Link>
                )}
                <h2>
                  {selected.data.russianLemma || "Новое слово"}
                  {dirty ? " *" : ""}
                </h2>
                <button onClick={() => setPreview(!preview)}>
                  {preview ? "К редактору" : "Предпросмотр"}
                </button>
              </div>
              {!preview && (
                <nav className="cms-sections" aria-label="Разделы редактора">
                  {Object.entries(editorSections).map(([key, section]) => (
                    <button
                      key={key}
                      aria-pressed={editorSection === key}
                      onClick={() =>
                        setEditorSection(key as keyof typeof editorSections)
                      }
                    >
                      {section.title}
                    </button>
                  ))}
                </nav>
              )}
              <fieldset disabled={saving}>
                {preview ? (
                  <Article previewWord={selected.data} />
                ) : (
                  <Editor
                    name="word"
                    value={
                      Object.fromEntries(
                        Object.entries(selected.data).filter(([key]) =>
                          (
                            editorSections[editorSection]
                              .keys as readonly string[]
                          ).includes(key),
                        ),
                      ) as Value
                    }
                    locked={selected.version > 0}
                    change={(v) => {
                      setSelected({
                        ...selected,
                        data: {
                          ...selected.data,
                          ...(v as object),
                        } as WordEntry,
                      });
                      setDirty(true);
                    }}
                  />
                )}
                <label>
                  Редакционный статус
                  <select
                    aria-label="Редакционный статус"
                    value={selected.state}
                    onChange={(e) => {
                      setSelected({ ...selected, state: e.target.value });
                      setDirty(true);
                    }}
                  >
                    {Object.entries(states).map(([k, v]) => (
                      <option value={k} key={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  {selected.published
                    ? "На сайте доступна опубликованная версия."
                    : "На сайте запись скрыта."}{" "}
                  Для снятия с публикации выберите «Архивировано» и сохраните.
                  Восстановление — выбор нового редакционного статуса.
                </p>
              </fieldset>
              <button
                id="save-word"
                className="button"
                disabled={saving}
                onClick={async () => {
                  try {
                    wordSchema.parse(selected.data);
                    if (
                      ["published", "archived"].includes(selected.state) &&
                      !confirm(
                        selected.state === "published"
                          ? "Опубликовать эту версию на сайте?"
                          : "Снять запись с публикации?",
                      )
                    )
                      return;
                    setSaving(true);
                    const row: Row = await api("admin/words", "PUT", selected);
                    setSelected({ ...row, data: enriched(row.data) });
                    setDirty(false);
                    setRows((current) => [
                      ...current.filter((r) => r.id !== row.id),
                      row,
                    ]);
                    setMessage(
                      "Версия сохранена. " +
                        (row.state === "published"
                          ? "Опубликовано."
                          : row.state === "archived"
                            ? "Запись снята с публикации."
                            : "Сохранено как черновик или на проверку."),
                    );
                    try {
                      await refreshPublicCatalog();
                    } catch {
                      setMessage(
                        "Версия сохранена в базе. Не удалось обновить публичное представление; обновите страницу после восстановления связи.",
                      );
                    }
                  } catch (e) {
                    setMessage(
                      (e as Error).name === "ZodError"
                        ? "Заполните слово, URL и обязательные поля."
                        : (e as Error).message,
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Сохранение…" : "Сохранить изменения"}
              </button>
              {dirty && <p>Есть несохранённые изменения.</p>}
              <button
                onClick={async () => {
                  try {
                    setHistory(
                      await api("admin/words/" + selected.data.id + "/history"),
                    );
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                История изменений
              </button>
              {history.map((h) => (
                <div key={h.version}>
                  <span>
                    Версия {h.version} · {h.updated}
                  </span>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "Загрузить старую версию в редактор? Сохранение создаст новую ревизию.",
                        )
                      ) {
                        setSelected({
                          ...selected,
                          data: enriched(h.data),
                          state: "draft",
                        });
                        setDirty(true);
                        setPreview(true);
                      }
                    }}
                  >
                    Восстановить в черновик
                  </button>
                </div>
              ))}
            </>
          ) : (
            <p>
              Выберите запись. Все существующие материалы сохранены; оригиналы
              research не редактируются.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Admin() {
  const logged = useSession();
  const [params] = useSearchParams();
  const section = params.get("section") ?? "words";
  const sections: Record<string, string> = {
    overview: "Обзор",
    words: "Словарь",
    categories: "Тематические категории",
    research: "Сравнительное исследование",
    journal: "Журнал",
    daily: "Слово дня",
    sources: "Источники",
    media: "Медиатека",
    trash: "Корзина",
    history: "История изменений",
    settings: "Настройки",
  };
  return (
    <>
      {logged && (
        <nav className="cms-navigation" aria-label="Разделы CMS">
          {Object.entries(sections).map(([key, label]) => (
            <Link
              key={key}
              aria-label={"Раздел CMS: " + label}
              aria-current={section === key ? "page" : undefined}
              to={"/admin?section=" + key}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {!logged || section === "words" ? (
        <WordAdmin />
      ) : (
        <Management key={section} section={section} />
      )}
    </>
  );
}
