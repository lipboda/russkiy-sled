import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { openStore, list, save, publicCatalog, root } from "./store.mjs";
import { applyImport, planImport, preparePackage } from "./content-import.mjs";
const raw = JSON.parse(
  readFileSync(
    resolve(root, "research/imports/russkiy-sled-content-final.json"),
    "utf8",
  ),
);
const bundle = preparePackage(raw);
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "cms-final-test-"));
  const path = join(dir, "content.sqlite");
  const db = openStore(path);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { db, dir, path };
}

test("final package maps 28 words, 64 cards, nine languages and preserves scientific content privately", (t) => {
  const { db } = fixture(t);
  const before = publicCatalog(db);
  const result = applyImport(db, bundle);
  assert.equal(result.imported, 28);
  assert.deepEqual(result.counts, {
    research: 8,
    additional: 20,
    words: 28,
    researchCards: 24,
    additionalForms: 40,
    languages: 9,
    countries: 9,
    sources: 65,
    categories: 14,
    potentialMapLinks: 60,
    confirmedForms: 0,
  });
  const records = result.mapping.map((m) =>
    list(db).find((r) => r.id === m.targetId),
  );
  assert.equal(records.filter((r) => r.state === "draft").length, 28);
  assert.equal(records.filter((r) => r.data.researchIncluded).length, 8);
  assert.equal(records.filter((r) => r.data.format === "compact").length, 20);
  assert.equal(
    records.reduce((n, r) => n + r.data.languages.length, 0),
    64,
  );
  for (const r of records) {
    assert.equal(r.data.publicationStatus, "provisional");
    for (const l of r.data.languages) {
      assert.equal(l.attestationStatus, "pending");
      assert.equal(l.correspondenceType, "unknown");
    }
  }
  assert.equal(
    db.prepare("SELECT code FROM language_definitions").all().length,
    9,
  );
  assert.equal(
    db.prepare("SELECT id FROM sources WHERE id LIKE 'final-%'").all().length,
    65,
  );
  assert.deepEqual(publicCatalog(db).words, before.words); // old public snapshots are not unpublished by a draft import
  const archived = JSON.parse(
    db.prepare("SELECT next FROM audit WHERE kind='import-package'").get().next,
  );
  assert.deepEqual(archived, raw);
  for (const e of raw.researchEntries) {
    const r = records.find((r) => r.data.russianLemma === e.wordRu);
    assert.deepEqual(
      r.data.languages.map((l) => l.languageCode),
      ["en-US", "fr-FR", "hy-AM"],
    );
    for (let i = 0; i < 3; i++) {
      const l = r.data.languages[i],
        c = e.languageCards[i];
      assert.equal(l.graphic, c.adaptation.graphic);
      assert.equal(l.grammar, c.adaptation.grammatical);
      assert.ok(
        l.integration.includes(c.integrationCriteria.formStability.result),
      );
    }
    assert.ok(r.data.notes.some((n) => n.text === e.comparativeConclusion));
  }
  assert.ok(
    !JSON.stringify(records.map((r) => r.data)).includes("sourceTableCells"),
  );
  assert.ok(
    !JSON.stringify(records.map((r) => r.data)).includes(
      "originalResearchCard",
    ),
  );
  assert.ok(
    result.editorialRestrictions.every((r) => r.scientificFields.length > 0),
  );
});
test("repeat imports never duplicate or overwrite later owner edits", (t) => {
  const { db } = fixture(t);
  const initial = applyImport(db, bundle);
  const first = list(db);
  const row = first.find((r) => r.id === initial.mapping[0].targetId);
  save(db, {
    data: { ...row.data, shortDescription: "Правка владельца" },
    state: "draft",
    version: row.version,
  });
  const before = list(db);
  const auditCount = db.prepare("SELECT COUNT(*) n FROM audit").get().n;
  const again = applyImport(db, bundle);
  assert.equal(again.imported, 0);
  assert.equal(again.skip, 28);
  assert.deepEqual(list(db), before);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM audit").get().n, auditCount);
});
test("conflicts block entire batch, including existing edits, categories and changed package", (t) => {
  const { db } = fixture(t);
  const row = list(db).find((r) => r.data.slug === "matryoshka");
  save(db, {
    data: { ...row.data, shortDescription: "Редакторская версия" },
    state: "draft",
    version: row.version,
  });
  const before = list(db);
  assert.equal(planImport(db, bundle).report.conflicts.length, 1);
  assert.throws(() => applyImport(db, bundle), /конфликт/);
  assert.deepEqual(list(db), before);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM sources WHERE id LIKE 'final-%'").get()
      .n,
    0,
  );
});
test("transaction rolls back late failure and changed imported sources remain protected", (t) => {
  const { db } = fixture(t);
  const before = list(db);
  db.exec(
    "CREATE TRIGGER fail_import BEFORE INSERT ON audit WHEN NEW.kind='import-package' BEGIN SELECT RAISE(ABORT,'test late failure'); END;",
  );
  assert.throws(() => applyImport(db, bundle), /test late failure/);
  assert.deepEqual(list(db), before);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM language_definitions").get().n,
    3,
  );
  db.exec("DROP TRIGGER fail_import");
  applyImport(db, bundle);
  const source = db
    .prepare("SELECT * FROM sources WHERE id LIKE 'final-%' LIMIT 1")
    .get();
  db.prepare("UPDATE sources SET data=? WHERE id=?").run(
    JSON.stringify({
      ...JSON.parse(source.data),
      notes: "Редактор исправил источник",
    }),
    source.id,
  );
  assert.throws(() => applyImport(db, bundle), /конфликт/);
  const changed = structuredClone(raw);
  changed.dictionaryEntries[0].definition += " Новая версия";
  assert.ok(
    planImport(db, preparePackage(changed)).report.conflicts.length >= 28,
  );
});
test("rejects missing cross references and duplicate lemmas before opening user database", () => {
  const bad = structuredClone(raw);
  bad.dictionaryEntries[0].foreignForms[0].sourceIds = ["does-not-exist"];
  assert.throws(() => preparePackage(bad), /источник/);
  const duplicate = structuredClone(raw);
  duplicate.dictionaryEntries[0].wordRu = duplicate.researchEntries[0].wordRu;
  assert.throws(() => preparePackage(duplicate), /Дубликат/);
  const noDimensions = structuredClone(raw);
  delete noDimensions.researchEntries[0].languageCards[0].adaptation.graphic;
  assert.throws(() => preparePackage(noDimensions));
});
test("CLI plan is read only; apply backs up owner, snapshots and data before mutation", (t) => {
  const { db, dir, path } = fixture(t);
  db.prepare("INSERT INTO owner VALUES(1,?)").run(
    "fixture-hash-never-a-real-password",
  );
  const before = list(db);
  const backupsBefore = readdirSync(join(dir, "backups")).length;
  const run = (...args) =>
    spawnSync(
      process.execPath,
      ["server/import-content.mjs", "--db", path, ...args],
      { cwd: root, encoding: "utf8" },
    );
  assert.equal(run().status, 0);
  assert.deepEqual(list(db), before);
  assert.equal(readdirSync(join(dir, "backups")).length, backupsBefore);
  const result = run("--apply");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.imported, 28);
  assert.equal(statSync(report.backup).mode & 0o777, 0o600);
  const copied = new DatabaseSync(report.backup, { readOnly: true });
  assert.equal(
    copied.prepare("SELECT hash FROM owner").get().hash,
    "fixture-hash-never-a-real-password",
  );
  assert.equal(
    copied.prepare("SELECT COUNT(*) n FROM content").get().n,
    before.length,
  );
  assert.equal(
    copied.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
  copied.close();
  assert.equal(
    db.prepare("SELECT hash FROM owner").get().hash,
    "fixture-hash-never-a-real-password",
  );
});
