// Arma en `dist/` la carpeta pública que se sube a Cloudflare Pages.
// Solo entran los archivos que el sitio necesita: nada de documentación, pruebas,
// maquetas ni archivos locales. Uso: `node scripts/build-export.mjs`.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist");

const FILES = ["_headers", "_redirects", "robots.txt", "sitemap.xml", "favicon.svg", "LICENSE"];
const DIRECTORIES = ["assets", "css", "js", "vendor"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const pages = readdirSync(ROOT).filter((name) => name.endsWith(".html"));
for (const name of [...pages, ...FILES]) {
  if (!existsSync(join(ROOT, name))) {
    console.error(`Falta un archivo del sitio: ${name}`);
    process.exit(1);
  }
  cpSync(join(ROOT, name), join(OUT, name));
}

for (const name of DIRECTORIES) {
  cpSync(join(ROOT, name), join(OUT, name), { recursive: true });
}

function count(directory) {
  return readdirSync(directory).reduce((total, name) => {
    const path = join(directory, name);
    return total + (statSync(path).isDirectory() ? count(path) : 1);
  }, 0);
}

console.log(`dist/ lista: ${pages.length} páginas, ${count(OUT)} archivos en total.`);
