import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { publicationSchema } from "../src/domain/publications.ts";
import { sourceSchema } from "../src/domain/schema.ts";
import { journal } from "../src/data/journal.ts";

export function atomic(db, fn) {
  const own = !db.isTransaction;
  if (own) db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    if (own) db.exec("COMMIT");
    return result;
  } catch (e) {
    if (own) db.exec("ROLLBACK");
    throw e;
  }
}
export function migrateStage2(db, path, root) {
  if (db.prepare("SELECT version FROM migrations WHERE version=2").get())
    return;
  // VACUUM INTO creates a consistent, closed SQLite snapshot including WAL contents.
  if (path !== ":memory:") {
    const folder = resolve(dirname(path), "backups");
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const target = resolve(
      folder,
      `before-stage2-${Date.now()}-${randomUUID()}.sqlite`,
    );
    db.exec("VACUUM INTO '" + target.replaceAll("'", "''") + "'");
    chmodSync(target, 0o600);
  }
  atomic(db, () => {
    db.exec(`CREATE TABLE categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,normalized TEXT NOT NULL UNIQUE,description TEXT NOT NULL DEFAULT '',sort INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE word_categories(word_id TEXT NOT NULL,category_id TEXT NOT NULL REFERENCES categories(id),scope TEXT NOT NULL,PRIMARY KEY(word_id,category_id,scope));
   CREATE TABLE sources(id TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE TABLE resources(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,published TEXT,state TEXT NOT NULL,version INTEGER NOT NULL,updated TEXT NOT NULL,deleted TEXT,PRIMARY KEY(kind,id));
   CREATE TABLE audit(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,entity_id TEXT NOT NULL,title TEXT NOT NULL,operation TEXT NOT NULL,previous TEXT,next TEXT,created TEXT NOT NULL);
   CREATE TABLE media(id TEXT PRIMARY KEY,data TEXT NOT NULL,bytes BLOB NOT NULL);
   CREATE TABLE language_definitions(code TEXT PRIMARY KEY,name TEXT NOT NULL,country TEXT NOT NULL);
   INSERT INTO language_definitions VALUES('en-US','Американский английский','US'),('fr-FR','Французский','FR'),('hy-AM','Восточноармянский','AM');
   CREATE TABLE settings(id INTEGER PRIMARY KEY CHECK(id=1),timezone TEXT NOT NULL);
   INSERT INTO settings VALUES(1,'Asia/Novosibirsk');`);
    const seed = JSON.parse(
      readFileSync(resolve(root, "src/data/catalog.json"), "utf8"),
    );
    for (const s of seed.sources)
      db.prepare("INSERT INTO sources VALUES(?,?)").run(
        s.id,
        JSON.stringify(s),
      );
    for (const row of db.prepare("SELECT * FROM content").all()) {
      syncCategories(db, row.id, JSON.parse(row.data).themes, "draft");
      if (row.published)
        syncCategories(db, row.id, JSON.parse(row.published).themes, "public");
    }
    for (const post of journal) {
      const data = publicationSchema.parse({
        id: "journal-" + post.slug,
        ...post,
        body:
          post.paragraphs.join("\n\n") +
          "\n\nОсновано на PROJECT_SPEC.md и первичном аудите исследовательского комплекта.\n\n[Читать исходный аудит ↗](https://github.com/lipboda/russkiy-sled/blob/f3bcc2dad9330096769e52b0405d44a1bcb99c39/research/reports/INITIAL_RESEARCH_AUDIT.md)",
        author: "Редакция проекта",
        date: "2026-11-03",
        publishAt: "2026-11-03T00:00:00.000Z",
      });
      db.prepare("INSERT INTO resources VALUES(?,?,?,?,?,1,?,NULL)").run(
        "journal",
        data.id,
        JSON.stringify(data),
        JSON.stringify(data),
        "published",
        new Date().toISOString(),
      );
    }
    db.prepare("INSERT INTO migrations VALUES(2)").run();
  });
}
export const normalizeCategory = (name) =>
  name.trim().toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ");
