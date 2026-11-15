import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { openStore, list, save, publicCatalog, root } from "./store.mjs";
import {
  applyImport,
  preparePackage,
  planImport,
  createImportReview,
  applyImportReview,
  importReviewHtml,
} from "./content-import.mjs";
const raw = JSON.parse(
  readFileSync(
    resolve(root, "research/imports/russkiy-sled-content-final.json"),
    "utf8",
  ),
);
const bundle = preparePackage(raw);
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "cms-mac-review-"));
  const path = join(dir, "mac.sqlite");
  const db = openStore(path);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  db.prepare("INSERT INTO media VALUES(?,?,?)").run(
    "mac-cover",
    JSON.stringify({ caption: "Пользовательское изображение" }),
    Buffer.from("test image bytes"),
  );
  db.prepare("INSERT INTO sources VALUES(?,?)").run(
    "mac-source",
    JSON.stringify({
      id: "mac-source",
      title: "Источник владельца",
      url: "https://example.org/mac-source",
      accessLevel: "bibliography",
      notes: "Правка владельца",
    }),
  );
  const initial = planImport(db, bundle);
  const related = list(db)[0].id;
  for (const [i, p] of initial.plans.filter((p) => p.old).entries()) {
    save(db, {
      data: {
        ...p.old.data,
        shortDescription: "Локальная правка " + i,
        coverId: "mac-cover",
        relatedWordIds: [related],
        links: [
          {
            sourceId: "mac-source",
            url: "https://example.org/mac-source",
            title: "Моя ссылка",
          },
        ],
      },
      state: ["published", "draft", "review"][i % 3],
      version: p.old.version,
    });
  }
  const extra = initial.plans.find((p) => p.action === "create").word;
  save(db, {
    data: {
      ...extra,
      id: "mac-local-word",
      slug: "local-" + extra.slug,
      sourceIds: [],
      languages: [],
      notes: [],
      coverId: "mac-cover",
      relatedWordIds: [related],
    },
    state: "published",
    version: 0,
  });
  db.prepare("INSERT INTO owner VALUES(1,?)").run("fixture-owner-hash");
  db.prepare("INSERT INTO sessions VALUES(?,?)").run(
    "fixture-session",
    9999999999,
  );
  db.prepare("UPDATE settings SET timezone='Europe/Moscow'").run();
  for (const kind of ["daily", "journal"])
    db.prepare("INSERT INTO resources VALUES(?,?,?,?,?,1,?,NULL)").run(
      kind,
      "mac-" + kind,
      JSON.stringify({
        wordIds: [related, "mac-local-word"],
        coverId: "mac-cover",
        body: "Пользовательский материал",
      }),
      null,
      "draft",
      "2026-11-16",
    );
  return { db, dir, path };
}
const snapshot = (db) =>
  [
    "content",
    "history",
    "sources",
    "categories",
    "word_categories",
    "language_definitions",
    "audit",
    "media",
    "resources",
    "settings",
    "owner",
    "sessions",
  ].map((t) => [t, db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]);
const unchanged = (db) =>
  ["owner", "sessions", "resources", "media", "settings"].map((t) => [
    t,
    db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all(),
  ]);
const cli = (path, ...args) =>
  spawnSync(
    process.execPath,
    ["server/import-content.mjs", "--db", path, ...args],
    { cwd: root, encoding: "utf8" },
  );

