const PAGE_W = 966;
const PAGE_H = 714;

const PDF_LIB_URL = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm";
const FONTKIT_URL = "https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm";

const OUTPUT_FILENAME = "Portada.pdf";
const OUTPUT_ZIP_PATH = "01_Portada/Portada.pdf";

const TEMPLATE_PATH = "../assets/templates/portada_base.png";
const FONT_REGULAR_PATH = "../assets/fonts/LiberationSans-Regular.ttf";
const FONT_BOLD_PATH = "../assets/fonts/LiberationSans-Bold.ttf";

const TEXT_RGB = hexToRgb("#37474F");

const DEPARTMENT_BOUNDS = { x: 462, y: 556, width: 286 };
const COURSE_BOUNDS = { y: 350, width: 540 };
const FACILITATOR_BOUNDS = { x: 530, y: 245, width: 280 };
const YEAR_BOUNDS = { x: 600, y: 165, width: 74 };

let pdfLibPromise;
let fontkitPromise;
const assetBytesCache = new Map();

export async function generatePortada(data) {
  const student = data?.student || data || {};
  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
    loadPdfLib(),
    loadFontkit(),
  ]);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [templateBytes, regularBytes, boldBytes] = await Promise.all([
    loadAssetBytes(TEMPLATE_PATH),
    loadAssetBytes(FONT_REGULAR_PATH),
    loadAssetBytes(FONT_BOLD_PATH),
  ]);

  const [templateImage, fontRegular, fontBold] = await Promise.all([
    pdfDoc.embedPng(templateBytes),
    pdfDoc.embedFont(regularBytes),
    pdfDoc.embedFont(boldBytes),
  ]);

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const textColor = rgb(TEXT_RGB.r, TEXT_RGB.g, TEXT_RGB.b);

  page.drawImage(templateImage, {
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
  });

  drawDepartmentValue(page, {
    text: toUpper(stripDepartmentPrefix(student.department)),
    font: fontRegular,
    color: textColor,
  });

  drawCenteredValue(page, {
    text: cleanText(student.course || student.courseName),
    font: fontBold,
    color: textColor,
    initialSize: 18.5,
    minimumSize: 14.5,
    maxWidth: COURSE_BOUNDS.width,
    y: COURSE_BOUNDS.y,
  });

  drawAlignedValue(page, {
    text: cleanText(student.facilitator),
    font: fontRegular,
    color: textColor,
    initialSize: 17,
    minimumSize: 13.5,
    maxWidth: FACILITATOR_BOUNDS.width,
    x: FACILITATOR_BOUNDS.x,
    y: FACILITATOR_BOUNDS.y,
  });

  drawAlignedValue(page, {
    text: resolveYear(student.year),
    font: fontRegular,
    color: textColor,
    initialSize: 18,
    minimumSize: 16,
    maxWidth: YEAR_BOUNDS.width,
    x: YEAR_BOUNDS.x,
    y: YEAR_BOUNDS.y,
  });

  const pdfBytes = await pdfDoc.save();

  return {
    filename: OUTPUT_FILENAME,
    zipPath: OUTPUT_ZIP_PATH,
    blob: new Blob([pdfBytes], { type: "application/pdf" }),
  };
}

function drawDepartmentValue(page, { text, font, color }) {
  const safeText = cleanText(text);
  if (!safeText) {
    return;
  }

  const fitted = fitTextToWidth(font, safeText, 11.5, 9.5, DEPARTMENT_BOUNDS.width - 8);
  const textWidth = font.widthOfTextAtSize(safeText, fitted.size);
  const x = DEPARTMENT_BOUNDS.x + (DEPARTMENT_BOUNDS.width - textWidth) / 2;

  page.drawText(safeText, {
    x,
    y: DEPARTMENT_BOUNDS.y,
    size: fitted.size,
    font,
    color,
  });
}

function drawCenteredValue(page, { text, font, color, initialSize, minimumSize, maxWidth, y }) {
  const safeText = cleanText(text);
  if (!safeText) {
    return;
  }

  const fitted = fitTextToWidth(font, safeText, initialSize, minimumSize, maxWidth);
  const width = font.widthOfTextAtSize(safeText, fitted.size);
  const x = (PAGE_W - width) / 2;

  page.drawText(safeText, {
    x,
    y,
    size: fitted.size,
    font,
    color,
  });
}

function drawAlignedValue(page, { text, font, color, initialSize, minimumSize, maxWidth, x, y }) {
  const safeText = cleanText(text);
  if (!safeText) {
    return;
  }

  const fitted = fitTextToWidth(font, safeText, initialSize, minimumSize, maxWidth);

  page.drawText(safeText, {
    x,
    y,
    size: fitted.size,
    font,
    color,
  });
}

function fitTextToWidth(font, text, initialSize, minimumSize, maxWidth) {
  for (let size = initialSize; size >= minimumSize; size -= 0.5) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) {
      return { size };
    }
  }

  return { size: minimumSize };
}

function resolveYear(year) {
  const normalized = cleanText(year);
  return normalized || String(new Date().getFullYear());
}

function stripDepartmentPrefix(value) {
  return cleanText(value).replace(/^departamento\s+de\s+/i, "");
}

function toUpper(value) {
  return cleanText(value).toLocaleUpperCase("es-PA");
}

function cleanText(value) {
  return String(value || "")
    .trim()
    .replace(/Ã“/g, "Ó")
    .replace(/Ã/g, "Í")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Ã³/g, "ó")
    .replace(/Ã­/g, "í")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/ï¿½/g, "");
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const int = Number.parseInt(normalized, 16);
  return {
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  };
}

async function loadAssetBytes(relativePath) {
  const assetUrl = new URL(relativePath, import.meta.url).href;
  if (!assetBytesCache.has(assetUrl)) {
    assetBytesCache.set(
      assetUrl,
      fetch(assetUrl).then(async (response) => {
        if (!response.ok) {
          throw new Error(`asset_unavailable:${relativePath}`);
        }
        return response.arrayBuffer();
      })
    );
  }

  return assetBytesCache.get(assetUrl);
}

async function loadPdfLib() {
  if (!pdfLibPromise) {
    pdfLibPromise = globalThis.PDFLib?.PDFDocument
      ? Promise.resolve(globalThis.PDFLib)
      : import(PDF_LIB_URL);
  }

  return pdfLibPromise;
}

async function loadFontkit() {
  if (!fontkitPromise) {
    fontkitPromise = globalThis.fontkit
      ? Promise.resolve(globalThis.fontkit.default || globalThis.fontkit)
      : import(FONTKIT_URL).then((mod) => mod.default || mod);
  }

  return fontkitPromise;
}
