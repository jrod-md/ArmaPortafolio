import { initProtectedPage } from "./auth.js";
import { generatePortada } from "./generate.js";
import { buildZip, saveGeneratedZip } from "./zip.js";

const TOTAL_STEPS = 5;
const MAX_AI_REGENERATIONS = 3;
const REQUIRED_UPLOAD_KEYS = ["planContenido"];
const MAX_FULL_NAME_LENGTH = 80;
const MAX_COURSE_NAME_LENGTH = 80;
const MAX_FACILITATOR_LENGTH = 80;
const MAX_CONCLUSION_LENGTH = 2000;
const UPLOAD_PATHS = {
  planContenido: "02_Descripcion_Curso/Plan_de_Contenido/",
  planSemestral: "02_Descripcion_Curso/Planificacion_Programa_Semestral/",
  tareas: "04_Actividades/Tareas/",
  trabajos: "04_Actividades/Trabajos_Clase/",
  proyectos: "04_Actividades/Proyectos/",
  labs: "04_Actividades/Laboratorios_Talleres/",
  parcial1e: "04_Actividades/Parciales/Parcial_1/Enunciado/",
  parcial1r: "04_Actividades/Parciales/Parcial_1/Respuestas/",
  parcial2e: "04_Actividades/Parciales/Parcial_2/Enunciado/",
  parcial2r: "04_Actividades/Parciales/Parcial_2/Respuestas/",
  material: "05_Material_Didactico/Material_Didactico/",
};

let currentStep = 1;
let aiRegenerationsLeft = MAX_AI_REGENERATIONS;
let conclusionSkipped = false;

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
  return `${UPLOAD_PATHS[key] || "99_Adjuntos/" }${fileName}`;
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
  const stepThreeText = clampText($("conclusionFinal")?.value, MAX_CONCLUSION_LENGTH);
  const stepFourText = clampText($("conclusionOutput")?.value, MAX_CONCLUSION_LENGTH);
  return stepFourText || stepThreeText || "";
}

function getSelectedActivities() {
  return Array.from(document.querySelectorAll('input[name="act"]:checked'))
    .map((input) => input.parentElement?.textContent || input.value)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getUploadEntry(key) {
  return uploads[key] || null;
}

function getAllUploadEntries() {
  return Object.values(uploads).filter((entry) => entry?.file);
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
    const requiredCount = REQUIRED_UPLOAD_KEYS.filter((key) => getUploadEntry(key)).length;
    parts.push(`Archivos requeridos: ${requiredCount}`);

    [
      ["tareas", "Tareas"],
      ["trabajos", "Trabajos de clase"],
      ["proyectos", "Proyectos"],
      ["labs", "Laboratorios y talleres"],
      ["material", "Material didactico"],
    ].forEach(([key, label]) => {
      if (getUploadEntry(key)) {
        parts.push(`${label}: 1`);
      }
    });

    const parcialUno = ["parcial1e", "parcial1r"].filter((key) => getUploadEntry(key)).length;
    const parcialDos = ["parcial2e", "parcial2r"].filter((key) => getUploadEntry(key)).length;
    if (parcialUno) parts.push(`Parcial 1: ${parcialUno}`);
    if (parcialDos) parts.push(`Parcial 2: ${parcialDos}`);

    filesNode.textContent = parts.join(" · ");
  }

  const conclusionNode = $("sum-conclusion");
  if (conclusionNode) {
    const conclusionText = getConclusionText();
    if (conclusionSkipped && !conclusionText) {
      conclusionNode.textContent = "No incluida";
    } else if (conclusionText) {
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
  const missing = REQUIRED_UPLOAD_KEYS.filter((key) => !getUploadEntry(key));
  if (missing.length > 0) {
    return "Debes subir el Plan de Contenido. La Planificacion Semestral es recomendada.";
  }
  return null;
}

function validateCurrentStep() {
  if (currentStep === 1) return validateStepOne();
  if (currentStep === 2) return validateStepTwo();
  return null;
}

function extractDropFile(event) {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return null;
  if (file.type !== "application/pdf") {
    showMessage("Solo se aceptan archivos PDF en este formulario.", "error");
    return null;
  }
  return file;
}

function setUploadUI(key, file) {
  const root = document.querySelector(`[data-upload-key="${key}"]`);
  if (!root) return;

  const title = root.querySelector(".upload-zone__title");
  const hint = root.querySelector(".upload-zone__hint");
  const metaLine = root.querySelector(".upload-zone__meta-line");
  const meta = root.querySelector(".upload-zone__meta");
  const nameNode = root.querySelector(".upload-zone__name");
  const sizeNode = root.querySelector(".upload-zone__size");
  const removeButton = root.querySelector(".upload-zone__remove");
  const input = root.querySelector(".upload-zone__input");

  if (file) {
    uploads[key] = {
      key,
      file,
      name: file.name,
      size: file.size,
      zipPath: getUploadPath(key, file.name),
    };

    if (nameNode) nameNode.textContent = file.name;
    if (sizeNode) sizeNode.textContent = formatBytes(file.size);
    if (title) title.hidden = true;
    if (hint) hint.hidden = true;
    if (metaLine) metaLine.hidden = true;
    if (meta) meta.hidden = false;
    if (removeButton) removeButton.hidden = false;
    root.classList.add("upload-zone--filled");
  } else {
    delete uploads[key];
    if (input) input.value = "";
    if (title) title.hidden = false;
    if (hint) hint.hidden = false;
    if (metaLine) metaLine.hidden = false;
    if (meta) meta.hidden = true;
    if (removeButton) removeButton.hidden = true;
    root.classList.remove("upload-zone--filled");
  }

  clearMessage();
  refreshSummary();
}

function bindUploadZone(root) {
  const key = root.getAttribute("data-upload-key");
  const input = root.querySelector(".upload-zone__input");
  const removeButton = root.querySelector(".upload-zone__remove");

  if (!key || !input) return;

  root.addEventListener("click", (event) => {
    if (event.target === removeButton) return;
    input.click();
  });

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

    const file = extractDropFile(event);
    if (!file) return;

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    setUploadUI(key, file);
  });

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadUI(key, null);
      showMessage("Solo se aceptan archivos PDF en este formulario.", "error");
      return;
    }
    setUploadUI(key, file);
  });

  if (removeButton) {
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setUploadUI(key, null);
    });
  }
}

