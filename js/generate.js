import { FACULTIES } from "./faculties.js";

const PAGE_W = 966;
const PAGE_H = 714;
const SAFE_TEXT_MAX_X = 550;

const PDF_LIB_URL = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm";
const FONTKIT_URL = "https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm";

const OUTPUT_FILENAME = "Portada.pdf";
const OUTPUT_ZIP_PATH = "01_Portada/Portada.pdf";
const DEFAULT_FACULTY_ID = "fisc";

const GREEN_LIGHT_RGB = { r: 0.553, g: 0.776, b: 0.247 };
const GREEN_DARK_RGB = { r: 0.0, g: 0.408, b: 0.22 };
const NAVY_RGB = { r: 0.122, g: 0.22, b: 0.392 };
const BLACK_RGB = { r: 0, g: 0, b: 0 };

const TITLE_TEXT = "DISEÑO DEL PORTAFOLIO DIGITAL ESTUDIANTIL";
const UNIVERSITY_TEXT = "UNIVERSIDAD TECNOLÓGICA DE PANAMÁ";
const FOOTER_1 =
  "(Fuentes: - Material suministrado por: Ing. Lourdes de Torres e Ing. Víctor Fuentes";
const FOOTER_2 =
  "- Instructivo para la Elaboración del Portafolio del Estudiante de la ISC-UTP - 2016)";
const FOOTER_3 = "Modificado por: Jefes de Departamentos - 2019";

let pdfLibPromise;
let fontkitPromise;
const assetBytesCache = new Map();

export async function generatePortada(data) {
  const student = data?.student || data || {};
  const faculty = resolveFaculty(student.faculty);

  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
    loadPdfLib(),
    loadFontkit(),
  ]);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [boldBytes, regularBytes, utpLogoBytes, facultyLogoBytes] = await Promise.all([
    loadAssetBytes("../assets/fonts/LiberationSans-Bold.ttf"),
    loadAssetBytes("../assets/fonts/LiberationSans-Regular.ttf"),
    loadAssetBytes("../assets/logos/logo_utp.png"),
    loadAssetBytes(`../assets/logos/${faculty.logoFile}`),
  ]);

  const [fontBold, fontRegular, logoUtp, logoFaculty] = await Promise.all([
    pdfDoc.embedFont(boldBytes),
    pdfDoc.embedFont(regularBytes),
    pdfDoc.embedPng(utpLogoBytes),
    pdfDoc.embedPng(facultyLogoBytes),
  ]);

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const GREEN_LIGHT = rgb(GREEN_LIGHT_RGB.r, GREEN_LIGHT_RGB.g, GREEN_LIGHT_RGB.b);
  const GREEN_DARK = rgb(GREEN_DARK_RGB.r, GREEN_DARK_RGB.g, GREEN_DARK_RGB.b);
  const NAVY = rgb(NAVY_RGB.r, NAVY_RGB.g, NAVY_RGB.b);
  const BLACK = rgb(BLACK_RGB.r, BLACK_RGB.g, BLACK_RGB.b);

  drawGreenBands(page, GREEN_LIGHT, GREEN_DARK);

  page.drawImage(logoUtp, {
    x: 11,
    y: 557,
    width: 150,
    height: 150,
  });

  page.drawImage(logoFaculty, {
    x: 814,
    y: 569,
    width: 146,
    height: 139,
  });

  drawCenteredText(page, UNIVERSITY_TEXT, 22, 647, fontBold, NAVY);
  drawCenteredText(page, faculty.headerLine, 16, 613, fontBold, NAVY);

  const departmentText = buildDepartmentLine(student.department);
  const departmentSize = 14;
  const departmentX = drawCenteredText(
    page,
    departmentText,
    departmentSize,
    585,
    fontBold,
    NAVY
  );

  drawDepartmentUnderline({
    page,
    fontBold,
    color: NAVY,
    fullText: departmentText,
    x: departmentX,
    y: 585,
    size: departmentSize,
  });

  const titleLayout = fitCenteredTextToSafeArea(fontBold, TITLE_TEXT, 40, 34, SAFE_TEXT_MAX_X);
  drawCenteredText(page, TITLE_TEXT, titleLayout.size, 422, fontBold, BLACK);

  drawCenteredText(page, "CURSO:", 18, 373, fontBold, BLACK);
  drawCenteredText(page, normalizeText(student.courseName), 18, 340, fontBold, BLACK);
  drawCenteredText(
    page,
    `FACILITADOR(A): ${normalizeText(student.facilitator)}`,
    18,
    251,
    fontBold,
    BLACK
  );
  drawCenteredText(page, `PANAMÁ, ${normalizeText(student.year)}`, 18, 168, fontBold, BLACK);

  drawCenteredText(page, FOOTER_1, 8, 98, fontRegular, BLACK);
  drawCenteredText(page, FOOTER_2, 8, 84, fontRegular, BLACK);
  drawCenteredText(page, FOOTER_3, 8, 27, fontBold, BLACK);

  const pdfBytes = await pdfDoc.save();

  return {
    filename: OUTPUT_FILENAME,
    zipPath: OUTPUT_ZIP_PATH,
    blob: new Blob([pdfBytes], { type: "application/pdf" }),
  };
}