test("MacBook 21 protected + 7 absent: review shows field diffs, retains identity/media/references and old snapshots, writes 28 drafts", (t) => {
  const { db, path } = fixture(t);
  const baseline = planImport(db, bundle).report;
  assert.equal(baseline.create, 7);
  assert.equal(baseline.replaceSeed, 0);
  assert.equal(baseline.skip, 0);
  assert.equal(baseline.conflicts.length, 21);
  assert.throws(() => applyImport(db, bundle), /конфликт/);
  const before = snapshot(db),
    protectedData = unchanged(db),
    publicBefore = publicCatalog(db).words;
  const historyBefore = db.prepare("SELECT * FROM history ORDER BY id").all();
  const review = createImportReview(db, bundle, path);
  assert.deepEqual(snapshot(db), before);
  assert.deepEqual(review.summary, {
    create: 7,
    updateReviewed: 21,
    replaceSeed: 0,
    skip: 0,
    blocked: 0,
  });
  const change = review.entries.find((e) => e.action === "update-reviewed");
  assert.ok(change.changes.some((c) => c.field === "shortDescription"));
  assert.ok(change.changes.some((c) => c.field.startsWith("languages[")));
  assert.ok(
    !change.changes.some((c) =>
      ["id", "slug", "coverId", "relatedWordIds"].includes(c.field),
    ),
  );
  const result = applyImportReview(db, bundle, review, path, review.id);
  assert.equal(result.imported, 28);
  assert.equal(result.updateReviewed, 21);
  assert.deepEqual(unchanged(db), protectedData);
  assert.deepEqual(publicCatalog(db).words, publicBefore);
  assert.deepEqual(
    db
      .prepare("SELECT * FROM history ORDER BY id LIMIT ?")
      .all(historyBefore.length),
    historyBefore,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM history").get().n,
    historyBefore.length + 21,
  );
  const records = review.entries.map((e) =>
    list(db).find((r) => r.id === e.targetId),
  );
  assert.equal(records.length, 28);
  assert.equal(new Set(records.map((r) => r.id)).size, 28);
  for (const [i, r] of records.entries()) {
    const e = review.entries[i],
      incoming = bundle.words.find((w) => w.id === e.inputId);
    assert.equal(r.state, "draft");
    assert.equal(r.data.slug, e.slug);
    assert.equal(r.data.shortDescription, incoming.shortDescription);
    assert.deepEqual(r.data.notes, incoming.notes);
    assert.deepEqual(r.data.sourceIds, incoming.sourceIds);
    assert.deepEqual(
      r.data.languages,
      JSON.parse(JSON.stringify(incoming.languages)),
    );
    if (e.action === "update-reviewed") {
      assert.equal(r.data.coverId, "mac-cover");
      assert.deepEqual(r.data.relatedWordIds, e.preserved.relatedWordIds);
      assert.equal(r.version, e.previousVersion + 1);
    }
    assert.notEqual(r.data.publicationStatus, "verified");
    assert.ok(
      r.data.languages.every(
        (l) =>
          l.attestationStatus === "pending" &&
          l.correspondenceType === "unknown",
      ),
    );
  }
  assert.equal(records.filter((r) => r.data.researchIncluded).length, 8);
  assert.ok(
    records
      .filter((r) => r.data.researchIncluded)
      .every((r) => r.data.languages.length === 3),
  );
  assert.equal(
    db.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
  assert.equal(planImport(db, bundle).report.skip, 28);
  const previousRows = before.find(([table]) => table === "content")[1];
  const ids = new Set(records.map((r) => r.id));
  assert.deepEqual(
    db
      .prepare("SELECT * FROM content ORDER BY rowid")
      .all()
      .filter((r) => !ids.has(r.id)),
    previousRows.filter((r) => !ids.has(r.id)),
  );
  for (const r of previousRows)
    assert.equal(
      db.prepare("SELECT published FROM content WHERE id=?").get(r.id)
        .published,
      r.published,
    );
  const repeated = applyImportReview(db, bundle, review, path, review.id);
  assert.equal(repeated.imported, 0);
  if (process.env.CMS_REVIEW_TEST_REPORT)
    writeFileSync(
      process.env.CMS_REVIEW_TEST_REPORT,
      JSON.stringify(
        {
          scenario:
            "Synthetic MacBook fixture matching 21 protected + 7 absent; not the owner's database",
          baseline: {
            create: baseline.create,
            replaceSeed: baseline.replaceSeed,
            skip: baseline.skip,
            conflicts: baseline.conflicts.length,
          },
          review: review.summary,
          result: {
            imported: result.imported,
            drafts: records.filter((r) => r.state === "draft").length,
            existingIdsKept: review.entries.filter(
              (e) => e.action === "update-reviewed",
            ).length,
            newRecords: result.create,
            historyRowsAdded: 21,
            publicSnapshotsPreserved: true,
            protectedTablesUnchanged: true,
            unrelatedWordsUnchanged: true,
            repeatImported: repeated.imported,
            repeatSkipped: repeated.skip,
            researchWords: records.filter((r) => r.data.researchIncluded)
              .length,
            researchLanguageCodes: [
              ...new Set(
                records
                  .filter((r) => r.data.researchIncluded)
                  .flatMap((r) => r.data.languages.map((l) => l.languageCode)),
              ),
            ],
            integrity: db.prepare("PRAGMA integrity_check").get()
              .integrity_check,
          },
        },
        null,
        2,
      ) + "\n",
    );
});

test("no consent, damaged plan, wrong DB or changed package cannot write; ordinary apply still protects all records", (t) => {
  const { db, path } = fixture(t),
    review = createImportReview(db, bundle, path),
    before = snapshot(db);
  for (const consent of [undefined, "", review.id.slice(0, 12)])
    assert.throws(
      () => applyImportReview(db, bundle, review, path, consent),
      /подтверждение/,
    );
  const tampered = structuredClone(review);
  tampered.entries[0].changes[0].after = "tampered";
  assert.throws(
    () => applyImportReview(db, bundle, tampered, path, review.id),
    /изменён или повреждён/,
  );
  assert.throws(
    () => applyImportReview(db, bundle, review, path + "other", review.id),
    /другой базе/,
  );
  const changed = structuredClone(raw);
  changed.dictionaryEntries[0].definition += " Изменение";
  assert.throws(
    () =>
      applyImportReview(db, preparePackage(changed), review, path, review.id),
    /другому файлу/,
  );
  assert.throws(() => applyImport(db, bundle), /конфликт/);
  assert.deepEqual(snapshot(db), before);
});

test("stale plan rejects editor changes, source edits, changed categories and concurrent inserts", (t) => {
  const { db, path } = fixture(t);
  for (const mutate of [
    () => {
      const row = list(db)[0];
      save(db, {
        data: { ...row.data, shortDescription: "После просмотра" },
        state: "draft",
        version: row.version,
      });
    },
    () =>
      db
        .prepare(
          "UPDATE categories SET description='После просмотра' WHERE id=(SELECT id FROM categories LIMIT 1)",
        )
        .run(),
    () =>
      db
        .prepare(
          "UPDATE sources SET data=json_set(data,'$.notes','После просмотра') WHERE id='mac-source'",
        )
        .run(),
    () =>
      save(db, {
        data: {
          ...bundle.words[0],
          id: "concurrent-word",
          slug: "concurrent-word",
          russianLemma: "Новое слово",
          sourceIds: [],
          languages: [],
          notes: [],
        },
        state: "draft",
        version: 0,
      }),
  ]) {
    const review = createImportReview(db, bundle, path);
    mutate();
    const after = snapshot(db);
    assert.throws(
      () => applyImportReview(db, bundle, review, path, review.id),
      /База изменилась/,
    );
    assert.deepEqual(snapshot(db), after);
  }
});

test("reviewed import is idempotent and repeat preserves owner edits made after import", (t) => {
  const { db, path } = fixture(t),
    review = createImportReview(db, bundle, path);
  applyImportReview(db, bundle, review, path, review.id);
  const row = list(db).find((r) => r.id === review.entries[0].targetId);
  save(db, {
    data: { ...row.data, shortDescription: "Новая правка владельца" },
    state: "draft",
    version: row.version,
  });
  const after = snapshot(db);
  const repeated = applyImportReview(db, bundle, review, path, review.id);
  assert.equal(repeated.imported, 0);
  assert.equal(repeated.skip, 28);
  assert.deepEqual(snapshot(db), after);
  const newReview = createImportReview(db, bundle, path);
  assert.equal(newReview.summary.skip, 28);
  assert.equal(
    applyImportReview(db, bundle, newReview, path, newReview.id).imported,
    0,
  );
});

test("late failure rolls back words, sources, languages and receipt together", (t) => {
  const { db, path } = fixture(t);
  db.exec(
    "CREATE TRIGGER fail_review BEFORE INSERT ON audit WHEN NEW.kind='import-review' BEGIN SELECT RAISE(ABORT,'review failure'); END;",
  );
  const review = createImportReview(db, bundle, path),
    before = snapshot(db);
  assert.throws(
    () => applyImportReview(db, bundle, review, path, review.id),
    /review failure/,
  );
  assert.deepEqual(snapshot(db), before);
});

test("ambiguous identity, changed imported sources and archived records remain blocking even in review mode", (t) => {
  const { db, path } = fixture(t);
  const row = list(db).find((r) => r.data.slug === "matryoshka");
  save(db, { data: row.data, state: "archived", version: row.version });
  let review = createImportReview(db, bundle, path);
  assert.ok(review.blockingConflicts.length);
  assert.throws(
    () => applyImportReview(db, bundle, review, path, review.id),
    /неразрешённые/,
  );
  db.prepare("INSERT INTO sources VALUES(?,?)").run(
    bundle.sources[0].id,
    JSON.stringify({ ...bundle.sources[0], notes: "Изменено владельцем" }),
  );
  review = createImportReview(db, bundle, path);
  assert.ok(
    review.blockingConflicts.some((c) => c.id === bundle.sources[0].id),
  );
  const other = list(db).find((r) => r.id !== row.id);
  save(db, {
    data: { ...other.data, russianLemma: row.data.russianLemma },
    state: "draft",
    version: other.version,
  });
  review = createImportReview(db, bundle, path);
  assert.ok(
    review.blockingConflicts.some((c) => c.reason.includes("Несколько")),
  );
});

test("CLI review is read-only, confirmation is mandatory and backup contains pre-update WAL data", (t) => {
  const { db, path, dir } = fixture(t),
    reviewPath = join(dir, "review.json");
  const before = snapshot(db),
    backups = readdirSync(join(dir, "backups"));
  const preview = cli(path, "--review", reviewPath);
  assert.equal(preview.status, 0, preview.stderr);
  assert.deepEqual(snapshot(db), before);
  assert.deepEqual(readdirSync(join(dir, "backups")), backups);
  const review = JSON.parse(readFileSync(reviewPath, "utf8"));
  const html = readFileSync(reviewPath + ".html", "utf8");
  assert.ok(html.includes("Было"));
  assert.ok(html.includes("Станет"));
  assert.equal(statSync(reviewPath).mode & 0o777, 0o600);
  assert.equal(statSync(reviewPath + ".html").mode & 0o777, 0o600);
  assert.equal(cli(path, "--apply-review", reviewPath).status, 1);
  assert.equal(
    cli(path, "--apply-review", reviewPath, "--confirm", "wrong").status,
    1,
  );
  assert.deepEqual(snapshot(db), before);
  assert.deepEqual(readdirSync(join(dir, "backups")), backups);
  const result = cli(
    path,
    "--apply-review",
    reviewPath,
    "--confirm",
    review.id,
  );
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.imported, 28);
  const saved = new DatabaseSync(report.backup, { readOnly: true });
  assert.deepEqual(snapshot(saved), before);
  assert.equal(
    saved.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
  saved.close();
  assert.equal(statSync(report.backup).mode & 0o777, 0o600);
  const repeated = cli(
    path,
    "--apply-review",
    reviewPath,
    "--confirm",
    review.id,
  );
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(JSON.parse(repeated.stdout).imported, 0);
});

test("HTML escapes local editorial text and is self-contained; preexisting plans are never overwritten", (t) => {
  const { db, path, dir } = fixture(t);
  const row = list(db)[0];
  save(db, {
    data: {
      ...row.data,
      shortDescription:
        '<script>alert("test")</script><img src=x onerror=alert(1)>',
    },
    state: "draft",
    version: row.version,
  });
  const review = createImportReview(db, bundle, path);
  const html = importReviewHtml(review);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img "));
  assert.ok(html.includes("&lt;script&gt;"));
  const out = join(dir, "review.json");
  writeFileSync(out + ".html", "keep");
  assert.equal(cli(path, "--review", out).status, 1);
  assert.equal(readFileSync(out + ".html", "utf8"), "keep");
});

test("duplicate note fields remain visible in review and language visibility controls survive", (t) => {
  const { db, path } = fixture(t);
  const row = list(db).find((r) => r.data.slug === "matryoshka");
  const data = structuredClone(row.data);
  data.notes.push({
    ...data.notes[0],
    text: "Дополнительное одноимённое примечание",
  });
  data.languages[0].hidden = true;
  data.languages[0].unpublished = true;
  data.languages[0].expanded = false;
  save(db, { data, state: "draft", version: row.version });
  const review = createImportReview(db, bundle, path);
  const entry = review.entries.find((e) => e.targetId === row.id);
  const diff = entry.changes.find((c) => c.field === "notes");
  assert.ok(
    diff.before.some((n) => n.text === "Дополнительное одноимённое примечание"),
  );
  applyImportReview(db, bundle, review, path, review.id);
  const saved = list(db).find((r) => r.id === row.id).data;
  assert.equal(saved.languages[0].hidden, true);
  assert.equal(saved.languages[0].unpublished, true);
  assert.equal(saved.languages[0].expanded, false);
});

test("two input words can never share one target ID in an approved plan", (t) => {
  const { db, path } = fixture(t);
  const candidates = planImport(db, bundle).plans.filter(
    (p) => p.action === "create",
  );
  const [a, b] = candidates;
  save(db, {
    data: {
      ...a.word,
      id: a.word.id,
      slug: "collision-local",
      russianLemma: b.word.russianLemma,
      sourceIds: [],
      languages: [],
      notes: [],
    },
    state: "draft",
    version: 0,
  });
  const review = createImportReview(db, bundle, path);
  assert.ok(
    review.blockingConflicts.some((c) =>
      c.reason.includes("одной существующей записью"),
    ),
  );
  const before = snapshot(db);
  assert.throws(
    () => applyImportReview(db, bundle, review, path, review.id),
    /неразрешённые/,
  );
  assert.deepEqual(snapshot(db), before);
});
