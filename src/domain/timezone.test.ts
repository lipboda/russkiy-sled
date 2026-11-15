import { expect, it } from "vitest";
import { publicationInstant, localDateTime } from "./timezone";
it("schedules a project-local time as an absolute instant regardless of browser timezone", () => {
  expect(publicationInstant("2026-12-01T09:30", "Asia/Novosibirsk")).toBe(
    "2026-12-01T02:30:00.000Z",
  );
  expect(localDateTime("2026-12-01T02:30:00.000Z", "Asia/Novosibirsk")).toBe(
    "2026-12-01T09:30",
  );
  expect(() =>
    publicationInstant("2026-03-08T02:30", "America/New_York"),
  ).toThrow("Такого местного времени");
});
