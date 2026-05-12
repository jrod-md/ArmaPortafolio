# Portafolio FISC

Portafolio FISC es una aplicación web estática para ayudar a estudiantes de la
Facultad de Ingeniería de Sistemas Computacionales (FISC) de la Universidad
Tecnológica de Panamá (UTP) a preparar su Portafolio Digital Estudiantil.

La herramienta genera la portada, organiza las evidencias por sección y entrega
un archivo ZIP con la estructura esperada para el cierre del semestre.

> Herramienta de apoyo académico. No es un producto oficial de la Universidad
> Tecnológica de Panamá ni de FISC.

## Estado

- Producción: <https://portafolio-fisc.pages.dev>
- Hosting: Cloudflare Pages, Direct Upload manual.
- Autenticación: no aplica, la herramienta es de uso libre y no requiere cuenta.
- Generación: portada PDF y ZIP en el navegador.
- Analytics: Cloudflare Web Analytics activo para medir visitas generales.
- IA: módulo de conclusión deshabilitado por ahora, reservado para una etapa futura.
- Dependencias clave: `pdf-lib` y `fontkit` vendorizadas localmente en `vendor/`.

## Qué hace

- Captura datos del estudiante, curso, facilitador, ciclo académico y departamento.
- Genera una portada PDF para el portafolio.
- Permite subir evidencias en formatos comunes, no solo PDF.
- Conserva los archivos originales dentro del ZIP.
- Sanitiza nombres de archivos antes de agregarlos al paquete.
- Bloquea extensiones peligrosas como ejecutables o scripts de sistema.
- Agrupa las evidencias en carpetas académicas predefinidas.
- Genera un ZIP final listo para revisar y entregar.

## Privacidad y datos

Portafolio FISC no tiene backend propio, base de datos del proyecto, usuarios,
sesiones privadas ni cuentas.

Los archivos se procesan en el navegador del usuario. Para facilitar la pantalla
de descarga, el ZIP puede guardarse temporalmente en IndexedDB, que es
almacenamiento local del propio navegador. Después de descargarlo, la herramienta
intenta borrar esa copia temporal.

Cloudflare Web Analytics está activo para medir visitas y rendimiento básico de
la página. Ese analytics no está pensado para leer el contenido de los archivos
subidos ni los datos escritos en el formulario.

La configuración de analytics se administra desde Cloudflare; no hay llaves,
tokens ni secretos de analytics dentro del repositorio.

## Formatos permitidos

La app acepta evidencias en formatos comunes:

- Documentos: `pdf`, `doc`, `docx`, `txt`, `rtf`, `odt`, `md`
- Hojas de cálculo: `xls`, `xlsx`, `csv`, `ods`
- Presentaciones: `ppt`, `pptx`, `odp`
- Código fuente: `java`, `py`, `js`, `ts`, `html`, `css`, `sql`, `json`, `xml`, `c`, `cpp`, `cs`, `php`, `ipynb`
- Imágenes: `png`, `jpg`, `jpeg`, `gif`, `webp`
- Archivos comprimidos: `zip`, `rar`, `7z`

Límites actuales:

- Máximo por archivo: 10 MB.
- Máximo total del paquete: 160 MB.
- Algunas secciones tienen límites propios de cantidad y formato.

## Estructura del proyecto

```text
.
|-- assets/
|   |-- fonts/
|   |-- logos/
|   `-- templates/
|-- css/
|   `-- styles.css
|-- js/
|   |-- app.js
|   |-- download.js
|   |-- faq.js
|   |-- generate.js
|   |-- landing.js
|   `-- zip.js
|-- vendor/
|   |-- fontkit/
|   `-- pdf-lib/
|-- 404.html
|-- ayuda.html
|-- descarga.html
|-- faq.html
|-- generar.html
|-- index.html
|-- nosotros.html
|-- robots.txt
|-- sitemap.xml
|-- _headers
`-- _redirects
```

## Prueba local

La app es estática. Puede probarse desde cualquier servidor local simple.

Desde el folder que se vaya a desplegar:

```powershell
python -m http.server 8081
```

Abrir:

```text
http://127.0.0.1:8081
```

Checklist mínimo:

- Abrir `index.html`.
- Entrar a `generar.html`.
- Completar el flujo del asistente.
- Subir archivos con nombres normales y nombres problemáticos.
- Confirmar que los nombres quedan sanitizados dentro del ZIP.
- Generar el portafolio.
- Descargar desde `descarga.html`.
- Revisar que `Portada.pdf` y la estructura de carpetas estén correctas.

## Deploy manual en Cloudflare Pages

El proyecto se despliega manualmente con Wrangler desde el folder público de
deploy, no desde una instalación permanente por proyecto.

```powershell
npx wrangler@latest pages deploy . --project-name portafolio-fisc
```

La URL pública para compartir es:

```text
https://portafolio-fisc.pages.dev
```

Las URLs con hash, por ejemplo `https://<hash>.portafolio-fisc.pages.dev`, son
deploys históricos o previews de Cloudflare Pages. No son la URL canónica.

## Carpeta de deploy

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

No incluir:

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

## Seguridad

La configuración de Cloudflare Pages usa `_headers` para aplicar controles de
seguridad:

- Content Security Policy sin `unsafe-inline`.
- `object-src 'none'`.
- `frame-ancestors 'none'`.
- `base-uri 'self'`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` restrictiva para cámara, micrófono, geolocalización,
  pagos y USB.

También se separa cache:

- HTML con `Cache-Control: no-cache`.
- `assets/` y `vendor/` con cache largo e immutable.
- `css/` y `js/` con cache corto y versionado por query string en HTML.

## Preparación para GitHub público

Antes de publicar el repositorio:

- Confirmar que no existan `.wrangler`, `.git` dentro del folder público de deploy,
  capturas temporales, perfiles de navegador, dumps o archivos locales.
- Mantener `LICENSE`, `LICENSE.es.md`, `THIRD_PARTY_NOTICES.md` y
  `assets/README.md`.
- Revisar si los logos institucionales deben mantenerse con aviso de propiedad o
  reemplazarse por placeholders.
- Confirmar que no existan llaves, tokens, secretos ni credenciales.
- Confirmar que el README describa el estado real del producto.

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

## Créditos

Creado como herramienta de apoyo para estudiantes de FISC, UTP.
