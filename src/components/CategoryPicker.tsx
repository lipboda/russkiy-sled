import { useRef, useState } from "react";
import { editorial } from "../domain/editorial";
import { api } from "../domain/session";
import { refreshPublicCatalog } from "../domain/catalog";
const normalize = (v: string) =>
  v.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru").replace(/ё/g, "е");
export function CategoryPicker({
  value,
  change,
}: {
  value: string[];
  change: (value: string[]) => void;
}) {
  const [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const latest = useRef(value);
  latest.current = value;
  async function create() {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("admin/categories/ensure", "POST", {
        name: query,
      });
      await refreshPublicCatalog();
      change([
        ...latest.current.filter(
          (t) => normalize(t) !== normalize(result.name),
        ),
        result.name,
      ]);
      setQuery("");
    } catch (e) {
      setError("Не удалось добавить тему: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset>
      <legend>Темы слова</legend>
      <div className="category-tags">
        {value.map((t) => (
          <button
            type="button"
            key={t}
            aria-label={"Убрать категорию " + t}
            onClick={() => change(value.filter((v) => v !== t))}
          >
            {t} ×
          </button>
        ))}
      </div>
      <details open>
        <summary>Выбрать или создать категорию</summary>
        <label>
          Добавить тему…
          <input
            aria-label="Добавить тему"
            placeholder="Добавить тему…"
            value={query}
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />
        </label>
        <button
          type="button"
          disabled={!query.trim() || busy}
          onClick={() => void create()}
        >
          {busy ? "Добавление…" : "Создать тему"}
        </button>
        <div className="category-options">
          {editorial.categories
            .filter((c) => normalize(c.name).includes(normalize(query)))
            .map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={value.some(
                    (t) => normalize(t) === normalize(c.name),
                  )}
                  onChange={(e) =>
                    change(
                      e.target.checked
                        ? [...value, c.name]
                        : value.filter(
                            (t) => normalize(t) !== normalize(c.name),
                          ),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
        </div>
      </details>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
