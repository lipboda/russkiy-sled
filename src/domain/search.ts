import Fuse from "fuse.js";
import { words, type WordEntry, type Language } from "./catalog";
export const normalize = (s: string) =>
  s
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[\s_—–-]+/g, " ")
    .trim();
export type Filters = {
  query?: string;
  languages?: Language[];
  mode?: "any" | "all";
  theme?: string;
  depth?: string;
  status?: string;
  research?: boolean;
  sort?: string;
};
export function searchWords(filters: Filters = {}, list: WordEntry[] = words) {
  const q = normalize(filters.query ?? "");
  const indexed = list.map((w) => ({
    word: w,
    text: normalize(
      [
        w.russianLemma,
        ...w.themes,
        ...w.languages.flatMap((l) => l.reportedForms),
      ].join(" "),
    ),
  }));
  let result = q
    ? new Fuse(indexed, {
        keys: ["text"],
        threshold: 0.32,
        ignoreLocation: true,
      })
        .search(q)
        .map((r) => r.item.word)
    : [...list];
  result = result.filter(
    (w) =>
      (!filters.theme || w.themes.includes(filters.theme)) &&
      (!filters.depth || w.articleDepth === filters.depth) &&
      (!filters.status || w.publicationStatus === filters.status) &&
      (!filters.research || w.researchIncluded) &&
      (!filters.languages?.length ||
        (filters.mode === "all"
          ? filters.languages.every((code) =>
              w.languages.some(
                (l) =>
                  l.languageCode === code && l.attestationStatus === "verified",
              ),
            )
          : filters.languages.some((code) =>
              w.languages.some(
                (l) => l.languageCode === code && l.reportedForms.length,
              ),
            ))),
  );
  if ((filters.sort && filters.sort !== "relevance") || !q)
    result.sort(
      (a, b) =>
        a.russianLemma.localeCompare(b.russianLemma, "ru") *
        (filters.sort === "desc" ? -1 : 1),
    );
  return result;
}
