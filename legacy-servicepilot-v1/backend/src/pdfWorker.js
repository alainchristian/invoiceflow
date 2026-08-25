import { parentPort, workerData } from "worker_threads";
import { generateInvoicePdfBuffer } from "./pdf.js";

generateInvoicePdfBuffer(workerData.invoice)
  .then((buffer) => parentPort.postMessage({ ok: true, buffer }))
  .catch((err) => parentPort.postMessage({ ok: false, error: String(err?.message || err) }));
