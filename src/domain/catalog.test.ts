import { describe, it, expect } from "vitest";
import {
  catalog,
  validateCatalog,
  wordOfDay,
  verifiedWords,
  type WordEntry,
} from "./catalog";
import { normalize, searchWords } from "./search";
describe("research publication gates", () => {
  it("preserves 58 records, 9 detailed articles, and zero verified claims", () => {
    expect(catalog.words).toHaveLength(58);
    expect(catalog.words.filter((w) => w.articleDepth === "full")).toHaveLength(
      9,
    );
    expect(verifiedWords()).toHaveLength(0);
    expect(wordOfDay()).toBeUndefined();
  });
  it("rejects dangling sources in claims", () => {
    const c = structuredClone(catalog);
    c.words[0].sourceIds = ["missing"];
    expect(() => validateCatalog(c)).toThrow("sourceId");
  });
  it("rejects verified forms with only an unverified dossier", () => {
    const c = structuredClone(catalog);
    const w = c.words.find((w) => w.slug === "samovar")!;
    w.languages[0].attestationStatus = "verified";
    expect(() => validateCatalog(c)).toThrow("проверенного источника");
  });
  it("rejects verified words without attested forms", () => {
    const c = structuredClone(catalog);
    c.words[0].publicationStatus = "verified";
    expect(() => validateCatalog(c)).toThrow("публикация");
  });
  it("excludes demonstration entries from daily selection and counts", () => {
    const w = {
      ...catalog.words[0],
      publicationStatus: "verified",
      isDemo: true,
    } as WordEntry;
    expect(verifiedWords([w])).toEqual([]);
    expect(wordOfDay(new Date(), [w])).toBeUndefined();
  });
});
describe("search and filters", () => {
  it("normalizes ё, case and separators", () =>
    expect(normalize("  МАТРЁШКА—слово ")).toBe("матрешка слово"));
  it("finds the same entry in Cyrillic, Latin and with a typo", () => {
    for (const q of ["самовар", "samovar", "самавар"])
      expect(searchWords({ query: q })[0].slug).toBe("samovar");
  });
  it("matches ё and е", () =>
    expect(searchWords({ query: "матрешка" })[0].slug).toBe("matryoshka"));
  it("applies any and all with different evidence requirements", () => {
    expect(
      searchWords({ languages: ["en-US", "fr-FR"], mode: "any" }).length,
    ).toBeGreaterThan(0);
    expect(searchWords({ languages: ["en-US", "fr-FR"], mode: "all" })).toEqual(
      [],
    );
  });
  it("filters depth, status and themes", () => {
    expect(searchWords({ depth: "full" })).toHaveLength(9);
    expect(searchWords({ status: "verified" })).toHaveLength(0);
    expect(searchWords({ theme: "Искусство" })[0].russianLemma).toBe(
      "балалайка",
    );
  });
  it("returns an empty set for an unrelated query", () =>
    expect(searchWords({ query: "zzzzqqqq" })).toEqual([]));
  it("sorts in reverse alphabetic order", () => {
    const a = searchWords({ sort: "asc" });
    expect(searchWords({ sort: "desc" })).toEqual([...a].reverse());
  });
});
