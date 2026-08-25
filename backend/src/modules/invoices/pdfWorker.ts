import { parentPort, workerData } from "worker_threads";
import { generateDocumentPdfBuffer } from "./pdf.js";

generateDocumentPdfBuffer(workerData.document)
  .then((buffer) => parentPort?.postMessage({ ok: true, buffer }))
  .catch((err) => parentPort?.postMessage({ ok: false, error: String(err?.message || err) }));
