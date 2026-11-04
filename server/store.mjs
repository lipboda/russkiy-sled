import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "../src/domain/schema.ts";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const defaultDb = resolve(root, ".cms/content.sqlite");
export function openStore(path = process.env.CMS_DB_PATH || defaultDb) {
  mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK(id=1), hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS content (id TEXT PRIMARY KEY, data TEXT NOT NULL, published TEXT, state TEXT NOT NULL, version INTEGER NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, content_id TEXT NOT NULL, data TEXT NOT NULL, state TEXT NOT NULL, version INTEGER NOT NULL, updated TEXT NOT NULL);
  `);
  if (!db.prepare("SELECT version FROM migrations WHERE version=1").get()) {
    const catalog = validateCatalog(
      JSON.parse(readFileSync(resolve(root, "src/data/catalog.json"), "utf8")),
    );
    const add = db.prepare("INSERT INTO content VALUES (?, ?, ?, ?, 1, ?)");
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const w of catalog.words)
        add.run(
          w.id,
          JSON.stringify(w),
          JSON.stringify(w),
          "published",
          new Date().toISOString(),
        );
      db.prepare("INSERT INTO migrations VALUES (1)").run();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      db.close();
      throw e;
    }
  }
  return db;
}
export function catalogWith(_db, words) {
  const seed = JSON.parse(
    readFileSync(resolve(root, "src/data/catalog.json"), "utf8"),
  );
  return validateCatalog({ ...seed, words });
}
export function publicCatalog(db) {
  return catalogWith(
    db,
    db
      .prepare(
        "SELECT published FROM content WHERE published IS NOT NULL ORDER BY rowid",
      )
      .all()
      .map((r) => JSON.parse(r.published)),
  );
}
export function list(db) {
  return db
    .prepare("SELECT * FROM content ORDER BY rowid")
    .all()
    .map((row) => ({
      ...row,
      data: JSON.parse(row.data),
      published: row.published !== null,
    }));
}
export function save(db, { data, state, version }) {
  if (!["draft", "review", "published", "archived"].includes(state))
    throw new Error("Недопустимый редакционный статус");
  if (
    !data ||
    typeof data.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(data.id)
  )
    throw new Error("Некорректный ID");
  db.exec("BEGIN IMMEDIATE");
  try {
    const old = db.prepare("SELECT * FROM content WHERE id=?").get(data.id);
    if ((old?.version ?? 0) !== version) {
      const e = new Error(
        "Запись изменена. Обновите список перед сохранением.",
      );
      e.status = 409;
      throw e;
    }
    const others = list(db)
      .filter((r) => r.id !== data.id)
      .map((r) => r.data);
    const validated = catalogWith(db, [...others, data]).words.at(-1);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(validated.slug))
      throw new Error("URL: только латинские буквы, цифры и дефисы");
    if (old && JSON.parse(old.data).slug !== validated.slug)
      throw new Error("URL существующей записи неизменяем");
    // Draft slug reservations must not hide or collide with an older published snapshot.
    const published = publicCatalog(db).words.filter((w) => w.id !== data.id);
    catalogWith(db, [...published, validated]);
    const json = JSON.stringify(validated),
      date = new Date().toISOString();
    if (old)
      db.prepare(
        "INSERT INTO history(content_id,data,state,version,updated) VALUES (?,?,?,?,?)",
      ).run(old.id, old.data, old.state, old.version, old.updated);
    const snapshot =
      state === "published"
        ? json
        : state === "archived"
          ? null
          : (old?.published ?? null);
    db.prepare(
      `INSERT INTO content VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,published=excluded.published,state=excluded.state,version=excluded.version,updated=excluded.updated`,
    ).run(data.id, json, snapshot, state, version + 1, date);
    db.exec("COMMIT");
    return list(db).find((r) => r.id === data.id);
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
