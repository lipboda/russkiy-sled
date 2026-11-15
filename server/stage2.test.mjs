import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { openStore, list, publicCatalog, save, root } from "./store.mjs";
import { createApp } from "./index.mjs";
import { passwordHash } from "./manage.mjs";
import { publicResources, projectDate } from "./stage2.mjs";
const seed = JSON.parse(
  readFileSync(join(root, "src/data/catalog.json"), "utf8"),
);

test("upgrade of an actual stage-one schema backs up first and preserves owner, sessions, Unicode edits, history and public URLs", () => {
  const dir = mkdtempSync(join(tmpdir(), "cms-upgrade-")),
    path = join(dir, "old.sqlite");
  let db = new DatabaseSync(path);
  try {
    db.exec(`CREATE TABLE migrations(version INTEGER PRIMARY KEY);INSERT INTO migrations VALUES(1);
   CREATE TABLE owner(id INTEGER PRIMARY KEY CHECK(id=1),hash TEXT NOT NULL);
   CREATE TABLE sessions(token TEXT PRIMARY KEY,expires INTEGER NOT NULL);
   CREATE TABLE attempts(ip TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE content(id TEXT PRIMARY KEY,data TEXT NOT NULL,published TEXT,state TEXT NOT NULL,version INTEGER NOT NULL,updated TEXT NOT NULL);
   CREATE TABLE history(id INTEGER PRIMARY KEY,content_id TEXT NOT NULL,data TEXT NOT NULL,state TEXT NOT NULL,version INTEGER NOT NULL,updated TEXT NOT NULL);`);
    const hash = passwordHash(randomUUID() + randomUUID());
    db.prepare("INSERT INTO owner VALUES(1,?)").run(hash);
    db.prepare("INSERT INTO sessions VALUES(?,?)").run(
      "old-session-hash",
      Date.now() + 60000,
    );
    for (const w of seed.words)
      db.prepare("INSERT INTO content VALUES(?,?,?,?,?,?)").run(
        w.id,
        JSON.stringify(w),
        JSON.stringify(w),
        "published",
        1,
        "2026-11-01",
      );
    const changed = {
      ...seed.words[0],
      editorialNotes: "Личная правка: հայերեն /ʃ/",
    };
    db.prepare("UPDATE content SET data=?,version=2 WHERE id=?").run(
      JSON.stringify(changed),
      changed.id,
    );
    db.prepare("INSERT INTO history VALUES(1,?,?,?,?,?)").run(
      changed.id,
      JSON.stringify(seed.words[0]),
      "published",
      1,
      "2026-11-01",
    );
    db.close();
    db = openStore(path);
    assert.equal(db.prepare("SELECT hash FROM owner").get().hash, hash);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 1);
    assert.equal(list(db)[0].data.editorialNotes, changed.editorialNotes);
    assert.equal(list(db)[0].version, 2);
    assert.equal(publicCatalog(db).words[0].slug, seed.words[0].slug);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM history").get().n, 1);
    const backups = readdirSync(join(dir, "backups")).filter((n) =>
      n.startsWith("before-stage2-"),
    );
    assert.equal(backups.length, 1);
    const backup = new DatabaseSync(join(dir, "backups", backups[0]), {
      readOnly: true,
    });
    assert.equal(backup.prepare("SELECT hash FROM owner").get().hash, hash);
    assert.equal(
      backup
        .prepare("SELECT COUNT(*) AS n FROM migrations WHERE version=2")
        .get().n,
      0,
    );
    assert.equal(
      backup.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    backup.close();
    assert.equal(
      statSync(join(dir, "backups", backups[0])).mode & 0o777,
      0o600,
    );
    assert.equal(publicResources(db, "journal").length, 3);
    db.close();
    db = openStore(path);
    assert.equal(
      readdirSync(join(dir, "backups")).filter((n) =>
        n.startsWith("before-stage2-"),
      ).length,
      1,
    );
    assert.equal(list(db).length, 58);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

async function apiFixture(run) {
  const dir = mkdtempSync(join(tmpdir(), "cms-stage2-")),
    path = join(dir, "test.sqlite");
  const db = openStore(path);
  const password = randomUUID() + randomUUID();
  db.prepare("INSERT INTO owner VALUES(1,?)").run(passwordHash(password));
  const port = 51000 + Math.floor(Math.random() * 10000),
    origin = "http://127.0.0.1:" + port;
  const app = createApp({ db, origin });
  await new Promise((resolve, reject) => {
    app.once("error", reject);
    app.listen(port, "127.0.0.1", resolve);
  });
  let cookie = "";
  const req = async (path, method = "GET", data) => {
    const r = await fetch(origin + "/api/" + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return r;
  };
  try {
    for (const path of [
      "admin/editorial",
      "admin/categories",
      "admin/history",
      "admin/media",
      "admin/sources",
      "admin/settings",
      "admin/publications/journal",
    ])
      assert.equal((await req(path)).status, 401);
    for (const path of [
      "admin/word-actions",
      "admin/categories",
      "admin/sources",
      "admin/settings",
      "admin/media",
      "admin/publications/daily",
      "admin/restore-history",
    ])
      assert.equal((await req(path, "POST", {})).status, 401);
    const login = await req("auth/login", "POST", { password });
    cookie = login.headers.get("set-cookie").split(";")[0];
    const ok = async (path, method = "GET", data) => {
      const r = await req(path, method, data);
      const value = await r.json();
      assert.equal(r.status, 200, JSON.stringify(value));
      return value;
    };
    await run({ db, req, ok });
  } finally {
    await new Promise((resolve) => app.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
test("categories rename/merge/delete update published and draft relations without losing words; batch rollback, duplicate and trash lifecycle", async () =>
  apiFixture(async ({ db, req, ok }) => {
    const row = list(db)[0];
    const original = structuredClone(row.data);
    await ok("admin/categories", "PUT", {
      id: "new-category",
      name: "Новая категория",
    });
    await ok("admin/word-actions", "POST", {
      ids: [row.id],
      versions: { [row.id]: row.version },
      action: "categories",
      categoryIds: ["new-category"],
    });
    assert.equal(list(db)[0].data.themes[0], "Новая категория");
    await ok("admin/word-actions", "POST", {
      ids: [row.id],
      versions: { [row.id]: 2 },
      action: "publish",
      confirm: "CONFIRM",
    });
    await ok("admin/categories", "PUT", {
      id: "new-category",
      name: "Переименовано",
    });
    assert.deepEqual(publicCatalog(db).words[0].themes, ["Переименовано"]);
    assert.deepEqual(list(db)[0].data.themes, ["Переименовано"]);
    assert.equal(
      (
        await req("admin/categories", "PUT", {
          id: "duplicate-name",
          name: "переименовано",
        })
      ).status,
      400,
    );
    await ok("admin/categories", "PUT", { id: "target", name: "Целевая" });
    await ok("admin/categories", "POST", {
      id: "new-category",
      targetId: "target",
      confirm: "Переименовано",
    });
    assert.deepEqual(publicCatalog(db).words[0].themes, ["Целевая"]);
    await ok("admin/categories", "POST", { id: "target", confirm: "Целевая" });
    assert.equal(list(db).length, 58);
    assert.deepEqual(publicCatalog(db).words[0].themes, []);
    const duplicate = (
      await ok("admin/word-actions", "POST", {
        ids: [row.id],
        action: "duplicate",
        versions: { [row.id]: list(db).find((r) => r.id === row.id).version },
      })
    )[0];
    assert.notEqual(duplicate.id, row.id);
    assert.equal(duplicate.state, "draft");
    assert.equal(duplicate.data.publicationStatus, original.publicationStatus);
    const current = list(db).find((r) => r.id === row.id);
    assert.equal(
      (
        await req("admin/word-actions", "POST", {
          ids: [row.id, duplicate.id],
          versions: { [row.id]: current.version, [duplicate.id]: 99 },
          action: "trash",
          confirm: "CONFIRM",
        })
      ).status,
      400,
    );
    assert.equal(list(db).find((r) => r.id === row.id).state, "published");
    let d = (
      await ok("admin/word-actions", "POST", {
        ids: [duplicate.id],
        versions: { [duplicate.id]: 1 },
        action: "trash",
        confirm: "CONFIRM",
      })
    )[0];
    d = (
      await ok("admin/word-actions", "POST", {
        ids: [d.id],
        versions: { [d.id]: d.version },
        action: "restore",
      })
    )[0];
    assert.equal(d.state, "draft");
    d = (
      await ok("admin/word-actions", "POST", {
        ids: [d.id],
        versions: { [d.id]: d.version },
        action: "trash",
        confirm: "CONFIRM",
      })
    )[0];
    await ok("admin/word-actions", "POST", {
      ids: [d.id],
      versions: { [d.id]: d.version },
      action: "delete",
      confirm: d.data.russianLemma,
    });
    assert.equal(list(db).length, 58);
  }));
test("journal, daily archives and scheduling honor timezone and retain published snapshots, references block deletion, image bytes are decoded and sanitized", async () =>
  apiFixture(async ({ db, req, ok }) => {
    const make = (id, date) => ({
      id,
      slug: id,
      title: id,
      date,
      body: "**Текст** հայերեն /ʃ/",
    });
    let journal = await ok("admin/publications/journal", "PUT", {
      data: make("journal-test", "2026-01-01"),
      state: "draft",
      version: 0,
    });
    assert.equal(publicResources(db, "journal").length, 3);
    journal = await ok("admin/publications/journal", "PUT", {
      ...journal,
      state: "published",
    });
    assert.equal(publicResources(db, "journal").length, 4);
    await ok("admin/publications/journal", "PUT", {
      ...journal,
      state: "draft",
      data: { ...journal.data, body: "Secret draft" },
    });
    assert.notEqual(
      publicResources(db, "journal").find((p) => p.id === journal.id).body,
      "Secret draft",
    );
    await ok("admin/settings", "PUT", { timezone: "Asia/Novosibirsk" });
    assert.equal(
      projectDate(db, new Date("2026-01-01T18:00:00Z")),
      "2026-01-02",
    );
    // Legacy stage-two snapshots retain their original calendar dates and schedules.
    const legacy = (id, date, state) => {
      const data = {
        ...make(id, date),
        intro: "",
        author: "",
        category: "",
        publishAt: "",
        coverId: "",
        wordIds: [],
        sourceIds: [],
        origin: "",
        adaptation: "",
        examples: "",
      };
      db.prepare("INSERT INTO resources VALUES(?,?,?,?,?,1,?,NULL)").run(
        "daily",
        id,
        JSON.stringify(data),
        JSON.stringify(data),
        state,
        new Date().toISOString(),
      );
      return { id };
    };
    const daily = legacy("daily-one", "2026-01-01", "published");
    legacy("daily-two", "2026-01-02", "scheduled");
    assert.equal(
      publicResources(db, "daily", new Date("2026-01-01T16:00:00Z")).length,
      1,
    );
    assert.equal(
      publicResources(db, "daily", new Date("2026-01-01T18:00:00Z")).length,
      2,
    );
    // Stage three permits more than one publication on the same day.
    legacy("same-date", "2026-01-02", "published");
    assert.equal(
      publicResources(db, "daily", new Date("2026-01-01T18:00:00Z")).length,
      3,
    );
    assert.equal(
      publicResources(db, "daily", new Date("2026-01-01T18:00:00Z")).at(-1).id,
      daily.id,
    );
    const source = {
      id: "new-source",
      title: "Источник для теста",
      url: "https://example.org",
      accessLevel: "bibliography",
      notes: "",
    };
    await ok("admin/sources", "PUT", source);
    const word = list(db)[0];
    save(db, {
      ...word,
      data: { ...word.data, sourceIds: [...word.data.sourceIds, source.id] },
      state: "draft",
    });
    assert.equal(
      (
        await req("admin/sources", "DELETE", {
          id: source.id,
          confirm: source.title,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("admin/sources", "PUT", {
          ...source,
          url: "javascript:alert(1)",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("admin/media", "POST", {
          name: "bad",
          alt: "bad",
          base64: Buffer.from('<svg onload="alert(1)"/>').toString("base64"),
        })
      ).status,
      400,
    );
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const media = await ok("admin/media", "POST", {
      name: "test image",
      alt: "Описание",
      base64: bytes.toString("base64"),
    });
    const image = await req("media/" + media.id);
    assert.equal(image.headers.get("content-type"), "image/webp");
    const src = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
    assert.equal(src.format, "webp");
    let publication = await ok("admin/publications/journal", "PUT", {
      data: {
        ...make("with-image", "2026-01-01"),
        coverId: media.id,
        wordIds: [word.id],
      },
      state: "draft",
      version: 0,
    });
    assert.equal(
      (
        await req("admin/media", "DELETE", {
          id: media.id,
          confirm: media.name,
        })
      ).status,
      400,
    );
    const history = await ok("admin/history");
    assert.ok(history.length > 0);
    const renamed = await ok("admin/publications/journal", "PUT", {
      ...publication,
      data: { ...publication.data, title: "Новое название" },
    });
    assert.equal(renamed.version, 2);
    const event = (await ok("admin/history")).find(
      (e) => e.entity_id === publication.id && e.previous,
    );
    await ok("admin/restore-history", "POST", { id: event.id });
    assert.equal(
      publicResources(db, "journal").some((p) => p.id === publication.id),
      false,
    );
    publication = (await ok("admin/publications/journal")).find(
      (r) => r.id === publication.id,
    );
    assert.equal(publication.data.title, "with-image");
  }));
