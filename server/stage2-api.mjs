import { stage3Api } from "./stage3-api.mjs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  atomic,
  audit,
  categoryList,
  normalizeCategory,
  references,
  resourceList,
  saveResource,
  saveSource,
  sourceList,
  settings,
  publicResources,
} from "./stage2.mjs";
import { list, save, catalogWith } from "./store.mjs";
const name = z.string().trim().min(1).max(200);
export function editorialData(db) {
  return {
    journal: publicResources(db, "journal"),
    daily: publicResources(db, "daily"),
    categories: categoryList(db).map(({ id, name, description, sort }) => ({
      id,
      name,
      description,
      sort,
    })),
    ...settings(db),
    languages: db.prepare("SELECT * FROM language_definitions").all(),
  };
}
function touchCategoryWords(db, id) {
  const rows = db
    .prepare(
      "SELECT DISTINCT c.* FROM word_categories wc JOIN content c ON c.id=wc.word_id WHERE wc.category_id=?",
    )
    .all(id);
  for (const row of rows) {
    db.prepare(
      "INSERT INTO history(content_id,data,state,version,updated) VALUES(?,?,?,?,?)",
    ).run(row.id, row.data, row.state, row.version, row.updated);
    db.prepare("UPDATE content SET version=version+1,updated=? WHERE id=?").run(
      new Date().toISOString(),
      row.id,
    );
  }
}
export async function stage2Api(db, path, method, input, send) {
  if (stage3Api(db, path, method, input, send)) return true;
  if (path === "/api/admin/editorial" && method === "GET") {
    send(200, {
      ...editorialData(db),
      journal: resourceList(db, "journal"),
      daily: resourceList(db, "daily"),
      sources: sourceList(db),
    });
    return true;
  }
  if (path === "/api/admin/word-actions" && method === "POST") {
    send(
      200,
      atomic(db, () => {
        const { ids, action, versions, confirm, categoryIds } = input;
        if (!Array.isArray(ids) || !ids.length || ids.length > 200)
          throw new Error("Выберите от 1 до 200 записей");
        const result = [];
        for (const id of [...new Set(ids)]) {
          const row = list(db).find((r) => r.id === id);
          if (!row) throw new Error("Запись не найдена");
          if (versions?.[id] !== row.version)
            throw new Error("Запись изменена. Обновите список");
          if (action === "delete") {
            if (row.state !== "trash" || confirm !== row.data.russianLemma)
              throw new Error(
                "Для окончательного удаления из корзины введите название слова",
              );
            const links = references(db, "word", id);
            if (links.length)
              throw new Error(
                "Сначала уберите связи: " +
                  links.map((r) => r.title).join(", "),
              );
            audit(
              db,
              "word",
              id,
              row.data.russianLemma,
              "delete",
              row.data,
              null,
            );
            db.prepare("DELETE FROM word_categories WHERE word_id=?").run(id);
            db.prepare("DELETE FROM content WHERE id=?").run(id);
            result.push({ id, deleted: true });
            continue;
          }
          let data = structuredClone(row.data),
            state = row.state,
            version = row.version;
          if (action === "duplicate") {
            data.id = randomUUID();
            data.slug += "-copy-" + data.id.slice(0, 8);
            data.russianLemma += " (копия)";
            data.researchIncluded = false;
            version = 0;
            state = "draft";
          } else if (action === "categories") {
            if (!Array.isArray(categoryIds))
              throw new Error("Не выбраны категории");
            data.themes = categoryIds.map((id) => {
              const c = db
                .prepare("SELECT name FROM categories WHERE id=?")
                .get(id);
              if (!c) throw new Error("Категория не найдена");
              return c.name;
            });
            // Category reassignment edits the draft only; it does not publish unfinished changes.
            state = "draft";
          } else {
            state = {
              draft: "draft",
              publish: "published",
              unpublish: "unpublished",
              archive: "archived",
              trash: "trash",
              restore: "draft",
            }[action];
            if (!state) throw new Error("Неизвестная операция");
            if (
              ["publish", "trash", "archive"].includes(action) &&
              confirm !== "CONFIRM"
            )
              throw new Error("Подтвердите пакетную операцию");
          }
          result.push(save(db, { data, state, version }));
        }
        return result;
      }),
    );
    return true;
  }
  if (path === "/api/admin/categories") {
    if (method === "GET") {
      send(200, categoryList(db));
      return true;
    }
    if (method === "PUT") {
      const data = z
        .object({
          id: z.string().min(1),
          name,
          description: z.string().max(10000).default(""),
          sort: z.number().int().min(0).default(0),
        })
        .parse(input);
      send(
        200,
        atomic(db, () => {
          const old = db
            .prepare("SELECT * FROM categories WHERE id=?")
            .get(data.id);
          if (old && old.name !== data.name) touchCategoryWords(db, data.id);
          db.prepare(
            `INSERT INTO categories VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,normalized=excluded.normalized,description=excluded.description,sort=excluded.sort`,
          ).run(
            data.id,
            data.name,
            normalizeCategory(data.name),
            data.description,
            data.sort,
          );
          audit(db, "category", data.id, data.name, "save", old ?? null, data);
          return categoryList(db);
        }),
      );
      return true;
    }
    if (method === "POST") {
      send(
        200,
        atomic(db, () => {
          const old = db
            .prepare("SELECT * FROM categories WHERE id=?")
            .get(input.id);
          if (!old) throw new Error("Категория не найдена");
          if (input.confirm !== old.name)
            throw new Error("Введите название категории для подтверждения");
          touchCategoryWords(db, input.id);
          if (input.targetId) {
            if (
              input.targetId === input.id ||
              !db
                .prepare("SELECT id FROM categories WHERE id=?")
                .get(input.targetId)
            )
              throw new Error("Выберите другую существующую категорию");
            db.prepare(
              "INSERT OR IGNORE INTO word_categories SELECT word_id,?,scope FROM word_categories WHERE category_id=?",
            ).run(input.targetId, input.id);
          }
          db.prepare("DELETE FROM word_categories WHERE category_id=?").run(
            input.id,
          );
          db.prepare("DELETE FROM categories WHERE id=?").run(input.id);
          audit(
            db,
            "category",
            input.id,
            old.name,
            input.targetId ? "merge" : "delete",
            old,
            input.targetId ?? null,
          );
          return categoryList(db);
        }),
      );
      return true;
    }
  }
  if (path === "/api/admin/category-links" && method === "POST") {
    send(
      200,
      db
        .prepare(
          "SELECT DISTINCT c.id,c.data FROM word_categories wc JOIN content c ON c.id=wc.word_id WHERE wc.category_id=?",
        )
        .all(input.id)
        .map((r) => ({ id: r.id, title: JSON.parse(r.data).russianLemma })),
    );
    return true;
  }
  if (path === "/api/admin/references" && method === "POST") {
    if (!["word", "source", "media"].includes(input.type))
      throw new Error("Неизвестный тип связи");
    send(200, references(db, input.type, input.id));
    return true;
  }
  const match = path.match(/^\/api\/admin\/publications\/(journal|daily)$/);
  if (match) {
    if (method === "GET") {
      send(200, resourceList(db, match[1]));
      return true;
    }
    if (method === "PUT") {
      send(200, saveResource(db, match[1], input));
      return true;
    }
    if (method === "DELETE") {
      const row = resourceList(db, match[1]).find((r) => r.id === input.id);
      if (
        !row ||
        row.state !== "trash" ||
        input.confirm !== row.data.title ||
        input.version !== row.version
      )
        throw new Error(
          "Удаление требует корзины, актуальной версии и точного названия",
        );
      atomic(db, () => {
        audit(db, match[1], row.id, row.data.title, "delete", row.data, null);
        db.prepare("DELETE FROM resources WHERE kind=? AND id=?").run(
          match[1],
          row.id,
        );
      });
      send(200, { ok: true });
      return true;
    }
  }
  if (path === "/api/admin/sources") {
    if (method === "GET") {
      send(200, sourceList(db));
      return true;
    }
    if (method === "PUT") {
      send(
        200,
        saveSource(db, input, (sources) => {
          const all = list(db).map((r) => r.data);
          const c = catalogWith(db, all);
          // Validate both drafts and published claims before changing verification metadata.
          const snapshots = db
            .prepare(
              "SELECT published FROM content WHERE published IS NOT NULL",
            )
            .all()
            .map((r) => JSON.parse(r.published));
          for (const words of [c.words, snapshots]) {
            // imported synchronously via shared validator below
            validate({ ...c, words, sources });
          }
        }),
      );
      return true;
    }
    if (method === "DELETE") {
      const old = sourceList(db).find((s) => s.id === input.id);
      if (!old || input.confirm !== old.title)
        throw new Error("Введите название источника");
      const links = references(db, "source", input.id);
      if (links.length)
        throw new Error(
          "Источник используется: " + links.map((r) => r.title).join(", "),
        );
      atomic(db, () => {
        db.prepare("DELETE FROM sources WHERE id=?").run(input.id);
        audit(db, "source", input.id, old.title, "delete", old, null);
      });
      send(200, { ok: true });
      return true;
    }
  }
  if (path === "/api/admin/history" && method === "GET") {
    const events = db
      .prepare("SELECT * FROM audit ORDER BY id DESC")
      .all()
      .map((r) => ({
        ...r,
        previous: r.previous ? JSON.parse(r.previous) : null,
        next: r.next ? JSON.parse(r.next) : null,
      }));
    const legacy = db
      .prepare("SELECT * FROM history ORDER BY id DESC")
      .all()
      .map((r) => ({
        id: "legacy-" + r.id,
        kind: "word",
        entity_id: r.content_id,
        title: JSON.parse(r.data).russianLemma,
        operation: "legacy",
        previous: JSON.parse(r.data),
        next: null,
        created: r.updated,
      }));
    send(
      200,
      [...events, ...legacy].sort((a, b) => b.created.localeCompare(a.created)),
    );
    return true;
  }
  if (path === "/api/admin/restore-history" && method === "POST") {
    const row = input.legacy
      ? db
          .prepare("SELECT content_id,data FROM history WHERE id=?")
          .get(input.id)
      : db.prepare("SELECT * FROM audit WHERE id=?").get(input.id);
    if (!row) throw new Error("Версия не найдена");
    const data = JSON.parse(input.legacy ? row.data : (row.previous ?? "null"));
    if (!data) throw new Error("Предыдущая версия отсутствует");
    const kind = input.legacy ? "word" : row.kind;
    if (kind === "word") {
      const current = list(db).find((r) => r.id === data.id);
      if (!current) throw new Error("Материал удалён окончательно");
      send(200, save(db, { data, state: "draft", version: current.version }));
    } else if (["journal", "daily"].includes(kind)) {
      const current = resourceList(db, kind).find((r) => r.id === data.id);
      if (!current) throw new Error("Материал удалён окончательно");
      send(
        200,
        saveResource(db, kind, {
          data,
          state: "draft",
          version: current.version,
        }),
      );
    } else
      throw new Error("Для этого типа используйте соответствующий редактор");
    return true;
  }
  if (path === "/api/admin/settings") {
    if (method === "GET") {
      send(200, {
        ...settings(db),
        languages: db.prepare("SELECT * FROM language_definitions").all(),
      });
      return true;
    }
    if (method === "PUT") {
      const timezone = z.string().parse(input.timezone);
      new Intl.DateTimeFormat("ru", { timeZone: timezone }).format();
      atomic(db, () => {
        const old = settings(db);
        db.prepare("UPDATE settings SET timezone=? WHERE id=1").run(timezone);
        audit(db, "settings", "1", "Часовой пояс", "save", old, { timezone });
      });
      send(200, settings(db));
      return true;
    }
  }
  if (path === "/api/admin/languages" && method === "PUT") {
    const data = z
      .object({
        code: z.string().min(2).max(35),
        name,
        country: z.string().regex(/^[A-Z]{2}$/),
      })
      .parse(input);
    new Intl.Locale(data.code);
    const old = db
      .prepare("SELECT * FROM language_definitions WHERE code=?")
      .get(data.code);
    if (
      old &&
      old.country !== data.country &&
      list(db).some((r) =>
        r.data.languages.some((l) => l.languageCode === data.code),
      )
    )
      throw new Error("Страна используемого языка неизменяема");
    db.prepare(
      "INSERT INTO language_definitions(code,name,country) VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,country=excluded.country",
    ).run(data.code, data.name, data.country);
    send(200, { ok: true });
    return true;
  }
  if (path === "/api/admin/media") {
    if (method === "GET") {
      send(
        200,
        db
          .prepare("SELECT id,data FROM media ORDER BY rowid DESC")
          .all()
          .map((r) => ({ id: r.id, ...JSON.parse(r.data) })),
      );
      return true;
    }
    if (method === "PUT") {
      const data = z
        .object({
          id: z.string(),
          name,
          alt: z.string().min(1).max(1000),
          caption: z.string().max(3000),
          credit: z.string().max(1000),
          source: z.string().max(3000),
        })
        .parse(input);
      const old = db.prepare("SELECT data FROM media WHERE id=?").get(data.id);
      if (!old) throw new Error("Изображение не найдено");
      db.prepare("UPDATE media SET data=? WHERE id=?").run(
        JSON.stringify({ ...JSON.parse(old.data), ...data }),
        data.id,
      );
      send(200, { ok: true });
      return true;
    }
    if (method === "POST") {
      const metadata = z
        .object({
          name,
          alt: z.string().min(1).max(1000),
          caption: z.string().max(3000).default(""),
          credit: z.string().max(1000).default(""),
          source: z.string().max(3000).default(""),
          base64: z.string().max(7 * 1024 * 1024),
        })
        .parse(input);
      const bytes = Buffer.from(metadata.base64, "base64");
      if (bytes.length > 5 * 1024 * 1024) throw new Error("Максимум 5 МБ");
      const decoder = sharp(bytes, { limitInputPixels: 20000000 });
      const info = await decoder.metadata();
      if (!["jpeg", "png", "webp"].includes(info.format) || info.pages > 1)
        throw new Error("Разрешены только неподвижные PNG, JPEG и WebP");
      const clean = await decoder.rotate().webp({ quality: 85 }).toBuffer();
      const id = randomUUID(),
        data = {
          ...metadata,
          base64: undefined,
          mime: "image/webp",
          created: new Date().toISOString(),
        };
      db.prepare("INSERT INTO media VALUES(?,?,?)").run(
        id,
        JSON.stringify(data),
        clean,
      );
      send(200, { id, ...data });
      return true;
    }
    if (method === "DELETE") {
      const row = db.prepare("SELECT data FROM media WHERE id=?").get(input.id);
      if (!row) throw new Error("Изображение не найдено");
      if (input.confirm !== JSON.parse(row.data).name)
        throw new Error("Введите название изображения");
      if (references(db, "media", input.id).length)
        throw new Error("Изображение используется материалами");
      db.prepare("DELETE FROM media WHERE id=?").run(input.id);
      send(200, { ok: true });
      return true;
    }
  }
  return false;
}
import { validateCatalog as validate } from "../src/domain/schema.ts";
