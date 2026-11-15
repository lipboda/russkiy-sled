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
  const lemmas = [
    "матрёшка",
    "калашников",
    "дача",
    "интеллигенция",
    "погром",
    "самиздат",
    "спутник",
    "самовар",
  ];
  const normalize = (s: string) =>
    s.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
  return mainResearchSlugs.flatMap((slug, index) =>
    list.filter(
      (w) =>
        w.researchIncluded &&
        (w.slug === slug ||
          normalize(w.russianLemma) === normalize(lemmas[index])),
    ),
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
