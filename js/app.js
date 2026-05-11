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
  return {
    fullName: clampText($("sf-nombre")?.value, MAX_FULL_NAME_LENGTH),
    cedula: ($("sf-cedula")?.value || "").trim(),
    courseName: clampText($("sf-curso")?.value, MAX_COURSE_NAME_LENGTH),
    department: ($("sf-depto")?.selectedOptions?.[0]?.text || $("sf-depto")?.value || "").trim(),
    facilitator: clampText($("sf-facilitador")?.value, MAX_FACILITATOR_LENGTH),
    semester: ($("sf-semestre")?.value || "").trim(),
    year: "2026",
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

function syncPreviewSectionToStep() {
  if (currentStep === 5) {
    previewActiveSection = getMostRelevantPreviewSection();
    return;
  }

  previewActiveSection = PREVIEW_STEP_SECTIONS[currentStep] || previewActiveSection || "portada";
}

function renderPortfolioPreview(options = {}) {
  const root = $("portfolio-live-preview");
  if (!root) return;

  const sections = getPreviewData();
  const incomingIds = new Set(options.incomingEntryIds || []);
  const requestedSection = options.activeSection || options.incomingSection;
  if (requestedSection) {
    previewActiveSection = requestedSection;
  }
  previewActiveSection = getPreviewSectionConfig(previewActiveSection).id;

  root.dataset.activeSection = previewActiveSection;
  root.dataset.compiling = previewIsCompiling ? "true" : "false";

  sections.forEach((section) => {
    const countNode = document.querySelector(`[data-preview-count="${section.id}"]`);
    if (countNode) {
      countNode.textContent = String(section.entries.length);
    }
  });

  const allEntries = sections.flatMap((section) => section.entries);
  const coverEntry = allEntries.find((entry) => entry.id === "preview-portada-generated");
  const restEntries = allEntries.filter((entry) => entry.id !== "preview-portada-generated");
  const visibleEntries = [coverEntry, ...restEntries.slice(-7)].filter(Boolean);
  const paperStack = $("preview-paper-stack");

  if (paperStack) {
    const liftBySection = {
      portada: 18,
      asignaciones: 24,
      parciales: 19,
      laboratorios: 15,
      proyectos: 10,
      conclusion: 6,
    };
    const shifts = [-26, -14, -3, 10, 20, -18, 4, 16];
    const rotations = [-2.1, -0.9, 1.1, -0.3, 1.6, -1.4, 0.5, 1.2];

    paperStack.innerHTML = "";
    visibleEntries.forEach((entry, index) => {
      const paper = document.createElement("div");
      paper.className = "folder-paper";
      if (incomingIds.has(entry.id)) {
        paper.classList.add("folder-paper--incoming");
      }
      paper.style.setProperty("--paper-shift", `${shifts[index % shifts.length]}px`);
      paper.style.setProperty(
        "--paper-lift",
        `${(liftBySection[entry.sectionId] || 16) + index * 3}px`
      );
      paper.style.setProperty("--paper-rot", `${rotations[index % rotations.length]}deg`);
      paper.style.setProperty("--paper-z", String(11 + index));

      const name = document.createElement("span");
      name.className = "folder-paper__name";
      name.textContent = entry.name;

      const sectionName = document.createElement("span");
      sectionName.className = "folder-paper__section";
      sectionName.textContent = entry.sectionLabel;

      paper.append(name, sectionName);
      paperStack.appendChild(paper);
    });
  }

  const activeConfig = getPreviewSectionConfig(previewActiveSection);
  const activeSection = sections.find((section) => section.id === activeConfig.id);
  const activeCount = activeSection?.entries.length || 0;
  const activeLabel = $("preview-active-label");
  const countLabel = $("preview-count");
  const copy = $("preview-copy");
  const fileList = $("preview-file-list");
  const zipCard = $("preview-zip-card");

  if (activeLabel) {
    activeLabel.textContent = activeConfig.label;
  }
  if (countLabel) {
    countLabel.textContent = activeCount ? countFilesLabel(activeCount) : activeConfig.empty;
  }
  if (copy) {
    if (previewIsCompiling) {
      copy.textContent = "La carpeta se compacta y el ZIP queda listo para entrega.";
    } else if (currentStep === 5) {
      copy.textContent = "Revisa la estructura final antes de descargar.";
    } else {
      copy.textContent = activeConfig.copy;
    }
  }
  if (zipCard) {
    zipCard.setAttribute("aria-hidden", previewIsCompiling ? "false" : "true");
  }
  if (fileList) {
    fileList.innerHTML = "";
    sections.forEach((section) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const count = document.createElement("strong");

      label.textContent = section.label;
      count.textContent = section.entries.length ? countFilesLabel(section.entries.length) : "Pendiente";
      item.append(label, count);
      fileList.appendChild(item);
    });
  }
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
  const departmentNode = $("sf-depto");
  const departmentText =
    departmentNode?.selectedOptions?.[0]?.text ||
    departmentNode?.value ||
    "-";

  const summary = {
    sumNombre: student.fullName || "-",
    sumCedula: student.cedula || "-",
    sumCurso: student.courseName || "-",
    sumDepto: departmentText || "-",
    sumFacil: student.facilitator || "-",
    sumSem: `${student.semester || "-"} · ${student.year || "-"}`,
  };

  Object.entries(summary).forEach(([id, value]) => {
    const node = $(id);
    if (node) {
      node.textContent = value;
    }
  });

  const presentationNode = $("sum-presentacion");
  if (presentationNode) {
    const parts = [student.fullName, student.cedula].filter(Boolean);
    presentationNode.textContent = parts.length ? parts.join(" · ") : "No indicada";
  }

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

function initApp() {
  const yearField = $("sf-anio");
  if (yearField) {
    yearField.value = "2026";
  }

  document.querySelectorAll("[data-upload-key]").forEach(bindUploadZone);
  bindNavigation();
  bindConclusionUi();
  bindGenerateButton();
  refreshSummary();
  updateSidebar();
  updateProgress();
  showPanel(1);
}

document.addEventListener("DOMContentLoaded", initApp);



