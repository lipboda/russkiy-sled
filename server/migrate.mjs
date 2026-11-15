import { openStore } from "./store.mjs";
const db = openStore();
try {
  const result = db.prepare("PRAGMA integrity_check").get().integrity_check;
  if (result !== "ok") throw new Error("Проверка целостности не пройдена");
  console.log(
    "Миграции применены. SQLite: ok. Словарных записей: " +
      db.prepare("SELECT COUNT(*) AS n FROM content").get().n +
      ". Владелец и существующие данные сохранены.",
  );
  console.log(
    "Перед первым обновлением до этапа 2 резервная копия автоматически создаётся в backups рядом с файлом SQLite. Повторный запуск данные не перезаписывает.",
  );
} finally {
  db.close();
}
