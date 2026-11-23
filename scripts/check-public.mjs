import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(process.argv[2] || "site");
const read = (p) => readFileSync(join(root, p), "utf8");
const catalog = JSON.parse(read("data/catalog.json"));
assert.equal(catalog.words.length, 28);
assert.equal(catalog.words.filter((w) => w.researchIncluded).length, 8);
assert.equal(catalog.sources.length, 65);
assert.equal(
  catalog.words.reduce((n, w) => n + w.languages.length, 0),
  64,
);
assert.ok(!read("index.html").includes('type="module"'));
for (const p of [
  "assets/site.js",
  "assets/site.css",
  "flags/us.svg",
  "sources/matryoshka_dossier.pdf",
])
  assert.ok(existsSync(join(root, p)), p);
assert.ok(
  !read("assets/site.js").includes("Не удалось обновить часть материалов"),
);
assert.ok(!read("index.html").includes('src="/'));
assert.ok(!readdirSync(root).some((n) => /sqlite|node_modules|\.cms/.test(n)));
console.log(
  "Public snapshot and resources: 28 articles, 64 forms, 65 sources; OK",
);

writeFileSync(
  join(root, "verification.json"),
  JSON.stringify(
    {
      buildChecks: "passed",
      articles: 28,
      forms: 64,
      sources: 65,
      resources: "local",
      browserTests:
        "See Actions/browser test report; this file records build checks only",
    },
    null,
    2,
  ),
);
