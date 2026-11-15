import { useEffect, useRef, useState } from "react";
import { useBlocker, useSearchParams, Link } from "react-router-dom";
import { api } from "../domain/session";
import { refreshPublicCatalog, type WordEntry } from "../domain/catalog";
import { editorial } from "../domain/editorial";
import type { ResourceRow, Publication } from "../domain/publications";
import { wordSlug } from "../domain/slug";
import { localDateTime, publicationInstant } from "../domain/timezone";
import { type RichNode } from "../domain/universal";
import { WordForm, newWord } from "../components/WordForm";
import { VisualEditor } from "../components/VisualEditor";
import { RichDocument } from "../components/RichDocument";
import { Markdown } from "../components/Markdown";
import { CompactWord } from "../components/CompactWord";
import { SourceLinksEditor } from "../components/SourceLinksEditor";
import { MediaSelect } from "./Management";
type WordRow = {
  id: string;
  version: number;
  state: string;
  data: WordEntry;
  published: boolean;
};
const legacyDoc = (text: string): RichNode => ({
  type: "doc",
  content: text
    .split(/\n\n+/)
    .filter(Boolean)
    .map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});
export function DailyEditor() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState<ResourceRow[]>([]),
    [words, setWords] = useState<WordRow[]>([]),
    [selected, setSelected] = useState<ResourceRow>(),
    [inline, setInline] = useState<WordEntry>(),
    [inlineVersion, setInlineVersion] = useState(0);
  const [dirty, setDirty] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [query, setQuery] = useState(""),
    [wordQuery, setWordQuery] = useState(""),
    [counts, setCounts] = useState<{
      count: number;
      trash: number;
      versions: Record<string, number>;
    }>(),
    [cleaning, setCleaning] = useState(false);
  const blocker = useBlocker(dirty);
  const handling = useRef(false);
  useEffect(() => {
    if (blocker.state !== "blocked") handling.current = false;
    else if (!handling.current) {
      handling.current = true;
      if (confirm("Уйти без сохранения публикации?")) blocker.proceed();
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
  async function load() {
    const [data, allWords] = await Promise.all([
      api("admin/publications/daily"),
      api("admin/words"),
    ]);
    setRows(data);
    setWords(allWords);
    return data as ResourceRow[];
  }
  useEffect(() => {
    void load()
      .then((data) => {
        if (params.get("material"))
          setSelected(data.find((r) => r.id === params.get("material")));
      })
      .catch((e) => setMessage(e.message));
  }, []);
  function pick(row: ResourceRow) {
    if (dirty && !confirm("Отменить несохранённые изменения?")) return;
    setSelected(structuredClone(row));
    setInline(undefined);
    setDirty(false);
    setPreview(false);
    setMessage("");
  }
  function create(format: "article" | "word-card") {
    const id = crypto.randomUUID();
    pick({
      id,
      kind: "daily",
      data: {
        id,
        slug: "publication-" + id.slice(0, 12),
        title: "",
        format,
        intro: "",
        body: "",
        author: "",
        category: "",
        date: "",
        publishAt: "",
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
  function update(patch: Partial<Publication>) {
    setSelected((current) =>
      current ? { ...current, data: { ...current.data, ...patch } } : current,
    );
    setDirty(true);
  }
  async function save(state: string) {
    if (!selected || busy) return;
    if (
      ["published", "scheduled", "trash", "archived", "unpublished"].includes(
        state,
      ) &&
      !confirm(
        "Сохранить публикацию со статусом «" +
          (
            {
              published: "Опубликовано",
              scheduled: "Запланировано",
              trash: "В корзине",
              archived: "Архивировано",
              unpublished: "Снято с публикации",
            } as Record<string, string>
          )[state] +
          "»?",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const row = await api("admin/publications/daily", "PUT", {
        ...selected,
        state,
      });
      setSelected(row);
      setDirty(false);
      await load();
      await refreshPublicCatalog();
      setMessage("Изменения сохранены");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const linked = words.find((w) => w.id === selected?.data.wordIds[0]);
  async function backup() {
    const response = await fetch("/api/admin/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw new Error("Не удалось создать резервную копию");
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "russkiy-sled-backup-" +
      new Date().toISOString().replaceAll(":", "-") +
      ".sqlite";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function cleanup(action: "trash" | "purge") {
    if (!counts) return;
    const phrase = action === "trash" ? "В КОРЗИНУ" : "УДАЛИТЬ НАВСЕГДА",
      count = action === "trash" ? counts.count : counts.trash;
    const typed = prompt(
      `Затрагивается публикаций: ${count}. Словарь, журнал и источники сохранятся. Введите «${phrase}»`,
    );
    if (typed === null) return;
    setBusy(true);
    try {
      await api("admin/daily-cleanup", "POST", {
        action,
        count,
        confirm: typed,
        versions: counts.versions,
      });
      setSelected(undefined);
      setDirty(false);
      await load();
      await refreshPublicCatalog();
      setCounts(await api("admin/daily-cleanup"));
      setMessage("Операция выполнена: " + count + " публикаций");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="cms daily-editor">
      <h1>Редакция «Слово дня»</h1>
      <p>
        Статьи и интерактивные карточки слов. Дата первой публикации
        устанавливается автоматически.
      </p>
      <p role="status">{message}</p>
      <div className="cms-actions">
        <button onClick={() => create("article")}>Создать статью</button>
        <button onClick={() => create("word-card")}>
          Создать карточку слова
        </button>
        <Link to="/word-of-the-day">Открыть публичную ленту</Link>
      </div>
      <details>
        <summary>Управление прежними выпусками</summary>
        <button
          disabled={busy}
          onClick={async () => {
            if (dirty) {
              setMessage("Сначала сохраните или отмените изменения");
              return;
            }
            setCleaning(true);
            setCounts(await api("admin/daily-cleanup"));
          }}
        >
          Удалить все публикации «Слова дня»
        </button>
        {cleaning && counts && (
          <div>
            <p>
              Всего выпусков всех статусов: {counts.count}. В корзине:{" "}
              {counts.trash}. Словарь и журнал не затрагиваются.
            </p>
            <button
              onClick={() => void backup().catch((e) => setMessage(e.message))}
            >
              Скачать резервную копию перед очисткой
            </button>
            <button
              disabled={busy || !counts.count}
              onClick={() => void cleanup("trash")}
            >
              Переместить все выпуски в корзину
            </button>
            <button
              disabled={busy || !counts.trash}
              onClick={() => void cleanup("purge")}
            >
              Окончательно очистить корзину «Слова дня»
            </button>
            <p>
              Копия содержит личные данные CMS; храните её у себя, не загружайте
              в GitHub. Восстановление отдельных выпусков доступно в общей
              корзине.
            </p>
          </div>
        )}
      </details>
      <div className="cms-layout">
        <aside>
          <label>
            Поиск материалов
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="cms-list">
            {rows
              .filter(
                (r) =>
                  r.state !== "trash" &&
                  (r.data.title + " " + r.data.date)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((row) => (
                <button key={row.id} onClick={() => pick(row)}>
                  {row.data.title || "Без заголовка"}
                  <small>
                    {row.data.date || "Ещё не опубликовано"} · {row.state}
                  </small>
                </button>
              ))}
          </div>
        </aside>
        {selected ? (
          <div>
            <div className="cms-sticky cms-actions">
              <button disabled={busy} onClick={() => void save("draft")}>
                Сохранить черновик
              </button>
              <button
                disabled={busy}
                className="button"
                onClick={() => void save("published")}
              >
                Опубликовать
              </button>
              <button onClick={() => setPreview(!preview)}>
                {preview ? "К редактору" : "Предпросмотр"}
              </button>
              <button
                onClick={() => {
                  if (!dirty || confirm("Отменить несохранённые изменения?")) {
                    setSelected(undefined);
                    setInline(undefined);
                    setDirty(false);
                  }
                }}
              >
                Отменить изменения
              </button>
              <span>
                {busy
                  ? "Сохранение…"
                  : dirty
                    ? "Есть несохранённые изменения"
                    : selected.updated
                      ? "Сохранено " +
                        new Date(selected.updated).toLocaleString("ru")
                      : "Новый материал"}
              </span>
            </div>
            {preview ? (
              <article className="reading">
                <h2>{selected.data.title || linked?.data.russianLemma}</h2>
                <p>{selected.data.intro}</p>
                {selected.data.format === "word-card" ? (
                  linked?.published ? (
                    <CompactWord word={linked.data} embedded />
                  ) : (
                    <p>
                      Словарная карточка пока не опубликована. Посетители не
                      увидят её черновик.
                    </p>
                  )
                ) : selected.data.richDocument ? (
                  <RichDocument value={selected.data.richDocument} />
                ) : (
                  <Markdown text={selected.data.body} />
                )}
              </article>
            ) : (
              <fieldset disabled={busy} key={selected.id}>
                <label>
                  Заголовок{" "}
                  {selected.data.format === "word-card"
                    ? "(по умолчанию — слово)"
                    : "*"}
                  <input
                    aria-label="Заголовок публикации"
                    value={selected.data.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </label>
                <label>
                  Краткое описание (необязательно)
                  <textarea
                    aria-label="Краткое описание публикации"
                    value={selected.data.intro}
                    onChange={(e) => update({ intro: e.target.value })}
                  />
                </label>
                {selected.data.format === "word-card" ? (
                  <>
                    <label>
                      Найти слово
                      <input
                        value={wordQuery}
                        onChange={(e) => setWordQuery(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Слово для публикации"
                      value={selected.data.wordIds[0] ?? ""}
                      onChange={(e) =>
                        update({
                          wordIds: e.target.value ? [e.target.value] : [],
                        })
                      }
                    >
                      <option value="">Выберите слово</option>
                      {words
                        .filter(
                          (w) =>
                            w.state !== "trash" &&
                            w.data.russianLemma
                              .toLowerCase()
                              .includes(wordQuery.toLowerCase()),
                        )
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.data.russianLemma}
                            {!w.published ? " — черновик" : ""}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setInline(newWord());
                        setInlineVersion(0);
                        setDirty(true);
                      }}
                    >
                      Создать новое слово здесь
                    </button>
                    {inline && (
                      <div className="paper">
                        <h3>Новая словарная карточка</h3>
                        {words
                          .filter(
                            (w) =>
                              w.data.russianLemma.trim().toLowerCase() ===
                              inline.russianLemma.trim().toLowerCase(),
                          )
                          .map((w) => (
                            <p key={w.id}>
                              Слово уже существует:{" "}
                              <button
                                type="button"
                                onClick={() => {
                                  update({ wordIds: [w.id] });
                                  setInline(undefined);
                                }}
                              >
                                Использовать «{w.data.russianLemma}»
                              </button>
                            </p>
                          ))}
                        <WordForm
                          word={inline}
                          change={(next) =>
                            setInline((current) =>
                              current
                                ? typeof next === "function"
                                  ? next(current)
                                  : next
                                : current,
                            )
                          }
                          locked={inlineVersion > 0}
                          media={
                            <label>
                              Изображение
                              <MediaSelect
                                value={inline.coverId ?? ""}
                                change={(coverId) =>
                                  setInline((w) => (w ? { ...w, coverId } : w))
                                }
                              />
                            </label>
                          }
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const row = await api("admin/words", "PUT", {
                                data: inline,
                                state: "draft",
                                version: inlineVersion,
                              });
                              setInline(row.data);
                              setInlineVersion(row.version);
                              update({ wordIds: [row.id] });
                              await load();
                              setMessage(
                                "Слово сохранено как черновик. Публикация — отдельное действие.",
                              );
                            } catch (e) {
                              setMessage((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Сохранить слово и использовать
                        </button>
                      </div>
                    )}
                    {linked && !linked.published && (
                      <div className="paper">
                        <p>
                          Связанное слово — черновик. Можно оставить выпуск
                          черновиком или отдельно опубликовать слово.
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              !confirm(
                                "Явно опубликовать словарную статью «" +
                                  linked.data.russianLemma +
                                  "»?",
                              )
                            )
                              return;
                            setBusy(true);
                            try {
                              await api("admin/words", "PUT", {
                                ...linked,
                                state: "published",
                              });
                              await load();
                              await refreshPublicCatalog();
                              setMessage(
                                "Словарная статья опубликована; выпуск ещё не опубликован.",
                              );
                            } catch (e) {
                              setMessage((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Опубликовать связанное слово
                        </button>
                      </div>
                    )}
                    <label>
                      Редакционный комментарий
                      <textarea
                        value={selected.data.comment ?? ""}
                        onChange={(e) => update({ comment: e.target.value })}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    {!selected.data.format && !selected.data.richDocument ? (
                      <div>
                        <p>Прежний текст Markdown сохранён без изменений.</p>
                        <textarea
                          aria-label="Прежний текст Markdown"
                          value={selected.data.body}
                          onChange={(e) => update({ body: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const text = [
                              selected.data.origin,
                              selected.data.adaptation,
                              selected.data.examples,
                              selected.data.body,
                            ]
                              .filter(Boolean)
                              .join("\n\n");
                            update({
                              format: "article",
                              richDocument: legacyDoc(text),
                            });
                          }}
                        >
                          Преобразовать в визуальный документ (исходный текст
                          сохраняется)
                        </button>
                      </div>
                    ) : (
                      <VisualEditor
                        value={selected.data.richDocument}
                        change={(richDocument) => update({ richDocument })}
                      />
                    )}
                  </>
                )}
                <details>
                  <summary>Дополнительные настройки публикации</summary>
                  <p>
                    Первая публикация:{" "}
                    {selected.data.publishedAt
                      ? new Date(selected.data.publishedAt).toLocaleString(
                          "ru",
                          { timeZone: editorial.timezone },
                        )
                      : selected.data.date || "Ещё не опубликовано"}
                    . Редактирование дату не меняет.
                  </p>
                  <label>
                    URL публикации
                    <input
                      aria-label="URL публикации"
                      value={selected.data.slug}
                      readOnly={selected.version > 0}
                      onChange={(e) =>
                        update({
                          slug: e.target.value || wordSlug(selected.data.title),
                        })
                      }
                    />
                  </label>
                  <label>
                    Обложка
                    <MediaSelect
                      value={selected.data.coverId}
                      change={(coverId) => update({ coverId })}
                    />
                  </label>
                  <SourceLinksEditor
                    ids={selected.data.sourceIds}
                    links={selected.data.links}
                    change={(links, sourceIds) => update({ links, sourceIds })}
                  />
                  <label>
                    Запланировать на ({editorial.timezone})
                    <input
                      type="datetime-local"
                      aria-label="Время публикации"
                      value={localDateTime(
                        selected.data.publishAt,
                        editorial.timezone,
                      )}
                      onChange={(e) => {
                        try {
                          update({
                            publishAt: publicationInstant(
                              e.target.value,
                              editorial.timezone,
                            ),
                          });
                        } catch (e) {
                          setMessage((e as Error).message);
                        }
                      }}
                    />
                  </label>
                  <button type="button" onClick={() => void save("scheduled")}>
                    Запланировать
                  </button>
                  <button
                    type="button"
                    onClick={() => void save("unpublished")}
                  >
                    Снять с публикации
                  </button>
                  <button type="button" onClick={() => void save("archived")}>
                    Архивировать
                  </button>
                  <button type="button" onClick={() => void save("trash")}>
                    В корзину
                  </button>
                </details>
              </fieldset>
            )}
          </div>
        ) : (
          <p>
            Создайте статью или карточку слова. Оба формата появятся в общей
            публичной ленте.
          </p>
        )}
      </div>
    </section>
  );
}
