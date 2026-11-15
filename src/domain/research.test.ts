import { describe, expect, it } from "vitest";
import { wordSlug } from "./slug";
import { catalog } from "./catalog";
import {
  languageComparison,
  mainResearchSlugs,
  mainResearchWords,
} from "./research";

describe("main research set", () => {
  it("preserves author order, excludes additional entries and never recreates unpublished records", () => {
    expect(mainResearchWords().map((w) => w.slug)).toEqual(mainResearchSlugs);
    expect(
      mainResearchWords(
        catalog.words.filter((w) => w.slug !== "matryoshka"),
      ).map((w) => w.slug),
    ).toEqual(mainResearchSlugs.slice(1));
    expect(mainResearchWords([])).toEqual([]);
  });
  it("reads edited language values from the same record without cached copies", () => {
    const l = structuredClone(mainResearchWords()[0].languages[0]);
    l.ipa = "Тестовое поле";
    expect(languageComparison(l, "phonetic")).toContain("Тестовое поле");
    l.ipa = "Другое тестовое поле";
    l.grammar = "Не применимо: тест";
    expect(languageComparison(l, "phonetic")).toContain("Другое тестовое поле");
    expect(languageComparison(l, "grammar")).toBe("Не применимо: тест");
  });
});

it("generates URL slugs from stressed Russian lemmas", () => {
  expect(wordSlug("Матрёшка")).toBe("matryoshka");
  expect(wordSlug("самова́р")).toBe("samovar");
  expect(wordSlug("Слово — тест!")).toBe("slovo-test");
});

it("keeps the scientific order when an imported existing word retains a custom URL", () => {
  const list = structuredClone(catalog.words);
  const word = list.find((w) => w.slug === "matryoshka")!;
  word.slug = "existing-owner-url";
  expect(mainResearchWords(list)[0].id).toBe(word.id);
  expect(mainResearchWords(list)).toHaveLength(8);
});
