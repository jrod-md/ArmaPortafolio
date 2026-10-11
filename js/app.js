const generatePortadaFn = globalThis.PortafolioFiscGenerate?.generatePortada;
const buildZipFn = globalThis.PortafolioFiscZip?.buildZip;
const saveGeneratedZipFn = globalThis.PortafolioFiscZip?.saveGeneratedZip;

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

const RECEIPT_STORAGE_KEY = "armaportafolio-recibo";
const STUDENT_FIELD_IDS = ["sf-nombre", "sf-cedula", "sf-curso", "sf-facilitador", "sf-depto", "sf-semestre", "sf-anio"];
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
const CLIP_ICON =
  '<svg class="slip__clip" viewBox="0 0 18 40" aria-hidden="true"><path d="M5 12v18a4 4 0 0 0 8 0V8a3 3 0 0 0-6 0v20a1.5 1.5 0 0 0 3 0V12"/></svg>';

let uploadSequence = 0;
let appInitialized = false;
let isGenerating = false;
let leavingForDownload = false;
let coverMeasureContext = null;

const uploads = {};

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function showMessage(message, type = "error") {
  const node = $("desk-message");
  if (!node) return;
  node.hidden = false;
  node.textContent = message;
  node.dataset.type = type;
  node.setAttribute("role", type === "error" ? "alert" : "status");
}

function clearMessage() {
  const node = $("desk-message");
  if (!node) return;
  node.hidden = true;
  node.textContent = "";
  node.dataset.type = "";
  node.removeAttribute("role");
}

function getSemesterValue() {
  return (document.querySelector('input[name="semestre"]:checked')?.value || "").trim();
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
    semester: getSemesterValue(),
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

/* ---------- Carpeta: pestañas ---------- */

function getTabs() {
  return Array.from(document.querySelectorAll("#portfolio-folder [role='tab']"));
}

function selectTab(key, options = {}) {
  const tabs = getTabs();
  const target = tabs.find((tab) => tab.dataset.tab === key);
  if (!target) return;

  tabs.forEach((tab) => {
    const active = tab === target;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    const sheet = $(tab.getAttribute("aria-controls"));
    if (sheet) sheet.hidden = !active;
  });

  if (options.focus) {
    target.focus();
  }
}

function bindTabs() {
  const tabs = getTabs();

  tabs.forEach((tab, index) => {
    const key = tab.dataset.tab;

    tab.addEventListener("click", () => selectTab(key));

    tab.addEventListener("keydown", (event) => {
      let nextIndex = -1;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex < 0) return;

      event.preventDefault();
      selectTab(tabs[nextIndex].dataset.tab, { focus: true });
    });

    if (!UPLOAD_CONFIG[key]) return;

    // Arrastrar archivos sobre una pestaña abre esa sección y los guarda ahí.
    tab.addEventListener("dragover", (event) => {
      event.preventDefault();
      tab.classList.add("is-drag");
      selectTab(key);
    });
    tab.addEventListener("dragleave", () => tab.classList.remove("is-drag"));
    tab.addEventListener("drop", (event) => {
      event.preventDefault();
      tab.classList.remove("is-drag");
      addFilesToUpload(key, Array.from(event.dataTransfer?.files || []));
    });
  });
}

function setSealed(isSealed) {
  const folder = $("portfolio-folder");
  if (!folder) return;

  if (isSealed) {
    // Reinicia la animación si ya estaba sellada.
    folder.classList.remove("is-sealed");
    void folder.offsetWidth;
  }
  folder.classList.toggle("is-sealed", isSealed);
}

/* ---------- Portada en vivo ---------- */

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

function getCoverValues(student = getStudentData()) {
  return {
    department: student.department.replace(/^departamento\s+de\s+/i, "").toLocaleUpperCase("es-PA"),
    courseName: student.courseName,
    fullName: student.fullName,
    cedula: student.cedula,
    facilitator: student.facilitator,
    year: student.year || "2026",
  };
}

function updateCoverPreview() {
  const values = getCoverValues();

  COVER_FIELDS.forEach((field) => {
    const node = $(field.id);
    if (!node) return;

    const text = values[field.key] || "";
    node.textContent = text;
    node.style.fontSize = `${((fitCoverSize(text, field) / COVER_PAGE_WIDTH) * 100).toFixed(3)}cqw`;
  });
}

/* ---------- Estado de la carpeta ---------- */

