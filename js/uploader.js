const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
];

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/jpeg",
  "image/png",
];

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 400 * 1024 * 1024;
const WARNING_BYTES = 350 * 1024 * 1024;

export class FileUploadSection {
  static instances = [];
  static globalUsageContainer = null;
  static globalBytesText = null;
  static globalBytesBar = null;

  constructor(containerEl, config) {
    if (!containerEl) {
      throw new Error("FileUploadSection requiere un contenedor válido.");
    }

    this.containerEl = containerEl;
    this.config = {
      sectionId: config.sectionId,
      label: config.label,
      zipPath: config.zipPath,
      required: Boolean(config.required),
      multiple: Boolean(config.multiple),
    };

    this.files = [];

    this.render();
    FileUploadSection.instances.push(this);
    FileUploadSection.updateGlobalUsage();
  }

  static initGlobalUsage(containerEl) {
    FileUploadSection.globalUsageContainer = containerEl;

    if (!containerEl) return;

    containerEl.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "wizard-warn-box";

    const text = document.createElement("p");
    text.style.margin = "0 0 .5rem";
    text.textContent = "0 MB de 400 MB usados";

    const track = document.createElement("div");
    track.style.width = "100%";
    track.style.height = "8px";
    track.style.background = "#ece6fa";
    track.style.borderRadius = "999px";
    track.style.overflow = "hidden";

    const bar = document.createElement("div");
    bar.style.height = "100%";
    bar.style.width = "0%";
    bar.style.borderRadius = "999px";
    bar.style.background = "linear-gradient(90deg, #7f58df, #5f36c5)";
    bar.style.transition = "width 220ms ease-out";

    track.appendChild(bar);
    wrapper.appendChild(text);
    wrapper.appendChild(track);
    containerEl.appendChild(wrapper);

    FileUploadSection.globalBytesText = text;
    FileUploadSection.globalBytesBar = bar;
    FileUploadSection.updateGlobalUsage();
  }

  static getTotalBytesAll() {
    return FileUploadSection.instances.reduce((sum, instance) => sum + instance.getTotalBytes(), 0);
  }

  static getAllFiles() {
    return FileUploadSection.instances.flatMap((instance) => instance.getFiles());
  }

  static updateGlobalUsage() {
    if (!FileUploadSection.globalBytesText || !FileUploadSection.globalBytesBar) return;

    const used = FileUploadSection.getTotalBytesAll();
    const percent = Math.min((used / MAX_TOTAL_BYTES) * 100, 100);

    FileUploadSection.globalBytesText.textContent = `${formatBytes(used)} de 400 MB usados`;
    FileUploadSection.globalBytesBar.style.width = `${percent.toFixed(2)}%`;

    if (used > WARNING_BYTES) {
      FileUploadSection.globalBytesBar.style.background = "linear-gradient(90deg, #d94a4a, #b02f2f)";
      FileUploadSection.globalBytesText.style.color = "#8f2323";
    } else {
      FileUploadSection.globalBytesBar.style.background = "linear-gradient(90deg, #7f58df, #5f36c5)";
      FileUploadSection.globalBytesText.style.color = "";
    }
  }

  render() {
    this.containerEl.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "upload-zone";
    wrapper.dataset.sectionId = this.config.sectionId;

    const label = document.createElement("p");
    label.className = "upload-zone__title";
    label.textContent = this.config.label;

    if (this.config.required) {
      const asterisk = document.createElement("span");
      asterisk.style.color = "#B42318";
      asterisk.textContent = " *";
      label.appendChild(asterisk);
    }

    const input = document.createElement("input");
    input.className = "upload-zone__input";
    input.type = "file";
    input.accept = ACCEPTED_EXTENSIONS.join(",");
    input.multiple = true;

    const ui = document.createElement("div");
    ui.className = "upload-zone__ui";

    const title = document.createElement("p");
    title.className = "upload-zone__hint";
    title.textContent = "Arrastra archivos aquí o haz clic para seleccionar";

    const meta = document.createElement("p");
    meta.className = "upload-zone__meta-line";
    meta.textContent = "PDF, Word, Excel, PowerPoint, imágenes, TXT · Máx 25 MB por archivo";

    const error = document.createElement("p");
    error.className = "wizard-ia-hint-step3";
    error.style.marginTop = ".65rem";
    error.hidden = true;

    const list = document.createElement("div");
    list.style.marginTop = ".8rem";
    list.style.display = "grid";
    list.style.gap = ".4rem";

    ui.appendChild(title);
    ui.appendChild(meta);

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(ui);
    wrapper.appendChild(error);
    wrapper.appendChild(list);

    this.containerEl.appendChild(wrapper);

    this.inputEl = input;
    this.zoneEl = wrapper;
    this.errorEl = error;
    this.listEl = list;

    this.bindEvents();
    this.renderList();
  }

