const generatePortadaFn = globalThis.PortafolioFiscGenerate?.generatePortada;
const buildZipFn = globalThis.PortafolioFiscZip?.buildZip;
const saveGeneratedZipFn = globalThis.PortafolioFiscZip?.saveGeneratedZip;

const TOTAL_STEPS = 5;
const MAX_FULL_NAME_LENGTH = 80;
const MAX_COURSE_NAME_LENGTH = 80;
const MAX_FACILITATOR_LENGTH = 80;
const MAX_CONCLUSION_LENGTH = 2000;
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const AI_CONCLUSION_ENABLED = false;
const UPLOAD_CONFIG = {
  planContenido: {
    label: "Plan de Contenido",
    path: "02_Descripcion_Curso/",
    maxFiles: 1,
  },
  tareas: {
    label: "Tareas",
    path: "04_Actividades/Tareas/",
    maxFiles: 16,
  },
  parciales: {
    label: "Parciales",
    path: "04_Actividades/Parciales/",
    maxFiles: 6,
  },
  proyectos: {
    label: "Proyectos",
    path: "04_Actividades/Proyectos/",
    maxFiles: 6,
  },
  labs: {
    label: "Laboratorios y talleres",
    path: "04_Actividades/Laboratorios_Talleres/",
    maxFiles: 20,
  },
  material: {
    label: "Material didáctico",
    path: "05_Material_Didactico/",
    maxFiles: 16,
  },
};

let currentStep = 1;
let uploadSequence = 0;
let previewActiveSection = "portada";
let previewIsCompiling = false;
let previewChipTimeout = null;

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
  return `${UPLOAD_CONFIG[key]?.path || "99_Adjuntos/"}${sanitizeFileName(fileName)}`;
}

function sanitizeFileName(fileName) {
  const rawName = String(fileName || "archivo.pdf")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  const lastDot = rawName.lastIndexOf(".");
  const hasPdfExtension = /\.pdf$/i.test(rawName);
  const baseName = (hasPdfExtension ? rawName.slice(0, lastDot) : rawName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 96);

  return `${baseName || "archivo"}.pdf`;
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
}

