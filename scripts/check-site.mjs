// Revisión estática del sitio. Sin dependencias: `node scripts/check-site.mjs`.
// Falla si una página rompería en producción por algo que un servidor local no muestra:
// enlaces o archivos que no existen, código en línea que la CSP bloquea, orígenes externos
// que la CSP no permite, o ids repetidos o inexistentes.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const report = (file, message) => problems.push(`${file}: ${message}`);
const read = (path) => readFileSync(join(ROOT, path), "utf8");

const pages = readdirSync(ROOT).filter((name) => name.endsWith(".html"));
const scripts = readdirSync(join(ROOT, "js")).filter((name) => name.endsWith(".js"));
const styles = readdirSync(join(ROOT, "css")).filter((name) => name.endsWith(".css"));

/* ---------- Content-Security-Policy que se sirve en producción ---------- */
const cspLine = read("_headers")
  .split("\n")
  .find((line) => line.trim().startsWith("Content-Security-Policy:"));
if (!cspLine) report("_headers", "no se encontró Content-Security-Policy");

const csp = Object.fromEntries(
  (cspLine || "")
    .replace(/^\s*Content-Security-Policy:\s*/, "")
    .split(";")
    .map((directive) => directive.trim().split(/\s+/))
    .filter((parts) => parts[0])
    .map(([name, ...values]) => [name, values])
);
const allows = (directive, origin) => (csp[directive] || csp["default-src"] || []).includes(origin);

const isExternal = (url) => /^https?:\/\//i.test(url);
const isSkippable = (url) => /^(mailto:|tel:|data:|blob:|#|javascript:)/i.test(url) || url === "";

function checkLocalTarget(file, url, baseDir = "") {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean) return;
  if (!existsSync(join(ROOT, baseDir, clean))) report(file, `apunta a un archivo que no existe: ${url}`);
}

/* ---------- Páginas ---------- */
for (const page of pages) {
  const html = read(page);
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");

  if (/<style[\s>]/i.test(withoutComments)) report(page, "tiene <style> en línea (la CSP lo bloquea)");
  if (/\sstyle\s*=\s*["']/i.test(withoutComments)) report(page, 'tiene atributos style="" (la CSP los bloquea)');
  if (/\son[a-z]+\s*=\s*["']/i.test(withoutComments)) report(page, "tiene manejadores on*= en línea (la CSP los bloquea)");
  for (const tag of withoutComments.match(/<script\b[^>]*>/gi) || []) {
    if (!/\ssrc\s*=/.test(tag)) report(page, "tiene un <script> sin src (la CSP lo bloquea)");
  }

  for (const [, tag, attrs] of withoutComments.matchAll(/<(a|link|script|img|source)\b([^>]*)>/gi)) {
    const url = attrs.match(/\s(?:href|src)\s*=\s*"([^"]*)"/i)?.[1];
    if (url === undefined || isSkippable(url)) continue;

    if (!isExternal(url)) {
      checkLocalTarget(page, url);
      continue;
    }

    const origin = new URL(url).origin;
    const name = tag.toLowerCase();
    if (name === "script" && !allows("script-src", origin)) {
      report(page, `carga un script de ${origin}, que script-src no permite`);
    }
    if (name === "link" && /rel\s*=\s*"stylesheet"/i.test(attrs) && !allows("style-src", origin)) {
      report(page, `carga una hoja de estilo de ${origin}, que style-src no permite`);
    }
    if (name === "img" && !allows("img-src", origin)) {
      report(page, `carga una imagen de ${origin}, que img-src no permite`);
    }
  }

  const ids = [...withoutComments.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((match) => match[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) report(page, `id repetido: ${id}`);
    seen.add(id);
  }

  for (const [, attr, value] of withoutComments.matchAll(/\s(for|aria-labelledby|aria-describedby|aria-controls)\s*=\s*"([^"]+)"/g)) {
    for (const id of value.split(/\s+/)) {
      if (!seen.has(id)) report(page, `${attr} apunta a un id que no existe: ${id}`);
    }
  }
  for (const [, id] of withoutComments.matchAll(/\shref\s*=\s*"#([^"]+)"/g)) {
    if (!seen.has(id)) report(page, `enlace interno a un id que no existe: #${id}`);
  }

  if (!/<html[^>]*\slang=/.test(html)) report(page, "falta el atributo lang");
  if (!/<title>[^<]+<\/title>/.test(html)) report(page, "falta el <title>");
  if ((withoutComments.match(/<h1[\s>]/g) || []).length !== 1) report(page, "debe tener exactamente un <h1>");
  for (const tag of withoutComments.match(/<img\b[^>]*>/gi) || []) {
    if (!/\salt\s*=/.test(tag)) report(page, "hay una imagen sin atributo alt");
  }
}

/* ---------- Hojas de estilo ---------- */
for (const sheet of styles) {
  const css = read(join("css", sheet));
  for (const [, raw] of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g).map((m) => [m[0], m[2]])) {
    if (isSkippable(raw)) {
      if (raw.startsWith("data:") && !allows("img-src", "data:")) report(sheet, "usa data: pero img-src no lo permite");
      continue;
    }
    if (isExternal(raw)) {
      report(sheet, `carga un recurso externo: ${raw}`);
      continue;
    }
    checkLocalTarget(`css/${sheet}`, raw, "css");
  }
  const open = (css.match(/{/g) || []).length;
  const close = (css.match(/}/g) || []).length;
  if (open !== close) report(`css/${sheet}`, `llaves desbalanceadas (${open} abren, ${close} cierran)`);
}

/* ---------- JavaScript ---------- */
for (const script of scripts) {
  try {
    execFileSync(process.execPath, ["--check", join(ROOT, "js", script)], { stdio: "pipe" });
  } catch (error) {
    report(`js/${script}`, `error de sintaxis: ${String(error.stderr || error.message).split("\n")[0]}`);
  }
}

/* ---------- Sitemap ---------- */
for (const [, loc] of read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const path = new URL(loc).pathname;
  const file = path === "/" ? "index.html" : path.replace(/^\//, "");
  if (!existsSync(join(ROOT, file))) report("sitemap.xml", `lista una página que no existe: ${loc}`);
}

if (problems.length > 0) {
  console.error(`${problems.length} problema(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Sin problemas: ${pages.length} páginas, ${styles.length} hojas de estilo, ${scripts.length} scripts.`);
