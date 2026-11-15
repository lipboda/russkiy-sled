import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { openStore, list, save, publicCatalog, root } from "./store.mjs";
import { applyImport } from "./content-import.mjs";
import {
  finalBundle,
  planFinalPublication,
  publishFinal,
} from "./publish-final.mjs";
const bundle = finalBundle();
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "cms-final-release-")),
    path = join(dir, "content.sqlite"),
    db = openStore(path);
  applyImport(db, bundle);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { db, path, dir };
}
const tables = (db) =>
  ["owner", "sessions", "settings", "media", "resources"].map((table) => [
    table,
    db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
  ]);
const all = (db) =>
  [
    "content",
    "history",
    "audit",
    "sources",
    "categories",
    "word_categories",
    "language_definitions",
    "media",
  ].map((table) => [
    table,
    db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
  ]);
test("publishes only final mapped 28, keeps science, identity and user data, leaves placeholders stored, repeat has no extra revisions", (t) => {
  const { db } = fixture(t);
  db.prepare("INSERT INTO owner VALUES(1,?)").run("fixture-owner-hash");
  db.prepare("INSERT INTO media VALUES(?,?,?)").run(
    "cover-final",
    "{}",
    Buffer.from("fixture media"),
  );
  db.prepare("UPDATE settings SET timezone='Europe/Moscow'").run();
  const plan = planFinalPublication(db);
  assert.equal(plan.plans.length, 28);
  const record = list(db).find((r) => r.id === plan.plans[0].id);
  save(db, {
    data: {
      ...record.data,
      coverId: "cover-final",
      relatedWordIds: [plan.plans[1].id],
    },
    state: "draft",
    version: record.version,
  });
  const before = list(db),
    snapshot = tables(db);
  const beforeScience = planFinalPublication(db).plans.map((p) => [
    p.data.publicationStatus,
    p.data.scientificStatus,
    p.data.languages.map((l) => [l.attestationStatus, l.correspondenceType]),
  ]);
  const result = publishFinal(db);
  assert.deepEqual(result, {
    publishedFinal: 28,
    main: 8,
    additional: 20,
    researchCards: 24,
    changed: 28,
    skipped: 0,
    conflicts: 0,
    publicDictionaryTotal: 28,
    scientificStatusesChanged: false,
  });
  assert.deepEqual(tables(db), snapshot);
  assert.equal(list(db).length, before.length);
  assert.equal(publicCatalog(db).words.length, 28);
  assert.deepEqual(
    planFinalPublication(db).plans.map((p) => [
      p.data.publicationStatus,
      p.data.scientificStatus,
      p.data.languages.map((l) => [l.attestationStatus, l.correspondenceType]),
    ]),
    beforeScience,
  );
  const published = publicCatalog(db).words;
  assert.equal(published.filter((w) => w.researchIncluded).length, 8);
  assert.equal(published.filter((w) => w.articleDepth === "short").length, 20);
  assert.equal(
    published.reduce((n, w) => n + w.languages.length, 0),
    64,
  );
  const ids = new Set(plan.plans.map((p) => p.id));
  for (const previous of before.filter((r) => !ids.has(r.id)))
    assert.deepEqual(
      list(db).find((r) => r.id === previous.id),
      previous,
    );
  assert.equal(
    published.find((w) => w.id === record.id).coverId,
    "cover-final",
  );
  assert.deepEqual(published.find((w) => w.id === record.id).relatedWordIds, [
    plan.plans[1].id,
  ]);
  const after = all(db);
  const repeated = publishFinal(db);
  assert.equal(repeated.changed, 0);
  assert.equal(repeated.skipped, 28);
  assert.deepEqual(all(db), after);
});
test("requires complete research eight by three but accepts compact entries with one form", (t) => {
  const { db } = fixture(t);
  const plan = planFinalPublication(db);
  assert.ok(
    plan.plans.some(
      (p) => !p.data.researchIncluded && p.data.languages.length === 1,
    ),
  );
  const p = plan.plans.find((p) => p.data.researchIncluded);
  save(db, {
    data: { ...p.data, languages: p.data.languages.slice(1) },
    state: "draft",
    version: p.version,
  });
  const before = all(db);
  assert.throws(() => publishFinal(db), /languages\[en-US\]/);
  assert.deepEqual(all(db), before);
});
test("never substitutes import for missing receipts or writes an incomplete final set", (t) => {
  const { db } = fixture(t);
  db.prepare("DELETE FROM audit WHERE kind='import-entry' AND entity_id=?").run(
    bundle.words[0].id,
  );
  const before = all(db);
  assert.throws(() => publishFinal(db), /сопоставления/);
  assert.deepEqual(all(db), before);
});
test("late save failure rolls back publication and visibility changes without weakening scientific validation", (t) => {
  const { db } = fixture(t),
    p = planFinalPublication(db).plans[0];
  const data = structuredClone(p.data);
  data.languages[0].hidden = true;
  save(db, { data, state: "draft", version: p.version });
  db.exec(
    "CREATE TRIGGER fail_final BEFORE INSERT ON audit WHEN NEW.kind='final-publication' BEGIN SELECT RAISE(ABORT,'final failure'); END;",
  );
  const before = all(db);
  assert.throws(() => publishFinal(db), /final failure/);
  assert.deepEqual(all(db), before);
  db.exec("DROP TRIGGER fail_final");
  publishFinal(db);
  assert.equal(
    publicCatalog(db).words.find((w) => w.id === p.id).languages.length,
    3,
  );
});
test("new edits publish once; unrelated substantive publications remain visible", (t) => {
  const { db } = fixture(t);
  const sample = planFinalPublication(db).plans[0];
  save(db, {
    data: {
      ...sample.data,
      id: "user-own-word",
      slug: "user-own-word",
      russianLemma: "Пользовательская статья",
      researchIncluded: false,
    },
    state: "published",
    version: 0,
  });
  assert.equal(publishFinal(db).publicDictionaryTotal, 29);
  const p = planFinalPublication(db).plans[0];
  save(db, {
    data: { ...p.data, shortDescription: "Правка после публикации" },
    state: "draft",
    version: p.version,
  });
  assert.equal(publishFinal(db).changed, 1);
  assert.equal(publishFinal(db).changed, 0);
});
test("CLI backs up WAL and owner before publishing, does not create or import a missing database", (t) => {
  const { db, path, dir } = fixture(t);
  db.prepare("INSERT INTO owner VALUES(1,?)").run("fixture-owner");
  const before = all(db),
    protectedBefore = tables(db);
  const run = (target) =>
    spawnSync(process.execPath, ["server/publish-final.mjs"], {
      cwd: root,
      env: { ...process.env, CMS_DB_PATH: target },
      encoding: "utf8",
    });
  const result = run(path);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.publishedFinal, 28);
  assert.equal(report.changed, 28);
  assert.equal(statSync(report.backup).mode & 0o777, 0o600);
  const backup = new DatabaseSync(report.backup, { readOnly: true });
  assert.deepEqual(all(backup), before);
  assert.deepEqual(tables(backup), protectedBefore);
  assert.equal(
    backup.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
  backup.close();
  assert.equal(run(path).status, 0);
  const missing = join(dir, "missing.sqlite");
  assert.equal(run(missing).status, 1);
  assert.equal(existsSync(missing), false);
  assert.ok(readdirSync(join(dir, "backups")).length > 0);
});
