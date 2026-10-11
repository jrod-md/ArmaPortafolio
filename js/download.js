(() => {
  const RECEIPT_STORAGE_KEY = "armaportafolio-recibo";

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function loadReceipt() {
    try {
      const receipt = JSON.parse(window.sessionStorage.getItem(RECEIPT_STORAGE_KEY) || "null");
      return Array.isArray(receipt?.rows) ? receipt : null;
    } catch {
      return null;
    }
  }

  function renderReceipt(saved) {
    const list = document.getElementById("recibo-lista");
    const weight = document.getElementById("recibo-peso");
    const date = document.getElementById("recibo-fecha");
    const receipt = loadReceipt();

    if (date) {
      date.textContent = new Date().toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" });
    }
    if (weight && saved?.blob) {
      weight.textContent = formatBytes(saved.blob.size);
    }
    if (!list || !receipt) return;

    list.replaceChildren(
      ...receipt.rows.map((row) => {
        const item = document.createElement("li");
        item.className = "receipt__row";
        const label = document.createElement("span");
        label.textContent = String(row.label || "");
        const count = document.createElement("span");
        count.textContent = String(Number(row.count) || 0);
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
      const title = document.getElementById("descarga-title");
      if (title) title.textContent = "Esta carpeta está vacía";
      if (filenameNode) filenameNode.textContent = "todavía no has armado nada";
      showMessage("No se encontró un ZIP generado. Vuelve a generar el portafolio.");
      return;
    }

    renderReceipt(saved);

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
