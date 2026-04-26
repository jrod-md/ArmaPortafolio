import { FACULTIES } from "./faculties.js";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

export async function generatePortada(data) {
  const faculty = FACULTIES.find((entry) => entry.id === data?.student?.faculty);

  const lines = [
    "UNIVERSIDAD TECNOLOGICA DE PANAMA",
    faculty?.headerLine || "FACULTAD",
    "",
    "PORTAFOLIO DEL CURSO",
    "",
    `Estudiante: ${data?.student?.fullName || ""}`,
    `Cedula: ${data?.student?.cedula || ""}`,
    `Curso: ${data?.student?.courseName || ""}`,
    `Departamento: ${data?.student?.department || ""}`,
    `Facilitador(a): ${data?.student?.facilitator || ""}`,
    `Periodo: ${data?.student?.semester || ""} ${data?.student?.year || ""}`.trim(),
  ];

  const contentStream = buildPdfTextStream(lines);
  const pdfBytes = buildPdfDocument(contentStream);

  return {
    filename: "Portada.pdf",
    zipPath: "01_Portada/Portada.pdf",
    blob: new Blob([pdfBytes], { type: "application/pdf" }),
  };
}

function buildPdfTextStream(lines) {
  const commands = ["BT", "/F1 18 Tf", "72 760 Td"];

  lines.forEach((line, index) => {
    if (index > 0) {
      commands.push("0 -28 Td");
    }
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push("ET");
  return commands.join("\n");
}

function buildPdfDocument(contentStream) {
  const objects = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj`
  );
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
  objects.push(
    `5 0 obj\n<< /Length ${getLatin1Bytes(contentStream).length} >>\nstream\n${contentStream}\nendstream\nendobj`
  );

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(getLatin1Bytes(pdf).length);
    pdf += `${object}\n`;
  });

  const xrefOffset = getLatin1Bytes(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return getLatin1Bytes(pdf);
}

function escapePdfText(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function getLatin1Bytes(value) {
  const bytes = [];
  for (const char of value) {
    bytes.push(mapCharCode(char));
  }
  return new Uint8Array(bytes);
}

function mapCharCode(char) {
  const code = char.charCodeAt(0);
  if (code <= 255) {
    return code;
  }

  const cp1252Map = {
    "Á": 193,
    "É": 201,
    "Í": 205,
    "Ó": 211,
    "Ú": 218,
    "á": 225,
    "é": 233,
    "í": 237,
    "ó": 243,
    "ú": 250,
    "Ñ": 209,
    "ñ": 241,
    "Ü": 220,
    "ü": 252,
  };

  return cp1252Map[char] ?? 63;
}