  bindEvents() {
    this.zoneEl.addEventListener("click", () => {
      this.inputEl.click();
    });

    this.zoneEl.addEventListener("dragover", (event) => {
      event.preventDefault();
      this.zoneEl.classList.add("upload-zone--drag");
    });

    this.zoneEl.addEventListener("dragleave", () => {
      this.zoneEl.classList.remove("upload-zone--drag");
    });

    this.zoneEl.addEventListener("drop", (event) => {
      event.preventDefault();
      this.zoneEl.classList.remove("upload-zone--drag");
      const files = Array.from(event.dataTransfer?.files || []);
      this.addFiles(files);
    });

    this.inputEl.addEventListener("change", () => {
      const files = Array.from(this.inputEl.files || []);
      this.addFiles(files);
      this.inputEl.value = "";
    });
  }

  addFiles(files) {
    const errors = [];

    for (const file of files) {
      const validationError = this.validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        continue;
      }

      const projectedBytes = FileUploadSection.getTotalBytesAll() + file.size;
      if (projectedBytes > MAX_TOTAL_BYTES) {
        errors.push(`${file.name}: se supera el límite global de 400 MB`);
        continue;
      }

      this.files.push(file);
    }

    if (errors.length > 0) {
      this.showError(errors.join(" · "));
    } else {
      this.hideError();
    }

    this.renderList();
    FileUploadSection.updateGlobalUsage();
  }

  validateFile(file) {
    const extension = getFileExtension(file.name);

    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      return "tipo de archivo no permitido";
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return "MIME inválido o no permitido";
    }

    if (file.size > MAX_FILE_BYTES) {
      return "supera 25 MB";
    }

    return null;
  }

  renderList() {
    this.listEl.innerHTML = "";

    this.files.forEach((file, index) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr auto auto";
      row.style.gap = ".55rem";
      row.style.alignItems = "center";
      row.style.border = "1px solid #e9e2fa";
      row.style.borderRadius = "10px";
      row.style.padding = ".45rem .55rem";
      row.style.background = "#fff";

      const name = document.createElement("span");
      name.textContent = truncate(file.name, 40);
      name.title = file.name;
      name.style.fontSize = ".85rem";
      name.style.color = "#1a1628";

      const size = document.createElement("span");
      size.textContent = formatBytes(file.size);
      size.style.fontSize = ".75rem";
      size.style.color = "#625c78";

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "upload-zone__remove";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.files.splice(index, 1);
        this.renderList();
        this.hideError();
        FileUploadSection.updateGlobalUsage();
      });

      row.appendChild(name);
      row.appendChild(size);
      row.appendChild(removeBtn);

      this.listEl.appendChild(row);
    });
  }

  showError(message) {
    this.errorEl.hidden = false;
    this.errorEl.textContent = message;
  }

  hideError() {
    this.errorEl.hidden = true;
    this.errorEl.textContent = "";
  }

  getFiles() {
    return this.files.map((file) => ({
      file,
      zipPath: `${this.config.zipPath}${file.name}`,
    }));
  }

  getTotalBytes() {
    return this.files.reduce((sum, file) => sum + file.size, 0);
  }

  clear() {
    this.files = [];
    this.hideError();
    this.renderList();
    FileUploadSection.updateGlobalUsage();
  }
}

function truncate(value, maxChars) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1)}…`;
}

function getFileExtension(fileName) {
  const index = fileName.lastIndexOf(".");
  if (index === -1) return "";
  return fileName.slice(index).toLowerCase();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
