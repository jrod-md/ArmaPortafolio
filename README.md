# Portafolio FISC

Generador web estatico para crear el ZIP del Portafolio Digital Estudiantil de FISC, UTP.

## Estado actual

- App estatica desplegada en Cloudflare Pages.
- URL canonica: https://portafolio-fisc.pages.dev
- Autenticacion deshabilitada.
- Generacion de ZIP y portada en el navegador.
- Conclusion con IA retirada por ahora; se puede replantear mas adelante.
- Dependencias PDF vendorizadas localmente en `vendor/`.
- Cloudflare Web Analytics activo desde el dashboard.

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
```

No incluir:

```text
.git/
_old/
DESIGN.md
PRODUCT.md
README.md
LICENSE
LICENSE.es.md
THIRD_PARTY_NOTICES.md
assets/README.md
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
- Subir evidencias con nombres normales y nombres raros.
- Probar que las evidencias se conservan en su formato original dentro del ZIP.
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

Cloudflare Web Analytics es gratis y privacy-first. Ya esta activo desde el
dashboard de Cloudflare.

Despues de cada deploy, verificar en:

1. Cloudflare Dashboard.
2. Workers & Pages.
3. Proyecto `portafolio-fisc`.
4. Metrics.

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

- Revisar IA de conclusión solo cuando el producto base esté estable.
- Verificar visitas en Cloudflare Web Analytics despues del proximo deploy.

## Licencia

El código fuente de este repositorio está licenciado bajo la licencia MIT.

Los logos universitarios, logos de facultades, marcas institucionales,
plantillas oficiales y cualquier recurso de terceros no están cubiertos por la
licencia MIT. Estos materiales siguen siendo propiedad de sus respectivos dueños
y se incluyen únicamente con fines de demostración, apoyo académico o referencia
nominativa.

Consulta `THIRD_PARTY_NOTICES.md` y `assets/README.md` para los avisos de
terceros y recursos. `LICENSE.es.md` incluye una traducción informativa al
español de la licencia MIT.

## Créditos y Contribución

Creado para la comunidad estudiantil de FISC - UTP.
