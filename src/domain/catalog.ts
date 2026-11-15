import raw from "../data/catalog.json";
import { editorial } from "./editorial";
import { languageNames } from "./schema";
import { validateCatalog } from "./schema";
export * from "./schema";
export const catalog = validateCatalog(raw);
export const words = catalog.words;
export function applyPublicCatalog(input: unknown) {
  const next = validateCatalog(input);
  words.splice(0, words.length, ...next.words);
  sources.splice(0, sources.length, ...next.sources);
  window.dispatchEvent(new Event("catalog-updated"));
}
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

let refreshVersion = 0;
export async function refreshPublicCatalog() {
  const version = ++refreshVersion;
  const [response, metaResponse] = await Promise.all([
    fetch("/api/content"),
    fetch("/api/editorial"),
  ]);
  if (!response.ok) throw new Error("Не удалось обновить публичный каталог");
  const data: unknown = await response.json();
  if (!metaResponse.ok) throw new Error("Не удалось загрузить публикации");
  const meta = await metaResponse.json();
  if (version === refreshVersion) {
    Object.assign(editorial, meta);
    for (const l of editorial.languages) languageNames[l.code] = l.name;
    applyPublicCatalog(data);
  }
}
