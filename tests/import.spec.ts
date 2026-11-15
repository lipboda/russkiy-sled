import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Public snapshots below simulate the owner's later approval, never publish user data.
const fixture = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
 import {readFileSync} from 'node:fs';
 import {preparePackage} from './server/content-import.mjs';
 const b=preparePackage(JSON.parse(readFileSync('research/imports/russkiy-sled-content-final.json','utf8')));
 console.log(JSON.stringify({words:b.words,sources:b.sources,auditCommit:b.hash,languageDefinitions:b.languages}));
`,
    ],
    { encoding: "utf8" },
  ),
);

test("final content preview keeps research eight by three and compares all published dictionary forms", async ({
  page,
}) => {
  await page.route("**/api/content", (r) => r.fulfill({ json: fixture }));
  await page.route("**/api/editorial", (r) =>
    r.fulfill({
      json: {
        journal: [],
        daily: [],
        categories: [],
        languages: fixture.languageDefinitions,
        timezone: "Asia/Novosibirsk",
      },
    }),
  );
  await page.goto("/research");
  await expect(
    page
      .getByRole("combobox", { name: "Слово", exact: true })
      .locator("option"),
  ).toHaveCount(8);
  await expect(page.locator(".comparison-grid > section")).toHaveCount(3);
  await page.getByLabel("Область сравнения").selectOption("dictionary");
  await expect(
    page
      .getByRole("combobox", { name: "Слово", exact: true })
      .locator("option"),
  ).toHaveCount(28);
  await page
    .getByRole("combobox", { name: "Слово", exact: true })
    .selectOption("perestroika");
  await expect(page.locator(".comparison-grid > section")).toHaveCount(7);
  await expect(page.locator(".comparison-grid")).toContainText(
    "ペレストロイカ",
  );
  await page.getByLabel("Режим сравнения").selectOption("set");
  await expect(page.getByLabel("Язык набора").locator("option")).toHaveCount(9);
  await page.getByLabel("Область сравнения").selectOption("research");
  await expect(page.getByLabel("Язык набора").locator("option")).toHaveCount(3);
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.goto("/dictionary/matryoshka");
  await expect(
    page.getByRole("heading", { name: "Сравнительный вывод", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Устойчивость формы:", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText("sourceTableCells");
  await expect(page.locator("main")).not.toContainText("originalResearchCard");
  await page.goto("/map");
  await expect(page.locator(".world-map path.focus-country")).toHaveCount(0);
  await expect(page.locator(".world-map text,.world-map title")).toHaveCount(0);
});