function updateFolderStatus() {
  const entries = getAllUploadEntries();
  const conclusionText = getConclusionText();

  Object.keys(UPLOAD_CONFIG).forEach((key) => {
    const count = getUploadEntries(key).length;
    const tab = $(`tab-${key}`);
    const badge = tab?.querySelector(".tab__count");
    if (badge) badge.textContent = count > 0 ? String(count) : "";
    if (tab) {
      const label = UPLOAD_CONFIG[key].label;
      tab.setAttribute("aria-label", count > 0 ? `${label}, ${count} ${count === 1 ? "archivo" : "archivos"}` : label);
    }
  });

  const conclusionBadge = $("tab-conclusion")?.querySelector(".tab__count");
  if (conclusionBadge) conclusionBadge.textContent = conclusionText ? "✓" : "";

  const counter = $("conclusion-count");
  if (counter) {
    counter.textContent = `${($("conclusionFinal")?.value || "").length} / ${MAX_CONCLUSION_LENGTH}`;
  }

  const tally = $("folder-tally");
  if (tally) {
    const parts = [];
    if (entries.length > 0) {
      parts.push(
        `${entries.length} ${entries.length === 1 ? "evidencia" : "evidencias"} · ${formatBytes(getTotalUploadSize(entries))} de ${formatBytes(MAX_TOTAL_UPLOAD_SIZE_BYTES)}`
      );
    }
    if (conclusionText) parts.push("conclusión incluida");
    const nextText = parts.length > 0 ? `${parts.join(" · ")}.` : "Carpeta vacía por ahora.";
    if (tally.textContent !== nextText) tally.textContent = nextText;
  }
}

function handleWorkChanged() {
  if (isGenerating) return;
  setSealed(false);
  updateCoverPreview();
  updateFolderStatus();
}

/* ---------- Validación de la ficha ---------- */

function validateStudent() {
  const student = getStudentData();
  const errors = [];

  if (!student.fullName || student.fullName.length < 3) {
    errors.push({ id: "sf-nombre", message: "falta tu nombre" });
  }
  if (!student.cedula) {
    errors.push({ id: "sf-cedula", message: "falta la cédula" });
  }
  if (!student.courseName || student.courseName.length < 3) {
    errors.push({ id: "sf-curso", message: "falta el curso" });
  }
  if (!student.facilitator || student.facilitator.length < 3) {
    errors.push({ id: "sf-facilitador", message: "falta el facilitador" });
  }
  if (!$("sf-depto")?.value) {
    errors.push({ id: "sf-depto", message: "elige el departamento" });
  }
  if (!student.semester || !student.year) {
    errors.push({ id: "sf-semestre", message: "encierra el semestre" });
  }

  return errors;
}

function setFieldError(id, message) {
  const field = $(id);
  const note = $(`${id}-error`);

  if (field) {
    if (message) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  }
  if (note) {
    note.textContent = message || "";
    note.hidden = !message;
  }
}

function showFieldErrors(errors) {
  const byId = Object.fromEntries(errors.map((error) => [error.id, error.message]));
  STUDENT_FIELD_IDS.forEach((id) => setFieldError(id, byId[id] || ""));
}

function focusField(id) {
  const field = id === "sf-semestre" ? document.querySelector('input[name="semestre"]') : $(id);
  field?.focus();
}

function bindStudentFields() {
  ["sf-nombre", "sf-cedula", "sf-curso", "sf-facilitador", "sf-depto", "sf-anio"].forEach((id) => {
    const field = $(id);
    if (!field) return;

    const onChange = () => {
      setFieldError(id, "");
      handleWorkChanged();
    };
    field.addEventListener("input", onChange);
    field.addEventListener("change", onChange);
  });

  document.querySelectorAll('input[name="semestre"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      setFieldError("sf-semestre", "");
      handleWorkChanged();
    });
  });
}

function bindConclusionUi() {
  const conclusionText = $("conclusionFinal");
  if (!conclusionText) return;
  conclusionText.addEventListener("input", handleWorkChanged);
}

/* ---------- Evidencias ---------- */

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
    // Inclinación fija por archivo: cada papelito queda un poco torcido, siempre igual.
    tilt: ((uploadSequence * 37) % 25) / 10 - 1.2,
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
        .map((entry) => {
          const itemClass = incomingIds.has(entry.id) ? "slip slip--new" : "slip";
          const name = escapeHtml(entry.name);
          return `<li class="${itemClass}">${CLIP_ICON}<span class="slip__name">${name}</span><span class="slip__size">${formatBytes(entry.size)}</span><button type="button" class="slip__remove" data-upload-remove="${entry.id}" aria-label="Quitar ${name}">×</button></li>`;
        })
        .join("");

      Array.from(fileList.children).forEach((item, index) => {
        item.style.setProperty("--tilt", `${entries[index].tilt.toFixed(2)}deg`);
      });
    }
  }

  root.classList.toggle("upload-zone--filled", entries.length > 0);
}