function clearMessage() {
  const node = getMessageNode();
  if (!node) return;
  node.hidden = true;
  node.textContent = "";
  node.dataset.type = "";
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

function countFilesLabel(count) {
  return count === 1 ? "1 archivo" : `${count} archivos`;
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

function showDossierUploadChip(sectionId, addedCount) {
  if (!addedCount || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  const chip = $("preview-upload-chip");
  const tab = document.querySelector(`[data-preview-tab="${sectionId}"]`);
  const root = $("portfolio-live-preview");
  if (!chip || !tab || !root) return;

  const rootBox = root.getBoundingClientRect();
  const tabBox = tab.getBoundingClientRect();
  const chipY = Math.round(tabBox.top - rootBox.top + tabBox.height / 2);

  chip.textContent = `+${addedCount} PDF${addedCount === 1 ? "" : "s"}`;
  chip.style.setProperty("--chip-y", String(chipY));
  chip.classList.add("vertical-dossier__upload-chip--visible");

  window.clearTimeout(previewChipTimeout);
  previewChipTimeout = window.setTimeout(() => {
    chip.classList.remove("vertical-dossier__upload-chip--visible");
  }, 850);
}

function sectionStatusText(section, count) {
  if (!section) return "Cada archivo entra en la carpeta correcta.";
  if (section.id === "portada") return "Portada: 1 archivo preparado.";
  if (count === 0) return `${section.label.replace(/^\d+_/, "")}: sin archivos agregados.`;
  const suffix = count === 1 ? "agregado" : "agregados";
  return `${section.label.replace(/^\d+_/, "")}: ${countFilesLabel(count)} ${suffix}.`;
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
  const activeConfig = getPreviewSectionConfig(activeSection);
  const activeSectionData = sections.find((section) => section.id === activeSection);
  const activeCount = activeSectionData?.entries.length || 0;
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

  sections.forEach((section) => {
    const count = section.entries.length;
    const countNode = document.querySelector(`[data-preview-count="${section.id}"]`);
    if (countNode) {
      countNode.textContent = String(count);
      countNode.setAttribute("aria-label", countFilesLabel(count));
    }

    const tabEl = document.querySelector(`[data-preview-tab="${section.id}"]`);
    if (tabEl) {
      const isActive = section.id === activeSection;
      const isCompleted = count > 0;
      tabEl.classList.toggle("vertical-dossier__tab--active", isActive);
      tabEl.classList.toggle("vertical-dossier__tab--completed", isCompleted);
      tabEl.setAttribute("aria-current", isActive ? "step" : "false");
      tabEl.setAttribute("aria-label", `${section.label}: ${countFilesLabel(count)}`);
    }
  });

  showDossierUploadChip(activeSection, options.incomingEntryIds?.length || 0);

  const stamp = $("preview-ready-stamp");
  if (stamp) {
    stamp.style.opacity = isFinalStep ? "1" : "0";
    stamp.style.transform = isFinalStep ? "rotate(-15deg) scale(1)" : "rotate(-15deg) scale(1.4)";
  }

  const zipBadge = $("preview-zip-badge");
  if (zipBadge) {
    zipBadge.classList.toggle("vertical-dossier__zip-badge--visible", previewIsCompiling || isFinalStep);
  }

  const copy = $("preview-copy");
  const state = $("preview-state");
  if (state) {
    const readyLabel = `${completedCount} de 6 secciones listas`;
    if (previewIsCompiling) {
      state.textContent = "Compilando paquete final";
    } else if (isFinalStep) {
      state.textContent = `Revisión final · ${readyLabel}`;
    } else {
      state.textContent = `Paquete en preparación · ${readyLabel}`;
    }
  }

  if (copy) {
    if (previewIsCompiling) {
      copy.textContent = "Comprimiendo paquete final...";
    } else if (isFinalStep) {
      copy.textContent = "Estructura verificada y lista para descargar.";
    } else {
      copy.textContent = sectionStatusText(activeConfig, activeCount);
    }
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
  const bar = $("wizard-progress-bar");
  const meta = $("wizard-progress-meta");
  const track = document.querySelector(".wizard-progress__track");
  const percent = (currentStep / TOTAL_STEPS) * 100;

  if (bar) {
    bar.style.width = `${percent}%`;
  }
  if (meta) {
    meta.textContent = `Paso ${currentStep} de ${TOTAL_STEPS}`;
  }
  if (track) {
    track.setAttribute("aria-valuenow", String(currentStep));
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
    } else {
      button.classList.add("wizard-step--future");
      button.disabled = true;
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

  window.scrollTo({ top: 0, behavior: "smooth" });
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

function isPdfFile(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

function buildUploadEntry(key, file) {
  uploadSequence += 1;
  return {
    id: `${key}-${uploadSequence}`,
    key,
    file,
    name: file.name,
    size: file.size,
    zipPath: getUploadPath(key, file.name),
  };
}

function renderUploadUI(key) {
  const root = document.querySelector(`[data-upload-key="${key}"]`);
  if (!root) return;

  const config = UPLOAD_CONFIG[key];
  const metaLine = root.querySelector(".upload-zone__meta-line");
  const fileList = root.querySelector(".upload-zone__file-list");
  const entries = getUploadEntries(key);

  if (metaLine && config) {
    const unit = config.maxFiles === 1 ? "PDF" : "PDFs";
    metaLine.textContent = `${entries.length}/${config.maxFiles} ${unit} · Máx. 10MB por archivo`;
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
  let feedbackMessage = "";

  for (const file of files) {
    if (!isPdfFile(file)) {
      feedbackMessage = "Solo se aceptan archivos PDF en este formulario.";
      continue;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      feedbackMessage = `Cada archivo en ${config.label} debe pesar maximo 10MB.`;
      continue;
    }

    if (nextEntries.length >= config.maxFiles) {
      feedbackMessage = `${config.label} permite hasta ${config.maxFiles} archivos PDF.`;
      break;
    }

    const entry = buildUploadEntry(key, file);
    nextEntries.push(entry);
    addedEntries.push(entry);
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

  if (addButton) {
    addButton.addEventListener("click", () => {
      input.click();
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

async function requestConclusion(targetId, hintId, options = {}) {
  if (!AI_CONCLUSION_ENABLED) {
    return;
  }

  const target = $(targetId);
  if (!target) return;

  const student = getStudentData();
  const button = options.buttonId ? $(options.buttonId) : null;
  const hint = hintId ? $(hintId) : null;

  const validationError = validateStepOne();
  if (validationError) {
    showMessage(validationError, "error");
    setStep(1);
    return;
  }

  if (button) {
    button.disabled = true;
    button.dataset.defaultLabel = button.dataset.defaultLabel || button.textContent || "";
    button.textContent = "Generando...";
  }

  clearMessage();

  try {
    const response = await fetch("/api/conclusion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courseName: student.courseName,
        department: student.department,
        facilitator: student.facilitator,
        semester: student.semester,
        year: student.year,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.conclusion) {
      throw new Error(data.error || "ai_unavailable");
    }

    target.value = clampText(data.conclusion, MAX_CONCLUSION_LENGTH);

    if (hint) {
      hint.hidden = false;
    }

    previewActiveSection = "conclusion";
    refreshSummary();
  } catch {
    showMessage(
      "No se pudo generar la conclusión en este momento. Intenta nuevamente.",
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.defaultLabel || "Generar";
    }
  }
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
  const aiButton = $("btn-generar-ia");
  const conclusionText = $("conclusionFinal");
  const aiHint = $("conclusion-final-ia-hint");

  if (!AI_CONCLUSION_ENABLED) {
    if (aiButton) {
      aiButton.hidden = true;
      aiButton.disabled = true;
    }
    if (aiHint) {
      aiHint.hidden = true;
    }
  }

  if (AI_CONCLUSION_ENABLED && aiButton) {
    aiButton.addEventListener("click", () => {
      requestConclusion("conclusionFinal", "conclusion-final-ia-hint", {
        buttonId: "btn-generar-ia",
      });
    });
  }

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
    if (!generatePortadaFn || !buildZipFn || !saveGeneratedZipFn) {
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

    await saveGeneratedZipFn(zipResult);
    await waitForPreviewTransition();
    window.location.href = "descarga.html";
  } catch {
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
}

document.addEventListener("DOMContentLoaded", initApp);



