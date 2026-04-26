# portada_spec_for_codex.md
## Spec para implementar `generate.js` — Portada UTP con pdf-lib

---

## FUENTE DE VERDAD
El template original es `portada_ppt.pdf` (en realidad un PPTX).
Imagen extraída: 1288×952 px. PDF destino: 966×714 pts.
Factor de escala: exactamente 0.75 en ambos ejes.
Coordenadas medidas de la imagen y convertidas a puntos pdf-lib.

**IMPORTANTE — Sistema de coordenadas pdf-lib:**
- Origen (0,0) está en la esquina INFERIOR-IZQUIERDA.
- Y aumenta hacia arriba.
- Top del page = y=714. Bottom = y=0.

---

## 1. DIMENSIONES DE PÁGINA

```js
const PAGE_W = 966;  // pts
const PAGE_H = 714;  // pts
const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
```

---

## 2. COLORES

```js
import { rgb } from 'pdf-lib';

const GREEN_LIGHT = rgb(0.553, 0.776, 0.247);  // #8DC63F — franja exterior
const GREEN_DARK  = rgb(0.000, 0.408, 0.220);  // #006838 — franja interior
const NAVY        = rgb(0.122, 0.220, 0.392);  // #1F3864 — texto header
const BLACK       = rgb(0, 0, 0);
```

Verificar colores exactos contra el original antes de hacer commit.

---

## 3. FRANJA VERDE (dibujar PRIMERO, antes de logos y texto)

```js
// Franja exterior (verde claro)
page.drawPolygon({
  points: [
    { x: 697, y: 714 },   // top-left
    { x: 966, y: 714 },   // top-right
    { x: 966, y: 0   },   // bottom-right
    { x: 562, y: 0   },   // bottom-left
  ],
  color: GREEN_LIGHT,
  borderWidth: 0,
});

// Franja interior (verde oscuro, encima)
page.drawPolygon({
  points: [
    { x: 821, y: 714 },   // top-left
    { x: 966, y: 714 },   // top-right
    { x: 966, y: 0   },   // bottom-right
    { x: 716, y: 0   },   // bottom-left
  ],
  color: GREEN_DARK,
  borderWidth: 0,
});
```

Estas coordenadas son medidas del template. Ajustar ±10pts si la línea diagonal no coincide visualmente.

---

## 4. LOGOS (PNG, embeber con pdf-lib embedPng)

### Logos disponibles en `/assets/logos/`
Hay 6 logos de facultades. Para la portada se usan dos:
- **Top-left:** logo UTP general → `logo_utp.png` (o el que corresponda)
- **Top-right:** logo FISC → `logo_fisc.png`

El nombre exacto de los archivos depende de cómo se nombraron al extraerlos.
Verificar nombres en `/assets/logos/` antes de codificar.

```js
// Cargar y embeber logos
const logoUtpBytes  = await fetch('/assets/logos/logo_utp.png').then(r => r.arrayBuffer());
const logoFiscBytes = await fetch('/assets/logos/logo_fisc.png').then(r => r.arrayBuffer());
const logoUtp  = await pdfDoc.embedPng(logoUtpBytes);
const logoFisc = await pdfDoc.embedPng(logoFiscBytes);

// Logo UTP — top-left
page.drawImage(logoUtp, {
  x: 11,
  y: 557,       // pdf-lib y (bottom-left of image)
  width:  150,
  height: 150,
});

// Logo FISC — top-right
page.drawImage(logoFisc, {
  x: 814,
  y: 569,       // pdf-lib y
  width:  146,
  height: 139,
});
```

---

## 5. TEXTO HEADER (entre logos, alineado a la izquierda de x≈210)

