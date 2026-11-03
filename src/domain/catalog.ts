import { z } from "zod";
import raw from "../data/catalog.json";
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
  for (const w of data.words) {
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
export const catalog = validateCatalog(raw);
export const words = catalog.words;
export const sources = catalog.sources;
export const fieldNames: Record<string, string> = {
  origin: "Происхождение",
  semantic: "Семантика",
  phonetic: "Фонетика",
  graphic: "Графика",
  grammar: "Грамматика",
  chronology: "История и датировки",
  sources: "Библиография",
  issues: "Открытые вопросы",
};
export function verifiedWords(list = words) {
  return list.filter(
    (w) =>
      !w.isDemo &&
      w.publicationStatus === "verified" &&
      w.languages.some((l) => l.attestationStatus === "verified"),
  );
}
export function wordOfDay(date = new Date(), list = words) {
  const eligible = verifiedWords(list);
  const day = Math.floor(
    Date.parse(date.toISOString().slice(0, 10)) / 86400000,
  );
  return eligible.length ? eligible[day % eligible.length] : undefined;
}
