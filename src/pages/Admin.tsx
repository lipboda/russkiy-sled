import { useEffect, useState } from "react";
import { sources, wordSchema, type WordEntry } from "../domain/catalog";
import { Article } from "./Dictionary";
import "./admin.css";

type Value = string | number | boolean | Value[] | { [key: string]: Value };
type Row = {
  id: string;
  data: WordEntry;
  state: string;
  version: number;
  updated: string;
  published: boolean;
};
const states: Record<string, string> = {
  draft: "Черновик",
  review: "На проверке",
  published: "Опубликовано",
  archived: "Архивировано",
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
  languageCode: {
    "en-US": "Американский английский",
    "fr-FR": "Французский",
    "hy-AM": "Восточноармянский",
  },
  status: {
    verified: "Подтверждено",
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
  meaning: "Значения формы",
  register: "Регистр",
  frequency: "Частотность и основание",
  examples: "Примеры с атрибуцией",
  integration: "Степень освоения",
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
    languageCode: "en-US",
    countryCode: "US",
    reportedForms: [],
    attestationStatus: "unknown",
    sourceIds: [],
    references: [],
    ipa: "",
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
            <button
              type="button"
              onClick={() => change(value.filter((_, j) => i !== j))}
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
            change={(next) => change({ ...value, [k]: next })}
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
      ) : locked ? (
        <input value={String(value)} readOnly />
      ) : (
        <textarea
          aria-label={label}
          rows={name === "text" ? 5 : 2}
          value={String(value)}
          onChange={(e) => change(e.target.value)}
        />
      )}
    </label>
  );
}
async function api(path: string, method = "GET", data?: unknown) {
  const response = await fetch("/api/" + path, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Ошибка сервера");
  return body;
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
export default function Admin() {
  const [logged, setLogged] = useState(false),
    [loading, setLoading] = useState(true),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState("");
  const [rows, setRows] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row>(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [preview, setPreview] = useState(false),
    [history, setHistory] = useState<Row[]>([]),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    api("auth/session")
      .then(() => setLogged(true))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (logged)
      api("admin/words")
        .then(setRows)
        .catch((e) => setMessage(e.message));
  }, [logged]);
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
    setHistory([]);
    setMessage("");
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
          <p>{rows.length} записей в базе</p>
          <div className="cms-list">
            {rows
              .filter(
                (r) =>
                  (!filter || r.state === filter) &&
                  [
                    r.data.russianLemma,
                    r.data.slug,
                    ...r.data.languages.flatMap((l) => l.reportedForms),
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((r) => (
                <button
                  key={r.id}
                  onClick={() => select(r)}
                  aria-pressed={r.id === selected?.id}
                >
                  {r.data.russianLemma}
                  <small>
                    {states[r.state]} · v{r.version}
                  </small>
                </button>
              ))}
          </div>
        </aside>
        <div>
          {selected ? (
            <>
              <div className="cms-actions">
                <h2>
                  {selected.data.russianLemma || "Новое слово"}
                  {dirty ? " *" : ""}
                </h2>
                <button onClick={() => setPreview(!preview)}>
                  {preview ? "К редактору" : "Предпросмотр"}
                </button>
              </div>
              {preview ? (
                <Article previewWord={selected.data} />
              ) : (
                <Editor
                  name="word"
                  value={selected.data as unknown as Value}
                  locked={selected.version > 0}
                  change={(v) => {
                    setSelected({
                      ...selected,
                      data: v as unknown as WordEntry,
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
              <button
                className="button"
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
                    const row: Row = await api("admin/words", "PUT", selected);
                    setSelected({ ...row, data: enriched(row.data) });
                    setRows(await api("admin/words"));
                    setDirty(false);
                    setMessage(
                      "Версия сохранена. Публичный сайт получит изменения при обновлении страницы.",
                    );
                  } catch (e) {
                    setMessage(
                      (e as Error).name === "ZodError"
                        ? "Заполните слово, URL и обязательные поля."
                        : (e as Error).message,
                    );
                  }
                }}
              >
                Сохранить изменения
              </button>
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