Todos los textos del header usan NAVY (#1F3864), bold.
El texto está visualmente centrado entre el logo UTP y el logo FISC.
Usar `textWidth = font.widthOfTextAtSize(text, size)` para centrar manualmente:
`x = (PAGE_W - textWidth) / 2`

```js
// Línea 1: "UNIVERSIDAD TECNOLÓGICA DE PANAMÁ"
// Font: bold, size: 22pt
const line1 = 'UNIVERSIDAD TECNOLÓGICA DE PANAMÁ';
const size1 = 22;
page.drawText(line1, {
  x: (PAGE_W - fontBold.widthOfTextAtSize(line1, size1)) / 2,
  y: 647,
  size: size1,
  font: fontBold,
  color: NAVY,
});

// Línea 2: "FACULTAD DE INGENIERÍA DE SISTEMAS COMPUTACIONALES"
// Font: bold, size: 16pt
const line2 = 'FACULTAD DE INGENIER\u00CDAS DE SISTEMAS COMPUTACIONALES';
const size2 = 16;
page.drawText(line2, {
  x: (PAGE_W - fontBold.widthOfTextAtSize(line2, size2)) / 2,
  y: 613,
  size: size2,
  font: fontBold,
  color: NAVY,
});

// Línea 3: "DEPARTAMENTO DE" + underline + nombre depto
// El subrayado es una línea dibujada, no underline CSS
const line3Label = 'DEPARTAMENTO DE ';
const size3 = 14;
const deptName = data.department;  // string del formulario
const line3Full = line3Label + deptName;
page.drawText(line3Full, {
  x: (PAGE_W - fontBold.widthOfTextAtSize(line3Full, size3)) / 2,
  y: 585,
  size: size3,
  font: fontBold,
  color: NAVY,
});
// Nota: el template original tiene una línea de underline estática larga.
// Opción simple: dibujar línea horizontal debajo del texto del depto.
// Omitir el underline en v1 si complica — el nombre del depto ya llena el espacio.
```

---

## 6. TÍTULO PRINCIPAL (centrado, negro, bold, grande)

```js
// "DISEÑO DEL PORTAFOLIO DIGITAL ESTUDIANTIL"
// Font: bold, size: 40pt, black, centered
const title = 'DISEÑO DEL PORTAFOLIO DIGITAL ESTUDIANTIL';
const titleSize = 40;
page.drawText(title, {
  x: (PAGE_W - fontBold.widthOfTextAtSize(title, titleSize)) / 2,
  y: 422,
  size: titleSize,
  font: fontBold,
  color: BLACK,
});
```

Si el texto desborda el área blanca (entra en la franja verde), reducir size a 36pt.
La franja empieza en x≈562 en el bottom. El área segura de texto es x=0 a x≈550.
Verificar visualmente.

---

## 7. CURSO

```js
// "CURSO:"
const cursoLabel = 'CURSO:';
const cursoSize = 18;
page.drawText(cursoLabel, {
  x: (PAGE_W - fontBold.widthOfTextAtSize(cursoLabel, cursoSize)) / 2,
  y: 373,
  size: cursoSize,
  font: fontBold,
  color: BLACK,
});

// Nombre del curso
const cursoName = data.courseName;
const cursoNameSize = 18;
page.drawText(cursoName, {
  x: (PAGE_W - fontBold.widthOfTextAtSize(cursoName, cursoNameSize)) / 2,
  y: 340,
  size: cursoNameSize,
  font: fontBold,
  color: BLACK,
});
```

---

## 8. FACILITADOR

```js
// "FACILITADOR(A): [nombre]"
const facilitadorText = `FACILITADOR(A): ${data.facilitator}`;
const facilitadorSize = 18;
page.drawText(facilitadorText, {
  x: (PAGE_W - fontBold.widthOfTextAtSize(facilitadorText, facilitadorSize)) / 2,
  y: 251,
  size: facilitadorSize,
  font: fontBold,
  color: BLACK,
});
```

---

## 9. PANAMÁ, AÑO

```js
// "PANAMÁ, 2025"
const ciudadAnio = `PANAMÁ, ${data.year}`;
const ciudadSize = 18;
page.drawText(ciudadAnio, {
  x: (PAGE_W - fontBold.widthOfTextAtSize(ciudadAnio, ciudadSize)) / 2,
  y: 168,
  size: ciudadSize,
  font: fontBold,
  color: BLACK,
});
```

---

## 10. FOOTER (italic, pequeño, centrado)

```js
// Fuente: Regular italic si tienes LiberationSans-Italic.ttf
// Si no, usar fontRegular (no italic) en v1.

const footer1 = '(Fuentes: - Material suministrado por: Ing. Lourdes de Torres e Ing. Víctor Fuentes';
const footer2 = '- Instructivo para la Elaboración del Portafolio del Estudiante de la ISC-UTP - 2016)';
const footer3 = 'Modificado por: Jefes de Departamentos - 2019';
const footerSize = 8;

page.drawText(footer1, {
  x: (PAGE_W - fontRegular.widthOfTextAtSize(footer1, footerSize)) / 2,
  y: 98,
  size: footerSize,
  font: fontRegular,
  color: BLACK,
});

page.drawText(footer2, {
  x: (PAGE_W - fontRegular.widthOfTextAtSize(footer2, footerSize)) / 2,
  y: 84,
  size: footerSize,
  font: fontRegular,
  color: BLACK,
});

page.drawText(footer3, {
  x: (PAGE_W - fontBold.widthOfTextAtSize(footer3, footerSize)) / 2,
  y: 27,
  size: footerSize,
  font: fontBold,   // "Modificado por" es bold italic en original
  color: BLACK,
});
```

---

## 11. FUENTES (Liberation Sans)

Descargar de: https://github.com/liberationfonts/liberation-fonts/releases

Archivos necesarios → guardar en `/assets/fonts/`:
- `LiberationSans-Bold.ttf`
- `LiberationSans-Regular.ttf`

```js
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const pdfDoc = await PDFDocument.create();
pdfDoc.registerFontkit(fontkit);

const boldBytes    = await fetch('/assets/fonts/LiberationSans-Bold.ttf').then(r => r.arrayBuffer());
const regularBytes = await fetch('/assets/fonts/LiberationSans-Regular.ttf').then(r => r.arrayBuffer());

const fontBold    = await pdfDoc.embedFont(boldBytes);
const fontRegular = await pdfDoc.embedFont(regularBytes);
```

---

## 12. FIRMA COMPLETA DE LA FUNCIÓN

```js
async function generatePortada(data) {
  // data = { department, courseName, facilitator, semester, year }
  // returns: Uint8Array (raw PDF bytes)
  ...
  return pdfDoc.save();
}
```

---

## 13. ORDEN DE DIBUJO (importante — capas)

1. Franja verde exterior (fondo)
2. Franja verde interior (encima)
3. Logo UTP
4. Logo FISC
5. Header text (Universidad, Facultad, Departamento)
6. Título principal
7. Curso + nombre del curso
8. Facilitador
9. Panamá + año
10. Footer

---

## 14. TEST METHODOLOGY

Después de generar el PDF:
1. Abrir en browser tab lado a lado con `portada_ppt.pdf`
2. Verificar que la franja diagonal coincide
3. Verificar que los logos están en las esquinas correctas
4. Verificar que el texto principal está centrado y no invade la franja
5. Ajustar coordenadas ±5-15pts según sea necesario

Las coordenadas Y son las más críticas — un error de 20pts es visible a simple vista.
Las coordenadas X del texto centrado se calculan automáticamente con `widthOfTextAtSize`.

---

## GAPS PENDIENTES ANTES DE CODIFICAR

1. **Nombres exactos de los logos en `/assets/logos/`** — verificar si son
   `logo_utp.png`/`logo_fisc.png` o algún otro nombre del script de extracción.

2. **Fuentes descargadas** — confirmar que `LiberationSans-Bold.ttf` y
   `LiberationSans-Regular.ttf` están en `/assets/fonts/`.

3. **Título principal overflow** — si "DISEÑO DEL PORTAFOLIO DIGITAL ESTUDIANTIL"
   a 40pt sobrepasa x≈550, reducir a 36pt o 34pt. Verificar en primera generación.

---

*Spec generado de mediciones directas sobre portada_ppt.pdf (1288×952px → 966×714pts)*
*Coordenadas son aproximadas ±10pts — requieren verificación visual en el primer render*
