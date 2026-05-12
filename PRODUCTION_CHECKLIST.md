# Checklist De Producción

Checklist para verificar Portafolio FISC antes y después de desplegar en
Cloudflare Pages.

## 1. Antes De Desplegar

La carpeta de deploy debe contener solo archivos públicos:

```text
assets/
css/
js/
vendor/
404.html
_headers
_redirects
ayuda.html
descarga.html
faq.html
favicon.svg
generar.html
index.html
nosotros.html
robots.txt
sitemap.xml
```

No debe contener:

```text
.git/
.wrangler/
_old/
DESIGN.md
PRODUCT.md
README.md
LICENSE
LICENSE.es.md
THIRD_PARTY_NOTICES.md
PRODUCTION_CHECKLIST.md
assets/README.md
```

## 2. Headers Y Seguridad

Confirmar en `_headers`:

- `Content-Security-Policy` no usa `unsafe-inline`.
- `script-src` permite `https://static.cloudflareinsights.com`.
- `connect-src` permite `https://cloudflareinsights.com`.
- `object-src 'none'`.
- `frame-ancestors 'none'`.
- Las páginas HTML tienen `Cache-Control: no-cache`.
- `assets/` y `vendor/` usan cache largo.

## 3. Analytics

Cloudflare Web Analytics ya está activo desde el dashboard. Después de cada
deploy:

1. Abrir `https://portafolio-fisc.pages.dev`.
2. Abrir DevTools.
3. Revisar la consola: no debe haber errores de CSP relacionados con
   `cloudflareinsights`.
4. En Network, filtrar por `cloudflareinsights` o `beacon`.
5. Confirmar que el request de Analytics se envía sin bloqueo.
6. En Cloudflare Dashboard, revisar Workers & Pages → `portafolio-fisc` →
   Metrics.

Los datos pueden tardar un poco en aparecer.

## 4. Flujo Principal

Verificar en producción:

- Home carga correctamente.
- `generar.html` abre.
- El asistente avanza de principio a fin.
- El preview del dossier se actualiza con los datos.
- Se aceptan los formatos permitidos por sección.
- Se bloquean extensiones peligrosas.
- La generación del ZIP funciona.
- `descarga.html` encuentra el ZIP.
- La descarga se completa.
- `Portada.pdf` se ve correcta.
- La estructura del ZIP es la esperada.

## 5. Rutas Y SEO

Confirmar:

- `robots.txt` existe.
- `sitemap.xml` existe.
- Las rutas viejas redirigen a `generar.html`:
  - `/login.html`
  - `/verify.html`
  - `/perfil.html`
  - `/dashboard.html`
- La URL pública para compartir es solo:

```text
https://portafolio-fisc.pages.dev
```

Las URLs con hash son despliegues históricos o previews.