export function categoryList(db) {
  return db
    .prepare(
      `SELECT c.*,COUNT(DISTINCT wc.word_id) AS count FROM categories c LEFT JOIN word_categories wc ON wc.category_id=c.id GROUP BY c.id ORDER BY c.sort,c.name`,
    )
    .all();
}
export function syncCategories(db, wordId, names, scope) {
  db.prepare("DELETE FROM word_categories WHERE word_id=? AND scope=?").run(
    wordId,
    scope,
  );
  for (const name of names) {
    if (!normalizeCategory(name)) continue;
    let category = db
      .prepare("SELECT id FROM categories WHERE normalized=?")
      .get(normalizeCategory(name));
    if (!category) {
      category = { id: randomUUID() };
      db.prepare("INSERT INTO categories VALUES(?,?,?,'',0)").run(
        category.id,
        name.trim(),
        normalizeCategory(name),
      );
    }
    db.prepare("INSERT OR IGNORE INTO word_categories VALUES(?,?,?)").run(
      wordId,
      category.id,
      scope,
    );
  }
}
export function themesFor(db, id, scope) {
  return db
    .prepare(
      "SELECT c.name FROM word_categories wc JOIN categories c ON c.id=wc.category_id WHERE wc.word_id=? AND wc.scope=? ORDER BY wc.rowid",
    )
    .all(id, scope)
    .map((c) => c.name);
}
export function audit(db, kind, id, title, operation, previous, next) {
  db.prepare(
    "INSERT INTO audit(kind,entity_id,title,operation,previous,next,created) VALUES(?,?,?,?,?,?,?)",
  ).run(
    kind,
    id,
    title,
    operation,
    previous === null ? null : JSON.stringify(previous),
    next === null ? null : JSON.stringify(next),
    new Date().toISOString(),
  );
}
export function resourceList(db, kind) {
  return db
    .prepare("SELECT * FROM resources WHERE kind=? ORDER BY updated DESC")
    .all(kind)
    .map((r) => ({
      ...r,
      data: JSON.parse(r.data),
      published: r.published !== null,
    }));
}
export function settings(db) {
  return db.prepare("SELECT timezone FROM settings WHERE id=1").get();
}
export function projectDate(db, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: settings(db).timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function publicResources(db, kind, now = new Date()) {
  const date = projectDate(db, now);
  return db
    .prepare(
      "SELECT * FROM resources WHERE kind=? AND published IS NOT NULL AND state NOT IN ('archived','trash','unpublished')",
    )
    .all(kind)
    .map((row) => ({ row, data: JSON.parse(row.published) }))
    .filter(
      ({ data }) =>
        (kind !== "daily" || data.date <= date) &&
        (!data.publishAt || new Date(data.publishAt) <= now),
    )
    .map(({ data }) => data)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
    );
}
export function sourceList(db) {
  return db
    .prepare("SELECT data FROM sources ORDER BY rowid")
    .all()
    .map((r) => JSON.parse(r.data));
}
export function references(db, type, id) {
  const result = [];
  for (const row of db.prepare("SELECT id,data,published FROM content").all()) {
    for (const scope of ["data", "published"])
      if (row[scope]) {
        const w = JSON.parse(row[scope]);
        const refs =
          type === "source"
            ? [
                ...w.sourceIds,
                ...w.languages.flatMap((l) => [
                  ...l.sourceIds,
                  ...l.references.map((r) => r.sourceId),
                ]),
                ...w.notes.flatMap((n) => n.references.map((r) => r.sourceId)),
              ]
            : type === "media"
              ? [w.coverId]
              : type === "word"
                ? (w.relatedWordIds ?? [])
                : [];
        if (refs.includes(id))
          result.push({ kind: "word", id: row.id, title: w.russianLemma });
      }
  }
  for (const row of db.prepare("SELECT * FROM resources").all())
    for (const scope of ["data", "published"])
      if (row[scope]) {
        const data = JSON.parse(row[scope]);
        if (
          (type === "word"
            ? data.wordIds
            : type === "source"
              ? data.sourceIds
              : [
                  data.coverId,
                  ...[
                    ...[data.body, data.origin, data.adaptation, data.examples]
                      .join("\n")
                      .matchAll(/\/api\/media\/([a-zA-Z0-9_-]+)/g),
                  ].map((m) => m[1]),
                ]
          ).includes(id)
        )
          result.push({ kind: row.kind, id: row.id, title: data.title });
      }
  if (type === "word") {
    const word = db.prepare("SELECT data FROM content WHERE id=?").get(id);
    if (word) {
      const w = JSON.parse(word.data);
      if (
        w.researchIncluded &&
        [
          "matryoshka",
          "kalashnikov",
          "dacha",
          "intelligentsia",
          "pogrom",
          "samizdat",
          "sputnik",
          "samovar",
        ].includes(w.slug)
      )
        result.push({
          kind: "research",
          id,
          title: "Основное сравнительное исследование",
        });
    }
  }
  return [...new Map(result.map((r) => [r.kind + ":" + r.id, r])).values()];
}
export function saveResource(db, kind, input) {
  return atomic(db, () => {
    if (!["journal", "daily"].includes(kind))
      throw new Error("Неизвестный тип материала");
    const data = publicationSchema.parse(input.data);
    const states = [
      "draft",
      "review",
      "published",
      "scheduled",
      "unpublished",
      "archived",
      "trash",
    ];
    if (!states.includes(input.state))
      throw new Error("Неизвестный редакционный статус");
    const old = db
      .prepare("SELECT * FROM resources WHERE kind=? AND id=?")
      .get(kind, data.id);
    if ((old?.version ?? 0) !== input.version)
      throw new Error(
        "Материал изменён. Обновите список, сохранив свои правки.",
      );
    if (old && JSON.parse(old.data).slug !== data.slug)
      throw new Error("URL существующего материала неизменяем");
    if (
      resourceList(db, kind).some(
        (r) => r.id !== data.id && r.data.slug === data.slug,
      )
    )
      throw new Error("Такой URL уже используется");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
      Number.isNaN(Date.parse(data.date)) ||
      new Date(data.date).toISOString().slice(0, 10) !== data.date
    )
      throw new Error("Некорректная дата");
    if (
      data.publishAt &&
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data.publishAt)
    )
      throw new Error("Время публикации требует часового пояса");
    if (data.publishAt && Number.isNaN(Date.parse(data.publishAt)))
      throw new Error("Некорректное время публикации");
    if (input.state === "scheduled" && !data.publishAt && kind === "journal")
      throw new Error("Задайте время публикации");
    for (const id of data.wordIds)
      if (!db.prepare("SELECT id FROM content WHERE id=?").get(id))
        throw new Error("Связанная статья не найдена");
    for (const id of data.sourceIds)
      if (!db.prepare("SELECT id FROM sources WHERE id=?").get(id))
        throw new Error("Источник не найден");
    if (
      data.coverId &&
      !db.prepare("SELECT id FROM media WHERE id=?").get(data.coverId)
    )
      throw new Error("Обложка не найдена");
    if (kind === "daily" && ["published", "scheduled"].includes(input.state)) {
      for (const r of resourceList(db, kind))
        if (r.id !== data.id) {
          const snapshots = [
            ["published", "scheduled"].includes(r.state) ? r.data : null,
            r.published
              ? JSON.parse(
                  db
                    .prepare(
                      "SELECT published FROM resources WHERE kind=? AND id=?",
                    )
                    .get(kind, r.id).published,
                )
              : null,
          ];
          if (
            !["trash", "archived", "unpublished"].includes(r.state) &&
            snapshots.some((s) => s?.date === data.date)
          )
            throw new Error("На эту дату уже есть активный выпуск");
        }
    }
    const row = {
      ...data,
      createdAt: old
        ? (JSON.parse(old.data).createdAt ?? old.updated)
        : new Date().toISOString(),
    };
    const published = ["published", "scheduled"].includes(input.state)
      ? JSON.stringify(row)
      : ["trash", "archived", "unpublished"].includes(input.state)
        ? null
        : (old?.published ?? null);
    const updated = new Date().toISOString();
    db.prepare(
      `INSERT INTO resources VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,published=excluded.published,state=excluded.state,version=excluded.version,updated=excluded.updated,deleted=excluded.deleted`,
    ).run(
      kind,
      data.id,
      JSON.stringify(row),
      published,
      input.state,
      input.version + 1,
      updated,
      input.state === "trash" ? updated : null,
    );
    audit(
      db,
      kind,
      data.id,
      data.title,
      input.state,
      old ? JSON.parse(old.data) : null,
      row,
    );
    return resourceList(db, kind).find((r) => r.id === data.id);
  });
}
export function saveSource(db, input, validate) {
  return atomic(db, () => {
    const data = sourceSchema.parse(input);
    const before = sourceList(db),
      old = before.find((s) => s.id === data.id);
    // Source verification is explicit and never inferred from editorial publication.
    const next = [...before.filter((s) => s.id !== data.id), data];
    validate(next);
    db.prepare(
      "INSERT INTO sources VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    ).run(data.id, JSON.stringify(data));
    audit(db, "source", data.id, data.title, "save", old ?? null, data);
    return data;
  });
}
