# Portafolio FISC

Generador web estatico para crear el ZIP del Portafolio Digital Estudiantil de FISC, UTP.

## Estado actual

- App estatica desplegada en Cloudflare Pages.
- URL canonica: https://portafolio-fisc.pages.dev
- Autenticacion deshabilitada.
- Generacion de ZIP y portada en el navegador.
- Conclusion con IA preparada para futuro, pero oculta/deshabilitada.
- Dependencias PDF vendorizadas localmente en `vendor/`.

## Estructura de despliegue

El folder de despliegue debe contener solo archivos publicos:

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
theme-init.js
```

No incluir:

```text
.git/
.codex
worker/
_old/
DESIGN.md
PRODUCT.md
portada_spec_for_codex.md
README.md
```

## Prueba local

Desde el folder de despliegue:

```powershell
python -m http.server 8081
```

Abrir:

```text
http://127.0.0.1:8081
```

Checklist minimo:

- Abrir inicio.
- Ir a `generar.html`.
- Completar los pasos del asistente.
- Subir PDFs con nombres normales y nombres raros.
- Generar ZIP.
- Revisar estructura del ZIP y `Portada.pdf`.
- Confirmar que `descarga.html` permite descargar.

## Despliegue manual

Desde el folder de despliegue:

```powershell
npx wrangler@latest pages deploy . --project-name portafolio-fisc
```

La URL canonica que se debe compartir es:

```text
https://portafolio-fisc.pages.dev
```

Las URLs con hash, como `https://<hash>.portafolio-fisc.pages.dev`, son despliegues historicos o previews. No son la URL principal.

## Cloudflare Web Analytics

Cloudflare Web Analytics es gratis y privacy-first. Para activarlo:

1. Entrar a Cloudflare Dashboard.
2. Ir a Workers & Pages.
3. Abrir el proyecto `portafolio-fisc`.
4. Ir a Metrics.
5. Activar Web Analytics.
6. Hacer un nuevo deploy.

El archivo `_headers` ya permite el beacon de Cloudflare:

```text
https://static.cloudflareinsights.com
https://cloudflareinsights.com
```

## Privacidad de previews

Los despliegues con hash quedan publicos por defecto, pero Cloudflare los marca con `X-Robots-Tag: noindex` para que no sean indexados. Si se quieren bloquear para visitantes, activar Access Policy:

1. Cloudflare Dashboard.
2. Workers & Pages.
3. Proyecto `portafolio-fisc`.
4. Settings.
5. General.
6. Enable access policy.

Eso protege los previews, no la URL canonica.

## Pendientes

- Pulir UI movil del asistente.
- Hacer limpieza de copy en paginas secundarias.
- Completar pulido visual de la nueva marca Portafolio FISC.
- Agregar Cloudflare Web Analytics desde el dashboard.
- Revisar IA de conclusion solo cuando el producto base este estable.
