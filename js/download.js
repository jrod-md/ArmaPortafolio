(() => {
  const RECEIPT_STORAGE_KEY = "armaportafolio-recibo";

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function loadReceiptRows() {
    try {
      const receipt = JSON.parse(window.sessionStorage.getItem(RECEIPT_STORAGE_KEY) || "null");
      return Array.isArray(receipt?.rows) ? receipt.rows : [];
    } catch {
      return [];
    }
  }

  function renderContents(saved) {
    const list = document.getElementById("contenido-lista");
    const weight = document.getElementById("contenido-peso");
    const rows = loadReceiptRows();

    if (weight) weight.textContent = formatBytes(saved.blob.size);
    if (!list || rows.length === 0) return;

    list.replaceChildren(
      ...rows.map((row) => {
        const item = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = String(row.label || "");
        const count = document.createElement("span");
        const total = Number(row.count) || 0;
        count.textContent = `${total} ${total === 1 ? "archivo" : "archivos"}`;
        item.append(label, count);
        return item;
      })
    );
  }

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
      setText("descarga-again", "Armar un portafolio");
      showMessage("No se encontró un ZIP generado. Vuelve a generar el portafolio.");
      return;
    }

    renderContents(saved);

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
