import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, "pdfWorker.js");
const PDF_TIMEOUT_MS = 8000;

// PDFKit's image decoder can hang indefinitely (not throw) on a malformed
// logo, which would otherwise block the whole single-threaded server for
// every tenant. Generating in a worker thread lets us terminate a stuck
// render after a timeout without affecting any other request.
export function renderInvoicePdfToBuffer(invoice) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, { workerData: { invoice } });
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(new Error("PDF generation timed out. If you recently uploaded a logo, try a different image file."));
    }, PDF_TIMEOUT_MS);

    worker.once("message", (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (msg.ok) {
        resolve(Buffer.from(msg.buffer));
      } else {
        reject(new Error(msg.error));
      }
    });

    worker.once("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      reject(err);
    });
  });
}
