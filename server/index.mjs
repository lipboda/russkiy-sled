import { createServer } from "node:http";
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { openStore, publicCatalog, list, save, root } from "./store.mjs";

import { editorialData, stage2Api } from "./stage2-api.mjs";
const digest = (token) => createHash("sha256").update(token).digest("hex");
export function createApp({
  db = openStore(),
  origin = process.env.CMS_ORIGIN || "http://localhost:5173",
  secure = process.env.NODE_ENV === "production",
} = {}) {
  const expectedOrigin = new URL(origin).origin;
  if (secure && !expectedOrigin.startsWith("https://"))
    throw new Error("Для production нужен CMS_ORIGIN с HTTPS");
  const cookieName = secure ? "__Host-cms" : "cms-dev";
  const cookie = (token, age) =>
    `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    const send = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(value));
    };
    const fail = (status, message) => {
      const e = new Error(message);
      e.status = status;
      throw e;
    };
    try {
      if (
        req.headers.host !== new URL(expectedOrigin).host &&
        req.headers.host !== "127.0.0.1:3001"
      )
        fail(403, "Недопустимый Host");
      const url = new URL(req.url, expectedOrigin);
      if (!url.pathname.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(req.method))
          fail(405, "Метод не поддерживается");
        const dir = resolve(root, "dist"),
          path = resolve(dir, "." + decodeURIComponent(url.pathname));
        if (!path.startsWith(dir + "/") && path !== dir)
          fail(403, "Недопустимый путь");
        const file =
          existsSync(path) && statSync(path).isFile()
            ? path
            : resolve(dir, "index.html");
        if (!existsSync(file)) fail(503, "Выполните npm run build");
        const types = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".ico": "image/x-icon",
        };
        res.setHeader(
          "Content-Type",
          types[extname(file)] || "application/octet-stream",
        );
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        );
        res.end(req.method === "HEAD" ? undefined : readFileSync(file));
        return;
      }
      const write = !["GET", "HEAD"].includes(req.method);
      if (
        write &&
        (req.headers.origin !== expectedOrigin ||
          req.headers["content-type"]?.split(";")[0] !== "application/json")
      )
        fail(403, "Недопустимый источник запроса");
      const body = async () => {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 8 * 1024 * 1024) fail(413, "Запрос превышает 8 МБ");
          chunks.push(chunk);
        }
        const data = Buffer.concat(chunks).toString("utf8");
        try {
          return JSON.parse(data);
        } catch {
          fail(400, "Некорректный JSON");
        }
      };
      if (url.pathname === "/api/editorial" && req.method === "GET") {
        send(200, editorialData(db));
        return;
      }
      const metadataMatch = url.pathname.match(
        /^\/api\/media-meta\/([a-zA-Z0-9_-]+)$/,
      );
      if (metadataMatch && req.method === "GET") {
        const row = db
          .prepare("SELECT data FROM media WHERE id=?")
          .get(metadataMatch[1]);
        if (!row) fail(404, "Изображение не найдено");
        send(200, JSON.parse(row.data));
        return;
      }
      const mediaMatch = url.pathname.match(/^\/api\/media\/([a-zA-Z0-9_-]+)$/);
      if (mediaMatch && req.method === "GET") {
        const row = db
          .prepare("SELECT data,bytes FROM media WHERE id=?")
          .get(mediaMatch[1]);
        if (!row) fail(404, "Изображение не найдено");
        res.writeHead(200, {
          "Content-Type": "image/webp",
          "Content-Security-Policy": "default-src 'none'",
        });
        res.end(row.bytes);
        return;
      }
      if (url.pathname === "/api/content" && req.method === "GET") {
        send(200, publicCatalog(db));
        return;
      }
      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        const ip = req.socket.remoteAddress,
          now = Date.now();
        db.prepare("DELETE FROM attempts WHERE expires < ?").run(now);
        const attempts = db
          .prepare("SELECT * FROM attempts WHERE ip=?")
          .get(ip);
        if (attempts?.count >= 5) {
          res.setHeader(
            "Retry-After",
            Math.ceil((attempts.expires - now) / 1000),
          );
          fail(429, "Слишком много попыток. Повторите через 15 минут.");
        }
        const { password } = await body();
        const owner = db.prepare("SELECT hash FROM owner WHERE id=1").get();
        if (!owner)
          fail(
            503,
            "Владелец не настроен. Выполните серверную процедуру создания.",
          );
        db.prepare(
          "INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET count=count+1",
        ).run(ip, now + 900000);
        const [salt, hash] = owner.hash.split(":");
        const key = scryptSync(
          typeof password === "string" && password.length <= 256
            ? password
            : "",
          salt,
          64,
          { N: 32768, maxmem: 64 * 1024 * 1024 },
        );
        if (!timingSafeEqual(key, Buffer.from(hash, "hex")))
          fail(401, "Неверные данные входа");
        db.prepare("DELETE FROM attempts WHERE ip=?").run(ip);
        db.prepare("DELETE FROM sessions WHERE expires < ?").run(now);
        const token = randomBytes(32).toString("hex");
        db.prepare("INSERT INTO sessions VALUES (?,?)").run(
          digest(token),
          now + 8 * 3600000,
        );
        res.setHeader("Set-Cookie", cookie(token, 8 * 3600));
        send(200, { ok: true });
        return;
      }
      const token =
        (req.headers.cookie || "")
          .split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith(cookieName + "="))
          ?.slice(cookieName.length + 1) || "";
      const session = db
        .prepare("SELECT expires FROM sessions WHERE token=?")
        .get(digest(token));
      if (!session || session.expires <= Date.now())
        fail(401, "Требуется вход");
      if (url.pathname === "/api/auth/session" && req.method === "GET") {
        send(200, { ok: true });
        return;
      }
      if (url.pathname === "/api/auth/logout" && req.method === "POST") {
        db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
        res.setHeader("Set-Cookie", cookie("", 0));
        send(200, { ok: true });
        return;
      }
      if (url.pathname === "/api/admin/words") {
        if (req.method === "GET") {
          send(200, list(db));
          return;
        }
        if (req.method === "PUT") {
          send(200, save(db, await body()));
          return;
        }
      }
      if (
        await stage2Api(
          db,
          url.pathname,
          req.method,
          ["GET", "HEAD"].includes(req.method) ? undefined : await body(),
          send,
        )
      )
        return;
      const match = url.pathname.match(
        /^\/api\/admin\/words\/([a-zA-Z0-9_-]+)\/history$/,
      );
      if (match && req.method === "GET") {
        send(
          200,
          db
            .prepare(
              "SELECT * FROM history WHERE content_id=? ORDER BY version DESC",
            )
            .all(match[1])
            .map((r) => ({ ...r, data: JSON.parse(r.data) })),
        );
        return;
      }
      fail(404, "Не найдено");
    } catch (e) {
      send(e.status || 400, {
        error:
          e.name === "ZodError"
            ? "Проверьте обязательные поля и статусы записи"
            : e.code?.includes("SQLITE")
              ? "Ошибка хранилища: проверьте уникальность названия и доступность базы"
              : e.message,
      });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createApp();
  server.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
    console.log(
      "CMS: сервер слушает loopback, порт " + (process.env.PORT || 3001),
    ),
  );
}
