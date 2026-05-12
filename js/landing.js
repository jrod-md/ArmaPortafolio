(() => {
  function initLandingProcess() {
    const visualTarget = document.getElementById("sticky-visual-target");
    const statusLabel = document.getElementById("artifact-status");
    const panels = document.querySelectorAll(".step-panel");

    if (!visualTarget || panels.length === 0) return;

    const statusMessages = {
      datos: "Preparando datos...",
      evidencias: "Organizando archivos...",
      revision: "Estructura verificada",
      zip: "ZIP empaquetado",
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const step = entry.target.id.replace("step-", "");
          visualTarget.dataset.step = step;

          if (statusLabel) {
            statusLabel.textContent = statusMessages[step] || "Preparando...";
          }
        });
      },
      { threshold: 0.5 }
    );

    panels.forEach((panel) => observer.observe(panel));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLandingProcess, { once: true });
  } else {
    initLandingProcess();
  }
})();
