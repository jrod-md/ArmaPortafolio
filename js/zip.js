(() => {
const encoder = new TextEncoder();
const crcTable = buildCrcTable();
const DOWNLOAD_DB_NAME = "folium81-downloads";
const DOWNLOAD_STORE_NAME = "downloads";
const DOWNLOAD_KEY = "latest";

async function buildZip(data) {
  const entries = [];

  if (data?.portadaResult?.blob && data?.portadaResult?.zipPath) {
    entries.push({
      path: data.portadaResult.zipPath,
      bytes: new Uint8Array(await data.portadaResult.blob.arrayBuffer()),
      lastModified: Date.now(),
    });
  }

  for (const item of data?.files || []) {
    entries.push({
      path: item.zipPath,
      bytes: new Uint8Array(await item.file.arrayBuffer()),
      lastModified: item.file.lastModified || Date.now(),
    });
  }

  if (data?.conclusionText) {
    entries.push({
      path: "06_Conclusion_Final/conclusion_final.txt",
      bytes: encoder.encode(data.conclusionText),
      lastModified: Date.now(),
    });
  }

  if (entries.length === 0) {
    return null;
  }

  const zipBytes = buildStoredZip(entries);
  const safeName = slugify(data?.student?.fullName || "portafolio");

  return {
    filename: `folium81_${safeName}.zip`,
    blob: new Blob([zipBytes], { type: "application/zip" }),
  };
}

async function saveGeneratedZip(payload) {
  if (!payload?.blob || !payload?.filename) {
    throw new Error("zip_payload_invalid");
  }

  const db = await openDownloadDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOWNLOAD_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DOWNLOAD_STORE_NAME);
    const request = store.put(
      {
        key: DOWNLOAD_KEY,
        filename: payload.filename,
        blob: payload.blob,
        createdAt: Date.now(),
      },
      DOWNLOAD_KEY
    );

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadGeneratedZip() {
  const db = await openDownloadDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOWNLOAD_STORE_NAME, "readonly");
    const store = transaction.objectStore(DOWNLOAD_STORE_NAME);
    const request = store.get(DOWNLOAD_KEY);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function clearGeneratedZip() {
  const db = await openDownloadDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOWNLOAD_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DOWNLOAD_STORE_NAME);
    const request = store.delete(DOWNLOAD_KEY);

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

function buildStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const crc = crc32(entry.bytes);
    const dos = toDosDateTime(entry.lastModified);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dos.time, true);
    localView.setUint16(12, dos.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.bytes.length, true);
    localView.setUint32(22, entry.bytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, entry.bytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dos.time, true);
    centralView.setUint16(14, dos.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.bytes.length, true);
    centralView.setUint32(24, entry.bytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + entry.bytes.length;
  }

  const centralDirectory = concatUint8Arrays(centralParts);
  const localData = concatUint8Arrays(localParts);

  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localData.length, true);
  endView.setUint16(20, 0, true);

  return concatUint8Arrays([localData, centralDirectory, endHeader]);
}

function concatUint8Arrays(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }

  return merged;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "portafolio";
}

function toDosDateTime(input) {
  const date = new Date(input);
  const year = Math.max(date.getFullYear(), 1980);

  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

function buildCrcTable() {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[i] = crc >>> 0;
  }

  return table;
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function openDownloadDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("indexeddb_unavailable"));
      return;
    }

    const request = window.indexedDB.open(DOWNLOAD_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOWNLOAD_STORE_NAME)) {
        db.createObjectStore(DOWNLOAD_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

globalThis.FoliumZip = {
  buildZip,
  saveGeneratedZip,
  loadGeneratedZip,
  clearGeneratedZip,
};
})();
