// Servidor estático local que aplica las cabeceras de `_headers`, como Cloudflare Pages.
// Un servidor simple no envía la Content-Security-Policy, y por eso no muestra lo que
// producción bloquea. Uso: `node scripts/serve.mjs [carpeta]` (PORT=4173 por defecto).

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(REPO, process.argv[2] || ".");
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

// Formato de Cloudflare: una línea con la ruta y, debajo, líneas indentadas "Nombre: valor".
function parseHeaderRules(text) {
  const rules = [];
  let current = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
      continue;
    }
    const separator = line.indexOf(":");
    if (current && separator > 0) {
      current.headers.push([line.slice(0, separator).trim(), line.slice(separator + 1).trim()]);
    }
  }
  return rules;
}

function matches(pattern, path) {
  if (pattern.endsWith("*")) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

const headersFile = join(ROOT, "_headers");
const rules = existsSync(headersFile) ? parseHeaderRules(readFileSync(headersFile, "utf8")) : [];

function headersFor(path) {
  const headers = {};
  for (const rule of rules) {
    if (!matches(rule.pattern, path)) continue;
    for (const [name, value] of rule.headers) {
      // En http://localhost no hay HTTPS al cual subir las peticiones.
      headers[name] =
        name.toLowerCase() === "content-security-policy"
          ? value.replace(/;\s*upgrade-insecure-requests/i, "")
          : value;
    }
  }
  return headers;
}

function resolveFile(path) {
  const safe = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, "");
  const target = resolve(ROOT, safe);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;

  const candidates = [target, `${target}.html`, join(target, "index.html")];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) || null;
}

const server = createServer((request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const file = resolveFile(path);
  const headers = headersFor(path);

  if (!file) {
    const notFound = join(ROOT, "404.html");
    response.writeHead(404, { ...headers, "Content-Type": TYPES[".html"] });
    if (existsSync(notFound)) createReadStream(notFound).pipe(response);
    else response.end("404");
    return;
  }

  response.writeHead(200, {
    ...headers,
    "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Sirviendo ${ROOT} en http://127.0.0.1:${PORT} con las cabeceras de _headers`);
});
