import { RichDocument } from "../components/RichDocument";
import { CompactWord, ContextLinks } from "../components/CompactWord";
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
  const releases = kind === "daily" ? [...editorial.daily].reverse() : [];
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
        {post.author} ·{" "}
        <time dateTime={post.publishedAt ?? post.date}>
          {post.publishedAt
            ? new Date(post.publishedAt).toLocaleString("ru", {
                timeZone: editorial.timezone,
              })
            : post.date}
        </time>
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
      {post.format === "word-card" ? (
        <>
          {words.find((w) => w.id === post.wordIds[0]) ? (
            <CompactWord
              word={words.find((w) => w.id === post.wordIds[0])!}
              embedded
            />
          ) : (
            <p>
              Связанная словарная статья сейчас недоступна. Черновые данные не
              показываются.
            </p>
          )}
          {post.comment && <p>{post.comment}</p>}
        </>
      ) : post.richDocument ? (
        <RichDocument value={post.richDocument} />
      ) : (
        <Markdown text={post.body} />
      )}
      <ContextLinks links={post.links} ids={[]} />
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
  const logged = useSession();
  const [query, setQuery] = useState(""),
    [month, setMonth] = useState("");
  const releases = editorial.daily;
  if (slug) {
    const post = releases.find((p) => p.slug === slug);
    return post ? <PublishedArticle post={post} kind="daily" /> : <Missing />;
  }
  const posts = releases.filter(
    (p) =>
      (!date || p.date === date) &&
      (p.title + " " + p.intro + " " + p.body)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!month || p.date.startsWith(month)),
  );
  if (date && posts.length === 1)
    return <PublishedArticle post={posts[0]} kind="daily" />;
  const archive = window.location.pathname.endsWith("/archive");
  return (
    <>
      <PageTitle
        eyebrow="Познавательные статьи и карточки слов"
        title={
          date
            ? "Публикации за " + date
            : archive
              ? "Архив «Слово дня»"
              : "Слово дня"
        }
      >
        Самостоятельные публикации о словах и языковых соответствиях.
      </PageTitle>
      {logged && (
        <Link className="button" to="/admin?section=daily">
          Добавить новую публикацию
        </Link>
      )}
      <Link to={archive ? "/word-of-the-day" : "/word-of-the-day/archive"}>
        {archive ? "Последние публикации" : "Архив «Слово дня»"}
      </Link>
      <div className="toolbar">
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
      </div>
      {!posts.length ? (
        <div className="paper empty">
          <h2>Новые публикации скоро появятся</h2>
          <p>
            {releases.length
              ? "По выбранным условиям ничего не найдено."
              : "Опубликованных материалов пока нет."}
          </p>
        </div>
      ) : (
        posts.map((post, index) => (
          <article
            className={
              "paper daily-feed-item " +
              (!archive && index === 0 ? "latest-publication" : "")
            }
            key={post.id}
          >
            <p className="eyebrow">
              {post.date} ·{" "}
              {post.format === "word-card" ? "Карточка слова" : "Статья"}
              {!archive && index === 0 ? " · Последняя публикация" : ""}
            </p>
            <h2>
              <Link to={"/word-of-the-day/issue/" + post.slug}>
                {post.title}
              </Link>
            </h2>
            {post.coverId && (
              <PublishedImage id={post.coverId} fallback={post.title} />
            )}
            <p>
              {post.intro ||
                (post.richDocument ? undefined : post.body.slice(0, 200))}
            </p>
            {post.format === "word-card" &&
              words.find((w) => w.id === post.wordIds[0]) && (
                <CompactWord
                  word={words.find((w) => w.id === post.wordIds[0])!}
                  embedded
                />
              )}
            <Link to={"/word-of-the-day/issue/" + post.slug}>
              Открыть публикацию ↗
            </Link>
          </article>
        ))
      )}
    </>
  );
}