async function requestConclusion(targetId, hintId, options = {}) {
  const target = $(targetId);
  if (!target) return;

  const student = getStudentData();
  const expectations = ($("expectativas")?.value || "").trim();
  const activities = getSelectedActivities();
  const parcialCount = Number($("num-parciales")?.value || 0);
  const button = options.buttonId ? $(options.buttonId) : null;
  const hint = hintId ? $(hintId) : null;

  const validationError = validateStepOne();
  if (validationError) {
    showMessage(validationError, "error");
    setStep(1);
    return;
  }

  if (!expectations && options.requireExpectations) {
    showMessage("Escribe las expectativas iniciales antes de pedir una conclusion.", "error");
    return;
  }

  if (options.consumeRegeneration) {
    if (aiRegenerationsLeft <= 0) {
      showMessage("Ya no quedan regeneraciones disponibles.", "error");
      return;
    }
    aiRegenerationsLeft -= 1;
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
        expectations,
        activities: activities.join(", ") || "Sin actividades marcadas",
        numParciales: parcialCount,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.conclusion) {
      throw new Error(data.error || "ai_unavailable");
    }

    conclusionSkipped = false;
    target.value = clampText(data.conclusion, MAX_CONCLUSION_LENGTH);

    if (hint) {
      hint.hidden = false;
    }

    if (options.regenerationLabelId) {
      const label = $(options.regenerationLabelId);
      if (label) {
        label.textContent = `${aiRegenerationsLeft}/${MAX_AI_REGENERATIONS} regeneraciones disponibles`;
      }
    }

    if (options.consumeRegeneration && aiRegenerationsLeft <= 0 && button) {
      button.disabled = true;
    }

    refreshSummary();
  } catch {
    showMessage(
      "No se pudo generar la conclusion en este momento. Intenta nuevamente.",
      "error"
    );

    if (options.consumeRegeneration) {
      aiRegenerationsLeft += 1;
    }
  } finally {
    if (button && (!options.consumeRegeneration || aiRegenerationsLeft > 0)) {
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
  const expectationInput = $("expectativas");
  const countNode = $("expectativas-count");
  const skipLink = $("link-omitir-paso4");
  const stepThreeButton = $("btn-ia-conclusion-final");
  const stepFourButton = $("btn-generar-ia");
  const stepThreeText = $("conclusionFinal");
  const stepFourText = $("conclusionOutput");

  if (expectationInput && countNode) {
    expectationInput.addEventListener("input", () => {
      countNode.textContent = String(expectationInput.value.length);
    });
  }

  if (stepThreeButton) {
    stepThreeButton.addEventListener("click", () => {
      requestConclusion("conclusionFinal", "conclusion-final-ia-hint", {
        buttonId: "btn-ia-conclusion-final",
      });
    });
  }

  if (stepFourButton) {
    stepFourButton.addEventListener("click", () => {
      requestConclusion("conclusionOutput", null, {
        buttonId: "btn-generar-ia",
        consumeRegeneration: true,
        regenerationLabelId: "regeneraciones-label",
        requireExpectations: true,
      });

      const wrap = $("conclusion-output-wrap");
      if (wrap) {
        wrap.hidden = false;
      }
    });
  }

  if (stepThreeText) {
    stepThreeText.addEventListener("input", () => {
      conclusionSkipped = false;
      refreshSummary();
    });
  }

  if (stepFourText) {
    stepFourText.addEventListener("input", () => {
      conclusionSkipped = false;
      refreshSummary();
    });
  }

  if (skipLink) {
    skipLink.addEventListener("click", (event) => {
      event.preventDefault();
      conclusionSkipped = true;
      setStep(5);
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
