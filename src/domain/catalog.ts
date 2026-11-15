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

export const publicLoad: { catalog: string; editorial: string } = {
  catalog: "loading",
  editorial: "loading",
};
let pending: Promise<void> | undefined;
async function loadPublic() {
  const results = await Promise.allSettled([
    fetch("/api/content").then(async (r) => {
      if (!r.ok) throw new Error();
      return validateCatalog(await r.json());
    }),
    fetch("/api/editorial").then(async (r) => {
      if (!r.ok) throw new Error();
      return r.json();
    }),
  ]);
  const [data, meta] = results;
  if (meta.status === "fulfilled") {
    Object.assign(editorial, meta.value);
    for (const l of editorial.languages) languageNames[l.code] = l.name;
    publicLoad.editorial = "ready";
  } else publicLoad.editorial = "error";
  if (data.status === "fulfilled") {
    applyPublicCatalog(data.value);
    publicLoad.catalog = "ready";
  } else publicLoad.catalog = "error";
  window.dispatchEvent(new Event("catalog-updated"));
  if (results.some((r) => r.status === "rejected"))
    throw new Error("Не удалось обновить часть материалов");
}
export function refreshPublicCatalog() {
  if (!pending)
    pending = loadPublic().finally(() => {
      pending = undefined;
    });
  return pending;
}
