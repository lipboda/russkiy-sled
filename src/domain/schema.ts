import { z } from "zod";
export const languageNames = {
  "en-US": "Американский английский",
  "fr-FR": "Французский",
  "hy-AM": "Восточноармянский",
} as const;
export type Language = keyof typeof languageNames;
const reference = z.object({
  sourceId: z.string(),
  pages: z.array(z.number().int().positive()),
});
const status = z.enum(["verified", "pending", "disputed", "unknown"]);
export const wordSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  russianLemma: z.string().min(1),
  russianStress: z.string().optional(),
  shortDescription: z.string().optional(),
  editorialNotes: z.string().optional(),
  culturalContext: z.string().optional(),
  checkedAt: z.string().optional(),
  scientificStatus: z
    .enum([
      "confirmed",
      "partial",
      "pending",
      "disputed",
      "unconfirmed",
      "insufficient",
    ])
    .optional(),
  originKind: z.enum(["native-russian", "via-russian", "disputed", "unknown"]),
  themes: z.array(z.string()),
  articleDepth: z.enum(["short", "full"]),
  publicationStatus: z.enum(["verified", "provisional", "draft"]),
  researchIncluded: z.boolean(),
  isDemo: z.boolean(),
  auditStatus: z.string(),
  sourceIds: z.array(z.string()),
  languages: z.array(
    z.object({
      languageCode: z.enum(["en-US", "fr-FR", "hy-AM"]),
      countryCode: z.string(),
      reportedForms: z.array(z.string()),
      ipa: z.string().optional(),
      graphic: z.string().optional(),
      phonetic: z.string().optional(),
      semantic: z.string().optional(),
      grammar: z.string().optional(),
      meaning: z.string().optional(),
      register: z.string().optional(),
      frequency: z.string().optional(),
      examples: z.string().optional(),
      integration: z.string().optional(),
      attestationStatus: status,
      sourceIds: z.array(z.string()),
      references: z.array(reference),
    }),
  ),
  notes: z.array(
    z.object({
      field: z.string(),
      text: z.string(),
      status,
      references: z.array(reference),
      bibliography: z.array(z.string()),
    }),
  ),
});
export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.url(),
  accessLevel: z.enum(["full", "section", "abstract", "bibliography"]),
  notes: z.string(),
  verifiedAt: z.string().optional(),
});
export type WordEntry = z.infer<typeof wordSchema>;
export type SourceRecord = z.infer<typeof sourceSchema>;
export function validateCatalog(input: unknown) {
  const data = z
    .object({
      words: z.array(wordSchema),
      sources: z.array(sourceSchema),
      auditCommit: z.string(),
    })
    .parse(input);
  const ids = new Set(data.sources.map((s) => s.id));
  if (ids.size !== data.sources.length) throw new Error("Повтор источника");
  if (new Set(data.words.map((w) => w.slug)).size !== data.words.length)
    throw new Error("Повтор slug");
  if (new Set(data.words.map((w) => w.id)).size !== data.words.length)
    throw new Error("Повтор ID");
  for (const w of data.words) {
    if (
      new Set(w.languages.map((l) => l.languageCode)).size !==
      w.languages.length
    )
      throw new Error("Повтор языка");
    for (const l of w.languages) {
      const countries = { "en-US": "US", "fr-FR": "FR", "hy-AM": "AM" };
      if (countries[l.languageCode] !== l.countryCode)
        throw new Error("Язык и страна не соответствуют друг другу");
    }
    for (const n of w.notes)
      if (
        n.status === "verified" &&
        (!n.references.length ||
          !n.references.every(
            (r) => data.sources.find((s) => s.id === r.sourceId)?.verifiedAt,
          ))
      )
        throw new Error(
          "Подтверждённое утверждение требует проверенного источника",
        );
    const refs = [
      ...w.sourceIds,
      ...w.languages.flatMap((l) => [
        ...l.sourceIds,
        ...l.references.map((r) => r.sourceId),
      ]),
      ...w.notes.flatMap((n) => n.references.map((r) => r.sourceId)),
    ];
    if (refs.some((id) => !ids.has(id)))
      throw new Error("Неизвестный sourceId");
    if (
      w.scientificStatus === "confirmed" &&
      w.publicationStatus !== "verified"
    )
      throw new Error(
        "Подтверждённый научный статус требует проверенных форм и источников",
      );
    for (const l of w.languages)
      if (
        l.attestationStatus === "verified" &&
        (!l.reportedForms.length ||
          !l.sourceIds.length ||
          !l.sourceIds.every(
            (id) => data.sources.find((s) => s.id === id)?.verifiedAt,
          ))
      )
        throw new Error("Подтверждённая форма требует проверенного источника");
    if (
      w.publicationStatus === "verified" &&
      (w.isDemo || !w.languages.some((l) => l.attestationStatus === "verified"))
    )
      throw new Error("Недопустимая публикация");
  }
  return data;
}
