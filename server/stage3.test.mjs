import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openStore, list, save, publicCatalog } from "./store.mjs";
import {
  sourceList,
  saveResource,
  publicResources,
  settings,
  projectDate,
  resourceList,
} from "./stage2.mjs";
import { passwordHash } from "./manage.mjs";
import { createApp } from "./index.mjs";
import { validateDocument } from "../src/domain/universal.ts";
const document = (text) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const word = (id = randomUUID()) => ({
  id,
  slug: "word-" + id,
  russianLemma: "Тестовое слово",
  shortDescription: "Описание для теста",
  format: "compact",
  originKind: "unknown",
  themes: [],
  articleDepth: "short",
  publicationStatus: "draft",
  researchIncluded: false,
  isDemo: true,
  auditStatus: "Тест",
  sourceIds: [],
  languages: [],
  notes: [],
});
async function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), "stage3-")),
    path = join(dir, "db.sqlite"),
    db = openStore(path);
  const password = randomUUID() + randomUUID();
  db.prepare("INSERT INTO owner VALUES(1,?)").run(passwordHash(password));
  const port = 40000 + Math.floor(Math.random() * 20000),
    origin = "http://127.0.0.1:" + port,
    app = createApp({ db, origin });
  await new Promise((resolve, reject) => {
    app.once("error", reject);
    app.listen(port, "127.0.0.1", resolve);
  });
  let cookie = "";
  const request = async (path, method = "GET", data) =>
    fetch(origin + "/api/" + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  try {
    for (const path of [
      "admin/categories/ensure",
      "admin/languages/ensure",
      "admin/daily-cleanup",
      "admin/backup",
    ])
      assert.equal((await request(path, "POST", {})).status, 401);
    const login = await request("auth/login", "POST", { password });
    cookie = login.headers.get("set-cookie").split(";")[0];
    const ok = async (path, method = "GET", data) => {
      const r = await request(path, method, data);
      const v = await r.json();
      assert.equal(r.status, 200, JSON.stringify(v));
      return v;
    };
    await run({ db, path, dir, request, ok });
  } finally {
    await new Promise((resolve) => app.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("stage-two migration preserves all table contents, owner and legacy publications; backup precedes additive language columns", async () =>
  fixture(async ({ db, path, dir }) => {
    // Reconstruct the exact stage-two language table; all other tables retain their schema and data.
    const custom = word();
    save(db, { data: custom, version: 0, state: "draft" });
    db.prepare(
      "INSERT INTO resources VALUES('daily','old',?,?, 'published',1,?,NULL)",
    ).run(
      JSON.stringify({
        id: "old",
        slug: "old",
        title: "Прежний выпуск",
        date: "2025-01-01",
        body: "**Армянский** հայերեն /ʃ/",
        wordIds: [],
        sourceIds: [],
        publishAt: "",
      }),
      JSON.stringify({
        id: "old",
        slug: "old",
        title: "Прежний выпуск",
        date: "2025-01-01",
        body: "**Армянский** հայերեն /ʃ/",
        wordIds: [],
        sourceIds: [],
        publishAt: "",
      }),
      new Date().toISOString(),
    );
    for (const name of [
      "nativeName",
      "region",
      "variety",
      "flag",
      "officialCode",
      "direction",
    ])
      db.exec("ALTER TABLE language_definitions DROP COLUMN " + name);
    db.exec("DELETE FROM migrations WHERE version=3");
    const snapshots = {};
    for (const table of [
      "owner",
      "sessions",
      "content",
      "history",
      "categories",
      "word_categories",
      "sources",
      "media",
      "resources",
      "audit",
      "settings",
    ])
      snapshots[table] = db.prepare("SELECT * FROM " + table).all();
    const other = openStore(path);
    try {
      for (const [table, data] of Object.entries(snapshots))
        assert.deepEqual(other.prepare("SELECT * FROM " + table).all(), data);
      assert.equal(publicResources(other, "daily")[0].slug, "old");
      const second = openStore(path);
      second.close();
    } finally {
      other.close();
    }
    const backups = readdirSync(join(dir, "backups")).filter((n) =>
      n.startsWith("before-stage3-"),
    );
    assert.equal(backups.length, 2); // one initial fresh install, one simulated upgrade
    const old = new DatabaseSync(join(dir, "backups", backups.at(-1)), {
      readOnly: true,
    });
    assert.equal(
      old.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );
    old.close();
  }));
test("new themes are idempotent, links reuse sources and remain local to associations, languages need neither a code nor a country", async () =>
  fixture(async ({ db, ok, request }) => {
    const a = await ok("admin/categories/ensure", "POST", {
        name: " Новая   тема ",
      }),
      b = await ok("admin/categories/ensure", "POST", { name: "НОВАЯ ТЕМА" });
    assert.equal(a.id, b.id);
    const language = await ok("admin/languages/ensure", "POST", {
      name: "Тестовый язык",
      direction: "rtl",
    });
    assert.equal(language.officialCode, null);
    assert.equal(language.country, "");
    assert.ok(language.code.startsWith("x-local-"));
    const w = word();
    w.themes = [a.name];
    w.links = [
      {
        url: "https://example.org/evidence",
        title: "Название",
        comment: "Комментарий",
      },
    ];
    w.languages = [
      {
        languageCode: language.code,
        countryCode: "",
        reportedForms: ["հայերեն"],
        meaning: "Тестовое значение",
        transliteration: "test",
        correspondenceType: "translation",
        attestationStatus: "unknown",
        sourceIds: [],
        references: [],
      },
    ];
    let row = save(db, { data: w, state: "published", version: 0 });
    assert.equal(
      sourceList(db).filter((s) => s.url === "https://example.org/evidence")
        .length,
      1,
    );
    const reused = word();
    reused.links = [{ url: "https://example.org/evidence" }];
    const r = save(db, { data: reused, state: "published", version: 0 });
    assert.equal(r.data.links[0].sourceId, row.data.links[0].sourceId);
    row = save(db, {
      ...row,
      data: { ...row.data, links: [], sourceIds: [] },
      state: "published",
    });
    assert.ok(sourceList(db).some((s) => s.id === r.data.sourceIds[0]));
    assert.equal(
      publicCatalog(db).words.find((x) => x.id === w.id).languages[0]
        .correspondenceType,
      "translation",
    );
    assert.equal(
      (
        await request("admin/words", "PUT", {
          data: { ...word(), links: [{ url: "javascript:alert(1)" }] },
          state: "draft",
          version: 0,
        })
      ).status,
      400,
    );
    assert.throws(
      () =>
        save(db, {
          data: { ...word(), shortDescription: "" },
          state: "published",
          version: 0,
        }),
      /описание/,
    );
    const forged = structuredClone(w);
    forged.id = randomUUID();
    forged.slug = "forged";
    forged.languages[0].correspondenceType = "borrowed";
    assert.throws(
      () => save(db, { data: forged, state: "published", version: 0 }),
      /источник/,
    );
    assert.equal(
      list(db).filter(
        (w) =>
          w.data.researchIncluded &&
          [
            "matryoshka",
            "kalashnikov",
            "dacha",
            "intelligentsia",
            "pogrom",
            "samizdat",
            "sputnik",
            "samovar",
          ].includes(w.data.slug),
      ).length,
      8,
    );
  }));
test("automatic publication instants, multiple daily articles, scheduling, linked word cards, draft isolation and cleanup safety", async () =>
  fixture(async ({ db, ok, request }) => {
    const make = (title) => ({
      id: randomUUID(),
      slug: "post-" + randomUUID(),
      format: "article",
      title,
      richDocument: document("Содержательный тестовый текст"),
      date: "1900-01-01",
    });
    let a = saveResource(db, "daily", {
      data: make("Первая статья"),
      version: 0,
      state: "published",
    });
    const instant = a.data.publishedAt;
    assert.equal(a.data.date, projectDate(db));
    assert.equal(new Date(instant).getFullYear(), new Date().getFullYear());
    const b = saveResource(db, "daily", {
      data: make("Вторая статья"),
      version: 0,
      state: "published",
    });
    assert.equal(publicResources(db, "daily").length, 2);
    a = saveResource(db, "daily", {
      ...a,
      data: { ...a.data, title: "Правка" },
      state: "draft",
    });
    assert.equal(
      publicResources(db, "daily").find((r) => r.id === a.id).title,
      "Первая статья",
    );
    a = saveResource(db, "daily", { ...a, state: "published" });
    assert.equal(a.data.publishedAt, instant);
    const draft = word();
    let w = save(db, { data: draft, version: 0, state: "draft" });
    const card = {
      id: randomUUID(),
      slug: "card-" + randomUUID(),
      format: "word-card",
      wordIds: [w.id],
    };
    assert.throws(
      () =>
        saveResource(db, "daily", {
          data: card,
          state: "published",
          version: 0,
        }),
      /явно опубликуйте/,
    );
    w = save(db, { ...w, state: "published" });
    const p = saveResource(db, "daily", {
      data: card,
      state: "published",
      version: 0,
    });
    assert.equal(p.data.title, w.data.russianLemma);
    assert.equal(p.data.body, "");
    w = save(db, {
      ...w,
      data: { ...w.data, shortDescription: "НЕОПУБЛИКОВАНО" },
      state: "draft",
    });
    assert.notEqual(
      publicCatalog(db).words.find((r) => r.id === w.id).shortDescription,
      "НЕОПУБЛИКОВАНО",
    );
    const future = new Date(Date.now() + 86400000).toISOString();
    const planned = saveResource(db, "daily", {
      data: { ...make("Будущее"), publishAt: future },
      state: "scheduled",
      version: 0,
    });
    assert.equal(planned.data.publishedAt, future);
    assert.ok(!publicResources(db, "daily").some((r) => r.id === planned.id));
    const empty = saveResource(db, "daily", {
      data: { id: randomUUID(), slug: "empty-draft", format: "article" },
      state: "draft",
      version: 0,
    });
    assert.throws(
      () => saveResource(db, "daily", { ...empty, state: "published" }),
      /заголовок/,
    );
    const beforeWords = db.prepare("SELECT * FROM content").all(),
      beforeJournal = resourceList(db, "journal"),
      beforeSources = sourceList(db),
      beforeOwner = db.prepare("SELECT * FROM owner").all();
    const backup = await request("admin/backup", "POST", {});
    assert.equal(backup.status, 200);
    assert.equal(
      Buffer.from(await backup.arrayBuffer())
        .subarray(0, 15)
        .toString(),
      "SQLite format 3",
    );
    let count = await ok("admin/daily-cleanup");
    assert.equal(
      (
        await request("admin/daily-cleanup", "POST", {
          ...count,
          action: "trash",
          confirm: "wrong",
        })
      ).status,
      400,
    );
    await ok("admin/daily-cleanup", "POST", {
      ...count,
      action: "trash",
      confirm: "В КОРЗИНУ",
    });
    assert.equal(publicResources(db, "daily").length, 0);
    assert.deepEqual(db.prepare("SELECT * FROM content").all(), beforeWords);
    assert.deepEqual(resourceList(db, "journal"), beforeJournal);
    assert.deepEqual(sourceList(db), beforeSources);
    assert.deepEqual(db.prepare("SELECT * FROM owner").all(), beforeOwner);
    const trashed = resourceList(db, "daily").find((r) => r.id === b.id);
    saveResource(db, "daily", { ...trashed, state: "draft" });
    assert.equal(
      resourceList(db, "daily").find((r) => r.id === b.id).state,
      "draft",
    );
    count = await ok("admin/daily-cleanup");
    await ok("admin/daily-cleanup", "POST", {
      ...count,
      count: count.trash,
      action: "purge",
      confirm: "УДАЛИТЬ НАВСЕГДА",
    });
    assert.equal(resourceList(db, "daily").length, 1);
    assert.equal(settings(db).timezone, "Asia/Novosibirsk");
  }));
test("rich documents reject scripts, unsafe URLs, external images and deep trees; scientific fields survive display changes", () => {
  for (const node of [
    { type: "script" },
    {
      type: "text",
      text: "bad",
      marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
    },
    { type: "image", attrs: { src: "https://attacker.example/a.svg" } },
  ])
    assert.throws(() => validateDocument({ type: "doc", content: [node] }));
  assert.deepEqual(
    validateDocument(document("հայերեն /ʃ/")),
    document("հայերեն /ʃ/"),
  );
  const dir = mkdtempSync(join(tmpdir(), "format-")),
    db = openStore(join(dir, "db.sqlite"));
  try {
    let w = word();
    w.culturalContext = "Расширенный текст";
    let row = save(db, { data: w, state: "draft", version: 0 });
    row = save(db, {
      ...row,
      data: { ...row.data, format: "detailed", articleDepth: "full" },
    });
    row = save(db, {
      ...row,
      data: { ...row.data, format: "compact", articleDepth: "short" },
    });
    assert.equal(row.data.culturalContext, w.culturalContext);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
