import { safeLink } from "../domain/universal";
import { sources, type WordEntry } from "../domain/catalog";
type Link = NonNullable<WordEntry["links"]>[number];
export function SourceLinksEditor({
  links = [],
  ids,
  change,
}: {
  links?: Link[];
  ids: string[];
  change: (links: Link[], ids: string[]) => void;
}) {
  const entries = [
    ...links,
    ...ids
      .filter((id) => !links.some((l) => l.sourceId === id))
      .map((sourceId) => {
        const s = sources.find((s) => s.id === sourceId);
        return {
          sourceId,
          url: s?.url ?? "",
          title: s?.title ?? sourceId,
          comment: "",
        };
      }),
  ];
  function update(index: number, patch: Partial<Link>) {
    change(
      entries.map((l, i) => (i === index ? { ...l, ...patch } : l)),
      patch.url !== undefined
        ? ids.filter((id) => id !== entries[index].sourceId)
        : ids,
    );
  }
  return (
    <fieldset>
      <legend>Источники и ссылки</legend>
      {entries.map((link, index) => (
        <div className="cms-item" key={index}>
          <label>
            URL источника
            <input
              type="url"
              value={link.url}
              onChange={(e) =>
                update(index, { url: e.target.value, sourceId: undefined })
              }
              placeholder="https://…"
            />
          </label>
          <label>
            Название ссылки (необязательно)
            <input
              value={link.title ?? ""}
              onChange={(e) => update(index, { title: e.target.value })}
            />
          </label>
          <label>
            Комментарий к ссылке
            <textarea
              aria-label="Комментарий к ссылке"
              value={link.comment ?? ""}
              onChange={(e) => update(index, { comment: e.target.value })}
            />
          </label>
          {link.url && safeLink(link.url) ? (
            <a href={link.url} target="_blank" rel="noreferrer">
              Открыть источник ↗
            </a>
          ) : (
            <p>Библиографический источник без URL сохранён.</p>
          )}
          <button
            type="button"
            onClick={() =>
              change(
                entries.filter((_, i) => i !== index),
                ids.filter((id) => id !== link.sourceId),
              )
            }
          >
            Удалить связь с источником
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => change([...entries, { url: "" }], ids)}
      >
        Добавить ещё ссылку
      </button>
      <p>
        Ссылка сохраняется со статьёй. Она сама по себе не подтверждает научное
        утверждение.
      </p>
    </fieldset>
  );
}
