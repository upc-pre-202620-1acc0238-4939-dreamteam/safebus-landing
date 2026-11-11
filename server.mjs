import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

export function createApp({
  dbPath = process.env.DATA_FILE || resolve("data/contacts.sqlite"),
  publicDir = resolve("dist"),
} = {}) {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(
    `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS contacts (submission_id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, received_at TEXT NOT NULL, company TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, consent INTEGER NOT NULL CHECK(consent=1));`,
  );
  const lookup = db.prepare(
    "SELECT reference, received_at, company, name, email FROM contacts WHERE submission_id = ?",
  );
  const insert = db.prepare("INSERT INTO contacts VALUES (?,?,?,?,?,?,1)");
  const limits = new Map();
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
  const server = createServer(async (req, res) => {
    const json = (code, data) => {
      res.writeHead(code, {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/api/contact") {
        if (req.method !== "POST")
          return json(405, { error: "Method not allowed" });
        if (
          req.headers.origin &&
          new URL(req.headers.origin).host !== req.headers.host
        )
          return json(403, { error: "Origin rejected" });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return json(415, { error: "JSON required" });
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8192) {
            json(413, { error: "Payload too large" });
            return;
          }
          chunks.push(chunk);
        }
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          return json(400, { error: "Invalid JSON" });
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          return json(400, { error: "Invalid request" });
        const fields = [];
        for (const field of ["company", "name"])
          if (
            typeof body[field] !== "string" ||
            !body[field].trim() ||
            body[field].trim().length > 120
          )
            fields.push(field);
        if (
          typeof body.email !== "string" ||
          body.email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
        )
          fields.push("email");
        if (body.consent !== true) fields.push("consent");
        if (fields.length)
          return json(422, { error: "Invalid contact details", fields });
        if (
          typeof body.submissionId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            body.submissionId,
          )
        )
          return json(422, { error: "Invalid submission identifier" });
        const { submissionId } = body;
        const company = body.company.trim(),
          name = body.name.trim(),
          email = body.email.trim();
        const existing = lookup.get(submissionId);
        if (existing) {
          if (
            existing.company !== company ||
            existing.name !== name ||
            existing.email !== email
          )
            return json(409, { error: "Submission identifier already used" });
          return json(200, {
            reference: existing.reference,
            receivedAt: existing.received_at,
          });
        }
        const now = Date.now();
        for (const [key, value] of limits)
          if (value.until < now) limits.delete(key);
        const key = req.socket.remoteAddress;
        const limit = limits.get(key) || { count: 0, until: now + 60000 };
        if (limit.count >= 10)
          return json(429, { error: "Please retry later" });
        limits.set(key, { ...limit, count: limit.count + 1 });
        const reference = `SB-${randomUUID()}`,
          receivedAt = new Date().toISOString();
        insert.run(submissionId, reference, receivedAt, company, name, email);
        return json(201, { reference, receivedAt });
      }
      if (!["GET", "HEAD"].includes(req.method))
        return json(405, { error: "Method not allowed" });
      if (url.pathname === "/") {
        res.writeHead(302, { ...headers, Location: "/en/" });
        return res.end();
      }
      if (["/en", "/es", "/en/terms", "/es/terms"].includes(url.pathname)) {
        res.writeHead(308, { ...headers, Location: `${url.pathname}/` });
        return res.end();
      }
      const path = decodeURIComponent(url.pathname);
      const routes = {
        "/en/": "en/index.html",
        "/es/": "es/index.html",
        "/en/terms/": "en/terms/index.html",
        "/es/terms/": "es/terms/index.html",
      };
      const file =
        routes[path] ||
        (/^\/(styles\.css|app\.js|favicon\.svg|robots\.txt|sitemap\.xml|fonts\/[a-z0-9-]+\.woff2)$/.test(
          path,
        )
          ? path.slice(1)
          : null);
      if (!file) return json(404, { error: "Not found" });
      const bytes = await readFile(resolve(publicDir, file));
      const types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
        ".txt": "text/plain; charset=utf-8",
        ".xml": "application/xml",
      };
      res.writeHead(200, {
        ...headers,
        "Content-Type": types[extname(file)],
        "Cache-Control": file.endsWith(".woff2")
          ? "public, max-age=86400"
          : "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (error) {
      if (!res.headersSent)
        json(error.code === "ENOENT" ? 404 : 500, {
          error: "Unable to process request",
        });
      else res.end();
    }
  });
  server.on("close", () => db.close());
  server.requestTimeout = 20000;
  return server;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!existsSync(resolve("dist/en/index.html")))
    throw new Error("Run npm run build before starting the server.");
  const server = createApp();
  const port = Number(process.env.PORT || 3000),
    host = process.env.HOST || "127.0.0.1";
  server.listen(port, host, () =>
    console.log(`SafeBus running at http://${host}:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close(() => process.exit(0)));
}
