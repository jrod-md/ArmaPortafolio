(function () {
  var currentStep = 1;
  var TOTAL_STEPS = 5;
  var conclusionSkipped = false;
  var aiRegenerationsLeft = 3;
  var uploads = {};

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function setUploadUI(key, file) {
    var root = document.querySelector('[data-upload-key="' + key + '"]');
    if (!root) return;
    var ui = root.querySelector(".upload-zone__ui");
    var meta = root.querySelector(".upload-zone__meta");
    var nameEl = root.querySelector(".upload-zone__name");
    var sizeEl = root.querySelector(".upload-zone__size");
    var removeBtn = root.querySelector(".upload-zone__remove");
    if (file) {
      uploads[key] = { name: file.name, size: file.size };
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = formatBytes(file.size);
      if (ui) ui.hidden = true;
      if (meta) meta.hidden = false;
      if (removeBtn) removeBtn.hidden = false;
      root.classList.add("upload-zone--filled");
      root.classList.remove("upload-zone--enter");
      window.requestAnimationFrame(function () {
        root.classList.add("upload-zone--enter");
      });
    } else {
      delete uploads[key];
      var input = root.querySelector(".upload-zone__input");
      if (input) input.value = "";
      if (ui) ui.hidden = false;
      if (meta) meta.hidden = true;
      if (removeBtn) removeBtn.hidden = true;
      root.classList.remove("upload-zone--filled", "upload-zone--enter");
    }
  }

  function updateProgress() {
    var bar = $("wizard-progress-bar");
    var meta = $("wizard-progress-meta");
    var track = document.querySelector(".wizard-progress__track");
    if (!bar || !meta || !track) return;
    var percent = (currentStep / TOTAL_STEPS) * 100;
    bar.style.width = percent + "%";
    meta.textContent = "Paso " + currentStep + " de " + TOTAL_STEPS;
    track.setAttribute("aria-valuenow", String(currentStep));
  }

  function bindUploadZone(root) {
    var key = root.getAttribute("data-upload-key");
    if (!key) return;
    var input = root.querySelector(".upload-zone__input");
    var ui = root.querySelector(".upload-zone__ui");
    if (!input || !ui) return;

    ui.addEventListener("click", function () {
      input.click();
    });

    root.addEventListener("dragover", function (e) {
      e.preventDefault();
      root.classList.add("upload-zone--drag");
    });
    root.addEventListener("dragleave", function () {
      root.classList.remove("upload-zone--drag");
    });
    root.addEventListener("drop", function (e) {
      e.preventDefault();
      root.classList.remove("upload-zone--drag");
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && f.type === "application/pdf") {
        var dt = new DataTransfer();
        dt.items.add(f);
        input.files = dt.files;
        setUploadUI(key, f);
      }
    });

    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (f) setUploadUI(key, f);
    });

    var removeBtn = root.querySelector(".upload-zone__remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        setUploadUI(key, null);
      });
    }
  }

  function updateSidebar() {
    for (var i = 1; i <= TOTAL_STEPS; i++) {
      var btn = $("wizard-nav-" + i);
      if (!btn) continue;
      btn.classList.remove(
        "wizard-step--active",
        "wizard-step--complete",
        "wizard-step--future"
      );
      if (i < currentStep) {
        btn.classList.add("wizard-step--complete");
        btn.disabled = false;
      } else if (i === currentStep) {
        btn.classList.add("wizard-step--active");
        btn.disabled = false;
      } else {
        btn.classList.add("wizard-step--future");
        btn.disabled = true;
      }
    }
  }

  function showPanel(step) {
    for (var i = 1; i <= TOTAL_STEPS; i++) {
      var panel = $("wizard-panel-" + i);
      if (!panel) continue;
      if (i !== step) {
        panel.hidden = true;
        panel.classList.remove("wizard-panel--enter");
        continue;
      }
      panel.hidden = false;
      panel.classList.remove("wizard-panel--enter");
      window.requestAnimationFrame(function (p) {
        return function () {
          p.classList.add("wizard-panel--enter");
        };
      }(panel));
    }
  }

  function setStep(n) {
    if (n < 1 || n > TOTAL_STEPS) return;
    currentStep = n;
    showPanel(n);
    updateSidebar();
    updateProgress();
    if (n === 5) refreshSummary();
    window.scrollTo(0, 0);
    var main = document.querySelector(".wizard-main");
    if (main) main.scrollTop = 0;
  }

  function refreshSummary() {
    var nombre = ($("sf-nombre") && $("sf-nombre").value) || "—";
    var cedula = ($("sf-cedula") && $("sf-cedula").value) || "—";
    var curso = ($("sf-curso") && $("sf-curso").value) || "—";
    var depto = ($("sf-depto") && $("sf-depto").selectedOptions[0]) || { text: "—" };
    var facil = ($("sf-facilitador") && $("sf-facilitador").value) || "—";
    var sem = ($("sf-semestre") && $("sf-semestre").value) || "—";
    var anio = ($("sf-anio") && $("sf-anio").value) || "—";

    var map = {
      sumNombre: nombre,
      sumCedula: cedula,
      sumCurso: curso,
      sumDepto: depto.text || depto.textContent || "—",
      sumFacil: facil,
      sumSem: sem + " · " + anio,
    };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = map[id];
    });

    var parts = [];
    var req = 0;
    if (uploads.planContenido) req++;
    if (uploads.planSemestral) req++;
    parts.push("Archivos requeridos: " + req);

    function addOpt(key, label) {
      if (uploads[key]) parts.push(label + ": 1");
    }

    addOpt("tareas", "Tareas");
    addOpt("trabajos", "Trabajos de Clase");
    addOpt("proyectos", "Proyectos");
    addOpt("labs", "Laboratorios y Talleres");
    addOpt("material", "Material Didáctico");

    var p1 = (uploads.parcial1e ? 1 : 0) + (uploads.parcial1r ? 1 : 0);
    var p2 = (uploads.parcial2e ? 1 : 0) + (uploads.parcial2r ? 1 : 0);
    if (p1) parts.push("Parcial 1: " + p1);
    if (p2) parts.push("Parcial 2: " + p2);

    var sumFiles = $("sum-files");
    if (sumFiles) sumFiles.textContent = parts.join(" · ");

    var nombreCompleto = ($("sf-nombre") && $("sf-nombre").value.trim()) || "";
    var cedPresent = ($("sf-cedula") && $("sf-cedula").value.trim()) || "";
    var sumPres = $("sum-presentacion");
    if (sumPres) {
      if (nombreCompleto || cedPresent) {
        sumPres.textContent = [nombreCompleto, cedPresent].filter(Boolean).join(" · ");
      } else {
        sumPres.textContent = "Completa nombre y cédula en el paso 1";
      }
    }

    var ta4 = $("conclusionOutput");
    var ta3 = $("conclusionFinal");
    var text4 = ta4 && ta4.value.trim();
    var text3 = ta3 && ta3.value.trim();
    var sumConc = $("sum-conclusion");
    if (sumConc) {
      if (conclusionSkipped && !text3 && !text4) {
        sumConc.textContent = "No incluida";
      } else if (text3 || text4) {
        sumConc.textContent = "Incluida (editada por el estudiante)";
      } else {
        sumConc.textContent = "No incluida";
      }
    }
  }

  function bindNav() {
    for (var i = 1; i <= TOTAL_STEPS; i++) {
      (function (step) {
        var btn = $("wizard-nav-" + step);
        if (btn) {
          btn.addEventListener("click", function () {
            setStep(step);
          });
        }
      })(i);
    }

    var nextBtns = document.querySelectorAll("[data-wizard-next]");
    nextBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        if (currentStep < TOTAL_STEPS) setStep(currentStep + 1);
      });
    });

    var prevBtns = document.querySelectorAll("[data-wizard-prev]");
    prevBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        if (currentStep > 1) setStep(currentStep - 1);
      });
    });
  }

  function bindStep4() {
    var ta = $("expectativas");
    var countEl = $("expectativas-count");
    if (ta && countEl) {
      ta.addEventListener("input", function () {
        countEl.textContent = ta.value.length;
      });
    }

    var genBtn = $("btn-generar-ia");
    var out = $("conclusionOutput");
    var regEl = $("regeneraciones-label");
    var skip = $("link-omitir-paso4");

    if (genBtn && out) {
      genBtn.addEventListener("click", function () {
        if (aiRegenerationsLeft <= 0) return;
        conclusionSkipped = false;
        aiRegenerationsLeft -= 1;
        out.value =
          "[Texto de ejemplo generado por IA]\n\n" +
          "En este curso consolidé conocimientos clave aplicables a mi formación. " +
          "Revisa, edita y adapta este borrador a tu experiencia real antes de entregarlo.";
        out.hidden = false;
        var wrap = $("conclusion-output-wrap");
        if (wrap) wrap.hidden = false;
        if (regEl) {
          regEl.textContent =
            aiRegenerationsLeft + "/3 regeneraciones disponibles";
        }
        if (aiRegenerationsLeft <= 0) genBtn.disabled = true;
      });
    }

    var outArea = $("conclusionOutput");
    if (outArea) {
      outArea.addEventListener("input", function () {
        conclusionSkipped = false;
      });
    }

    var conclusionFinal = $("conclusionFinal");
    if (conclusionFinal) {
      conclusionFinal.addEventListener("input", function () {
        conclusionSkipped = false;
      });
    }

    if (skip) {
      skip.addEventListener("click", function (e) {
        e.preventDefault();
        conclusionSkipped = true;
        setStep(5);
      });
    }
  }

  function bindStep5() {
    var btn = $("btn-generar-portafolio");
    var idle = $("wizard-step5-idle");
    var load = $("wizard-step5-loading");
    if (!btn || !idle || !load) return;
    btn.addEventListener("click", function () {
      btn.disabled = true;
      var actionButtons = document.querySelectorAll(".wizard-panel button, .wizard-panel a.btn");
      actionButtons.forEach(function (node) {
        if (node !== btn) node.setAttribute("aria-disabled", "true");
      });
      idle.hidden = true;
      load.hidden = false;
      btn.textContent = "Generando...";
      window.setTimeout(function () {
        window.location.href = "descarga.html";
      }, 2200);
    });
  }

  function bindStep3ConclusionIa() {
    var btn = $("btn-ia-conclusion-final");
    var ta = $("conclusionFinal");
    var hint = $("conclusion-final-ia-hint");
    if (!btn || !ta) return;
    btn.addEventListener("click", function () {
      conclusionSkipped = false;
      var n = Object.keys(uploads).length;
      ta.value =
        "[Borrador generado por IA a partir de los archivos indicados en el formulario" +
        (n ? " (" + n + " documento" + (n === 1 ? "" : "s") + ")" : "") +
        ".]\n\n" +
        "Sintetiza aquí los aprendizajes principales del curso y su aplicación. " +
        "Revisa, corrige y sustituye este texto por tu conclusión real antes de generar el portafolio.";
      if (hint) hint.hidden = false;
    });
  }

  function loadWizardDefaults() {
    try {
      var raw = localStorage.getItem("folium_defaults");
      if (!raw) return;
      var d = JSON.parse(raw);
      var n = $("sf-nombre");
      var c = $("sf-cedula");
      var de = $("sf-depto");
      var f = $("sf-facilitador");
      if (n && d.nombre) n.value = d.nombre;
      if (c && d.cedula) c.value = d.cedula;
      if (de && d.depto) {
        for (var i = 0; i < de.options.length; i++) {
          if (de.options[i].value === d.depto || de.options[i].text === d.depto) {
            de.selectedIndex = i;
            break;
          }
        }
      }
      if (f && d.facilitador) f.value = d.facilitador;
    } catch (e) {}
  }

  document.querySelectorAll("[data-upload-key]").forEach(bindUploadZone);
  bindNav();
  bindStep3ConclusionIa();
  bindStep4();
  bindStep5();
  loadWizardDefaults();
  updateSidebar();
  updateProgress();
  showPanel(1);
})();
