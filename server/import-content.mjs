import { backup, DatabaseSync } from "node:sqlite";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { defaultDb, openStore, root } from "./store.mjs";
import { applyImport, planImport, preparePackage } from "./content-import.mjs";

// Local operator CLI: no HTTP route, session bypass, remote upload, or publish mode.
const args = process.argv.slice(2);
const value = (key) => {
  const i = args.indexOf(key);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (!v || v.startsWith("--")) throw new Error("Нет значения " + key);
  return v;
};
let db, temp;
try {
  const allowed = new Set(["--apply", "--file", "--db", "--report", "--help"]);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i]))
      throw new Error("Неизвестный параметр " + args[i]);
    if (["--file", "--db", "--report"].includes(args[i])) i++;
  }
  if (args.includes("--help")) {
    console.log(
      "npm run content:import -- [--file path] [--db path] [--report NEW.json] [--apply]\nБез --apply: только план. --apply: резервная копия, транзакция, только черновики. При конфликте ничего не импортируется. Остановите API перед --apply.",
    );
  } else {
    const path = resolve(value("--db") || process.env.CMS_DB_PATH || defaultDb);
    const reportPath = value("--report")
      ? resolve(value("--report"))
      : undefined;
    if (reportPath && existsSync(reportPath))
      throw new Error("Отчёт уже существует: выберите новое имя");
    const file = resolve(
      value("--file") ||
        join(root, "research/imports/russkiy-sled-content-final.json"),
    );
    const bundle = preparePackage(JSON.parse(readFileSync(file, "utf8")));
    let backupPath;
    if (args.includes("--apply")) {
      if (existsSync(path)) {
        // Backup before openStore: migrations must not precede the safety snapshot.
        const folder = join(dirname(path), "backups");
        mkdirSync(folder, { recursive: true, mode: 0o700 });
        backupPath = join(
          folder,
          `before-final-import-${Date.now()}-${randomUUID()}.sqlite`,
        );
        const original = new DatabaseSync(path, { readOnly: true });
        try {
          await backup(original, backupPath);
          chmodSync(backupPath, 0o600);
        } finally {
          original.close();
        }
      }
      db = openStore(path);
    } else if (existsSync(path)) {
      db = new DatabaseSync(path, { readOnly: true });
      if (!db.prepare("SELECT version FROM migrations WHERE version=3").get())
        throw new Error(
          "Сначала обновите CMS по ADMIN_GUIDE.md с резервной копией",
        );
    } else {
      temp = mkdtempSync(join(tmpdir(), "cms-import-plan-"));
      db = openStore(join(temp, "plan.sqlite"));
    }
    const planned = planImport(db, bundle).report;
    const result = args.includes("--apply") ? applyImport(db, bundle) : planned;
    const report = {
      mode: args.includes("--apply") ? "applied-drafts" : "read-only-plan",
      database: path,
      backup: backupPath || null,
      ...result,
    };
    if (reportPath) {
      writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
    }
    console.log(JSON.stringify(report, null, 2));
    if (report.conflicts.length) process.exitCode = 2;
  }
} catch (e) {
  console.error(e.message);
  if (e.report) console.error(JSON.stringify(e.report, null, 2));
  process.exitCode = 1;
} finally {
  db?.close();
  if (temp) rmSync(temp, { recursive: true, force: true });
}
