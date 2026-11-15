import type { SourceRecord, WordEntry } from "./schema";
export type MapLayer = "correspondences" | "borrowings";
export function mapConnections(
  words: WordEntry[],
  sources: SourceRecord[],
  layer: MapLayer = "correspondences",
) {
  return words
    .filter((w) => !w.isDemo)
    .flatMap((word) =>
      word.languages
        .filter(
          (card) =>
            !card.hidden &&
            !card.unpublished &&
            /^[A-Z]{2}$/.test(card.countryCode) &&
            card.reportedForms.some((f) => f.trim()) &&
            card.sourceIds.length > 0 &&
            card.sourceIds.every((id) => sources.some((s) => s.id === id)) &&
            (layer !== "borrowings" ||
              (card.correspondenceType === "borrowed" &&
                card.attestationStatus === "verified" &&
                card.sourceIds.every(
                  (id) => sources.find((s) => s.id === id)?.verifiedAt,
                ))),
        )
        .map((card) => ({ word, card })),
    );
}
