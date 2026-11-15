import { randomUUID } from "node:crypto";
import { atomic, audit, normalizeCategory, categoryList } from "./stage2.mjs";
import { z } from "zod";
export function stage3Api(db, path, method, input, send) {
  if (path === "/api/admin/categories/ensure" && method === "POST") {
    const name = z
      .string()
      .trim()
      .min(1)
      .max(200)
      .parse(input.name)
      .replace(/\s+/g, " ");
    send(
      200,
      atomic(db, () => {
        let category = categoryList(db).find(
          (c) => c.normalized === normalizeCategory(name),
        );
        if (!category) {
          const id = randomUUID();
          db.prepare("INSERT INTO categories VALUES(?,?,?,'',0)").run(
            id,
            name,
            normalizeCategory(name),
          );
          audit(db, "category", id, name, "create", null, { name });
          category = categoryList(db).find((c) => c.id === id);
        }
        return category;
      }),
    );
    return true;
  }
  if (path === "/api/admin/languages/ensure" && method === "POST") {
    const data = z
      .object({
        name: z.string().trim().min(1).max(200),
        officialCode: z.string().max(35).default(""),
        nativeName: z.string().max(200).default(""),
        region: z.string().max(500).default(""),
        variety: z.string().max(200).default(""),
        flag: z.string().max(100).default(""),
        direction: z.enum(["auto", "ltr", "rtl"]).default("auto"),
      })
      .parse(input);
    let code = data.officialCode.trim();
    if (code) code = new Intl.Locale(code).toString();
    const known = db
      .prepare("SELECT * FROM language_definitions")
      .all()
      .find((l) =>
        code
          ? l.officialCode === code
          : l.name.trim().toLocaleLowerCase("ru") ===
              data.name.toLocaleLowerCase("ru") && l.variety === data.variety,
      );
    if (known) {
      send(200, known);
      return true;
    }
    code = code || "x-local-" + randomUUID().slice(0, 12);
    db.prepare(
      "INSERT INTO language_definitions(code,name,country,nativeName,region,variety,flag,officialCode,direction) VALUES(?,?,'',?,?,?,?,?,?)",
    ).run(
      code,
      data.name,
      data.nativeName,
      data.region,
      data.variety,
      data.flag,
      data.officialCode ? code : null,
      data.direction,
    );
    audit(db, "language", code, data.name, "create", null, data);
    send(
      200,
      db.prepare("SELECT * FROM language_definitions WHERE code=?").get(code),
    );
    return true;
  }
  if (path === "/api/admin/daily-cleanup" && method === "GET") {
    const rows = db
      .prepare("SELECT id,version,state FROM resources WHERE kind='daily'")
      .all();
    send(200, {
      count: rows.length,
      trash: rows.filter((r) => r.state === "trash").length,
      versions: Object.fromEntries(rows.map((r) => [r.id, r.version])),
    });
    return true;
  }
  if (path === "/api/admin/daily-cleanup" && method === "POST") {
    send(
      200,
      atomic(db, () => {
        const rows = db
          .prepare("SELECT * FROM resources WHERE kind='daily'")
          .all();
        if (!["trash", "purge"].includes(input.action))
          throw new Error("Неизвестная операция");
        const targets =
          input.action === "purge"
            ? rows.filter((r) => r.state === "trash")
            : rows;
        const phrase =
          input.action === "purge" ? "УДАЛИТЬ НАВСЕГДА" : "В КОРЗИНУ";
        if (
          input.confirm !== phrase ||
          input.count !== targets.length ||
          Object.keys(input.versions ?? {}).length !== rows.length ||
          rows.some((r) => input.versions?.[r.id] !== r.version)
        )
          throw new Error(
            "Состав выпусков изменился или подтверждение неверно. Обновите счётчик",
          );
        for (const row of targets) {
          const data = JSON.parse(row.data);
          audit(
            db,
            "daily",
            row.id,
            data.title,
            input.action === "purge" ? "delete" : "trash",
            data,
            input.action === "purge" ? null : data,
          );
          if (input.action === "purge")
            db.prepare("DELETE FROM resources WHERE kind='daily' AND id=?").run(
              row.id,
            );
          else
            db.prepare(
              "UPDATE resources SET state='trash',published=NULL,deleted=?,updated=?,version=version+1 WHERE kind='daily' AND id=?",
            ).run(new Date().toISOString(), new Date().toISOString(), row.id);
        }
        return { count: targets.length };
      }),
    );
    return true;
  }
  return false;
}
