import { useState } from "react";
import { editorial } from "../domain/editorial";
import { api } from "../domain/session";
import { refreshPublicCatalog } from "../domain/catalog";
export function CategoryPicker({
  value,
  change,
}: {
  value: string[];
  change: (v: string[]) => void;
}) {
  const [query, setQuery] = useState(""),
    [error, setError] = useState("");
  return (
    <fieldset>
      <legend>Тематические категории</legend>
      <div className="category-tags">
        {value.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => change(value.filter((x) => x !== t))}
            aria-label={"Убрать категорию " + t}
          >
            {t} ×
          </button>
        ))}
      </div>
      <details>
        <summary>Выбрать или создать категорию</summary>
        <label>
          Поиск категории
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {editorial.categories
          .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
          .map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={value.includes(c.name)}
                onChange={(e) =>
                  change(
                    e.target.checked
                      ? [...value, c.name]
                      : value.filter((v) => v !== c.name),
                  )
                }
              />
              {c.name}
            </label>
          ))}
        {query.trim() && (
          <button
            type="button"
            onClick={async () => {
              try {
                await api("admin/categories", "PUT", {
                  id: crypto.randomUUID(),
                  name: query.trim(),
                  description: "",
                  sort: 0,
                });
                await refreshPublicCatalog();
                change([...new Set([...value, query.trim()])]);
                setQuery("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Создать категорию «{query}»
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </details>
    </fieldset>
  );
}
