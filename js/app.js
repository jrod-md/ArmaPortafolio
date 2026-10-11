const generatePortadaFn = globalThis.PortafolioFiscGenerate?.generatePortada;
const buildZipFn = globalThis.PortafolioFiscZip?.buildZip;
const saveGeneratedZipFn = globalThis.PortafolioFiscZip?.saveGeneratedZip;

const TOTAL_STEPS = 5;
const MAX_FULL_NAME_LENGTH = 80;
const MAX_COURSE_NAME_LENGTH = 80;
const MAX_FACILITATOR_LENGTH = 80;
const MAX_CONCLUSION_LENGTH = 2000;
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_SIZE_BYTES = 160 * 1024 * 1024;
const FILE_TYPE_GROUPS = {
  documents: ["pdf", "doc", "docx", "txt", "rtf", "odt", "md"],
  spreadsheets: ["xls", "xlsx", "csv", "ods"],
  presentations: ["ppt", "pptx", "odp"],
  sourceCode: ["java", "py", "js", "ts", "html", "css", "sql", "json", "xml", "c", "cpp", "cs", "php", "ipynb"],
  archives: ["zip", "rar", "7z"],
  images: ["png", "jpg", "jpeg", "gif", "webp"],
};
const uniqueExtensions = (...groups) => Array.from(new Set(groups.flat()));
const EVIDENCE_EXTENSIONS = uniqueExtensions(
  FILE_TYPE_GROUPS.documents,
  FILE_TYPE_GROUPS.spreadsheets,
  FILE_TYPE_GROUPS.presentations,
  FILE_TYPE_GROUPS.sourceCode,
  FILE_TYPE_GROUPS.archives,
  FILE_TYPE_GROUPS.images
);
const EVIDENCE_EXTENSION_SET = new Set(EVIDENCE_EXTENSIONS);
const BLOCKED_EXTENSIONS = [
  "ade",
  "adp",
  "app",
  "asp",
  "bas",
  "bat",
  "cer",
  "chm",
  "cmd",
  "com",
  "cpl",
  "dll",
  "dmg",
  "exe",
  "gadget",
  "hta",
  "inf",
  "ins",
  "isp",
  "jar",
  "jsm",
  "jse",
  "lnk",
  "mde",
  "msc",
  "msi",
  "msp",
  "mst",
  "pif",
  "pkg",
  "ps1",
  "reg",
  "scr",
  "sh",
  "sys",
  "vb",
  "vbe",
  "vbs",
  "ws",
  "wsc",
  "wsf",
  "wsh",
];
const BLOCKED_EXTENSION_SET = new Set(BLOCKED_EXTENSIONS);
const EVIDENCE_FORMATS_LABEL = "PDF, Word, Excel, PowerPoint, texto, código fuente, imágenes o ZIP";
const UPLOAD_CONFIG = {
  planContenido: {
    label: "Plan de Contenido",
    path: "02_Descripcion_Curso/",
    maxFiles: 1,
    allowFolders: false,
    allowedExtensions: ["pdf", "doc", "docx"],
    formatsLabel: "PDF o Word",
  },
  tareas: {
    label: "Tareas",
    path: "04_Actividades/Tareas/",
    maxFiles: 32,
    allowFolders: true,
    allowedExtensions: EVIDENCE_EXTENSIONS,
    formatsLabel: "documentos, hojas de cálculo, presentaciones, código, imágenes o ZIP",
  },
  parciales: {
    label: "Parciales",
    path: "04_Actividades/Parciales/",
    maxFiles: 12,
    allowFolders: true,
    allowedExtensions: uniqueExtensions(FILE_TYPE_GROUPS.documents, FILE_TYPE_GROUPS.images),
    formatsLabel: "PDF, Word, texto o imágenes",
  },
  proyectos: {
    label: "Proyectos",
    path: "04_Actividades/Proyectos/",
    maxFiles: 120,
    allowFolders: true,
    allowedExtensions: uniqueExtensions(
      FILE_TYPE_GROUPS.documents,
      FILE_TYPE_GROUPS.spreadsheets,
      FILE_TYPE_GROUPS.presentations,
      FILE_TYPE_GROUPS.sourceCode,
      FILE_TYPE_GROUPS.images,
      FILE_TYPE_GROUPS.archives
    ),
    formatsLabel: "documentos, código fuente, imágenes, hojas de cálculo, presentaciones o ZIP",
  },
  labs: {
    label: "Laboratorios y talleres",
    path: "04_Actividades/Laboratorios_Talleres/",
    maxFiles: 120,
    allowFolders: true,
    allowedExtensions: uniqueExtensions(
      FILE_TYPE_GROUPS.documents,
      FILE_TYPE_GROUPS.spreadsheets,
      FILE_TYPE_GROUPS.sourceCode,
      FILE_TYPE_GROUPS.images,
      FILE_TYPE_GROUPS.archives
    ),
    formatsLabel: "documentos, hojas de cálculo, código fuente, imágenes o ZIP",
  },
  material: {
    label: "Material didáctico",
    path: "05_Material_Didactico/",
    maxFiles: 64,
    allowFolders: true,
    allowedExtensions: uniqueExtensions(
      FILE_TYPE_GROUPS.documents,
      FILE_TYPE_GROUPS.spreadsheets,
      FILE_TYPE_GROUPS.presentations,
      FILE_TYPE_GROUPS.images,
      FILE_TYPE_GROUPS.archives
    ),
    formatsLabel: "documentos, hojas de cálculo, presentaciones, imágenes o ZIP",
  },
};

