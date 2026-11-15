import { correspondenceNames } from "./universal.ts";
import { z } from "zod";
export const languageNames: Record<string, string> = {
  "en-US": "Американский английский",
  "fr-FR": "Французский",
  "hy-AM": "Восточноармянский",
} as const;
export type Language = keyof typeof languageNames;
const reference = z.object({
  sourceId: z.string(),
  pages: z.array(z.number().int().positive()),
});
const status = z.enum([
  "verified",
  "partial",
  "presumed",
  "pending",
  "disputed",
  "unknown",
]);
const links = z.array(
  z.object({
    sourceId: z.string().optional(),
    url: z.string().default(""),
    title: z.string().max(500).optional(),
    comment: z.string().max(5000).optional(),
  }),
);
export const wordSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  russianLemma: z.string().trim().min(1),
  russianStress: z.string().optional(),
  shortDescription: z.string().optional(),
  format: z.enum(["compact", "detailed"]).optional(),
  partOfSpeech: z.string().optional(),
  links: links.optional(),
  editorialNotes: z.string().optional(),
  coverId: z.string().optional(),
  relatedWordIds: z.array(z.string()).optional(),
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
      languageCode: z.string().min(2).max(100),
      hidden: z.boolean().optional(),
      unpublished: z.boolean().optional(),
      expanded: z.boolean().optional(),
      correspondenceType: z
        .enum(
          Object.keys(correspondenceNames) as [
            keyof typeof correspondenceNames,
            ...(keyof typeof correspondenceNames)[],
          ],
        )
        .optional(),
      transliteration: z.string().optional(),
      comment: z.string().optional(),
      origin: z.string().optional(),
      firstAttested: z.string().optional(),
      borrowingPath: z.string().optional(),
      intermediary: z.string().optional(),
      links: links.optional(),
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
  id: z.string().min(1).max(300),
  title: z.string().trim().min(1),
  url: z
    .union([
      z.literal(""),
      z
        .url()
        .refine(
          (v) => ["http:", "https:"].includes(new URL(v).protocol),
          "Только HTTP/HTTPS",
        ),
    ])
    .optional(),
  author: z.string().optional(),
  sourceType: z.string().optional(),
  year: z.string().optional(),
  publisher: z.string().optional(),
  doi: z.string().optional(),
  accessedAt: z.string().optional(),
  citation: z.string().optional(),
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
      languageDefinitions: z
        .array(
          z.object({ code: z.string(), name: z.string(), country: z.string() }),
        )
        .optional(),
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
      const countries: Record<string, string> = {
        "en-US": "US",
        "fr-FR": "FR",
        "hy-AM": "AM",
        ...Object.fromEntries(
          (data.languageDefinitions ?? []).map((l) => [l.code, l.country]),
        ),
      };
      if (
        !(l.languageCode in countries) ||
        (["en-US", "fr-FR", "hy-AM"].includes(l.languageCode) &&
          countries[l.languageCode] !== l.countryCode)
      )
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
        (l.attestationStatus === "verified" ||
          l.correspondenceType === "borrowed") &&
        (!l.reportedForms.length ||
          !l.sourceIds.length ||
          !l.sourceIds.every(
            (id) => data.sources.find((s) => s.id === id)?.verifiedAt,
          ))
      )
        throw new Error("Подтверждённая форма требует проверенного источника");
    if (
      w.languages.some(
        (l) =>
          l.correspondenceType === "borrowed" &&
          l.attestationStatus !== "verified",
      )
    )
      throw new Error(
        "Подтверждённое заимствование требует подтверждённой формы и источников",
      );
    if (
      w.publicationStatus === "verified" &&
      (w.isDemo ||
        !w.languages.some(
          (l) => !l.hidden && l.attestationStatus === "verified",
        ))
    )
      throw new Error("Недопустимая публикация");
  }
  return data;
}
