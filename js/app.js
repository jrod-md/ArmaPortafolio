import { initProtectedPage } from "./auth.js";
import { generatePortada } from "./generate.js";
import { buildZip, saveGeneratedZip } from "./zip.js";

const TOTAL_STEPS = 5;
const MAX_FULL_NAME_LENGTH = 80;
const MAX_COURSE_NAME_LENGTH = 80;
const MAX_FACILITATOR_LENGTH = 80;
const MAX_CONCLUSION_LENGTH = 2000;
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
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
  return `${UPLOAD_CONFIG[key]?.path || "99_Adjuntos/"}${fileName}`;
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

  if (step === 5) {
    refreshSummary();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validateStepOne() {
  const student = getStudentData();

  if (!student.fullName || student.fullName.length < 3) {
    return "Completa el nombre del estudiante.";
  }
  if (!student.cedula) {
    return "Completa la cedula del estudiante.";
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

    nextEntries.push(buildUploadEntry(key, file));
  }

  if (nextEntries.length > 0) {
    uploads[key] = nextEntries;
  } else {
    delete uploads[key];
  }

  renderUploadUI(key);
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

    refreshSummary();
  } catch {
    showMessage(
      "No se pudo generar la conclusion en este momento. Intenta nuevamente.",
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

  if (aiButton) {
    aiButton.addEventListener("click", () => {
      requestConclusion("conclusionFinal", "conclusion-final-ia-hint", {
        buttonId: "btn-generar-ia",
      });
    });
  }

  if (conclusionText) {
    conclusionText.addEventListener("input", () => {
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

  try {
    const student = getStudentData();
    const files = getAllUploadEntries().map((entry) => ({
      file: entry.file,
      zipPath: entry.zipPath,
    }));
    const conclusionText = getConclusionText() || null;
    const portadaResult = await generatePortada({ student });
    const zipResult = await buildZip({
      student,
      files,
      conclusionText,
      portadaResult,
    });

    if (!zipResult?.blob) {
      throw new Error("zip_not_created");
    }

    await saveGeneratedZip(zipResult);
    window.location.href = "descarga.html";
  } catch {
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

export function initApp() {
  if (!initProtectedPage()) {
    return;
  }

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



