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
let previewActiveSection = "portada";
let previewIsCompiling = false;
let appInitialized = false;

const uploads = {};

const PREVIEW_SECTIONS = [
  {
    id: "portada",
    label: "01_Portada",
    empty: "Portada preparada",
    copy: "La portada oficial queda preparada desde los datos del estudiante.",
  },
  {
    id: "asignaciones",
    label: "02_Asignaciones",
    empty: "Sin evidencias todavía",
    copy: "Cada archivo entra en la carpeta correcta.",
  },
  {
    id: "parciales",
    label: "03_Parciales",
    empty: "Sin parciales todavía",
    copy: "Los parciales se agrupan sin mezclar el resto de evidencias.",
  },
  {
    id: "laboratorios",
    label: "04_Laboratorios",
    empty: "Sin laboratorios todavía",
    copy: "Los laboratorios y talleres quedan archivados como una sección propia.",
  },
  {
    id: "proyectos",
    label: "05_Proyectos",
    empty: "Sin proyectos todavía",
    copy: "Los proyectos se guardan aparte para revisar la estructura final.",
  },
  {
    id: "conclusion",
    label: "06_Conclusión",
    empty: "Conclusión opcional",
    copy: "La conclusión se añade solo si decides incluirla.",
  },
];

const PREVIEW_UPLOAD_SECTIONS = {
  planContenido: "asignaciones",
  tareas: "asignaciones",
  material: "asignaciones",
  parciales: "parciales",
  labs: "laboratorios",
  proyectos: "proyectos",
};

const PREVIEW_STEP_SECTIONS = {
  1: "portada",
  2: "asignaciones",
  3: "asignaciones",
  4: "conclusion",
};

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
    semester: ($("sf-semestre")?.value || "").trim(),
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

function getPreviewSectionConfig(sectionId) {
  return PREVIEW_SECTIONS.find((section) => section.id === sectionId) || PREVIEW_SECTIONS[0];
}

function getPreviewSectionForUploadKey(key) {
  return PREVIEW_UPLOAD_SECTIONS[key] || "asignaciones";
}

function getPreviewData() {
  const sections = PREVIEW_SECTIONS.map((section) => ({
    ...section,
    entries: [],
  }));
  const sectionMap = Object.fromEntries(sections.map((section) => [section.id, section]));

  sectionMap.portada.entries.push({
    id: "preview-portada-generated",
    name: "Portada_Oficial.pdf",
    sectionId: "portada",
    sectionLabel: "01_Portada",
  });

  Object.entries(uploads).forEach(([key, entries]) => {
    const sectionId = getPreviewSectionForUploadKey(key);
    const section = sectionMap[sectionId];
    if (!section) return;

    entries.forEach((entry) => {
      section.entries.push({
        id: entry.id,
        name: sanitizeFileName(entry.name),
        sectionId,
        sectionLabel: section.label,
      });
    });
  });

  if (getConclusionText()) {
    sectionMap.conclusion.entries.push({
      id: "preview-conclusion-final",
      name: "conclusion_final.txt",
      sectionId: "conclusion",
      sectionLabel: "06_Conclusión",
    });
  }

  return sections;
}

function getMostRelevantPreviewSection(sections = getPreviewData()) {
  const activeSection = sections.find((section) => section.id === previewActiveSection);
  if (activeSection?.entries.length) {
    return activeSection.id;
  }

  for (let index = sections.length - 1; index >= 0; index -= 1) {
    if (sections[index].entries.length > 0) {
      return sections[index].id;
    }
  }

  return "portada";
}

function previewText(value) {
  const text = String(value || "").trim();
  return text || "—";
}

function setPreviewText(id, value) {
  const node = $(id);
  if (!node) return;

  const nextValue = previewText(value);
  if (node.textContent === nextValue) return;

  node.textContent = nextValue;

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  node.classList.remove("vertical-dossier__value--updated");
  window.requestAnimationFrame?.(() => {
    node.classList.add("vertical-dossier__value--updated");
  });
}

function syncPreviewSectionToStep() {
  if (currentStep === 5) {
    previewActiveSection = getMostRelevantPreviewSection();
    return;
  }

  previewActiveSection = PREVIEW_STEP_SECTIONS[currentStep] || previewActiveSection || "portada";
}

