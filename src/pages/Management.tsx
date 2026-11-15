import { localDateTime, publicationInstant } from "../domain/timezone";
import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useSearchParams } from "react-router-dom";
import { api } from "../domain/session";
import {
  words,
  sources,
  refreshPublicCatalog,
  type SourceRecord,
} from "../domain/catalog";
import { editorial } from "../domain/editorial";
import {
  publicationStates,
  type Publication,
  type ResourceRow,
  type Category,
  type Media,
} from "../domain/publications";
import { wordSlug } from "../domain/slug";
import { Markdown } from "../components/Markdown";
import "./admin.css";

type WordRow = {
  id: string;
  data: (typeof words)[number];
  state: string;
  version: number;
  published: boolean;
  updated: string;
};
type History = {
  id: number | string;
  kind: string;
  entity_id: string;
  title: string;
  operation: string;
  created: string;
  previous: unknown;
  next: unknown;
};
export function MediaSelect({
  value,
  change,
}: {
  value: string;
  change: (id: string) => void;
}) {
  const [media, setMedia] = useState<Media[]>([]);
  useEffect(() => {
    void api("admin/media")
      .then(setMedia)
      .catch(() => {});
  }, []);
  return (
    <select
      aria-label="Обложка"
      value={value}
      onChange={(e) => change(e.target.value)}
    >
      <option value="">Без изображения</option>
      {media.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
export function WordSelect({
  value,
  change,
}: {
  value: string[];
  change: (ids: string[]) => void;
}) {
  const [rows, setRows] = useState<WordRow[]>([]);
  useEffect(() => {
    void api("admin/words")
      .then(setRows)
      .catch(() => {});
  }, []);
  return (
    <select
      multiple
      aria-label="Связанные словарные статьи"
      value={value}
      onChange={(e) =>
        change(Array.from(e.target.selectedOptions, (o) => o.value))
      }
    >
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {r.data.russianLemma}
        </option>
      ))}
    </select>
  );
}
export function SourceSelect({
  value,
  change,
}: {
  value: string[];
  change: (ids: string[]) => void;
}) {
  const [error, setError] = useState("");
  return (
    <fieldset>
      <legend>Источники</legend>
      <select
        multiple
        aria-label="Источники публикации"
        value={value}
        onChange={(e) =>
          change(Array.from(e.target.selectedOptions, (o) => o.value))
        }
      >
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={async () => {
          const title = prompt("Название нового источника");
          if (!title) return;
          const url = prompt("URL источника (https://…)");
          if (!url) return;
          try {
            const s = await api("admin/sources", "PUT", {
              id: crypto.randomUUID(),
              title,
              url,
              accessLevel: "bibliography",
              notes: "",
            });
            await refreshPublicCatalog();
            change([...value, s.id]);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Создать источник
      </button>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
function useUnsaved(dirty: boolean) {
  const blocker = useBlocker(dirty);
  const handling = useRef(false);
  useEffect(() => {
    if (blocker.state !== "blocked") handling.current = false;
    else if (!handling.current) {
      handling.current = true;
      if (confirm("Уйти без сохранения изменений?")) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
export function Management({ section }: { section: string }) {
  const [params] = useSearchParams();
  const [rows, setRows] = useState<ResourceRow[]>([]),
    [allWords, setWords] = useState<WordRow[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [media, setMedia] = useState<Media[]>([]),
    [history, setHistory] = useState<History[]>([]);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ResourceRow>(),
    [preview, setPreview] = useState(false),
    [category, setCategory] = useState<Category>(),
    [source, setSource] = useState<SourceRecord>(),
    [target, setTarget] = useState("");
  const [timezone, setTimezone] = useState(editorial.timezone),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [image, setImage] = useState<Media>({
    id: "",
    name: "",
    alt: "",
    caption: "",
    credit: "",
    source: "",
    mime: "",
    created: "",
  });
  const [language, setLanguage] = useState({ code: "", name: "", country: "" });
  useUnsaved(dirty);
  async function load() {
    const [data, ws, cs, ms, hs] = await Promise.all([
      api("admin/editorial"),
      api("admin/words"),
      api("admin/categories"),
      api("admin/media"),
      api("admin/history"),
    ]);
    const loaded = section === "daily" ? data.daily : data.journal;
    setRows(loaded);
    if (params.get("material") && !dirty)
      setSelected(
        loaded.find((r: ResourceRow) => r.id === params.get("material")),
      );
    setWords(ws);
    setCategories(cs);
    setMedia(ms);
    setHistory(hs);
    setTimezone(data.timezone);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [section]);
  async function perform(
    fn: () => Promise<unknown>,
    success = "Изменения сохранены",
  ) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setDirty(false);
      await load();
      await refreshPublicCatalog();
      setMessage(success);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function pick(row: ResourceRow) {
    if (dirty && !confirm("Отменить несохранённые изменения?")) return;
    setSelected(structuredClone(row));
    setDirty(false);
    setPreview(false);
  }
  function create() {
    const id = crypto.randomUUID();
    pick({
      id,
      kind: section as "journal" | "daily",
      data: {
        id,
        slug: "",
        title: "",
        intro: "",
        body: "",
        author: "",
        date: new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
          new Date(),
        ),
        publishAt: "",
        category: "",
        coverId: "",
        wordIds: [],
        sourceIds: [],
        origin: "",
        adaptation: "",
        examples: "",
      },
      state: "draft",
      published: false,
      version: 0,
      updated: "",
      deleted: null,
    });
  }
  function update<K extends keyof Publication>(key: K, value: Publication[K]) {
    if (selected) {
      setSelected({
        ...selected,
        data: {
          ...selected.data,
          [key]: value,
          ...(key === "title" &&
          selected.version === 0 &&
          (!selected.data.slug ||
            selected.data.slug === wordSlug(selected.data.title))
            ? { slug: wordSlug(String(value)) }
            : {}),
        },
      });
      setDirty(true);
    }
  }
  async function removeWord(row: WordRow) {
    const refs = await api("admin/references", "POST", {
      type: "word",
      id: row.id,
    });
    alert(
      "Слово: " +
        row.data.russianLemma +
        "\nСвязанные материалы: " +
        (refs.map((r: { title: string }) => r.title).join(", ") || "нет") +
        "\nМатериалы не будут удалены автоматически.",
    );
    if (refs.length) throw new Error("Сначала уберите связи с материалами");
    const confirm = prompt(
      "Необратимое удаление. Введите название: " + row.data.russianLemma,
    );
    if (confirm === null) throw new Error("Операция отменена");
    await api("admin/word-actions", "POST", {
      ids: [row.id],
      action: "delete",
      versions: { [row.id]: row.version },
      confirm,
    });
  }
  const field = (key: keyof Publication, label: string, multiline = false) => (
    <label key={key}>
      {label}
      {multiline ? (
        <textarea
          aria-label={label}
          value={String(selected?.data[key] ?? "")}
          rows={5}
          onChange={(e) => update(key, e.target.value)}
        />
      ) : (
        <input
          required={key === "title" || key === "slug"}
          readOnly={key === "slug" && (selected?.version ?? 0) > 0}
          type={key === "date" ? "date" : "text"}
          value={String(selected?.data[key] ?? "")}
          onChange={(e) => update(key, e.target.value)}
        />
      )}
    </label>
  );
  return (
    <section className="cms">
      <h1>
        {
          (
            {
              overview: "Обзор платформы",
              categories: "Тематические категории",
              journal: "Редакция журнала",
              daily: "Редакция «Слово дня»",
              sources: "Справочник источников",
              media: "Медиатека",
              trash: "Корзина",
              history: "История изменений",
              settings: "Настройки",
              research: "Редактирование исследования",
            } as Record<string, string>
          )[section]
        }
      </h1>
      <p role="status">{message}</p>
      {section === "overview" && (
        <>
          <p>
            Словарных записей: {allWords.length}; опубликованных снимков:{" "}
            {allWords.filter((w) => w.published).length}; черновиков:{" "}
            {allWords.filter((w) => w.state === "draft").length}; категорий:{" "}
            {categories.length}; источников: {sources.length}; изображений:{" "}
            {media.length}.
          </p>
          <Link className="button" to="/admin?new=1">
            Добавить слово
          </Link>
          <Link className="button" to="/admin?section=journal">
            Создать публикацию
          </Link>
          <Link to="/admin?section=history">Последние изменения</Link>
        </>
      )}
      {section === "research" && (
        <>
          <p>
            Изменения сохраняются в единой словарной статье. Выберите слово,
            затем «Языковые карточки».
          </p>
          {[
            "matryoshka",
            "kalashnikov",
            "dacha",
            "intelligentsia",
            "pogrom",
            "samizdat",
            "sputnik",
            "samovar",
          ].map((slug) => {
            const w = allWords.find((w) => w.data.slug === slug);
            return (
              w && (
                <p key={slug}>
                  <Link to={"/admin?word=" + w.id + "&tab=languages"}>
                    {w.data.russianLemma}
                  </Link>
                </p>
              )
            );
          })}
          <Link to="/research">Открыть публичное сравнение</Link>
        </>
      )}
      {["journal", "daily"].includes(section) && (
        <>
          <div className="cms-actions">
            <button onClick={create}>
              Создать {section === "daily" ? "выпуск" : "статью"}
            </button>
            <label>
              Поиск материалов
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          {section === "daily" && (
            <>
              <label>
                Месяц календаря
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
              <div className="cms-calendar" aria-label="Календарь выпусков">
                {Array.from(
                  {
                    length: new Date(
                      Number(month.slice(0, 4)),
                      Number(month.slice(5)),
                      0,
                    ).getDate(),
                  },
                  (_, i) => {
                    const date = month + "-" + String(i + 1).padStart(2, "0");
                    const releases = rows.filter(
                      (r) => r.data.date === date && r.state !== "trash",
                    );
                    return (
                      <div key={date}>
                        <strong>{i + 1}</strong>
                        {releases.length ? (
                          releases.map((r) => (
                            <button key={r.id} onClick={() => pick(r)}>
                              {r.data.title} · {publicationStates[r.state]}
                            </button>
                          ))
                        ) : (
                          <small>Нет выпуска</small>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
              <p>Часовой пояс публикаций: {timezone}</p>
            </>
          )}
          <div className="cms-layout">
            <aside className="cms-list">
              {rows
                .filter(
                  (r) =>
                    r.state !== "trash" &&
                    (r.data.title + " " + r.data.date)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((r) => (
                  <div key={r.id}>
                    <button onClick={() => pick(r)}>
                      {r.data.title}
                      <small>
                        {r.data.date} · {publicationStates[r.state]}
                      </small>
                    </button>
                    <button
                      onClick={() => {
                        const id = crypto.randomUUID();
                        pick({
                          ...structuredClone(r),
                          id,
                          version: 0,
                          published: false,
                          state: "draft",
                          data: {
                            ...r.data,
                            id,
                            slug: r.data.slug + "-copy-" + id.slice(0, 8),
                            title: r.data.title + " (копия)",
                          },
                        });
                      }}
                    >
                      Дублировать
                    </button>
                  </div>
                ))}
            </aside>
            {selected ? (
              <div>
                <div className="cms-sticky cms-actions">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        if (
                          [
                            "published",
                            "scheduled",
                            "trash",
                            "archived",
                          ].includes(selected.state) &&
                          !confirm(
                            "Сохранить материал со статусом «" +
                              publicationStates[selected.state] +
                              "»?",
                          )
                        )
                          throw new Error("Операция отменена");
                        const next = await api(
                          "admin/publications/" + section,
                          "PUT",
                          selected,
                        );
                        setSelected(next);
                      })
                    }
                  >
                    {busy ? "Сохранение…" : "Сохранить материал"}
                  </button>
                  <button onClick={() => setPreview(!preview)}>
                    {preview ? "К редактору" : "Предпросмотр"}
                  </button>
                  <button
                    onClick={() => {
                      if (!dirty || confirm("Отменить изменения?")) {
                        setSelected(undefined);
                        setDirty(false);
                      }
                    }}
                  >
                    Отменить
                  </button>
                  <span>
                    {dirty
                      ? "Есть несохранённые изменения"
                      : selected.updated
                        ? "Сохранено " +
                          new Date(selected.updated).toLocaleString("ru")
                        : "Новый материал"}
                  </span>
                </div>
                {preview ? (
                  <article className="reading">
                    <h2>{selected.data.title}</h2>
                    <p>{selected.data.intro}</p>
                    <Markdown
                      text={[
                        selected.data.origin,
                        selected.data.adaptation,
                        selected.data.examples,
                        selected.data.body,
                      ]
                        .filter(Boolean)
                        .join("\n\n")}
                    />
                  </article>
                ) : (
                  <fieldset disabled={busy}>
                    {field("title", "Заголовок *")}
                    {field("slug", "URL *")}
                    {field("intro", "Краткое вступление", true)}
                    {field("author", "Автор")}
                    {field(
                      "date",
                      section === "daily"
                        ? "Дата выпуска *"
                        : "Дата публикации *",
                    )}
                    <label>
                      Время публикации ({timezone})
                      <input
                        aria-label="Время публикации"
                        type="datetime-local"
                        value={localDateTime(selected.data.publishAt, timezone)}
                        onChange={(e) => {
                          try {
                            update(
                              "publishAt",
                              publicationInstant(e.target.value, timezone),
                            );
                          } catch (error) {
                            setMessage((error as Error).message);
                          }
                        }}
                      />
                    </label>
                    {field("category", "Категория публикации")}
                    <label>
                      Связанные слова
                      <select
                        multiple
                        value={selected.data.wordIds}
                        onChange={(e) =>
                          update(
                            "wordIds",
                            Array.from(
                              e.target.selectedOptions,
                              (o) => o.value,
                            ),
                          )
                        }
                      >
                        {allWords
                          .filter((w) => w.state !== "trash")
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.data.russianLemma}
                            </option>
                          ))}
                      </select>
                    </label>
                    {section === "daily" && (
                      <button
                        type="button"
                        onClick={() => {
                          const w = allWords.find(
                            (w) => w.id === selected.data.wordIds[0],
                          );
                          if (!w) {
                            setMessage("Сначала выберите связанное слово");
                            return;
                          }
                          setSelected({
                            ...selected,
                            data: {
                              ...selected.data,
                              title: w.data.russianLemma,
                              intro: w.data.shortDescription ?? "",
                              origin: w.data.notes
                                .filter((n) => n.field === "origin")
                                .map((n) => n.text)
                                .join("\n\n"),
                              adaptation: "",
                              examples: w.data.languages
                                .map((l) => l.examples)
                                .filter(Boolean)
                                .join("\n\n"),
                              sourceIds: [...w.data.sourceIds],
                            },
                          });
                          setDirty(true);
                        }}
                      >
                        Заполнить из выбранной статьи
                      </button>
                    )}
                    {section === "daily" && (
                      <>
                        {field(
                          "origin",
                          "История происхождения — с атрибуцией",
                          true,
                        )}
                        {field(
                          "adaptation",
                          "Особенности заимствования — с источниками",
                          true,
                        )}
                        {field(
                          "examples",
                          "Примеры употребления — с атрибуцией",
                          true,
                        )}
                      </>
                    )}
                    <p>
                      Markdown: # заголовок, **жирный**, *курсив*, списки, &gt;
                      цитата, [текст](https://…), таблицы GFM, --- разделитель.
                      HTML не исполняется. Изображение:
                      ![подпись](/api/media/ID). Научное примечание оформляйте
                      отдельным абзацем со ссылкой на выбранный источник.
                    </p>
                    {field("body", "Основной текст (Markdown)", true)}
                    <label>
                      Обложка
                      <MediaSelect
                        value={selected.data.coverId}
                        change={(v) => update("coverId", v)}
                      />
                    </label>
                    <SourceSelect
                      value={selected.data.sourceIds}
                      change={(v) => update("sourceIds", v)}
                    />
                    <label>
                      Статус материала
                      <select
                        aria-label="Статус материала"
                        value={selected.state}
                        onChange={(e) => {
                          setSelected({ ...selected, state: e.target.value });
                          setDirty(true);
                        }}
                      >
                        {Object.entries(publicationStates).map(
                          ([key, title]) => (
                            <option key={key} value={key}>
                              {title}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </fieldset>
                )}
              </div>
            ) : (
              <p>Выберите материал или создайте новый.</p>
            )}
          </div>
        </>
      )}
      {section === "categories" && (
        <>
          <button
            onClick={() =>
              setCategory({
                id: crypto.randomUUID(),
                name: "",
                description: "",
                sort: categories.length,
                count: 0,
              })
            }
          >
            Создать категорию
          </button>
          <ul>
            {categories.map((c) => (
              <li key={c.id}>
                <button onClick={() => setCategory(c)}>
                  {c.name} · записей: {c.count}
                </button>
              </li>
            ))}
          </ul>
          {category && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform(() => api("admin/categories", "PUT", category));
              }}
            >
              <label>
                Название категории
                <input
                  required
                  value={category.name}
                  onChange={(e) => {
                    setCategory({ ...category, name: e.target.value });
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                Описание
                <textarea
                  value={category.description}
                  onChange={(e) => {
                    setCategory({ ...category, description: e.target.value });
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                Порядок
                <input
                  type="number"
                  min="0"
                  value={category.sort}
                  onChange={(e) => {
                    setCategory({ ...category, sort: Number(e.target.value) });
                    setDirty(true);
                  }}
                />
              </label>
              <button disabled={busy}>Сохранить категорию</button>
              <label>
                Объединить с
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">Без объединения</option>
                  {categories
                    .filter((c) => c.id !== category.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  void perform(async () => {
                    const links = await api("admin/category-links", "POST", {
                      id: category.id,
                    });
                    alert(
                      "Связанные статьи: " +
                        (links
                          .map((r: { title: string }) => r.title)
                          .join(", ") || "нет") +
                        ". Статьи сохранятся.",
                    );
                    const confirm = prompt(
                      "Введите название удаляемой/объединяемой категории: " +
                        category.name,
                    );
                    if (confirm === null) throw new Error("Операция отменена");
                    await api("admin/categories", "POST", {
                      id: category.id,
                      targetId: target || undefined,
                      confirm,
                    });
                    setCategory(undefined);
                  })
                }
              >
                {target ? "Объединить категории" : "Удалить категорию"}
              </button>
            </form>
          )}
        </>
      )}
      {section === "sources" && (
        <>
          <button
            onClick={() =>
              setSource({
                id: crypto.randomUUID(),
                title: "",
                url: "",
                notes: "",
                accessLevel: "bibliography",
                author: "",
                sourceType: "",
                year: "",
                publisher: "",
                doi: "",
                accessedAt: "",
                citation: "",
              })
            }
          >
            Добавить источник
          </button>
          <ul>
            {sources.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() =>
                    setSource({
                      ...{
                        author: "",
                        sourceType: "",
                        year: "",
                        publisher: "",
                        doi: "",
                        accessedAt: "",
                        citation: "",
                        verifiedAt: "",
                      },
                      ...s,
                    })
                  }
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
          {source && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform(() => api("admin/sources", "PUT", source));
              }}
            >
              {Object.entries({
                title: "Название *",
                author: "Автор",
                sourceType: "Тип",
                year: "Год",
                publisher: "Издание",
                url: "URL *",
                doi: "DOI",
                accessedAt: "Дата обращения",
                citation: "Библиографическое описание",
                notes: "Примечание",
                verifiedAt:
                  "Дата независимой верификации (только после проверки)",
              }).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    required={["title", "url"].includes(key)}
                    value={String(source[key as keyof SourceRecord] ?? "")}
                    onChange={(e) => {
                      setSource({ ...source, [key]: e.target.value });
                      setDirty(true);
                    }}
                  />
                </label>
              ))}
              <label>
                Уровень доступа
                <select
                  value={source.accessLevel}
                  onChange={(e) => {
                    setSource({
                      ...source,
                      accessLevel: e.target
                        .value as SourceRecord["accessLevel"],
                    });
                    setDirty(true);
                  }}
                >
                  {["full", "section", "abstract", "bibliography"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <p>
                Дата верификации не означает автоматического повышения статусов
                слов или форм.
              </p>
              <button disabled={busy}>Сохранить источник</button>
              <button
                type="button"
                onClick={() =>
                  void perform(async () => {
                    const refs = await api("admin/references", "POST", {
                      type: "source",
                      id: source.id,
                    });
                    alert(
                      "Связанные материалы: " +
                        (refs
                          .map((r: { title: string }) => r.title)
                          .join(", ") || "нет"),
                    );
                    if (refs.length)
                      throw new Error("Сначала уберите связи с материалами");
                    const confirm = prompt(
                      "Введите название источника: " + source.title,
                    );
                    if (confirm === null) throw new Error("Операция отменена");
                    await api("admin/sources", "DELETE", {
                      id: source.id,
                      confirm,
                    });
                    setSource(undefined);
                  })
                }
              >
                Удалить источник
              </button>
            </form>
          )}
        </>
      )}
      {section === "media" && (
        <>
          <p>
            PNG, JPEG или WebP; до 5 МБ и 20 миллионов пикселей. Сервер
            декодирует и сохраняет безопасный WebP в SQLite, поэтому изображения
            входят в резервную копию базы.
          </p>
          {(["name", "alt", "caption", "credit", "source"] as const).map(
            (key) => (
              <label key={key}>
                {
                  {
                    name: "Название изображения",
                    alt: "Альтернативный текст",
                    caption: "Подпись",
                    credit: "Авторство",
                    source: "Источник",
                  }[key]
                }
                <input
                  value={image[key]}
                  onChange={(e) =>
                    setImage({ ...image, [key]: e.target.value })
                  }
                />
              </label>
            ),
          )}
          {image.id && (
            <button
              onClick={() =>
                void perform(() => api("admin/media", "PUT", image))
              }
            >
              Сохранить описание изображения
            </button>
          )}
          <label>
            Файл изображения
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void perform(async () => {
                  if (file.size > 5 * 1024 * 1024)
                    throw new Error("Максимум 5 МБ");
                  const data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () =>
                      resolve(String(reader.result).split(",")[1]);
                    reader.onerror = () =>
                      reject(new Error("Не удалось прочитать файл"));
                    reader.readAsDataURL(file);
                  });
                  await api("admin/media", "POST", { ...image, base64: data });
                });
              }}
            />
          </label>
          <div className="word-grid">
            {media.map((m) => (
              <figure className="paper" key={m.id}>
                <img src={"/api/media/" + m.id} alt={m.alt} />
                <figcaption>
                  {m.name} · {m.caption} · {m.credit}
                  <p>
                    Markdown: ![{m.alt}](/api/media/{m.id})
                  </p>
                </figcaption>
                <button onClick={() => setImage(m)}>
                  Редактировать описание
                </button>
                <button
                  onClick={() =>
                    void perform(async () => {
                      const refs = await api("admin/references", "POST", {
                        type: "media",
                        id: m.id,
                      });
                      if (refs.length) {
                        alert(
                          "Используется: " +
                            refs
                              .map((r: { title: string }) => r.title)
                              .join(", "),
                        );
                        throw new Error("Изображение используется материалами");
                      }
                      const confirm = prompt(
                        "Удалить неиспользуемое изображение? Введите название: " +
                          m.name,
                      );
                      if (confirm === null)
                        throw new Error("Операция отменена");
                      await api("admin/media", "DELETE", { id: m.id, confirm });
                    })
                  }
                >
                  Удалить изображение
                </button>
              </figure>
            ))}
          </div>
        </>
      )}
      {section === "trash" && (
        <>
          {allWords
            .filter((w) => w.state === "trash")
            .map((w) => (
              <div className="paper" key={w.id}>
                <h2>{w.data.russianLemma}</h2>
                <p>
                  Перемещено в корзину:{" "}
                  {new Date(w.updated).toLocaleString("ru")}
                </p>
                <button
                  onClick={() =>
                    void perform(() =>
                      api("admin/word-actions", "POST", {
                        ids: [w.id],
                        action: "restore",
                        versions: { [w.id]: w.version },
                      }),
                    )
                  }
                >
                  Восстановить слово в черновик
                </button>
                <button onClick={() => void perform(() => removeWord(w))}>
                  Удалить слово окончательно
                </button>
              </div>
            ))}
          <PublicationTrash perform={perform} />
        </>
      )}
      {section === "history" && (
        <>
          {history.map((h) => (
            <details className="paper" key={h.id}>
              <summary>
                {h.created} · {h.kind} · {h.title} · {h.operation}
              </summary>
              <div className="history-diff">
                <div>
                  <h3>Предыдущая версия</h3>
                  <pre>{JSON.stringify(h.previous, null, 2)}</pre>
                </div>
                <div>
                  <h3>Новая версия</h3>
                  <pre>{JSON.stringify(h.next, null, 2)}</pre>
                </div>
              </div>
              {Boolean(h.previous) &&
                ["word", "journal", "daily"].includes(h.kind) && (
                  <button
                    onClick={() =>
                      void perform(async () => {
                        if (
                          !confirm(
                            "Восстановить предыдущую редакцию в черновик? Публичный снимок не изменится.",
                          )
                        )
                          throw new Error("Операция отменена");
                        await api("admin/restore-history", "POST", {
                          id: String(h.id).replace("legacy-", ""),
                          legacy: String(h.id).startsWith("legacy-"),
                        });
                      })
                    }
                  >
                    Восстановить предыдущую версию
                  </button>
                )}
            </details>
          ))}
        </>
      )}
      {section === "settings" && (
        <>
          <label>
            Часовой пояс проекта (IANA)
            <input
              value={timezone}
              onChange={(e) => {
                setTimezone(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void perform(() => api("admin/settings", "PUT", { timezone }))
            }
          >
            Сохранить часовой пояс
          </button>
          <h2>Языки проекта</h2>
          <p>
            Основные языки исследования сохранены. Добавление языка не добавляет
            научных сведений.
          </p>
          {(["code", "name", "country"] as const).map((key) => (
            <label key={key}>
              {
                {
                  code: "Код языка, например de-DE",
                  name: "Название языка",
                  country: "Страна ISO, например DE",
                }[key]
              }
              <input
                value={language[key]}
                onChange={(e) =>
                  setLanguage({ ...language, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <button
            onClick={() =>
              void perform(() => api("admin/languages", "PUT", language))
            }
          >
            Сохранить язык
          </button>
          <ul>
            {editorial.languages.map((l) => (
              <li key={l.code}>
                {l.name} · {l.code} · {l.country}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
function PublicationTrash({
  perform,
}: {
  perform: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const load = () =>
    Promise.all(
      ["journal", "daily"].map((k) => api("admin/publications/" + k)),
    ).then((all) => setRows(all.flat().filter((r) => r.state === "trash")));
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      {rows.map((r) => (
        <div className="paper" key={r.id}>
          <h2>{r.data.title}</h2>
          <p>В корзине с {r.deleted}</p>
          <button
            onClick={() =>
              void perform(async () => {
                await api("admin/publications/" + r.kind, "PUT", {
                  ...r,
                  state: "draft",
                });
                await load();
              })
            }
          >
            Восстановить публикацию
          </button>
          <button
            onClick={() =>
              void perform(async () => {
                const confirm = prompt(
                  "Необратимое удаление. Введите заголовок: " + r.data.title,
                );
                if (confirm === null) throw new Error("Операция отменена");
                {
                  await api("admin/publications/" + r.kind, "DELETE", {
                    id: r.id,
                    version: r.version,
                    confirm,
                  });
                  await load();
                }
              })
            }
          >
            Удалить публикацию окончательно
          </button>
        </div>
      ))}
    </>
  );
}
