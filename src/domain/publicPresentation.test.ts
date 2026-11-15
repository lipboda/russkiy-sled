import { describe, it, expect } from "vitest";
import { catalog } from "./catalog";
import { mapConnections } from "./mapConnections";
import { publicProse, dictionaryDayWord } from "./publicPresentation";
describe("public presentation and scientific map boundary", () => {
  it("keeps scientific qualifications and removes only importer boilerplate", () => {
    expect(
      publicProse(
        "Импортировано черновиком. Формы и происхождение требуют редакторской проверки.\nРазграничивать фамилию конструктора, собственное имя и нарицательное употребление.",
      ),
    ).toBe(
      "Разграничивать фамилию конструктора, собственное имя и нарицательное употребление.",
    );
    expect(
      publicProse(
        "Форма совпадает с транслитерацией; это не доказательство нарицательного заимствования.",
      ),
    ).toContain("не доказательство");
  });
  it("shows sourced correspondences without calling pending/proper forms confirmed borrowings", () => {
    const word = structuredClone(catalog.words[0]);
    word.isDemo = false;
    word.languages = [
      {
        languageCode: "en-US",
        countryCode: "US",
        reportedForms: ["test"],
        meaning: "test fixture",
        attestationStatus: "pending",
        correspondenceType: "proper",
        sourceIds: [catalog.sources[0].id],
        references: [],
      },
    ];
    expect(mapConnections([word], catalog.sources)).toHaveLength(1);
    expect(mapConnections([word], catalog.sources, "borrowings")).toHaveLength(
      0,
    );
    const sources = structuredClone(catalog.sources);
    sources[0].verifiedAt = "2026-11-16";
    word.languages[0].attestationStatus = "verified";
    word.languages[0].correspondenceType = "borrowed";
    expect(mapConnections([word], sources, "borrowings")).toHaveLength(1);
    word.languages[0].hidden = true;
    expect(mapConnections([word], sources)).toHaveLength(0);
  });
  it("daily dictionary feature is deterministic and never creates a publication", () => {
    const word = structuredClone(catalog.words[0]);
    word.shortDescription = "Описание";
    word.isDemo = false;
    expect(dictionaryDayWord([word], new Date("2026-11-16"))?.id).toBe(word.id);
    expect(dictionaryDayWord([], new Date("2026-11-16"))).toBeUndefined();
  });
});