function updateDossierPreview(options = {}) {
  const root = $("portfolio-live-preview");
  if (!root) return;

  const sections = getPreviewData();
  const student = getStudentData();
  const isFinalStep = currentStep === 5;
  const requestedSection = options.activeSection || options.incomingSection;

  if (sections.some((section) => section.id === requestedSection)) {
    previewActiveSection = requestedSection;
  }

  const activeSection = previewActiveSection || getMostRelevantPreviewSection(sections);
  const subtitleParts = ["FISC", "UTP", student.year].filter(Boolean);
  const completedCount = sections.filter((section) => section.entries.length > 0).length;

  root.dataset.activeSection = activeSection;
  root.dataset.completedSections = String(completedCount);

  setPreviewText("preview-dossier-title", student.courseName || "Portafolio Digital");
  setPreviewText("preview-dossier-subtitle", subtitleParts.join(" · "));
  setPreviewText("preview-meta-nombre", student.fullName);
  setPreviewText("preview-meta-cedula", student.cedula);
  setPreviewText("preview-meta-curso", student.courseName);
  setPreviewText("preview-meta-facilitador", student.facilitator);
  setPreviewText("preview-meta-departamento", student.department);
  setPreviewText("preview-meta-semestre", student.semester);
  setPreviewText("preview-meta-anio", student.year);

  const stamp = $("preview-ready-stamp");
  const showReadyStamp = previewIsCompiling || isFinalStep;
  if (stamp) {
    stamp.style.opacity = showReadyStamp ? "1" : "0";
    stamp.style.transform = showReadyStamp ? "rotate(-15deg) scale(1)" : "rotate(-15deg) scale(1.4)";
  }
}

function renderPortfolioPreview(options = {}) {
  updateDossierPreview(options);
}

function setPortfolioPreviewCompiling(isCompiling) {
  previewIsCompiling = Boolean(isCompiling);
  renderPortfolioPreview();
}

function waitForPreviewTransition() {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const delay = reducedMotion ? 80 : 520;
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

function showPanel(step) {
  for (let index = 1; index <= TOTAL_STEPS; index += 1) {
    const panel = $(`wizard-panel-${index}`);
    if (!panel) continue;
    panel.hidden = index !== step;
  }
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
  currentStep = step;
  showPanel(step);
  updateSidebar();
  updateProgress();
  clearMessage();
  syncPreviewSectionToStep();

  if (step === 5) {
    refreshSummary();
  } else {
    renderPortfolioPreview();
  }

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  focusPanelHeading(step);
}

function validateStepOne() {
  const student = getStudentData();

  if (!student.fullName || student.fullName.length < 3) {
    return "Completa el nombre del estudiante.";
  }
  if (!student.cedula) {
    return "Completa la cédula del estudiante.";
  }
  if (!student.courseName || student.courseName.length < 3) {
    return "Completa el nombre del curso.";
  }
  if (!$("sf-depto")?.value) {
    return "Selecciona un departamento.";
  }
  if (!student.facilitator || student.facilitator.length < 3) {
    return "Completa el nombre del facilitador.";
  }
  if (!student.semester || !student.year) {
    return "Selecciona el semestre y el anio.";
  }

  return null;
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

function renderUploadUI(key) {
  const root = document.querySelector(`[data-upload-key="${key}"]`);
  if (!root) return;

  const config = UPLOAD_CONFIG[key];
  const metaLine = root.querySelector(".upload-zone__meta-line");
  const fileList = root.querySelector(".upload-zone__file-list");
  let formatLine = root.querySelector(".upload-zone__format-line");
  const entries = getUploadEntries(key);

  if (metaLine && config) {
    const unit = config.maxFiles === 1 ? "archivo" : "archivos";
    metaLine.textContent = `${entries.length}/${config.maxFiles} ${unit} · Máx. 10MB por archivo`;
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
        .map(
          (entry) =>
            `<li><span>${escapeHtml(entry.name)}</span> <span>${formatBytes(entry.size)}</span> <button type="button" data-upload-remove="${entry.id}">Quitar</button></li>`
        )
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

  renderUploadUI(key);
  refreshSummary();

  if (addedEntries.length > 0) {
    const incomingSection = getPreviewSectionForUploadKey(key);
    previewActiveSection = incomingSection;
    renderPortfolioPreview({
      activeSection: incomingSection,
      incomingSection,
      incomingEntryIds: addedEntries.map((entry) => entry.id),
    });
  }

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
    folderButton.className = "btn btn--outline btn--sm upload-zone__add-folder";
    folderButton.textContent = "+ Añadir carpeta";

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

  if (conclusionText) {
    conclusionText.addEventListener("input", () => {
      previewActiveSection = "conclusion";
      refreshSummary();
    });
  }
}

async function handleGenerate() {
  const error = validateStepOne() || validateStepTwo();
  if (error) {
    showMessage(error, "error");
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

    const deliveryMode = await deliverGeneratedZip(zipResult);
    await waitForPreviewTransition();

    if (deliveryMode === "saved") {
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
  [
    "sf-nombre",
    "sf-cedula",
    "sf-curso",
    "sf-facilitador",
    "sf-semestre",
    "sf-anio",
    "sf-depto",
  ].forEach((id) => {
    const field = $(id);
    if (!field) return;
    field.addEventListener("input", () => updateDossierPreview());
    field.addEventListener("change", () => updateDossierPreview());
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
  refreshSummary();
  updateSidebar();
  updateProgress();
  showPanel(1);
  document.body.dataset.appReady = "true";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}



