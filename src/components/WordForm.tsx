import {
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import type { WordEntry } from "../domain/catalog";
import { wordSlug } from "../domain/slug";
import { CategoryPicker } from "./CategoryPicker";
import { LanguageCardsEditor } from "./LanguageCardsEditor";
import { SourceLinksEditor } from "./SourceLinksEditor";
export function newWord(): WordEntry {
  return {
    id: crypto.randomUUID(),
    slug: "",
    russianLemma: "",
    shortDescription: "",
    format: "compact",
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
  };
}
export function WordForm({
  word,
  change,
  locked = false,
  initialTab,
  initialLanguage,
  advanced,
  media,
}: {
  word: WordEntry;
  change: Dispatch<SetStateAction<WordEntry>>;
  locked?: boolean;
  initialTab?: string;
  initialLanguage?: string;
  advanced?: ReactNode;
  media?: ReactNode;
}) {
  const [tab, setTab] = useState(initialTab ?? "main");
  const format =
    word.format ?? (word.articleDepth === "full" ? "detailed" : "compact");
  const set = <K extends keyof WordEntry>(key: K, value: WordEntry[K]) =>
    change((w) => ({ ...w, [key]: value }));
  return (
    <div className="word-form">
      <div className="cms-sections" aria-label="Формат статьи">
        {[
          ["compact", "Краткая карточка"],
          ["detailed", "Подробная статья"],
        ].map(([value, title]) => (
          <button
            key={value}
            type="button"
            aria-pressed={format === value}
            onClick={() =>
              change((w) => ({
                ...w,
                format: value as WordEntry["format"],
                articleDepth: value === "compact" ? "short" : "full",
              }))
            }
          >
            {title}
          </button>
        ))}
      </div>
      <nav className="cms-sections" aria-label="Разделы редактора">
        {Object.entries({
          main: "Основная информация",
          languages: "Языковые карточки",
          ...(format === "detailed"
            ? { science: "Лингвистический анализ" }
            : {}),
          sources: "Источники статьи",
          related: "Изображения и связи",
        }).map(([key, title]) => (
          <button
            type="button"
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {title}
          </button>
        ))}
      </nav>
      {tab === "main" && (
        <>
          <label>
            Русское слово *
            <input
              aria-label="Русское слово"
              required
              value={word.russianLemma}
              onChange={(e) =>
                change((w) => ({
                  ...w,
                  russianLemma: e.target.value,
                  slug:
                    !locked && (!w.slug || w.slug === wordSlug(w.russianLemma))
                      ? wordSlug(e.target.value)
                      : w.slug,
                }))
              }
            />
          </label>
          <label>
            Краткое определение или описание {format === "compact" ? "*" : ""}
            <textarea
              aria-label="Краткое определение или описание"
              value={word.shortDescription ?? ""}
              onChange={(e) => set("shortDescription", e.target.value)}
            />
          </label>
          <label>
            Ударение (необязательно)
            <input
              value={word.russianStress ?? ""}
              onChange={(e) => set("russianStress", e.target.value)}
            />
          </label>
          <label>
            Часть речи (необязательно)
            <input
              value={word.partOfSpeech ?? ""}
              onChange={(e) => set("partOfSpeech", e.target.value)}
            />
          </label>
          <CategoryPicker
            value={word.themes}
            change={(themes) => change((w) => ({ ...w, themes }))}
          />
          <label>
            Редакционное примечание
            <textarea
              aria-label="Редакционное примечание"
              value={word.editorialNotes ?? ""}
              onChange={(e) => set("editorialNotes", e.target.value)}
            />
          </label>
          <details>
            <summary>Адрес и дополнительные настройки</summary>
            <label>
              URL (после создания неизменяемый)
              <input
                aria-label="URL (после создания неизменяемый)"
                value={word.slug}
                readOnly={locked}
                onChange={(e) => set("slug", e.target.value)}
              />
            </label>
            <p>Внутренний идентификатор: {word.id}</p>
            <label>
              <input
                type="checkbox"
                checked={word.researchIncluded}
                onChange={(e) => set("researchIncluded", e.target.checked)}
              />
              Включено в сравнение (основной набор изменяется отдельно)
            </label>
          </details>
          {format === "compact" && (
            <button
              type="button"
              onClick={() => {
                change((w) => ({
                  ...w,
                  format: "detailed",
                  articleDepth: "full",
                }));
                setTab("science");
              }}
            >
              Добавить подробное описание
            </button>
          )}
        </>
      )}
      {tab === "languages" && (
        <LanguageCardsEditor
          word={word}
          change={change}
          initial={initialLanguage}
        />
      )}
      {tab === "sources" && (
        <SourceLinksEditor
          links={word.links}
          ids={word.sourceIds}
          change={(links, sourceIds) =>
            change((w) => ({ ...w, links, sourceIds }))
          }
        />
      )}
      {tab === "science" && (
        <>
          {advanced ?? (
            <>
              <label>
                Историко-культурный контекст
                <textarea
                  value={word.culturalContext ?? ""}
                  onChange={(e) => set("culturalContext", e.target.value)}
                />
              </label>
              <p>
                Существующие научные наблюдения сохраняются в словарной статье.
              </p>
            </>
          )}
        </>
      )}
      {tab === "related" && (
        <>
          {media ?? (
            <p>
              Изображение можно добавить в словарном редакторе после сохранения.
            </p>
          )}
          <SourceLinksEditor
            links={word.links}
            ids={word.sourceIds}
            change={(links, sourceIds) =>
              change((w) => ({ ...w, links, sourceIds }))
            }
          />
        </>
      )}
    </div>
  );
}
