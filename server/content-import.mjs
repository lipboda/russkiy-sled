import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  wordSchema,
  sourceSchema,
  validateCatalog,
} from "../src/domain/schema.ts";
import { root, list, save } from "./store.mjs";
import { atomic, audit, normalizeCategory, sourceList } from "./stage2.mjs";
import { resolve } from "node:path";

const seed = JSON.parse(
  readFileSync(resolve(root, "src/data/catalog.json"), "utf8"),
);
const canon = (v) =>
  JSON.stringify(v, (_, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
        )
      : value,
  );
export const fingerprint = (v) =>
  createHash("sha256").update(canon(v)).digest("hex");
const normalized = (s) =>
  s.normalize("NFC").trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
const ids = z.array(z.string().min(1));
const card = z
  .object({
    languageId: z.string(),
    languageCode: z.string(),
    sourceIds: ids,
    meaning: z.string().min(1),
  })
  .passthrough();
const entry = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    wordRu: z.string().min(1),
    definition: z.string().min(1),
    categoryIds: ids,
    sourceIds: ids,
  })
  .passthrough();
const packageSchema = z
  .object({
    metadata: z
      .object({
        filename: z.literal("russkiy-sled-content-final.json"),
        formatVersion: z.literal("2.0-editorially-completed"),
      })
      .passthrough(),
    languages: z.array(
      z
        .object({
          id: z.string(),
          code: z.string(),
          nameRu: z.string().min(1),
          countryIds: ids,
        })
        .passthrough(),
    ),
    countries: z.array(
      z
        .object({
          id: z.string(),
          iso3166_1_alpha2: z.string().regex(/^[A-Z]{2}$/),
        })
        .passthrough(),
    ),
    categories: z.array(
      z.object({ id: z.string(), nameRu: z.string().min(1) }).passthrough(),
    ),
    sources: z.array(
      z
        .object({
          id: z.string(),
          reference: z.string().min(1),
          url: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
    researchEntries: z.array(
      entry.extend({
        languageCards: z.array(
          card.extend({
            foreignForm: z.string().min(1),
            adaptation: z.object({
              graphic: z.string(),
              phonetic: z.string(),
              semantic: z.string(),
              grammatical: z.string(),
            }),
            integrationCriteria: z.object({
              formStability: z.object({}).passthrough(),
              grammar: z.object({}).passthrough(),
              semantics: z.object({}).passthrough(),
              lexicographicAttestation: z.object({}).passthrough(),
              realUsage: z.object({}).passthrough(),
            }),
          }),
        ),
        comparativeConclusion: z.string().min(1),
      }),
    ),
    dictionaryEntries: z.array(
      entry.extend({
        foreignForms: z.array(card.extend({ writtenForm: z.string().min(1) })),
      }),
    ),
  })
  .passthrough();
const sid = (id) => "final-" + id;
const langCode = (code) =>
  ({ fr: "fr-FR", hy: "hy-AM", "hy-EA": "hy-AM" })[code] || code;
const criterionNames = {
  formStability: "Устойчивость формы",
  grammar: "Грамматика",
  semantics: "Семантика",
  lexicographicAttestation: "Словарная фиксация",
  realUsage: "Реальное употребление",
};
const text = (v) => (typeof v === "string" ? v : "");
const note = (field, value, refs = []) => ({
  field,
  text: value,
  status: "pending",
  references: refs.map((id) => ({ sourceId: sid(id), pages: [] })),
  bibliography: [],
});

export function preparePackage(input) {
  const p = packageSchema.parse(input);
  const entries = [...p.researchEntries, ...p.dictionaryEntries];
  for (const [name, values, key] of [
    ["статей", entries, "id"],
    ["URL", entries, "slug"],
    ["лемм", entries, "wordRu"],
    ["языков", p.languages, "id"],
    ["кодов языков", p.languages, "code"],
    ["стран", p.countries, "id"],
    ["кодов стран", p.countries, "iso3166_1_alpha2"],
    ["источников", p.sources, "id"],
    ["категорий", p.categories, "id"],
  ])
    if (new Set(values.map((v) => normalized(v[key]))).size !== values.length)
      throw new Error("Дубликат " + name);
  const primary = seed.words
    .filter((w) =>
      [
        "matryoshka",
        "kalashnikov",
        "dacha",
        "intelligentsia",
        "pogrom",
        "samizdat",
        "sputnik",
        "samovar",
      ].includes(w.slug),
    )
    .map((w) => w.slug)
    .sort();
  if (canon(p.researchEntries.map((e) => e.slug).sort()) !== canon(primary))
    throw new Error("Основная выборка должна содержать восемь исходных слов");
  const sourceIds = new Set(p.sources.map((s) => s.id));
  const checkRefs = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (
        ["sourceIds", "evidenceSourceIds", "exampleSourceIds"].includes(key) &&
        (!Array.isArray(v) || v.some((id) => !sourceIds.has(id)))
      )
        throw new Error("Неизвестный источник в " + key);
      if (key === "sourceId" && !sourceIds.has(v))
        throw new Error("Неизвестный sourceId");
      checkRefs(v);
    }
  };
  checkRefs(p);
  const languages = p.languages.map((l) => {
    if (l.countryIds.length !== 1)
      throw new Error("Нужна однозначная опорная страна: " + l.id);
    const country = p.countries.find((c) => c.id === l.countryIds[0]);
    if (!country) throw new Error("Неизвестная страна " + l.id);
    return {
      code: langCode(l.code),
      name: l.nameRu,
      country: country.iso3166_1_alpha2,
      nativeName: text(l.autonym),
    };
  });
  const sources = p.sources.map((s) =>
    sourceSchema.parse({
      id: sid(s.id),
      title: s.reference,
      url: s.url || "",
      citation: s.reference,
      sourceType: text(s.sourceKind),
      accessLevel: s.directEntryLinkEstablished ? "section" : "bibliography",
      accessedAt: text(s.checkedOn),
      notes: [
        "Перенесено из финального файла; внешняя проверка импортёром не выполнялась.",
        text(s.verificationStatus),
        text(s.evidenceNote),
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  );
  const words = entries.map((e) => {
    const research = p.researchEntries.some((r) => r.id === e.id);
    const cards = research ? e.languageCards : e.foreignForms;
    const themes = e.categoryIds.map((id) => {
      const c = p.categories.find((c) => c.id === id);
      if (!c) throw new Error("Неизвестная категория " + id);
      return c.nameRu;
    });
    if (
      research &&
      canon(cards.map((c) => langCode(c.languageCode)).sort()) !==
        canon(["en-US", "fr-FR", "hy-AM"].sort())
    )
      throw new Error("Три исследуемых языка: " + e.slug);
    return wordSchema.parse({
      id: e.id,
      slug: e.slug,
      russianLemma: e.wordRu,
      russianStress: e.wordRuStressed || undefined,
      shortDescription: e.definition,
      partOfSpeech: e.partOfSpeech || undefined,
      format: research ? "detailed" : "compact",
      articleDepth: research ? "full" : "short",
      originKind: "unknown",
      publicationStatus: "provisional",
      scientificStatus: "pending",
      isDemo: false,
      researchIncluded: research,
      auditStatus: "final-import-awaiting-owner-review",
      themes,
      sourceIds: e.sourceIds.map(sid),
      culturalContext: e.culturalNote || undefined,
      editorialNotes: [
        "Импортировано черновиком. Формы и происхождение требуют редакторской проверки.",
        ...(e.specialNotes || []),
      ].join("\n"),
      notes: [
        note(
          "origin",
          e.etymology || e.origin || "Происхождение требует проверки",
          e.sourceIds,
        ),
        ...(e.comparativeConclusion
          ? [note("conclusion", e.comparativeConclusion, e.sourceIds)]
          : []),
      ],
      languages: cards.map((c) => {
        const l = p.languages.find((l) => l.id === c.languageId);
        if (!l || langCode(l.code) !== langCode(c.languageCode))
          throw new Error(
            "Неизвестный или несогласованный язык " + c.languageId,
          );
        const def = languages.find((d) => d.code === langCode(c.languageCode));
        const integration = c.integrationCriteria
          ? Object.entries(criterionNames)
              .map(([key, name]) =>
                [
                  name,
                  text(c.integrationCriteria[key].result),
                  text(c.integrationCriteria[key].evidence),
                ]
                  .filter(Boolean)
                  .join(": "),
              )
              .join("\n")
          : undefined;
        return {
          languageCode: def.code,
          countryCode: def.country,
          reportedForms: [
            research ? c.foreignForm : c.writtenForm,
            ...(c.variants || []),
          ],
          ipa: c.ipa || undefined,
          meaning: c.meaning,
          origin: c.originNote || c.borrowingRoute || undefined,
          borrowingPath: c.borrowingRoute || undefined,
          firstAttested: c.borrowingPeriod || undefined,
          graphic: c.adaptation?.graphic,
          phonetic: c.adaptation?.phonetic,
          semantic: c.adaptation?.semantic,
          grammar: c.adaptation?.grammatical,
          register: c.usageDomains,
          examples:
            c.attestedExamples
              ?.map((ex) =>
                [
                  ex.text,
                  ex.gloss,
                  ex.type,
                  ex.sourceId ? sid(ex.sourceId) : "",
                ]
                  .filter(Boolean)
                  .join(" · "),
              )
              .join("\n") || undefined,
          integration:
            [
              integration,
              c.overallConclusion ? "Вывод: " + c.overallConclusion : "",
            ]
              .filter(Boolean)
              .join("\n") || undefined,
          correspondenceType: "unknown",
          attestationStatus: "pending",
          comment: [
            text(c.verificationStatus),
            c.countOnMap === false
              ? "Составитель исключил эту форму из потенциальных связей карты; проверьте имя, перевод и нарицательное употребление."
              : "Потенциальная связь; не подтверждена импортёром.",
            c.pronunciationEvidenceNote
              ? "Нормативная транскрипция не подтверждена; исходные данные сохранены в закрытом архиве импорта."
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          sourceIds: c.sourceIds.map(sid),
          references: [],
        };
      }),
    });
  });
  validateCatalog({
    words,
    sources,
    auditCommit: fingerprint(input),
    languageDefinitions: languages,
  });
  const blockers = words.map((w) => ({
    id: w.id,
    word: w.russianLemma,
    editorialPublication:
      "Допускается CMS с оговорками; научная проверка не выполнена",
    scientificFields: [
      {
        field: "originKind",
        issue:
          "Установить прямой/опосредованный/спорный путь; исходное описание в notes.origin",
      },
      ...w.languages.flatMap((l, i) => [
        {
          field: `languages[${i}].attestationStatus`,
          language: l.languageCode,
          issue:
            "Проверить точное написание и значение по источникам; сейчас pending",
        },
        {
          field: `languages[${i}].correspondenceType`,
          language: l.languageCode,
          issue:
            "Разграничить заимствование, имя, перевод, цитату; сейчас unknown",
        },
        ...l.sourceIds
          .filter((id) => !sources.find((s) => s.id === id)?.verifiedAt)
          .map((id) => ({
            field: `sources[${id}].verifiedAt`,
            language: l.languageCode,
            issue:
              "Зафиксировать реальную проверку источника, а не дату импорта",
          })),
        ...(w.researchIncluded && !l.ipa
          ? [
              {
                field: `languages[${i}].ipa`,
                language: l.languageCode,
                issue:
                  "Нормативная IPA не установлена; поле необязательно, не восстанавливать из реконструкции",
              },
            ]
          : []),
      ]),
    ],
  }));
  return {
    hash: fingerprint(input),
    raw: input,
    words,
    sources,
    languages,
    categories: p.categories,
    blockers,
    counts: {
      research: p.researchEntries.length,
      additional: p.dictionaryEntries.length,
      words: words.length,
      researchCards: p.researchEntries.reduce(
        (n, e) => n + e.languageCards.length,
        0,
      ),
      additionalForms: p.dictionaryEntries.reduce(
        (n, e) => n + e.foreignForms.length,
        0,
      ),
      languages: languages.length,
      countries: p.countries.length,
      sources: sources.length,
      categories: p.categories.length,
      potentialMapLinks: entries
        .flatMap((e) => e.languageCards || e.foreignForms)
        .filter((c) => c.countOnMap === true).length,
      confirmedForms: 0,
    },
  };
}

export function planImport(db, bundle) {
  const rows = list(db);
  const plans = bundle.words.map((word) => {
    const matches = rows.filter(
      (r) =>
        r.id === word.id ||
        r.data.slug === word.slug ||
        normalized(r.data.russianLemma) === normalized(word.russianLemma),
    );
    if (matches.length > 1)
      return {
        word,
        action: "conflict",
        reason: "Несколько существующих записей соответствуют слову",
      };
    const old = matches[0];
    const receipt = db
      .prepare(
        "SELECT next FROM audit WHERE kind='import-entry' AND entity_id=? ORDER BY id DESC LIMIT 1",
      )
      .get(word.id);
    if (receipt) {
      const last = JSON.parse(receipt.next);
      if (last.packageHash === bundle.hash && old?.id === last.targetId)
        return {
          word,
          old,
          action: "skip",
          reason: "Пакет уже импортирован; любые последующие правки сохранены",
        };
      return {
        word,
        old,
        action: "conflict",
        reason:
          "Пакет или запись изменены после предыдущего импорта; требуется ручное сравнение",
      };
    }
    if (!old) return { word, action: "create" };
    const original = seed.words.find((w) => w.id === old.id);
    const untouched =
      original &&
      old.version === 1 &&
      old.state === "published" &&
      canon(old.data) === canon(wordSchema.parse(original)) &&
      !db
        .prepare("SELECT id FROM history WHERE content_id=? LIMIT 1")
        .get(old.id) &&
      !db
        .prepare(
          "SELECT id FROM audit WHERE kind='word' AND entity_id=? LIMIT 1",
        )
        .get(old.id) &&
      canon(
        JSON.parse(
          db.prepare("SELECT published FROM content WHERE id=?").get(old.id)
            .published,
        ),
      ) === canon(wordSchema.parse(original));
    return untouched
      ? {
          word: { ...word, id: old.id, slug: old.data.slug },
          old,
          action: "replace-seed",
        }
      : {
          word,
          old,
          action: "conflict",
          reason:
            "Существующая запись защищена: найдены правки, история или редакционный статус",
        };
  });
  const conflicts = plans
    .filter((p) => p.action === "conflict")
    .map((p) => ({
      id: p.word.id,
      word: p.word.russianLemma,
      reason: p.reason,
    }));
  for (const s of bundle.sources) {
    const old = sourceList(db).find((v) => v.id === s.id);
    if (old && canon(old) !== canon(s))
      conflicts.push({
        id: s.id,
        reason: "Источник изменён: перезапись запрещена",
      });
  }
  for (const l of bundle.languages) {
    const old = db
      .prepare("SELECT * FROM language_definitions WHERE code=?")
      .get(l.code);
    if (old?.country && old.country !== l.country)
      conflicts.push({
        id: l.code,
        reason:
          "Опорная страна языка отличается; требуется ручное согласование",
      });
  }
  return {
    plans,
    report: {
      packageHash: bundle.hash,
      counts: bundle.counts,
      create: plans.filter((p) => p.action === "create").length,
      replaceSeed: plans.filter((p) => p.action === "replace-seed").length,
      skip: plans.filter((p) => p.action === "skip").length,
      conflicts,
      mapping: plans.map((p) => ({
        inputId: bundle.words.find(
          (w) => w.russianLemma === p.word.russianLemma,
        ).id,
        targetId: p.old?.id || p.word.id,
        slug: p.word.slug,
        action: p.action,
      })),
      editorialRestrictions: bundle.blockers,
    },
  };
}
export function applyImport(db, bundle) {
  return atomic(db, () => {
    const { plans, report } = planImport(db, bundle);
    if (report.conflicts.length) {
      const e = new Error("Импорт остановлен: конфликтующие записи защищены");
      e.report = report;
      throw e;
    }
    if (!plans.some((p) => ["create", "replace-seed"].includes(p.action)))
      return { ...report, imported: 0 };
    for (const l of bundle.languages)
      if (
        !db
          .prepare("SELECT code FROM language_definitions WHERE code=?")
          .get(l.code)
      )
        db.prepare(
          "INSERT INTO language_definitions(code,name,country,nativeName,officialCode) VALUES(?,?,?,?,?)",
        ).run(l.code, l.name, l.country, l.nativeName, l.code);
    for (const c of bundle.categories)
      if (
        !db
          .prepare("SELECT id FROM categories WHERE normalized=?")
          .get(normalizeCategory(c.nameRu))
      )
        db.prepare("INSERT INTO categories VALUES(?,?,?,'',0)").run(
          "final-" + c.id,
          c.nameRu,
          normalizeCategory(c.nameRu),
        );
    for (const s of bundle.sources)
      if (!db.prepare("SELECT id FROM sources WHERE id=?").get(s.id))
        db.prepare("INSERT INTO sources VALUES(?,?)").run(
          s.id,
          JSON.stringify(s),
        );
    for (const p of plans.filter((p) => p.action !== "skip")) {
      const saved = save(db, {
        data: p.word,
        state: "draft",
        version: p.old?.version || 0,
      });
      const inputId = bundle.words.find(
        (w) => w.russianLemma === p.word.russianLemma,
      ).id;
      audit(db, "import-entry", inputId, p.word.russianLemma, "draft", null, {
        packageHash: bundle.hash,
        targetId: saved.id,
        version: saved.version,
      });
    }
    if (
      !db
        .prepare(
          "SELECT id FROM audit WHERE kind='import-package' AND entity_id=?",
        )
        .get(bundle.hash)
    )
      audit(
        db,
        "import-package",
        bundle.hash,
        "Финальный исходный научный пакет",
        "archive",
        null,
        bundle.raw,
      );
    return {
      ...report,
      imported: plans.filter((p) => p.action !== "skip").length,
    };
  });
}
