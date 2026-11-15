import { PublishedImage } from "../components/PublishedImage";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { editorial } from "../domain/editorial";
import { words } from "../domain/catalog";
import { useSession } from "../domain/session";
import type { Publication } from "../domain/publications";
import { Markdown } from "../components/Markdown";
import { SourceLink, PageTitle } from "../components/Common";
import { Missing } from "./Dictionary";
function PublishedArticle({
  post,
  kind,
}: {
  post: Publication;
  kind: "journal" | "daily";
}) {
  const logged = useSession();
  const link = kind === "journal" ? "/journal" : "/word-of-the-day/archive";
  const releases =
    kind === "daily"
      ? [...editorial.daily].sort((a, b) => a.date.localeCompare(b.date))
      : [];
  const index = releases.findIndex((p) => p.id === post.id);
  return (
    <article className="reading">
      <Link className="back" to={link}>
        ← {kind === "journal" ? "Журнал" : "Архив «Слово дня»"}
      </Link>
      <PageTitle
        eyebrow={
          post.category ||
          (kind === "daily" ? "Выпуск «Слово дня»" : "Редакционная публикация")
        }
        title={post.title}
      >
        {post.intro}
      </PageTitle>
      <p>
        {post.author} · <time dateTime={post.date}>{post.date}</time>
      </p>
      {logged && (
        <Link
          className="button"
          to={"/admin?section=" + kind + "&material=" + post.id}
        >
          Редактировать публикацию
        </Link>
      )}
      {post.coverId && (
        <PublishedImage id={post.coverId} fallback={post.title} />
      )}
      {post.origin && (
        <>
          <h2>Происхождение</h2>
          <Markdown text={post.origin} />
        </>
      )}
      {post.adaptation && (
        <>
          <h2>Особенности заимствования</h2>
          <Markdown text={post.adaptation} />
        </>
      )}
      {post.examples && (
        <>
          <h2>Примеры употребления</h2>
          <Markdown text={post.examples} />
        </>
      )}
      <Markdown text={post.body} />
      {post.wordIds.length > 0 && (
        <section>
          <h2>Связанные словарные статьи</h2>
          {post.wordIds.map((id) => {
            const w = words.find((w) => w.id === id);
            return w ? (
              <p key={id}>
                <Link to={"/dictionary/" + w.slug}>{w.russianLemma}</Link> ·
                научный статус:{" "}
                {w.publicationStatus === "verified"
                  ? "Подтверждено"
                  : "Требует проверки"}
              </p>
            ) : (
              <p key={id}>Связанная запись сейчас не опубликована.</p>
            );
          })}
        </section>
      )}
      {post.sourceIds.length > 0 && (
        <section>
          <h2>Источники публикации</h2>
          {post.sourceIds.map((id) => (
            <SourceLink key={id} id={id} />
          ))}
        </section>
      )}
      {kind === "daily" && (
        <nav aria-label="Соседние выпуски">
          {releases[index - 1] && (
            <Link to={"/word-of-the-day/issue/" + releases[index - 1].slug}>
              ← Предыдущий выпуск
            </Link>
          )}{" "}
          {releases[index + 1] && (
            <Link to={"/word-of-the-day/issue/" + releases[index + 1].slug}>
              Следующий выпуск →
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
export function Journal() {
  const { slug } = useParams();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [month, setMonth] = useState("");
  if (slug) {
    const post = editorial.journal.find((p) => p.slug === slug);
    return post ? <PublishedArticle post={post} kind="journal" /> : <Missing />;
  }
  const posts = editorial.journal.filter(
    (p) =>
      (p.title + " " + p.intro + " " + p.body)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!category || p.category === category) &&
      (!month || p.date.startsWith(month)),
  );
  return (
    <>
      <PageTitle eyebrow="Редакционные материалы" title="Журнал">
        Архив публикаций проекта.
      </PageTitle>
      <div className="toolbar">
        <label>
          Поиск в журнале
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          Категория журнала
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Все категории</option>
            {[...new Set(editorial.journal.map((p) => p.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Месяц публикации
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>
      <div className="journal-grid">
        {posts.map((p) => (
          <Link className="journal-card" key={p.id} to={"/journal/" + p.slug}>
            <p className="eyebrow">
              {p.category} · {p.date}
            </p>
            <h2>{p.title}</h2>
            <p>{p.intro}</p>
            <span>Читать заметку ↗</span>
          </Link>
        ))}
      </div>
      {!posts.length && <p>Публикации не найдены.</p>}
    </>
  );
}
export function DayWord() {
  const { date, slug } = useParams();
  const [query, setQuery] = useState(""),
    [month, setMonth] = useState("");
  if (date || slug) {
    const post = editorial.daily.find((p) =>
      slug ? p.slug === slug : p.date === date,
    );
    return post ? <PublishedArticle post={post} kind="daily" /> : <Missing />;
  }
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone: editorial.timezone,
  }).format(new Date());
  const latest =
    editorial.daily.find((p) => p.date === current) ?? editorial.daily[0];
  const archive = window.location.pathname.endsWith("/archive");
  if (!archive)
    return (
      <>
        <PageTitle eyebrow="Одна история каждый день" title="Слово дня">
          Редакционные выпуски с источниками и ссылками на словарь.
        </PageTitle>
        <Link className="button secondary" to="/word-of-the-day/archive">
          Архив «Слово дня»
        </Link>
        {latest ? (
          <>
            <p>
              {latest.date === current
                ? "Сегодняшний выпуск"
                : "Последний опубликованный выпуск от " +
                  latest.date +
                  ". На сегодня выпуск не назначен."}
            </p>
            <PublishedArticle post={latest} kind="daily" />
          </>
        ) : (
          <div className="paper empty">
            <h2>Первое слово дня ещё впереди</h2>
            <p>
              Опубликованных редакционных выпусков пока нет. Непроверенные
              сведения не подставляются автоматически.
            </p>
            <Link to="/dictionary">Изучить материалы исследования ↗</Link>
          </div>
        )}
      </>
    );
  const posts = editorial.daily.filter(
    (p) =>
      (p.title + " " + p.intro + " " + p.body)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!month || p.date.startsWith(month)),
  );
  return (
    <>
      <PageTitle eyebrow="Все предыдущие выпуски" title="Архив «Слово дня»">
        Выпуски сохраняются после наступления новой даты.
      </PageTitle>
      <label>
        Поиск по архиву
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label>
        Месяц и год
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      {posts.map((p) => (
        <article className="paper" key={p.id}>
          <time>{p.date}</time>
          <h2>
            <Link to={"/word-of-the-day/issue/" + p.slug}>{p.title}</Link>
          </h2>
          <p>{p.intro}</p>
        </article>
      ))}
      {!posts.length && <p>Выпуски не найдены.</p>}
    </>
  );
}
