import {
  mkdirSync,
  mkdtempSync,
  cpSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let out = resolve(root, "site"),
  ref = "HEAD",
  historical = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") out = resolve(args[++i]);
  else if (args[i] === "--ref") ref = args[++i];
  else if (args[i] === "--historical") historical = true;
  else throw new Error("Unknown option " + args[i]);
}
if (out === root || root.startsWith(out + "/") || existsSync(out))
  throw new Error(
    "Output must be a NEW directory outside existing project files: " + out,
  );
const work = mkdtempSync(join(tmpdir(), "russkiy-sled-pages-"));
const env = {
  ...process.env,
  EXPORT_DIR: out,
  EXPORT_HISTORICAL: historical ? "1" : "0",
  EXPORT_DB: join(work, "export.sqlite"),
  EXPORT_META: join(work, "publication-proof.json"),
};
try {
  const archive = execFileSync("git", ["archive", ref], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  });
  execFileSync("tar", ["-x", "-C", work], { input: archive });
  cpSync(join(root, "node_modules"), join(work, "node_modules"), {
    recursive: true,
    verbatimSymlinks: true,
  });
  mkdirSync(join(work, "src/offline"), { recursive: true });
  execFileSync(
    "git",
    ["apply", join(root, "scripts/public-export/offline.patch")],
    { cwd: work, stdio: "inherit" },
  );
  for (const [from, to] of [
    ["snapshot.mjs", "export-snapshot.mjs"],
    ["finish.mjs", "finish-output.mjs"],
    ["vite.config.mjs", "offline.config.mjs"],
  ])
    cpSync(join(root, "scripts/public-export", from), join(work, to));
  if (!historical) {
    const path = join(work, "src/domain/publicPresentation.ts");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(
        'date = new Date("2026-11-16T12:00:00Z")',
        "date = new Date()",
      ),
    );
  }
  for (const cmd of [
    ["export-snapshot.mjs"],
    [
      "node_modules/vite/bin/vite.js",
      "build",
      "--config",
      "offline.config.mjs",
      "--configLoader",
      "native",
    ],
    ["finish-output.mjs"],
  ])
    execFileSync(process.execPath, cmd, { cwd: work, env, stdio: "inherit" });
  writeFileSync(join(out, ".nojekyll"), "");
  writeFileSync(
    join(out, "publication.json"),
    JSON.stringify(
      {
        sourceCommit: execFileSync("git", ["rev-parse", ref], {
          cwd: root,
          encoding: "utf8",
        }).trim(),
        historicalDate: historical ? "2026-11-16" : null,
        ...JSON.parse(readFileSync(env.EXPORT_META, "utf8")),
      },
      null,
      2,
    ),
  );
  console.log("Static public site: " + out);
} finally {
  rmSync(work, { recursive: true, force: true });
}
