import { backup, DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, mkdirSync, chmodSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { defaultDb, root, list, save, publicCatalog } from "./store.mjs";
import { atomic, audit } from "./stage2.mjs";
import { preparePackage, fingerprint } from "./content-import.mjs";
const equal = (a, b) => fingerprint(a) === fingerprint(b);
const norm = (s) =>
  s.normalize("NFC").trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
export function finalBundle() {
  return preparePackage(
    JSON.parse(
      readFileSync(
        join(root, "research/imports/russkiy-sled-content-final.json"),
        "utf8",
      ),
    ),
  );
}
export function planFinalPublication(db, bundle = finalBundle()) {
  const rows = list(db),
    seen = new Set(),
    plans = [],
    errors = [];
  for (const incoming of bundle.words) {
    const receipt = db
      .prepare(
        "SELECT next FROM audit WHERE kind='import-entry' AND entity_id=? ORDER BY id DESC LIMIT 1",
      )
      .get(incoming.id);
    const mapping = receipt && JSON.parse(receipt.next);
    if (!mapping || mapping.packageHash !== bundle.hash) {
      errors.push(
        `${incoming.russianLemma}: нет сопоставления именно финального импорта`,
      );
      continue;
    }
    const row = rows.find((r) => r.id === mapping.targetId);
    if (!row || seen.has(mapping.targetId)) {
      errors.push(
        `${incoming.russianLemma}: отсутствующий или повторный targetId`,
      );
      continue;
    }
    seen.add(mapping.targetId);
    if (!["draft", "review", "published"].includes(row.state))
      errors.push(
        `${incoming.russianLemma}: редакционный статус ${row.state} не допускает публикацию`,
      );
    const data = structuredClone(row.data);
    if (norm(data.russianLemma) !== norm(incoming.russianLemma))
      errors.push(
        `${incoming.russianLemma}: сопоставление указывает на другую лемму`,
      );
    if (
      !data.shortDescription?.trim() ||
      !data.russianStress?.trim() ||
      !data.themes.length ||
      !data.sourceIds.length ||
      !data.notes.some((n) => n.field === "origin" && n.text.trim())
    )
      errors.push(
        `${incoming.russianLemma}: нужны shortDescription, russianStress, themes, sourceIds и notes.origin`,
      );
    if (
      data.researchIncluded !== incoming.researchIncluded ||
      data.articleDepth !== incoming.articleDepth
    )
      errors.push(
        `${incoming.russianLemma}: нарушены researchIncluded/articleDepth`,
      );
    if (
      incoming.researchIncluded &&
      (!data.notes.some((n) => n.field === "conclusion" && n.text.trim()) ||
        data.format === "compact")
    )
      errors.push(
        `${incoming.russianLemma}: нужен подробный формат и notes.conclusion`,
      );
    for (const expected of incoming.languages) {
      const card = data.languages.find(
        (l) => l.languageCode === expected.languageCode,
      );
      if (
        !card ||
        !expected.reportedForms[0] ||
        !card.reportedForms.some(
          (f) => norm(f) === norm(expected.reportedForms[0]),
        )
      ) {
        errors.push(
          `${incoming.russianLemma}: languages[${expected.languageCode}].reportedForms — нет формы финального набора`,
        );
        continue;
      }
      if (!card.meaning?.trim() || !card.sourceIds.length)
        errors.push(
          `${incoming.russianLemma}: languages[${expected.languageCode}] — нужны meaning и sourceIds`,
        );
      if (incoming.researchIncluded)
        for (const field of [
          "graphic",
          "phonetic",
          "semantic",
          "grammar",
          "integration",
        ])
          if (!card[field]?.trim())
            errors.push(
              `${incoming.russianLemma}: languages[${expected.languageCode}].${field} отсутствует`,
            );
      // The owner explicitly authorizes showing every final-set card; no scientific status changes.
      if (card.hidden) card.hidden = false;
      if (card.unpublished) card.unpublished = false;
    }
    const aliases = rows.filter(
      (r) =>
        r.id !== row.id &&
        norm(r.data.russianLemma) === norm(data.russianLemma),
    );
    if (aliases.length)
      errors.push(`${incoming.russianLemma}: дублирующаяся лемма в базе`);
    const published = db
      .prepare("SELECT published FROM content WHERE id=?")
      .get(row.id).published;
    plans.push({
      id: row.id,
      data,
      version: row.version,
      skip:
        row.state === "published" &&
        published !== null &&
        equal(JSON.parse(published), data),
    });
  }
  if (
    plans.length !== 28 ||
    bundle.words.length !== 28 ||
    bundle.words.filter((w) => w.researchIncluded).length !== 8
  )
    errors.push(
      "Неполный финальный комплект: требуется 8 основных + 20 дополнительных статей",
    );
  if (errors.length)
    throw new Error("Публикация остановлена:\n" + errors.join("\n"));
  return { plans, digest: fingerprint(plans), packageHash: bundle.hash };
}
export function publishFinal(db, bundle = finalBundle(), expectedDigest) {
  return atomic(db, () => {
    const plan = planFinalPublication(db, bundle);
    if (expectedDigest && plan.digest !== expectedDigest)
      throw new Error(
        "База изменилась после предварительной проверки; повторите команду",
      );
    const changed = plan.plans.filter((p) => !p.skip);
    for (const p of changed)
      save(db, { data: p.data, state: "published", version: p.version });
    if (
      changed.length ||
      !db
        .prepare(
          "SELECT id FROM audit WHERE kind='final-publication' AND entity_id=?",
        )
        .get(bundle.hash)
    )
      audit(
        db,
        "final-publication",
        bundle.hash,
        "Публикация финальных 28 статей",
        "published",
        null,
        { ids: plan.plans.map((p) => p.id) },
      );
    const visible = publicCatalog(db).words;
    for (const p of plan.plans)
      if (!visible.some((w) => w.id === p.id))
        throw new Error(
          "Опубликованная статья отсутствует в публичном каталоге: " +
            p.data.russianLemma,
        );
    const main = plan.plans.filter((p) => p.data.researchIncluded);
    return {
      publishedFinal: plan.plans.length,
      main: main.length,
      additional: plan.plans.length - main.length,
      researchCards: main.reduce(
        (n, p) =>
          n +
          p.data.languages.filter(
            (l) =>
              ["en-US", "fr-FR", "hy-AM"].includes(l.languageCode) &&
              !l.hidden &&
              !l.unpublished,
          ).length,
        0,
      ),
      changed: changed.length,
      skipped: plan.plans.length - changed.length,
      conflicts: 0,
      publicDictionaryTotal: visible.length,
      scientificStatusesChanged: false,
    };
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  let db;
  try {
    if (process.argv.length > 2)
      throw new Error(
        "Параметры не нужны; используйте CMS_DB_PATH для нестандартного пути базы",
      );
    const path = resolve(process.env.CMS_DB_PATH || defaultDb);
    if (!existsSync(path))
      throw new Error(
        "База не найдена. Команда не создаёт базу и не выполняет импорт",
      );
    const bundle = finalBundle(),
      original = new DatabaseSync(path, { readOnly: true });
    let plan, backupPath;
    try {
      original.exec("BEGIN");
      try {
        plan = planFinalPublication(original, bundle);
        original.exec("COMMIT");
      } catch (e) {
        original.exec("ROLLBACK");
        throw e;
      }
      const folder = join(dirname(path), "backups");
      mkdirSync(folder, { recursive: true, mode: 0o700 });
      backupPath = join(
        folder,
        `before-final-publication-${Date.now()}-${randomUUID()}.sqlite`,
      );
      await backup(original, backupPath);
      chmodSync(backupPath, 0o600);
    } finally {
      original.close();
    }
    console.error("Резервная копия: " + backupPath);
    db = new DatabaseSync(path);
    db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
    console.log(
      JSON.stringify(
        {
          database: path,
          backup: backupPath,
          ...publishFinal(db, bundle, plan.digest),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}
