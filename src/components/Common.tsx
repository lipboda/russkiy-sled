import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { searchWords } from "../domain/search";
import { fieldNames, sources, type WordEntry } from "../domain/catalog";
export function Badge({
  children = "Материал собирается",
}: {
  children?: React.ReactNode;
}) {
  return <span className="badge">{children}</span>;
}
export function Notice() {
  return (
    <div className="notice">
      <span className="dot" /> Исследовательская версия · Формы и выводы из
      досье требуют проверки первоисточников. Отсутствие данных не означает
      отсутствие слова в языке.
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <div className="lede">{children}</div>}
    </header>
  );
}
export function SearchBox({
  initial = "",
  onChange,
}: {
  initial?: string;
  onChange?: (v: string) => void;
}) {
  const [q, setQ] = useState(initial);
  useEffect(() => setQ(initial), [initial]);
  const [open, setOpen] = useState(false);
  const id = useId();
  const navigate = useNavigate();
  const suggestions = q.trim() ? searchWords({ query: q }).slice(0, 5) : [];
  return (
    <div className="search-wrap">
      <form
        className="searchbox"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          navigate("/dictionary?q=" + encodeURIComponent(q));
        }}
      >
        <Search aria-hidden="true" size={23} />
        <input
          aria-label="Поиск по словарю"
          value={q}
          placeholder="Русское слово или иностранная форма"
          aria-describedby={open && suggestions.length ? id : undefined}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            onChange?.(e.target.value);
          }}
        />
        <button aria-label="Найти слово" type="submit">
          <ArrowUpRight />
        </button>
      </form>
      {open && suggestions.length > 0 && (
        <div id={id} className="suggestions">
          <p>В материалах исследования</p>
          {suggestions.map((w) => (
            <Link
              key={w.id}
              to={"/dictionary/" + w.slug}
              onClick={() => setOpen(false)}
            >
              {w.russianLemma}
              <span>Открыть статью ↗</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
export function WordCard({ word: w }: { word: WordEntry }) {
  return (
    <Link className="word-card" to={"/dictionary/" + w.slug}>
      <div className="flex justify-between gap-4">
        <span className="eyebrow">{w.themes[0]}</span>
        <ArrowUpRight size={18} />
      </div>
      <h3>{w.russianLemma}</h3>
      <p className="forms-preview">
        {w.languages.flatMap((l) => l.reportedForms.slice(0, 1)).join(" · ") ||
          "Иностранные формы уточняются"}
      </p>
      <div className="card-bottom">
        <Badge />
        <span>
          {w.articleDepth === "full" ? "Подробный разбор" : "Краткая запись"}
        </span>
      </div>
    </Link>
  );
}
export function SourceLink({
  id,
  pages = [],
}: {
  id: string;
  pages?: number[];
}) {
  const s = sources.find((s) => s.id === id);
  if (s && !s.url)
    return (
      <span className="source-link">
        {s.citation || s.title}
        {pages.length ? " · с. " + pages.join(", ") : ""}
      </span>
    );
  return s ? (
    <a className="source-link" href={s.url} target="_blank" rel="noreferrer">
      {s.title}
      {pages.length ? " · с. " + pages.join(", ") : ""} ↗
    </a>
  ) : null;
}
export function ResearchNotes({
  word,
  fields,
}: {
  word: WordEntry;
  fields?: string[];
}) {
  const notes = word.notes.filter((n) => !fields || fields.includes(n.field));
  return notes.length ? (
    <div className="notes">
      {notes.map((n) => (
        <section key={n.field}>
          <div className="flex flex-wrap items-center gap-3">
            <h2>{fieldNames[n.field]}</h2>
            <Badge>
              {n.status === "disputed"
                ? "Есть расхождения"
                : "По материалам аудита"}
            </Badge>
          </div>
          <p className="preline">{n.text}</p>
          <div className="source-list">
            {n.references.map((r, i) => (
              <SourceLink key={i} id={r.sourceId} pages={r.pages} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ) : (
    <div className="empty">
      Материал собирается. Подробный анализ и библиография ещё не подготовлены.
    </div>
  );
}
