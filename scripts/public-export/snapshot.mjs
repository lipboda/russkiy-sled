import { openStore, publicCatalog } from "./server/store.mjs";
import { applyImport } from "./server/content-import.mjs";
import { finalBundle, publishFinal } from "./server/publish-final.mjs";
import { editorialData } from "./server/stage2-api.mjs";
import { writeFileSync } from "node:fs";
const db = openStore(process.env.EXPORT_DB);
const bundle = finalBundle();
applyImport(db, bundle);
const result = publishFinal(db, bundle);
const catalog = publicCatalog(db),
  editorial = editorialData(db);
const finalIds = new Set(bundle.sources.map((s) => s.id));
catalog.sources = catalog.sources.filter((s) => finalIds.has(s.id));
if (
  catalog.words.length !== 28 ||
  catalog.sources.length !== 65 ||
  editorial.languages.length !== 9
)
  throw new Error("Incomplete public snapshot");
writeFileSync(
  "src/offline/catalog.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
writeFileSync(
  "src/offline/editorial.json",
  JSON.stringify(editorial, null, 2) + "\n",
);
writeFileSync(process.env.EXPORT_META, JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({
    words: catalog.words.length,
    sources: catalog.sources.length,
    languages: editorial.languages.length,
    journal: editorial.journal.length,
    daily: editorial.daily.length,
    ...result,
  }),
);
db.close();