function addFilesToUpload(key, files) {
  const config = UPLOAD_CONFIG[key];
  if (!config || files.length === 0 || isGenerating) return;

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
      feedbackMessage =
        config.maxFiles === 1
          ? `${config.label} permite un solo archivo. Quita el actual para cambiarlo.`
          : `${config.label} permite hasta ${config.maxFiles} archivos.`;
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
  handleWorkChanged();

  if (feedbackMessage) {
    showMessage(feedbackMessage, "error");
  } else {
    clearMessage();
  }
}

function removeUploadEntry(key, entryId) {
  if (isGenerating) return;

  const nextEntries = getUploadEntries(key).filter((entry) => entry.id !== entryId);
  if (nextEntries.length > 0) {
    uploads[key] = nextEntries;
  } else {
    delete uploads[key];
  }

  renderUploadUI(key);
  handleWorkChanged();
  clearMessage();
  document.querySelector(`[data-upload-key="${key}"] .upload-zone__add`)?.focus();
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
    folderButton.className = "paper-btn upload-zone__add-folder";
    folderButton.textContent = "Elegir carpeta";

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

/* ---------- Generar ---------- */

function waitForStamp() {
  const delay = prefersReducedMotion() ? 80 : 900;
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

// Resumen sin datos personales para el recibo de la página de descarga.
function saveReceipt(conclusionText) {
  const rows = [{ label: "01_Portada", count: 1 }];

  Object.entries(UPLOAD_CONFIG).forEach(([key, config]) => {
    const count = getUploadEntries(key).length;
    if (count > 0) rows.push({ label: config.path.replace(/\/$/, ""), count });
  });
  if (conclusionText) rows.push({ label: "06_Conclusion_Final", count: 1 });

  try {
    window.sessionStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify({ rows }));
  } catch {
    // Sin sessionStorage el recibo solo muestra el nombre y el peso del ZIP.
  }
}

function setGenerating(nextValue) {
  isGenerating = nextValue;
  const button = $("btn-generar-portafolio");
  if (button) {
    button.disabled = nextValue;
    button.textContent = nextValue ? "Armando…" : "Sellar y armar";
  }
  $("portfolio-folder")?.setAttribute("aria-busy", String(nextValue));
}

async function handleGenerate() {
  if (isGenerating) return;

  const errors = validateStudent();
  showFieldErrors(errors);
  if (errors.length > 0) {
    showMessage(
      errors.length === 1
        ? "Falta un dato en la ficha. Está marcado en rojo."
        : `Faltan ${errors.length} datos en la ficha. Están marcados en rojo.`,
      "error"
    );
    focusField(errors[0].id);
    return;
  }

  clearMessage();
  setGenerating(true);

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
    selectTab("portada");
    setSealed(true);
    await waitForStamp();

    if (deliveryMode === "saved") {
      leavingForDownload = true;
      window.location.href = "descarga.html";
      return;
    }

    setGenerating(false);
    showMessage("ZIP generado. Si la descarga no empezó, revisa las descargas del navegador.", "success");
  } catch (error) {
    console.error("No se pudo generar el portafolio.", error);
    setGenerating(false);
    setSealed(false);
    showMessage(
      "No se pudo generar el portafolio. Revisa tus datos y vuelve a intentar.",
      "error"
    );
  }
}

function bindGenerateButton() {
  const button = $("btn-generar-portafolio");
  if (!button) return;

  button.addEventListener("click", () => {
    handleGenerate();
  });
}

function bindPageGuards() {
  // Un archivo soltado fuera de la carpeta no debe abrirse en la pestaña y borrar el trabajo.
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
  bindTabs();
  bindStudentFields();
  bindConclusionUi();
  bindGenerateButton();
  bindPageGuards();
  updateCoverPreview();
  updateFolderStatus();
  // Vuelve a medir cuando carga la fuente de la portada.
  document.fonts?.load?.(`700 17px ${COVER_FONT_FAMILY}`).then(updateCoverPreview, () => {});
  document.body.dataset.appReady = "true";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}
