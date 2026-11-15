import { backup, DatabaseSync } from "node:sqlite";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { defaultDb, openStore, root } from "./store.mjs";
import {
  applyImport,
  planImport,
  preparePackage,
  createImportReview,
  applyImportReview,
  verifyImportReview,
  importReviewHtml,
} from "./content-import.mjs";

// Trusted local operator only; the HTTP API and global overwrite protection stay unchanged.
const args = process.argv.slice(2);
const values = new Map();
const valueFlags = new Set([
  "--file",
  "--db",
  "--report",
  "--review",
  "--apply-review",
  "--confirm",
]);
let db, temp, reportFd;
try {
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (![...valueFlags, "--apply", "--help"].includes(key))
      throw new Error("Неизвестный параметр " + key);
    if (values.has(key)) throw new Error("Повтор параметра " + key);
    if (valueFlags.has(key)) {
      const v = args[++i];
      if (!v || v.startsWith("--")) throw new Error("Нет значения " + key);
      values.set(key, v);
    } else values.set(key, true);
  }
  const value = (key) => values.get(key);
  if (value("--help")) {
    console.log(
      "npm run content:import -- [--file path] [--db path] [--report NEW.json] [--apply]\nСогласование: --review NEW.json (сравнение JSON + HTML); затем --apply-review NEW.json (ввод кода в терминале) либо --apply-review NEW.json --confirm ПОЛНЫЙ_КОД.\nБез режима записи: только план. При применении: резервная копия, транзакция, только черновики. Остановите API/Vite до просмотра и применения.",
    );
  } else {
    if (
      ["--apply", "--review", "--apply-review"].filter((k) => value(k)).length >
      1
    )
      throw new Error("Выберите один режим импорта");
    if (value("--confirm") && !value("--apply-review"))
      throw new Error("Подтверждение разрешено только с --apply-review");
    if (value("--report") && value("--review"))
      throw new Error(
        "В режиме --review путь плана уже задан; --report не нужен",
      );
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
    let review, confirmation, backupPath;
    if (value("--apply-review")) {
      review = JSON.parse(
        readFileSync(resolve(value("--apply-review")), "utf8"),
      );
      confirmation = value("--confirm");
      // Validate before asking for approval or touching the DB/backup directory.
      verifyImportReview(bundle, review, path, review.id);
      if (!confirmation) {
        if (!process.stdin.isTTY || !process.stdout.isTTY)
          throw new Error(
            "Для явного подтверждения нужен интерактивный терминал или --confirm с полным кодом просмотренного плана",
          );
        console.log(
          `База: ${path}\nОбновить защищённых: ${review.summary.updateReviewed}; новых: ${review.summary.create}. Только черновики. Сначала прочитайте HTML-сравнение.\nКод плана: ${review.id}`,
        );
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        try {
          confirmation = await rl.question(
            "Для согласия на замену показанных содержательных полей введите полный код (Enter — отмена): ",
          );
        } finally {
          rl.close();
        }
      }
      verifyImportReview(bundle, review, path, confirmation);
    }
    if ((value("--review") || review) && !existsSync(path))
      throw new Error("Для согласования нужна существующая локальная база");
    if (reportPath) reportFd = openSync(reportPath, "wx", 0o600);
    if (value("--apply") || review) {
      if (existsSync(path)) {
        // Before openStore/migrations, and including outstanding WAL transactions.
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
        console.error("Резервная копия: " + backupPath);
      }
      if (review) {
        // A reviewed update must never run migrations before checking its snapshot.
        db = new DatabaseSync(path);
        db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
        if (!db.prepare("SELECT version FROM migrations WHERE version=3").get())
          throw new Error(
            "Схема базы изменилась после просмотра; создайте новый план после обновления CMS",
          );
      } else db = openStore(path);
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
    if (value("--review")) {
      const target = resolve(value("--review"));
      const html = target + ".html";
      if (existsSync(target) || existsSync(html))
        throw new Error("План или HTML уже существует: выберите новое имя");
      const plan = createImportReview(db, bundle, path);
      const jsonFd = openSync(target, "wx", 0o600);
      try {
        const htmlFd = openSync(html, "wx", 0o600);
        try {
          writeFileSync(jsonFd, JSON.stringify(plan, null, 2) + "\n");
          writeFileSync(htmlFd, importReviewHtml(plan));
        } finally {
          closeSync(htmlFd);
        }
      } finally {
        closeSync(jsonFd);
      }
      console.log(
        JSON.stringify(
          {
            mode: "review-only",
            plan: target,
            html,
            id: plan.id,
            ...plan.summary,
            blockingConflicts: plan.blockingConflicts,
          },
          null,
          2,
        ),
      );
      if (plan.blockingConflicts.length) process.exitCode = 2;
    } else {
      const result = review
        ? applyImportReview(db, bundle, review, path, confirmation)
        : value("--apply")
          ? applyImport(db, bundle)
          : planImport(db, bundle).report;
      const report = {
        mode: review
          ? "applied-reviewed-drafts"
          : value("--apply")
            ? "applied-drafts"
            : "read-only-plan",
        database: path,
        backup: backupPath || null,
        ...result,
      };
      if (reportFd !== undefined)
        writeFileSync(reportFd, JSON.stringify(report, null, 2) + "\n");
      console.log(JSON.stringify(report, null, 2));
      if (report.conflicts?.length) process.exitCode = 2;
    }
  }
} catch (e) {
  console.error(e.message);
  if (e.report) console.error(JSON.stringify(e.report, null, 2));
  if (reportFd !== undefined)
    writeFileSync(
      reportFd,
      JSON.stringify({ error: e.message, report: e.report ?? null }, null, 2) +
        "\n",
    );
  process.exitCode = 1;
} finally {
  db?.close();
  if (reportFd !== undefined) closeSync(reportFd);
  if (temp) rmSync(temp, { recursive: true, force: true });
}