let currentStep = 1;
let uploadSequence = 0;
let previewIsCompiling = false;
let appInitialized = false;
let leavingForDownload = false;
const RECEIPT_STORAGE_KEY = "armaportafolio-recibo";

const uploads = {};

function $(id) {
  return document.getElementById(id);
}

function clampText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getUploadPath(key, fileName) {
  return `${UPLOAD_CONFIG[key]?.path || "99_Adjuntos/"}${sanitizeRelativePath(fileName)}`;
}

function getFileExtension(fileName) {
  const match = String(fileName || "")
    .trim()
    .match(/\.([^.\\/]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function sanitizeFileName(fileName) {
  const rawName = String(fileName || "archivo.pdf")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  const extension = getFileExtension(rawName).replace(/[^a-z0-9]/g, "").slice(0, 12);
  const hasExtension = Boolean(extension);
  const baseEnd = hasExtension ? rawName.length - extension.length - 1 : rawName.length;
  const baseName = rawName
    .slice(0, Math.max(baseEnd, 0))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 96);

  return `${baseName || "archivo"}${extension ? `.${extension}` : ""}`;
}

function sanitizeRelativePath(path) {
  const parts = String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .slice(0, 12)
    .map(sanitizeFileName)
    .filter(Boolean);

  return parts.length > 0 ? parts.join("/") : "archivo";
}

function getFileUploadPath(file) {
  return file?.webkitRelativePath || file?.name || "archivo";
}

function getTotalUploadSize(entries = getAllUploadEntries()) {
  return entries.reduce((total, entry) => total + (entry.size || 0), 0);
}

function makeUniqueZipPath(zipPath, entries) {
  const usedPaths = new Set(entries.map((entry) => entry.zipPath));
  if (!usedPaths.has(zipPath)) return zipPath;

  const slashIndex = zipPath.lastIndexOf("/");
  const directory = slashIndex >= 0 ? zipPath.slice(0, slashIndex + 1) : "";
  const fileName = slashIndex >= 0 ? zipPath.slice(slashIndex + 1) : zipPath;
  const dotIndex = fileName.lastIndexOf(".");
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const extension = dotIndex > 0 ? fileName.slice(dotIndex) : "";

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${directory}${base}_${index}${extension}`;
    if (!usedPaths.has(candidate)) return candidate;
  }

  return `${directory}${base}_${Date.now()}${extension}`;
}

function getMessageNode() {
  let node = $("wizard-message");
  if (node) return node;

  const progress = document.querySelector(".wizard-progress");
  if (!progress || !progress.parentNode) return null;

  node = document.createElement("div");
  node.id = "wizard-message";
  node.className = "wizard-inline-message";
  node.hidden = true;
  progress.insertAdjacentElement("afterend", node);
  return node;
}

function showMessage(message, type = "error") {
  const node = getMessageNode();
  if (!node) return;
  node.hidden = false;
  node.textContent = message;
  node.dataset.type = type;
  node.setAttribute("role", type === "error" ? "alert" : "status");
  node.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
}

function clearMessage() {
  const node = getMessageNode();
  if (!node) return;
  node.hidden = true;
  node.textContent = "";
  node.dataset.type = "";
  node.removeAttribute("role");
  node.removeAttribute("aria-live");
}

function getStudentData() {
  const departmentField = $("sf-depto");
  const department = departmentField?.value
    ? (departmentField.selectedOptions?.[0]?.text || departmentField.value || "").trim()
    : "";

  return {
    fullName: clampText($("sf-nombre")?.value, MAX_FULL_NAME_LENGTH),
    cedula: ($("sf-cedula")?.value || "").trim(),
    courseName: clampText($("sf-curso")?.value, MAX_COURSE_NAME_LENGTH),
    department,
    facilitator: clampText($("sf-facilitador")?.value, MAX_FACILITATOR_LENGTH),
    semester: (document.querySelector('input[name="semestre"]:checked')?.value || "").trim(),
    year: ($("sf-anio")?.value || "").trim(),
    faculty: "fisc",
  };
}

function getConclusionText() {
  return clampText($("conclusionFinal")?.value, MAX_CONCLUSION_LENGTH);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getUploadEntries(key) {
  return Array.isArray(uploads[key]) ? uploads[key] : [];
}

function getAllUploadEntries() {
  return Object.values(uploads).flat().filter((entry) => entry?.file);
}

const COVER_PAGE_WIDTH = 966;
// Mismos tamaños y anchos que usa generate.js, para que la vista previa coincida con el PDF.
const COVER_FIELDS = [
  { id: "cover-depto", key: "department", initialSize: 14.5, minimumSize: 12, maxWidth: 280 },
  { id: "cover-curso", key: "courseName", initialSize: 17.5, minimumSize: 14.5, maxWidth: 560 },
  { id: "cover-nombre", key: "fullName", initialSize: 19, minimumSize: 14.5, maxWidth: 280 },
  { id: "cover-cedula", key: "cedula", initialSize: 18.5, minimumSize: 15, maxWidth: 210 },
  { id: "cover-facil", key: "facilitator", initialSize: 17, minimumSize: 14.5, maxWidth: 285 },
  { id: "cover-anio", key: "year", initialSize: 17, minimumSize: 15, maxWidth: 96 },
];
const COVER_FONT_FAMILY = '"Liberation Sans Cover", Arial, Helvetica, sans-serif';
const STEP_FOLDERS = {
  1: ["portada"],
  2: ["curso"],
  3: ["actividades", "material"],
  4: ["conclusion"],
};
const STEP_NOTES = {
  1: ["Empieza por la portada.", "Se escribe sola mientras llenas tus datos."],
  2: ["Carpeta del curso.", "Aquí va el plan de contenido."],
  3: ["Actividades y material.", "Cada archivo cae en su carpeta."],
  4: ["La última carpeta.", "Solo se crea si escribes algo."],
  5: ["Todo en orden.", "Las carpetas vacías no se incluyen."],
};
const STACK_CLOSED_STEP = 16;
const STACK_STAGGER_MS = 55;

let coverMeasureContext = null;

function getFolderCounts() {
  const student = getStudentData();
  const count = (key) => getUploadEntries(key).length;

  return {
    portada: student.fullName || student.courseName ? 1 : 0,
    curso: count("planContenido"),
    actividades: count("tareas") + count("parciales") + count("proyectos") + count("labs"),
    material: count("material"),
    conclusion: getConclusionText() ? 1 : 0,
  };
}

function measureCoverText(text, size) {
  if (!coverMeasureContext) {
    coverMeasureContext = document.createElement("canvas").getContext("2d");
  }
  if (!coverMeasureContext) return 0;
  coverMeasureContext.font = `700 ${size}px ${COVER_FONT_FAMILY}`;
  return coverMeasureContext.measureText(text).width;
}

function fitCoverSize(text, field) {
  for (let size = field.initialSize; size >= field.minimumSize; size -= 0.5) {
    if (measureCoverText(text, size) <= field.maxWidth) return size;
  }
  return field.minimumSize;
}

function updateCoverPreview() {
  const student = getStudentData();
  const values = {
    department: student.department.replace(/^departamento\s+de\s+/i, "").toLocaleUpperCase("es-PA"),
    courseName: student.courseName,
    fullName: student.fullName,
    cedula: student.cedula,
    facilitator: student.facilitator,
    year: student.year || "2026",
  };

  COVER_FIELDS.forEach((field) => {
    const node = $(field.id);
    if (!node) return;

    const text = values[field.key] || "";
    if (node.textContent !== text) node.textContent = text;
    node.style.fontSize = `${((fitCoverSize(text, field) / COVER_PAGE_WIDTH) * 100).toFixed(3)}cqw`;
  });
}

function updateStackPreview() {
  const stack = $("portfolio-stack");
  if (!stack) return;

  const counts = getFolderCounts();
  const activeFolders = previewIsCompiling ? [] : STEP_FOLDERS[currentStep] || [];
  const folds = Array.from(stack.querySelectorAll(".fold"));
  let closedZ = 0;

  // En el HTML van de abajo hacia arriba.
  folds.forEach((fold) => {
    const key = fold.dataset.folder;
    const count = counts[key] || 0;
    const badge = fold.querySelector("small");

    fold.classList.toggle("is-filled", count > 0);
    fold.classList.toggle("is-active", activeFolders.includes(key));
    if (badge) badge.textContent = count > 1 ? String(count) : "";

    if (previewIsCompiling) {
      fold.style.setProperty("--z", `${closedZ}px`);
      if (count > 0) closedZ += STACK_CLOSED_STEP;
    } else {
      fold.style.removeProperty("--z");
    }
  });

  // Al armar el ZIP las carpetas bajan una tras otra, de arriba hacia abajo.
  folds
    .slice()
    .reverse()
    .forEach((fold, index) => {
      fold.style.transitionDelay = previewIsCompiling ? `${index * STACK_STAGGER_MS}ms` : "";
    });
  stack.classList.toggle("is-zipped", previewIsCompiling);

  const note = previewIsCompiling
    ? ["Armando el ZIP.", "Un solo archivo, listo para entregar."]
    : STEP_NOTES[currentStep] || STEP_NOTES[1];
  const noteTitle = $("preview-note-title");
  const noteText = $("preview-note-text");
  if (noteTitle) noteTitle.textContent = note[0];
  if (noteText) noteText.textContent = note[1];
}

function updateDossierPreview() {
  updateCoverPreview();
  updateStackPreview();
}

function renderPortfolioPreview() {
  updateDossierPreview();
}

function setPortfolioPreviewCompiling(isCompiling) {
  previewIsCompiling = Boolean(isCompiling);
  renderPortfolioPreview();
}

function waitForPreviewTransition() {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const delay = reducedMotion ? 80 : 760;
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

function downloadZipDirectly(payload) {
  if (!payload?.blob || !payload?.filename) {
    throw new Error("zip_payload_invalid");
  }

  const url = URL.createObjectURL(payload.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = payload.filename || "portafolio_fisc.zip";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// Resumen sin datos personales para la página de descarga.
function saveReceipt(conclusionText) {
  const rows = [{ label: "01_Portada", count: 1 }];

  Object.values(UPLOAD_CONFIG).forEach((config) => {
    const count = getAllUploadEntries().filter((entry) => entry.zipPath.startsWith(config.path)).length;
    if (count > 0) rows.push({ label: config.path.replace(/\/$/, ""), count });
  });
  if (conclusionText) rows.push({ label: "06_Conclusion_Final", count: 1 });

  try {
    window.sessionStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify({ rows }));
  } catch {
    // Sin sessionStorage la descarga solo muestra el nombre y el peso del ZIP.
  }
}

async function deliverGeneratedZip(payload) {
  if (saveGeneratedZipFn) {
    try {
      await saveGeneratedZipFn(payload);
      return "saved";
    } catch (error) {
      console.warn("Falling back to direct ZIP download.", error);
    }
  }

  downloadZipDirectly(payload);
  return "downloaded";
}

function refreshSummary() {
  const student = getStudentData();

  const summary = {
    sumNombre: student.fullName || "-",
    sumCedula: student.cedula || "-",
    sumCurso: student.courseName || "-",
    sumDepto: student.department || "-",
    sumFacil: student.facilitator || "-",
    sumSem: `${student.semester || "-"} · ${student.year || "-"}`,
  };

  Object.entries(summary).forEach(([id, value]) => {
    const node = $(id);
    if (node) {
      node.textContent = value;
    }
  });

  const filesNode = $("sum-files");
  if (filesNode) {
    const parts = [];
    const uploadedCount = getAllUploadEntries().length;
    parts.push(`Archivos cargados: ${uploadedCount}`);

    Object.entries(UPLOAD_CONFIG).forEach(([key, config]) => {
      const count = getUploadEntries(key).length;
      if (count > 0) {
        parts.push(`${config.label}: ${count}`);
      }
    });

    filesNode.textContent = parts.join(" · ");
  }

  const conclusionNode = $("sum-conclusion");
  if (conclusionNode) {
    const conclusionText = getConclusionText();
    if (conclusionText) {
      conclusionNode.textContent = "Incluida";
    } else {
      conclusionNode.textContent = "No incluida";
    }
  }

  renderPortfolioPreview();
}

function updateProgress() {
  const meta = $("wizard-progress-meta");
  const track = document.querySelector(".wizard-progress__track");

  if (meta) {
    meta.textContent = `Paso ${currentStep} de ${TOTAL_STEPS}`;
  }
  if (track) {
    track.setAttribute("aria-valuenow", String(currentStep));
    track.dataset.step = String(currentStep);
  }
}

function updateSidebar() {
  const steps = document.querySelector(".wizard-steps");
  if (steps) {
    steps.dataset.step = String(currentStep);
  }

  for (let step = 1; step <= TOTAL_STEPS; step += 1) {
    const button = $(`wizard-nav-${step}`);
    if (!button) continue;

    button.classList.remove(
      "wizard-step--active",
      "wizard-step--complete",
      "wizard-step--future"
    );

    if (step < currentStep) {
      button.classList.add("wizard-step--complete");
      button.disabled = false;
    } else if (step === currentStep) {
      button.classList.add("wizard-step--active");
      button.disabled = false;
      button.setAttribute("aria-current", "step");
    } else {
      button.classList.add("wizard-step--future");
      button.disabled = true;
    }

    if (step !== currentStep) {
      button.removeAttribute("aria-current");
    }
    if (button.disabled) {
      button.setAttribute("aria-disabled", "true");
    } else {
      button.removeAttribute("aria-disabled");
    }
  }
}

function showPanel(step, direction = 1) {
  const layout = $("generador");
  if (layout) layout.dataset.step = String(step);

  for (let index = 1; index <= TOTAL_STEPS; index += 1) {
    const panel = $(`wizard-panel-${index}`);
    if (!panel) continue;
    panel.hidden = index !== step;
    panel.classList.remove("wizard-panel--enter");
  }

  const panel = $(`wizard-panel-${step}`);
  if (!panel) return;

  // El panel entra desde el lado hacia donde se avanza; la animación vive en CSS.
  panel.style.setProperty("--dir", String(direction));
  void panel.offsetWidth;
  panel.classList.add("wizard-panel--enter");
}

function focusPanelHeading(step) {
  const heading = $(`wizard-h${step}`);
  if (!heading) return;

  try {
    heading.focus({ preventScroll: true });
  } catch {
    heading.focus();
  }
}

function setStep(step) {
  if (step < 1 || step > TOTAL_STEPS) return;
  const direction = step >= currentStep ? 1 : -1;
  currentStep = step;
  showPanel(step, direction);
  updateSidebar();
  updateProgress();
  clearMessage();

  if (step === 5) {
    refreshSummary();
  } else {
    renderPortfolioPreview();
  }

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  focusPanelHeading(step);
}

const STUDENT_FIELD_IDS = ["sf-nombre", "sf-cedula", "sf-curso", "sf-depto", "sf-facilitador", "sf-semestre"];

function getStudentErrors() {
  const student = getStudentData();
  const errors = [];

  if (!student.fullName || student.fullName.length < 3) {
    errors.push({ id: "sf-nombre", note: "Falta tu nombre.", message: "Completa el nombre del estudiante." });
  }
  if (!student.cedula) {
    errors.push({ id: "sf-cedula", note: "Falta la cédula.", message: "Completa la cédula del estudiante." });
  }
  if (!student.courseName || student.courseName.length < 3) {
    errors.push({ id: "sf-curso", note: "Falta el curso.", message: "Completa el nombre del curso." });
  }
  if (!$("sf-depto")?.value) {
    errors.push({ id: "sf-depto", note: "Elige un departamento.", message: "Selecciona un departamento." });
  }
  if (!student.facilitator || student.facilitator.length < 3) {
    errors.push({ id: "sf-facilitador", note: "Falta el facilitador.", message: "Completa el nombre del facilitador." });
  }
  if (!student.semester || !student.year) {
    errors.push({ id: "sf-semestre", note: "Elige el semestre.", message: "Selecciona el semestre y el año." });
  }

  return errors;
}

function setFieldError(id, note) {
  const field = $(id);
  const noteNode = $(`${id}-error`);

  if (field) {
    if (note) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  }
  if (noteNode) {
    noteNode.textContent = note || "";
    noteNode.hidden = !note;
  }
}

function clearFieldError(id) {
  if ($(id)?.getAttribute("aria-invalid") !== "true") return;
  setFieldError(id, "");
  // El aviso general se va cuando ya no queda ningún campo marcado.
  if (!document.querySelector('.wizard-main [aria-invalid="true"]')) clearMessage();
}

function validateStepOne() {
  const errors = getStudentErrors();
  const notes = Object.fromEntries(errors.map((error) => [error.id, error.note]));
  STUDENT_FIELD_IDS.forEach((id) => setFieldError(id, notes[id] || ""));

  if (errors.length === 0) return null;

  if (currentStep === 1) {
    const first = errors[0].id;
    (first === "sf-semestre" ? document.querySelector('input[name="semestre"]') : $(first))?.focus();
  }

  return errors.length === 1
    ? errors[0].message
    : `Faltan ${errors.length} datos. Están marcados en el formulario.`;
}

function validateStepTwo() {
  return null;
}

function validateCurrentStep() {
  if (currentStep === 1) return validateStepOne();
  if (currentStep === 2) return validateStepTwo();
  return null;
}

function getAcceptAttributeForConfig(config) {
  return (config?.allowedExtensions || EVIDENCE_EXTENSIONS)
    .map((extension) => `.${extension}`)
    .join(",");
}

function getEvidenceFileError(file, key) {
  const extension = getFileExtension(file?.name);
  const config = UPLOAD_CONFIG[key];
  const allowedExtensions = new Set(config?.allowedExtensions || EVIDENCE_EXTENSIONS);

  if (!extension) {
    return "Ese archivo no tiene extensión. Renómbralo con su formato antes de subirlo.";
  }

  if (BLOCKED_EXTENSION_SET.has(extension)) {
    return `.${extension} está bloqueado por seguridad. Sube el código fuente, documento o un ZIP del proyecto.`;
  }

  if (!EVIDENCE_EXTENSION_SET.has(extension) || !allowedExtensions.has(extension)) {
    if (config?.formatsLabel) {
      return `Ese archivo no corresponde a ${config.label}. En esta sección usa: ${config.formatsLabel}.`;
    }
    return `Tipo de archivo no permitido. Sube evidencias en formatos comunes: ${EVIDENCE_FORMATS_LABEL}.`;
  }

  return "";
}

function buildUploadEntry(key, file, existingEntries) {
  uploadSequence += 1;
  const zipPath = makeUniqueZipPath(getUploadPath(key, getFileUploadPath(file)), existingEntries);
  return {
    id: `${key}-${uploadSequence}`,
    key,
    file,
    name: file.webkitRelativePath || file.name,
    size: file.size,
    zipPath,
  };
}

function renderUploadUI(key, options = {}) {
  const root = document.querySelector(`[data-upload-key="${key}"]`);
  if (!root) return;

  const config = UPLOAD_CONFIG[key];
  const metaLine = root.querySelector(".upload-zone__meta-line");
  const fileList = root.querySelector(".upload-zone__file-list");
  let formatLine = root.querySelector(".upload-zone__format-line");
  const entries = getUploadEntries(key);
  const incomingIds = new Set(options.incomingEntryIds || []);

  if (metaLine && config) {
    const previousCount = Number(metaLine.dataset.uploadCount || 0);
    const hasRenderedCount = Object.prototype.hasOwnProperty.call(metaLine.dataset, "uploadCount");
    const unit = config.maxFiles === 1 ? "archivo" : "archivos";
    metaLine.textContent = `${entries.length}/${config.maxFiles} ${unit} · Máx. 10MB por archivo`;
    metaLine.dataset.uploadCount = String(entries.length);

    if (
      hasRenderedCount &&
      previousCount !== entries.length &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      metaLine.classList.remove("upload-zone__meta-line--tick");
      window.requestAnimationFrame?.(() => {
        metaLine.classList.add("upload-zone__meta-line--tick");
      });
    }
  }

  if (config?.formatsLabel && metaLine) {
    if (!formatLine) {
      formatLine = document.createElement("p");
      formatLine.className = "upload-zone__format-line";
      metaLine.insertAdjacentElement("afterend", formatLine);
    }
    formatLine.textContent = `Formatos: ${config.formatsLabel}.`;
  }

  if (fileList) {
    if (entries.length === 0) {
      fileList.hidden = true;
      fileList.innerHTML = "";
    } else {
      fileList.hidden = false;
      fileList.innerHTML = entries
        .map((entry) => {
          const itemClass = incomingIds.has(entry.id)
            ? "upload-zone__file-item upload-zone__file-item--new"
            : "upload-zone__file-item";
          const name = escapeHtml(entry.name);
          return `<li class="${itemClass}"><span>${name}</span> <span>${formatBytes(entry.size)}</span> <button type="button" data-upload-remove="${entry.id}" aria-label="Quitar ${name}">×</button></li>`;
        })
        .join("");
    }
  }

  root.classList.toggle("upload-zone--filled", entries.length > 0);
}

function addFilesToUpload(key, files) {
  const config = UPLOAD_CONFIG[key];
  if (!config || files.length === 0) return;

  const currentEntries = getUploadEntries(key);
  const nextEntries = [...currentEntries];
  const addedEntries = [];
  let nextTotalSize = getTotalUploadSize();
  let feedbackMessage = "";

  for (const file of files) {
    const fileError = getEvidenceFileError(file, key);
    if (fileError) {
      feedbackMessage = fileError;
      continue;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      feedbackMessage = `Cada archivo en ${config.label} debe pesar máximo 10MB.`;
      continue;
    }

    if (nextTotalSize + file.size > MAX_TOTAL_UPLOAD_SIZE_BYTES) {
      feedbackMessage = `El paquete completo no debe superar ${formatBytes(MAX_TOTAL_UPLOAD_SIZE_BYTES)}.`;
      continue;
    }

    if (nextEntries.length >= config.maxFiles) {
      feedbackMessage = `${config.label} permite hasta ${config.maxFiles} archivos.`;
      break;
    }

    const entry = buildUploadEntry(key, file, nextEntries);
    nextEntries.push(entry);
    addedEntries.push(entry);
    nextTotalSize += file.size;
  }

  if (nextEntries.length > 0) {
    uploads[key] = nextEntries;
  } else {
    delete uploads[key];
  }

  renderUploadUI(key, {
    incomingEntryIds: addedEntries.map((entry) => entry.id),
  });
  refreshSummary();

  if (feedbackMessage) {
    showMessage(feedbackMessage, "error");
  } else {
    clearMessage();
  }
}

function removeUploadEntry(key, entryId) {
  const nextEntries = getUploadEntries(key).filter((entry) => entry.id !== entryId);
  if (nextEntries.length > 0) {
    uploads[key] = nextEntries;
  } else {
    delete uploads[key];
  }

  renderUploadUI(key);
  refreshSummary();
  clearMessage();
}

function bindUploadZone(root) {
  const key = root.getAttribute("data-upload-key");
  const input = root.querySelector(".upload-zone__input");
  const addButton = root.querySelector(".upload-zone__add");
  const fileList = root.querySelector(".upload-zone__file-list");

  if (!key || !input) return;

  const config = UPLOAD_CONFIG[key];
  input.accept = getAcceptAttributeForConfig(config);
  let folderInput = null;
  let folderButton = null;

  if (config?.allowFolders && "webkitdirectory" in document.createElement("input")) {
    folderInput = document.createElement("input");
    folderInput.type = "file";
    folderInput.hidden = true;
    folderInput.multiple = true;
    folderInput.setAttribute("webkitdirectory", "");
    folderInput.setAttribute("directory", "");
    folderInput.accept = getAcceptAttributeForConfig(config);
    folderInput.className = "upload-zone__directory-input";
    folderInput.setAttribute("aria-label", `${config.label}, carpeta de evidencias`);

    folderButton = document.createElement("button");
    folderButton.type = "button";
    folderButton.className = "btn upload-zone__add-folder";
    folderButton.textContent = "Añadir carpeta";

    const actions = document.createElement("div");
    actions.className = "upload-zone__actions";
    if (addButton) {
      addButton.insertAdjacentElement("beforebegin", actions);
      actions.append(addButton, folderButton);
    } else {
      root.append(actions);
      actions.append(folderButton);
    }
    root.append(folderInput);
  }

  if (addButton) {
    addButton.addEventListener("click", () => {
      input.click();
    });
  }

  if (folderButton && folderInput) {
    folderButton.addEventListener("click", () => {
      folderInput.click();
    });

    folderInput.addEventListener("change", () => {
      addFilesToUpload(key, Array.from(folderInput.files || []));
      folderInput.value = "";
    });
  }

  root.addEventListener("dragover", (event) => {
    event.preventDefault();
    root.classList.add("upload-zone--drag");
  });

  root.addEventListener("dragleave", () => {
    root.classList.remove("upload-zone--drag");
  });

  root.addEventListener("drop", (event) => {
    event.preventDefault();
    root.classList.remove("upload-zone--drag");
    addFilesToUpload(key, Array.from(event.dataTransfer?.files || []));
    input.value = "";
  });

  input.addEventListener("change", () => {
    addFilesToUpload(key, Array.from(input.files || []));
    input.value = "";
  });

  if (fileList) {
    fileList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-upload-remove]");
      if (!button) return;
      event.preventDefault();
      removeUploadEntry(key, button.getAttribute("data-upload-remove"));
    });
  }

  renderUploadUI(key);
}

function bindNavigation() {
  document.querySelectorAll("[data-wizard-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const error = validateCurrentStep();
      if (error) {
        showMessage(error, "error");
        return;
      }

      setStep(currentStep + 1);
    });
  });

  document.querySelectorAll("[data-wizard-prev]").forEach((button) => {
    button.addEventListener("click", () => {
      setStep(currentStep - 1);
    });
  });

  for (let step = 1; step <= TOTAL_STEPS; step += 1) {
    const nav = $(`wizard-nav-${step}`);
    if (!nav) continue;

    nav.addEventListener("click", () => {
      if (step > currentStep) {
        const error = validateCurrentStep();
        if (error) {
          showMessage(error, "error");
          return;
        }
      }

      setStep(step);
    });
  }
}

function bindConclusionUi() {
  const conclusionText = $("conclusionFinal");
  const counter = $("conclusion-count");
  if (!conclusionText) return;

  conclusionText.addEventListener("input", () => {
    if (counter) {
      counter.textContent = `${conclusionText.value.length} / ${MAX_CONCLUSION_LENGTH}`;
    }
    refreshSummary();
  });
}

async function handleGenerate() {
  if (getStudentErrors().length > 0) {
    // Los datos viven en el paso 1: se vuelve ahí para mostrar qué falta.
    if (currentStep !== 1) setStep(1);
    showMessage(validateStepOne(), "error");
    return;
  }

  const button = $("btn-generar-portafolio");
  const idle = $("wizard-step5-idle");
  const loading = $("wizard-step5-loading");

  if (button) {
    button.disabled = true;
    button.textContent = "Generando...";
  }
  if (idle) idle.hidden = true;
  if (loading) loading.hidden = false;
  clearMessage();
  setPortfolioPreviewCompiling(true);

  try {
    if (!generatePortadaFn || !buildZipFn) {
      throw new Error("generator_scripts_unavailable");
    }

    const student = getStudentData();
    const files = getAllUploadEntries().map((entry) => ({
      file: entry.file,
      zipPath: entry.zipPath,
    }));
    const conclusionText = getConclusionText() || null;
    const portadaResult = await generatePortadaFn({ student });
    const zipResult = await buildZipFn({
      student,
      files,
      conclusionText,
      portadaResult,
    });

    if (!zipResult?.blob) {
      throw new Error("zip_not_created");
    }

    saveReceipt(conclusionText);
    const deliveryMode = await deliverGeneratedZip(zipResult);
    await waitForPreviewTransition();

    if (deliveryMode === "saved") {
      leavingForDownload = true;
      window.location.href = "descarga.html";
      return;
    }

    setPortfolioPreviewCompiling(false);
    showMessage("ZIP generado. Si la descarga no empezó, revisa las descargas del navegador.", "success");
    if (idle) idle.hidden = false;
    if (loading) loading.hidden = true;
    if (button) {
      button.disabled = false;
      button.textContent = "Generar portafolio";
    }
  } catch (error) {
    console.error("No se pudo generar el portafolio.", error);
    setPortfolioPreviewCompiling(false);
    showMessage(
      "No se pudo generar el portafolio. Revisa tus datos y vuelve a intentar.",
      "error"
    );
    if (idle) idle.hidden = false;
    if (loading) loading.hidden = true;
    if (button) {
      button.disabled = false;
      button.textContent = "Generar portafolio";
    }
  }
}

function bindGenerateButton() {
  const button = $("btn-generar-portafolio");
  if (!button) return;

  button.addEventListener("click", () => {
    handleGenerate();
  });
}

function bindDossierPreviewInputs() {
  ["sf-nombre", "sf-cedula", "sf-curso", "sf-facilitador", "sf-anio", "sf-depto"].forEach((id) => {
    const field = $(id);
    if (!field) return;
    const onChange = () => {
      clearFieldError(id);
      updateDossierPreview();
    };
    field.addEventListener("input", onChange);
    field.addEventListener("change", onChange);
  });

  document.querySelectorAll('input[name="semestre"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      clearFieldError("sf-semestre");
      updateDossierPreview();
    });
  });
}

function hasUnsavedWork() {
  const student = getStudentData();
  return Boolean(
    getAllUploadEntries().length ||
      getConclusionText() ||
      student.fullName ||
      student.cedula ||
      student.courseName ||
      student.facilitator
  );
}

function bindPageGuards() {
  // Un archivo soltado fuera de una zona no debe abrirse en la pestaña y borrar el trabajo.
  ["dragover", "drop"].forEach((type) => {
    window.addEventListener(type, (event) => {
      if (!event.defaultPrevented) event.preventDefault();
    });
  });

  window.addEventListener("beforeunload", (event) => {
    if (leavingForDownload || !hasUnsavedWork()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  const yearField = $("sf-anio");
  if (yearField) {
    yearField.value = "2026";
  }

  document.querySelectorAll("[data-upload-key]").forEach(bindUploadZone);
  bindNavigation();
  bindConclusionUi();
  bindGenerateButton();
  bindDossierPreviewInputs();
  bindPageGuards();
  refreshSummary();
  updateSidebar();
  updateProgress();
  showPanel(1);
  // Vuelve a medir la portada cuando carga su fuente.
  document.fonts?.load?.(`700 17px ${COVER_FONT_FAMILY}`).then(updateCoverPreview, () => {});
  document.body.dataset.appReady = "true";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}



