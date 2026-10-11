(() => {
  async function initDownloadPage() {
    const { loadGeneratedZip, clearGeneratedZip } = window.PortafolioFiscZip || {};
    const button = document.querySelector(".descarga-btn");
    const filenameNode = document.querySelector(".descarga-filename");
    const noteNode = document.querySelector(".descarga-note");

    const showMessage = (message) => {
      if (noteNode) {
        noteNode.hidden = false;
        noteNode.textContent = message;
      }
    };

    const saved = loadGeneratedZip ? await loadGeneratedZip().catch(() => null) : null;

    if (saved?.filename && filenameNode) {
      filenameNode.textContent = saved.filename;
    }

    if (!saved || !saved.blob) {
      if (button) {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
      }
      document.body.classList.add("is-empty");
      const setText = (id, text) => {
        const node = document.getElementById(id);
        if (node) node.textContent = text;
      };
      setText("descarga-kicker", "Sin portafolio");
      setText("descarga-title", "Aquí todavía no hay nada.");
      setText("descarga-lead", "Esta página guarda el último ZIP que armaste en este navegador.");
      showMessage("No se encontró un ZIP generado. Vuelve a generar el portafolio.");
      return;
    }

    if (button) {
      button.addEventListener("click", () => {
        const url = URL.createObjectURL(saved.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = saved.filename || "portafolio_fisc.zip";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        if (clearGeneratedZip) {
          clearGeneratedZip().catch(() => {});
        }
      });
    }
  }

  initDownloadPage();
})();
