import { words, type WordEntry } from "./catalog";

// Main conference set is specified by the author. Other researched entries stay in the dictionary.
export const mainResearchSlugs = [
  "matryoshka",
  "kalashnikov",
  "dacha",
  "intelligentsia",
  "pogrom",
  "samizdat",
  "sputnik",
  "samovar",
] as const;
export function mainResearchWords(list: WordEntry[] = words) {
  return mainResearchSlugs.flatMap((slug) =>
    list.filter((w) => w.slug === slug && w.researchIncluded),
  );
}
export const comparisonFields = {
  graphic: "Графика",
  phonetic: "Фонетика",
  semantic: "Семантика",
  grammar: "Грамматика",
  register: "Сфера употребления",
  integration: "Освоенность",
  sources: "Источники",
} as const;
export type ComparisonField = keyof typeof comparisonFields;
export function languageComparison(
  l: WordEntry["languages"][number],
  field: ComparisonField,
) {
  switch (field) {
    case "graphic":
      return l.graphic || l.reportedForms.join("; ");
    case "phonetic":
      return [l.ipa, l.phonetic].filter(Boolean).join("\n");
    case "semantic":
      return [l.meaning, l.semantic].filter(Boolean).join("\n");
    case "sources":
      return ""; // Render linked sources in the view.
    default:
      return l[field];
  }
}
