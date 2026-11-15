import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { applyImport } from "./content-import.mjs";
import { finalBundle, publishFinal } from "./publish-final.mjs";
import { openStore } from "./store.mjs";
import { passwordHash } from "./manage.mjs";
const dir = mkdtempSync(join(tmpdir(), "cms-browser-"));
const password = randomBytes(32).toString("hex");
const path = join(dir, "browser.sqlite");
const db = openStore(path);
db.prepare("INSERT INTO owner VALUES (1,?)").run(passwordHash(password));
const finalMode = process.argv.includes("--final");
if (finalMode) {
  applyImport(db, finalBundle());
  publishFinal(db);
}
db.close();
const child = spawn(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    ...process.argv.slice(2).filter((a) => a !== "--final"),
    ...(finalMode ? ["tests/final-public.spec.ts"] : []),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      CMS_DB_PATH: path,
      CMS_E2E_FINAL: finalMode ? "1" : "",
      CMS_ORIGIN: "http://127.0.0.1:5173",
      CMS_TEST_PASSWORD: password,
    },
  },
);
child.on("exit", (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exitCode = code ?? 1;
});
