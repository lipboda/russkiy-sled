import { useState, type Dispatch, type SetStateAction } from "react";
import { editorial } from "../domain/editorial";
import { refreshPublicCatalog, type WordEntry } from "../domain/catalog";
import { api } from "../domain/session";
import { correspondenceNames } from "../domain/universal";
import { SourceLinksEditor } from "./SourceLinksEditor";
type Card = WordEntry["languages"][number];
export function LanguageCardsEditor({
  word,
  change,
  initial,
}: {
  word: WordEntry;
  change: Dispatch<SetStateAction<WordEntry>>;
  initial?: string;
}) {
  const [active, setActive] = useState(
      initial ?? word.languages[0]?.languageCode ?? "",
    ),
    [adding, setAdding] = useState(false),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    officialCode: "",
    nativeName: "",
    region: "",
    variety: "",
    flag: "",
    direction: "auto",
  });
  function add(code: string) {
    if (word.languages.some((l) => l.languageCode === code)) {
      setActive(code);
      setError("Этот язык уже добавлен: открыта существующая карточка.");
      setAdding(false);
      return;
    }
    const country =
      editorial.languages.find((l) => l.code === code)?.country ?? "";
    change((w) => ({
      ...w,
      languages: [
        ...w.languages,
        {
          languageCode: code,
          countryCode: country,
          reportedForms: [],
          attestationStatus: "unknown",
          correspondenceType: "unknown",
          sourceIds: [],
          references: [],
          expanded: false,
        },
      ],
    }));
    setActive(code);
    setAdding(false);
    setCreating(false);
  }
  const card =
    word.languages.find((l) => l.languageCode === active) ?? word.languages[0];
  function update(patch: Partial<Card>) {
    if (card)
      change((w) => ({
        ...w,
        languages: w.languages.map((l) =>
          l.languageCode === card.languageCode ? { ...l, ...patch } : l,
        ),
      }));
  }
  const text = (key: keyof Card, label: string, large = false) => (
    <label key={key}>
      {label}
      {large ? (
        <textarea
          aria-label={label}
          value={String(card?.[key] ?? "")}
          onChange={(e) => update({ [key]: e.target.value })}
        />
      ) : (
        <input
          aria-label={label}
          value={String(card?.[key] ?? "")}
          onChange={(e) => update({ [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <section>
      <h3>Языки слова</h3>
      <button type="button" onClick={() => setAdding(!adding)}>
        Добавить язык
      </button>
      <div className="language-tabs">
        {word.languages.map((l) => (
          <button
            type="button"
            key={l.languageCode}
            aria-pressed={card?.languageCode === l.languageCode}
            onClick={() => setActive(l.languageCode)}
          >
            {editorial.languages.find((d) => d.code === l.languageCode)?.name ??
              l.languageCode}
            {l.hidden ? " · скрыт" : ""}
          </button>
        ))}
      </div>
      {adding && (
        <fieldset>
          <legend>Выберите язык</legend>
          {editorial.languages.map((l) => (
            <button key={l.code} type="button" onClick={() => add(l.code)}>
              {l.name}
              {word.languages.some((c) => c.languageCode === l.code)
                ? " — уже добавлен"
                : ""}
            </button>
          ))}
          <button type="button" onClick={() => setCreating(true)}>
            Создать новый язык
          </button>
          {creating && (
            <div>
              {(
                [
                  "name",
                  "officialCode",
                  "nativeName",
                  "region",
                  "variety",
                  "flag",
                ] as const
              ).map((k) => (
                <label key={k}>
                  {
                    {
                      name: "Название языка *",
                      officialCode: "Международный код (если известен)",
                      nativeName: "Название на самом языке",
                      region: "Страны или регион (необязательно)",
                      variety: "Языковая разновидность",
                      flag: "Визуальный идентификатор",
                    }[k]
                  }
                  <input
                    value={draft[k]}
                    onChange={(e) =>
                      setDraft({ ...draft, [k]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Направление письма
                <select
                  value={draft.direction}
                  onChange={(e) =>
                    setDraft({ ...draft, direction: e.target.value })
                  }
                >
                  <option value="auto">Автоматически</option>
                  <option value="ltr">Слева направо</option>
                  <option value="rtl">Справа налево</option>
                </select>
              </label>
              <button
                type="button"
                disabled={busy || !draft.name.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const language = await api(
                      "admin/languages/ensure",
                      "POST",
                      draft,
                    );
                    await refreshPublicCatalog();
                    add(language.code);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Сохранить и добавить язык
              </button>
            </div>
          )}
        </fieldset>
      )}
      {error && <p role="alert">{error}</p>}
      {card && (
        <fieldset disabled={busy}>
          <legend>
            {editorial.languages.find((l) => l.code === card.languageCode)
              ?.name ?? card.languageCode}
          </legend>
          <label>
            Иностранная форма
            <input
              value={card.reportedForms[0] ?? ""}
              onChange={(e) =>
                update({
                  reportedForms: [
                    e.target.value,
                    ...card.reportedForms.slice(1),
                  ],
                })
              }
            />
          </label>
          {text("meaning", "Значение или краткое описание", true)}
          <label>
            Тип языкового соответствия
            <select
              value={card.correspondenceType ?? "unknown"}
              onChange={(e) =>
                update({
                  correspondenceType: e.target
                    .value as Card["correspondenceType"],
                })
              }
            >
              {Object.entries(correspondenceNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {text("ipa", "Транскрипция")}
          {text("comment", "Комментарий", true)}
          <SourceLinksEditor
            ids={card.sourceIds}
            links={card.links}
            change={(links, sourceIds) => update({ links, sourceIds })}
          />
          <label>
            <input
              type="checkbox"
              checked={Boolean(card.hidden)}
              onChange={(e) => update({ hidden: e.target.checked })}
            />
            Скрыть языковую карточку
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(card.unpublished)}
              onChange={(e) => update({ unpublished: e.target.checked })}
            />
            Карточка пока не готова к публикации
          </label>
          <button
            type="button"
            onClick={() => update({ expanded: !card.expanded })}
          >
            {card.expanded ? "Свернуть описание" : "Расширить описание"}
          </button>
          {card.expanded && (
            <div>
              {text("transliteration", "Транслитерация")}
              {text("origin", "Этимология", true)}
              {text("firstAttested", "Первая фиксация")}
              {text("borrowingPath", "Путь заимствования", true)}
              {text("intermediary", "Язык-посредник")}
              {text("graphic", "Графическая адаптация", true)}
              {text("phonetic", "Фонетическая адаптация", true)}
              {text("semantic", "Семантическая адаптация", true)}
              {text("grammar", "Грамматические характеристики", true)}
              {text("register", "Сфера употребления")}
              {text("integration", "Степень освоения", true)}
              {text("examples", "Реальные примеры с атрибуцией", true)}
              {text("frequency", "Частотность и основание", true)}
              <label>
                Достоверность формы
                <select
                  value={card.attestationStatus}
                  onChange={(e) =>
                    update({
                      attestationStatus: e.target
                        .value as Card["attestationStatus"],
                    })
                  }
                >
                  {Object.entries({
                    unknown: "Не установлено",
                    pending: "Требует проверки",
                    partial: "Частично подтверждено",
                    presumed: "Предположительно",
                    verified: "Подтверждено",
                    disputed: "Спорно",
                  }).map(([v, n]) => (
                    <option value={v} key={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Подтверждённые заимствования и формы требуют независимо
                проверенного источника. Прежние варианты написания, ссылки на
                страницы и научные поля сохраняются при сворачивании.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              change((w) => {
                const languages = [...w.languages],
                  index = languages.findIndex(
                    (l) => l.languageCode === card.languageCode,
                  );
                if (index > 0)
                  [languages[index - 1], languages[index]] = [
                    languages[index],
                    languages[index - 1],
                  ];
                return { ...w, languages };
              });
            }}
          >
            Переместить язык выше
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Удалить только эту языковую карточку из редактируемой версии?",
                )
              )
                change((w) => ({
                  ...w,
                  languages: w.languages.filter(
                    (l) => l.languageCode !== card.languageCode,
                  ),
                }));
            }}
          >
            Удалить языковую карточку
          </button>
        </fieldset>
      )}
    </section>
  );
}
