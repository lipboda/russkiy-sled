import { randomBytes, scryptSync } from "node:crypto";
import { backup } from "node:sqlite";
import { openStore } from "./store.mjs";
import { chmodSync, existsSync } from "node:fs";
import { resolve } from "node:path";
export function passwordHash(password) {
  if (
    typeof password !== "string" ||
    password.length < 14 ||
    password.length > 256
  )
    throw new Error("Пароль должен содержать 14–256 символов");
  const salt = randomBytes(32).toString("hex");
  return (
    salt +
    ":" +
    scryptSync(password, salt, 64, {
      N: 32768,
      maxmem: 64 * 1024 * 1024,
    }).toString("hex")
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const db = openStore();
  try {
    if (process.argv[2] === "create-owner") {
      if (db.prepare("SELECT id FROM owner").get())
        throw new Error("Владелец уже создан. Публичного сброса пароля нет.");
      db.prepare("INSERT INTO owner VALUES (1,?)").run(
        passwordHash(process.env.CMS_OWNER_PASSWORD),
      );
      console.log("Владелец создан. Удалите CMS_OWNER_PASSWORD из окружения.");
    } else if (process.argv[2] === "backup") {
      const path = process.argv[3] && resolve(process.argv[3]);
      if (!path || existsSync(path))
        throw new Error("Укажите новый путь для резервной копии");
      await backup(db, path);
      chmodSync(path, 0o600);
      console.log("Резервная копия создана");
    } else throw new Error("Команды: create-owner | backup <новый путь>");
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
