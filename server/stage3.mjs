import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { atomic, audit, sourceList } from "./stage2.mjs";
import { safeLink } from "../src/domain/universal.ts";
export function migrateStage3(db, path) {
  if (db.prepare("SELECT version FROM migrations WHERE version=3").get())
    return;
  if (path !== ":memory:") {
    const folder = resolve(dirname(path), "backups");
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const target = resolve(
      folder,
      `before-stage3-${Date.now()}-${randomUUID()}.sqlite`,
    );
    db.exec("VACUUM INTO '" + target.replaceAll("'", "''") + "'");
    chmodSync(target, 0o600);
  }
  atomic(db, () => {
    db.exec(`ALTER TABLE language_definitions ADD COLUMN nativeName TEXT NOT NULL DEFAULT '';
 ALTER TABLE language_definitions ADD COLUMN region TEXT NOT NULL DEFAULT '';
 ALTER TABLE language_definitions ADD COLUMN variety TEXT NOT NULL DEFAULT '';
 ALTER TABLE language_definitions ADD COLUMN flag TEXT NOT NULL DEFAULT '';
 ALTER TABLE language_definitions ADD COLUMN officialCode TEXT;
 ALTER TABLE language_definitions ADD COLUMN direction TEXT NOT NULL DEFAULT 'auto';
 UPDATE language_definitions SET officialCode=code;
 INSERT INTO migrations VALUES(3);`);
  });
}
export function resolveLinks(db, entity) {
  if (entity.links) {
    entity.links = entity.links
      .filter((l) => l.sourceId || l.url.trim())
      .map((link) => {
        if (link.url && !safeLink(link.url))
          throw new Error(
            "Источник должен содержать безопасную HTTP/HTTPS-ссылку",
          );
        if (link.url?.startsWith("/"))
          throw new Error(
            "Для научного источника укажите полный HTTP/HTTPS URL",
          );
        let source = link.sourceId
          ? sourceList(db).find((s) => s.id === link.sourceId)
          : undefined;
        if (link.url) {
          const url = new URL(link.url).href;
          source = sourceList(db).find(
            (s) => s.url && new URL(s.url).href === url,
          );
          if (!source) {
            source = {
              id: randomUUID(),
              title: link.title?.trim() || url,
              url,
              accessLevel: "bibliography",
              notes: "",
            };
            db.prepare("INSERT INTO sources VALUES(?,?)").run(
              source.id,
              JSON.stringify(source),
            );
            audit(db, "source", source.id, source.title, "link", null, source);
          }
        }
        if (!source) throw new Error("Источник не найден");
        return {
          ...link,
          sourceId: source.id,
          url: link.url || source.url || "",
        };
      });
    entity.sourceIds = [
      ...new Set([...entity.sourceIds, ...entity.links.map((l) => l.sourceId)]),
    ];
  }
  for (const card of entity.languages ?? []) resolveLinks(db, card);
  return entity;
}