function resolveFaculty(facultyId) {
  return (
    FACULTIES.find((entry) => entry.id === facultyId) ||
    FACULTIES.find((entry) => entry.id === DEFAULT_FACULTY_ID) ||
    {
      id: DEFAULT_FACULTY_ID,
      headerLine: "FACULTAD DE INGENIERÍA DE SISTEMAS COMPUTACIONALES",
      logoFile: "logo_fisc.png",
    }
  );
}

function normalizeText(value) {
  return String(value || "").trim();
}

function buildDepartmentLine(department) {
  const cleanDepartment = normalizeDepartmentName(department);
  return `DEPARTAMENTO DE ${cleanDepartment}`.trim();
}

function normalizeDepartmentName(department) {
  const clean = normalizeText(department).replace(/^departamento\s+de\s+/i, "");
  return clean.toUpperCase();
}

function drawGreenBands(page, lightColor, darkColor) {
  page.drawSvgPath("M 697 714 L 966 714 L 966 0 L 562 0 Z", {
    color: lightColor,
    borderWidth: 0,
  });

  page.drawSvgPath("M 821 714 L 966 714 L 966 0 L 716 0 Z", {
    color: darkColor,
    borderWidth: 0,
  });
}

function drawCenteredText(page, text, size, y, font, color) {
  const safeText = text || "";
  const width = font.widthOfTextAtSize(safeText, size);
  const x = (PAGE_W - width) / 2;

  page.drawText(safeText, {
    x,
    y,
    size,
    font,
    color,
  });

  return x;
}

function drawDepartmentUnderline({ page, fontBold, color, fullText, x, y, size }) {
  const labelText = "DEPARTAMENTO DE ";
  const deptText = fullText.startsWith(labelText) ? fullText.slice(labelText.length) : fullText;
  const labelWidth = fontBold.widthOfTextAtSize(labelText, size);
  const deptWidth = fontBold.widthOfTextAtSize(deptText, size);

  if (!deptText || deptWidth <= 0) {
    return;
  }

  page.drawLine({
    start: { x: x + labelWidth, y: y - 2 },
    end: { x: x + labelWidth + deptWidth, y: y - 2 },
    thickness: 1,
    color,
  });
}

function fitCenteredTextToSafeArea(font, text, initialSize, minimumSize, maxX) {
  for (let size = initialSize; size >= minimumSize; size -= 2) {
    const width = font.widthOfTextAtSize(text, size);
    const x = (PAGE_W - width) / 2;
    if (x + width <= maxX) {
      return { size, x, width };
    }
  }

  const fallbackWidth = font.widthOfTextAtSize(text, minimumSize);
  return {
    size: minimumSize,
    x: (PAGE_W - fallbackWidth) / 2,
    width: fallbackWidth,
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
