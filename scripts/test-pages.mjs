import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const root = resolve(process.argv[2] || "site"),
  prefix = "/russkiy-sled/";
const server = createServer((req, res) => {
  const path = resolve(
    root,
    "." +
      decodeURIComponent(
        new URL(req.url, "http://localhost").pathname.slice(prefix.length - 1),
      ),
  );
  if (!path.startsWith(root + "/") && path !== root) {
    res.writeHead(403).end();
    return;
  }
  const target = path === root ? resolve(root, "index.html") : path;
  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".json": "application/json",
      ".pdf": "application/pdf",
    }[extname(target)] || "application/octet-stream",
  );
  res.end(readFileSync(target));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  const origin = `http://127.0.0.1:${server.address().port}`,
    base = origin + prefix;
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const errors = [],
    network = [];
  page.on("pageerror", (e) => (errors.push(e.message),console.error("PAGE ERROR",e.message)));
  page.on("request", (r) => {
    if (!r.url().startsWith(origin) || r.url().includes("/api/"))
      network.push(r.url());
  });
  const data = JSON.parse(
    readFileSync(resolve(root, "data/catalog.json"), "utf8"),
  );
  assert.equal(data.words.length, 28);
  await page.goto(base);
  await page.locator("h1").waitFor();
  assert.equal(await page.locator(".home-word").count(), 6);
  for (const w of data.words) {
    await page.goto(base + "#/dictionary/" + w.slug);
    await page.locator("h1").waitFor();
    assert.equal(await page.locator("h1").innerText(), w.russianLemma);
    if (w.researchIncluded)
      assert.equal(await page.locator(".language-card").count(), 3);
  }
  await page.goto(base + "#/dictionary");
  await page.getByRole("textbox", { name: "Поиск по словарю" }).fill("samovar");
  await page.waitForTimeout(200);
  assert.ok(
    (await page.locator(".word-card").first().innerText()).includes("самова"),
  );
  await page.goto(base + "#/map");
  await page.getByLabel("Выбрать страну").selectOption("250");
  assert.ok((await page.locator(".map-panel").innerText()).includes("Франция"));
  assert.equal(
    await page.locator(".world-map text,.world-map title").count(),
    0,
  );
  await page.goto(base + "#/research");
  assert.equal(
    await page.getByLabel("Слово", { exact: true }).locator("option").count(),
    8,
  );
  await page.getByLabel("Область сравнения").selectOption("dictionary");
  assert.equal(
    await page.getByLabel("Слово", { exact: true }).locator("option").count(),
    28,
  );
  for (const route of [
    "/",
    "/dictionary",
    "/research",
    "/map",
    "/journey",
    "/journal",
    "/word-of-the-day",
  ]) {
    await page.goto(base + "#" + route);
    await page.locator("h1").waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  for (const img of await page.locator("img.country-flag").all())
    assert.ok(await img.evaluate((i) => i.complete && i.naturalWidth > 0));
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  console.log(
    "Pages subdirectory browser checks passed: 28 articles, search, map, comparison, navigation, local flags, no API requests",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
