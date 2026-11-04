import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { openStore, publicCatalog, list, save, root } from "./store.mjs";
import { passwordHash } from "./manage.mjs";
import { createApp } from "./index.mjs";
const seed = JSON.parse(
  readFileSync(join(root, "src/data/catalog.json"), "utf8"),
);

test("migration preserves all existing fields, is repeatable, revisions survive restart; drafts do not leak", () => {
  const dir = mkdtempSync(join(tmpdir(), "cms-")),
    path = join(dir, "test.sqlite");
  let db = openStore(path);
  try {
    assert.deepEqual(publicCatalog(db), seed);
    const row = list(db)[0];
    const data = { ...row.data, russianLemma: "Изменено редактором" };
    save(db, { data, state: "draft", version: 1 });
    assert.deepEqual(publicCatalog(db), seed);
    assert.throws(
      () => save(db, { data, state: "published", version: 1 }),
      /изменена/,
    );
    save(db, { data, state: "published", version: 2 });
    assert.equal(publicCatalog(db).words[0].russianLemma, data.russianLemma);
    db.close();
    db = openStore(path);
    assert.equal(list(db)[0].version, 3);
    assert.equal(publicCatalog(db).words.length, seed.words.length);
    assert.equal(db.prepare("SELECT count(*) AS n FROM history").get().n, 2);
    save(db, { data, state: "archived", version: 3 });
    assert.equal(publicCatalog(db).words.length, seed.words.length - 1);
    save(db, { data, state: "published", version: 4 });
    assert.equal(publicCatalog(db).words.length, seed.words.length);
    const forged = structuredClone(data);
    forged.publicationStatus = "verified";
    forged.scientificStatus = "confirmed";
    assert.throws(
      () => save(db, { data: forged, state: "published", version: 5 }),
      /публикация/,
    );
    const invalid = structuredClone(data);
    invalid.sourceIds = ["nonexistent"];
    assert.throws(
      () => save(db, { data: invalid, state: "draft", version: 5 }),
      /sourceId/,
    );
    assert.equal(list(db)[0].version, 5);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("server authentication, CSRF, protected writes, new records, public search data, logout and rate limit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cms-api-")),
    db = openStore(join(dir, "test.sqlite"));
  const password = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO owner VALUES (1,?)").run(passwordHash(password));
  const port = 40000 + Math.floor(Math.random() * 10000);
  const expectedOrigin = "http://127.0.0.1:" + port;
  const app = createApp({ db, origin: expectedOrigin });
  await new Promise((resolve) => app.listen(port, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + app.address().port;
  let cookie = "";
  const request = (path, method = "GET", body, origin = expectedOrigin) =>
    fetch(base + "/api/" + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    assert.equal((await request("admin/words")).status, 401);
    assert.equal((await request("admin/words", "PUT", {})).status, 401);
    assert.equal(
      (
        await request(
          "auth/login",
          "POST",
          { password },
          "https://attacker.example",
        )
      ).status,
      403,
    );
    const login = await request("auth/login", "POST", { password });
    assert.equal(login.status, 200);
    const header = login.headers.get("set-cookie");
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Strict/);
    cookie = header.split(";")[0];
    assert.equal((await request("auth/session")).status, 200);
    const rows = await (await request("admin/words")).json();
    assert.equal(rows.length, 58);
    const data = {
      ...structuredClone(rows[0].data),
      id: "new-test",
      slug: "new-test",
      russianLemma: "Тестовая запись",
      languages: [],
      sourceIds: [],
      notes: [],
    };
    const saveResponse = await request("admin/words", "PUT", {
      data,
      state: "draft",
      version: 0,
    });
    assert.equal(saveResponse.status, 200);
    assert.equal((await (await request("content")).json()).words.length, 58);
    assert.equal(
      (
        await request("admin/words", "PUT", {
          data,
          state: "published",
          version: 1,
        })
      ).status,
      200,
    );
    let content = await (await request("content")).json();
    assert.equal(content.words.at(-1).russianLemma, "Тестовая запись");
    // Verified forms must use genuinely checked source metadata; no artificial map entries.
    const bad = structuredClone(data);
    bad.languages = [
      {
        languageCode: "en-US",
        countryCode: "US",
        reportedForms: ["test"],
        attestationStatus: "verified",
        sourceIds: [seed.sources[0].id],
        references: [],
      },
    ];
    assert.equal(
      (
        await request("admin/words", "PUT", {
          data: bad,
          state: "published",
          version: 2,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "admin/words",
          "PUT",
          { data, state: "archived", version: 2 },
          "https://evil.example",
        )
      ).status,
      403,
    );
    assert.equal((await request("auth/logout", "POST", {})).status, 200);
    assert.equal((await request("admin/words")).status, 401);
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await request("auth/login", "POST", { password: "wrong" })).status,
        401,
      );
    assert.equal(
      (await request("auth/login", "POST", { password })).status,
      429,
    );
    content = await (await request("content")).json();
    assert.equal(content.words.length, 59);
  } finally {
    await new Promise((resolve) => app.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
