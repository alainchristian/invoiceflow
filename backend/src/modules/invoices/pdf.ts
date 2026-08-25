import PDFDocument from "pdfkit";

// PDF rendering always receives plain numbers (every caller converts Decimal
// fields via toApiNumbers() before calling renderDocumentPdfToBuffer -- see
// serialize.ts), so this uses plain float rounding rather than invoice-math's
// Decimal-returning round2. Fine for display purposes: the persisted totals
// were already computed precisely and rounded server-side before this ever runs.
const round2 = (n: number) => Math.round(n * 100) / 100;

interface PdfDocumentData {
  kind?: "INVOICE" | "QUOTE" | "CREDIT NOTE" | "STATEMENT";
  dueDateLabel?: string;
  number: string;
  status: string;
  issueDate: Date | string;
  dueDate: Date | string | null;
  subtotal: number;
  discount: number;
  invoiceDiscountType?: "FLAT" | "PERCENT";
  invoiceDiscountValue?: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  poNumber?: string | null;
  notes?: string | null;
  terms?: string | null;
  items: { description: string; quantity: number; unitPrice: number; taxRate: number; discount: number; total: number }[];
  customer: { name: string; company?: string | null; email?: string | null };
  organization: {
    name: string;
    logoUrl?: string | null;
    brandColor?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    pdfTemplate?: string | null;
  };
}

function money(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function decodeDataUrl(dataUrl?: string | null): Buffer | null {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

function invoiceDiscountAmountOf(invoice: PdfDocumentData): number {
  return !invoice.invoiceDiscountValue || invoice.invoiceDiscountValue <= 0
    ? 0
    : invoice.invoiceDiscountType === "PERCENT"
      ? round2(invoice.subtotal * (invoice.invoiceDiscountValue / 100))
      : invoice.invoiceDiscountValue;
}

// The original layout: brand-colored header rule, alternating-shade item
// rows, right-aligned totals block.
function renderClassicLayout(doc: PDFKit.PDFDocument, invoice: PdfDocumentData) {
  const org = invoice.organization;
  const brandColor = org.brandColor || "#4f46e5";

  const logoBuffer = decodeDataUrl(org.logoUrl);
  const headerTop = 50;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, headerTop, { fit: [110, 60] });
    } catch {
      // Malformed logo shouldn't block PDF generation.
    }
  }

  doc.fontSize(20).fillColor(brandColor).text(invoice.kind ?? "INVOICE", 350, headerTop, { align: "right" });
  doc
    .fontSize(10)
    .fillColor("#333333")
    .text(`#${invoice.number}`, 350, headerTop + 26, { align: "right" })
    .text(invoice.status, 350, headerTop + 40, { align: "right" });

  const businessTop = logoBuffer ? headerTop + 70 : headerTop;
  doc.fontSize(14).fillColor("#111111").text(org.name, 50, businessTop);
  doc.fontSize(9).fillColor("#555555");
  if (org.address) doc.text(org.address, 50, doc.y + 2);
  if (org.phone) doc.text(org.phone, 50, doc.y + 2);
  if (org.email) doc.text(org.email, 50, doc.y + 2);

  doc.moveTo(50, doc.y + 15).lineTo(545, doc.y + 15).strokeColor(brandColor).lineWidth(2).stroke();

  const detailsTop = doc.y + 30;
  doc.fontSize(9).fillColor("#888888").text("BILL TO", 50, detailsTop);
  doc.fontSize(11).fillColor("#111111").text(invoice.customer.name, 50, detailsTop + 14);
  doc.fontSize(9).fillColor("#555555");
  if (invoice.customer.company) doc.text(invoice.customer.company, 50, doc.y + 2);
  if (invoice.customer.email) doc.text(invoice.customer.email, 50, doc.y + 2);
  if (invoice.poNumber) {
    doc.fontSize(9).fillColor("#888888").text(`PO #: ${invoice.poNumber}`, 50, doc.y + 6);
  }

  doc.fontSize(9).fillColor("#888888").text("ISSUED", 350, detailsTop, { align: "right" });
  doc
    .fontSize(10)
    .fillColor("#111111")
    .text(new Date(invoice.issueDate).toLocaleDateString(), 350, detailsTop + 14, { align: "right" });
  if (invoice.dueDate) {
    doc
      .fontSize(9)
      .fillColor("#888888")
      .text(invoice.dueDateLabel ?? "DUE", 350, detailsTop + 34, { align: "right" });
    doc
      .fontSize(10)
      .fillColor("#111111")
      .text(new Date(invoice.dueDate).toLocaleDateString(), 350, detailsTop + 48, { align: "right" });
  }

  let tableTop = detailsTop + 90;
  const columns = { description: 50, qty: 280, unitPrice: 340, tax: 410, amount: 460 };

  doc.rect(50, tableTop, 495, 22).fill(brandColor);
  doc
    .fontSize(9)
    .fillColor("#ffffff")
    .text("DESCRIPTION", columns.description + 8, tableTop + 6)
    .text("QTY", columns.qty, tableTop + 6)
    .text("PRICE", columns.unitPrice, tableTop + 6)
    .text("TAX", columns.tax, tableTop + 6)
    .text("AMOUNT", columns.amount, tableTop + 6, { width: 80, align: "right" });

  let rowTop = tableTop + 22;
  doc.fontSize(9).fillColor("#111111");
  invoice.items.forEach((item, index) => {
    const rowHeight = 24;
    if (index % 2 === 1) {
      doc.rect(50, rowTop, 495, rowHeight).fill("#f7f7f9");
      doc.fillColor("#111111");
    }
    doc
      .text(item.description, columns.description + 8, rowTop + 6, { width: 220 })
      .text(String(item.quantity), columns.qty, rowTop + 6)
      .text(money(item.unitPrice), columns.unitPrice, rowTop + 6)
      .text(item.taxRate ? `${item.taxRate}%` : "-", columns.tax, rowTop + 6)
      .text(money(item.total), columns.amount, rowTop + 6, { width: 80, align: "right" });
    rowTop += rowHeight;
  });

  let totalsTop = rowTop + 20;
  const totalsLabelX = 380;
  const totalsValueX = 460;

  function totalsLine(label: string, value: string, bold = false) {
    doc
      .fontSize(bold ? 12 : 10)
      .fillColor(bold ? "#111111" : "#555555")
      .text(label, totalsLabelX, totalsTop, { width: 80 })
      .text(value, totalsValueX, totalsTop, { width: 80, align: "right" });
    totalsTop += bold ? 22 : 18;
  }

  const invoiceDiscountAmount = invoiceDiscountAmountOf(invoice);

  totalsLine("Subtotal", money(invoice.subtotal));
  if (invoice.discount > 0) totalsLine("Item discounts", `-${money(invoice.discount)}`);
  if (invoice.taxTotal > 0) totalsLine("Tax", money(invoice.taxTotal));
  if (invoiceDiscountAmount > 0) {
    const label =
      invoice.invoiceDiscountType === "PERCENT" ? `Discount (${invoice.invoiceDiscountValue}%)` : "Discount";
    totalsLine(label, `-${money(invoiceDiscountAmount)}`);
  }
  doc.moveTo(totalsLabelX, totalsTop).lineTo(545, totalsTop).strokeColor("#dddddd").lineWidth(1).stroke();
  totalsTop += 8;
  totalsLine("Total", money(invoice.total), true);
  if (invoice.amountPaid > 0) {
    totalsLine("Paid", money(invoice.amountPaid));
    totalsLine("Balance due", money(invoice.total - invoice.amountPaid), true);
  }

  if (invoice.notes) {
    doc
      .fontSize(9)
      .fillColor("#888888")
      .text("NOTES", 50, totalsTop + 30)
      .fontSize(10)
      .fillColor("#333333")
      .text(invoice.notes, 50, totalsTop + 44, { width: 495 });
  }
  if (invoice.terms) {
    doc
      .fontSize(9)
      .fillColor("#888888")
      .text("TERMS", 50, doc.y + 16)
      .fontSize(10)
      .fillColor("#333333")
      .text(invoice.terms, 50, doc.y + 4, { width: 495 });
  }
}

// A left-aligned, bolder layout: a vertical brand-color accent bar instead
// of a horizontal rule, bottom-border item rows instead of alternating
// shading, and a boxed totals panel.
function renderModernLayout(doc: PDFKit.PDFDocument, invoice: PdfDocumentData) {
  const org = invoice.organization;
  const brandColor = org.brandColor || "#4f46e5";

  doc.rect(50, 40, 6, 90).fill(brandColor);

  const logoBuffer = decodeDataUrl(org.logoUrl);
  const headerLeft = 70;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, headerLeft, 40, { fit: [100, 55] });
    } catch {
      // Malformed logo shouldn't block PDF generation.
    }
  }

  const titleLeft = logoBuffer ? headerLeft + 115 : headerLeft;
  doc.fontSize(22).fillColor("#111111").text(invoice.kind ?? "INVOICE", titleLeft, 42, { characterSpacing: 1 });
  doc
    .fontSize(10)
    .fillColor(brandColor)
    .text(`#${invoice.number} · ${invoice.status}`, titleLeft, 70);

  doc.fontSize(14).fillColor("#111111").text(org.name, 50, 150);
  doc.fontSize(9).fillColor("#555555");
  if (org.address) doc.text(org.address, 50, doc.y + 2);
  if (org.phone) doc.text(org.phone, 50, doc.y + 2);
  if (org.email) doc.text(org.email, 50, doc.y + 2);

  const detailsTop = doc.y + 24;
  doc.rect(50, detailsTop, 495, 1).fill("#eeeeee");

  doc.fontSize(9).fillColor(brandColor).text("BILL TO", 50, detailsTop + 16, { characterSpacing: 0.5 });
  doc.fontSize(11).fillColor("#111111").text(invoice.customer.name, 50, detailsTop + 30);
  doc.fontSize(9).fillColor("#555555");
  if (invoice.customer.company) doc.text(invoice.customer.company, 50, doc.y + 2);
  if (invoice.customer.email) doc.text(invoice.customer.email, 50, doc.y + 2);
  if (invoice.poNumber) {
    doc.fontSize(9).fillColor("#888888").text(`PO #: ${invoice.poNumber}`, 50, doc.y + 6);
  }

  doc.fontSize(9).fillColor(brandColor).text("ISSUED", 350, detailsTop + 16, { align: "right", characterSpacing: 0.5 });
  doc
    .fontSize(10)
    .fillColor("#111111")
    .text(new Date(invoice.issueDate).toLocaleDateString(), 350, detailsTop + 30, { align: "right" });
  if (invoice.dueDate) {
    doc
      .fontSize(9)
      .fillColor(brandColor)
      .text(invoice.dueDateLabel ?? "DUE", 350, detailsTop + 50, { align: "right", characterSpacing: 0.5 });
    doc
      .fontSize(10)
      .fillColor("#111111")
      .text(new Date(invoice.dueDate).toLocaleDateString(), 350, detailsTop + 64, { align: "right" });
  }

  let tableTop = detailsTop + 106;
  const columns = { description: 50, qty: 280, unitPrice: 340, tax: 410, amount: 460 };

  doc
    .fontSize(9)
    .fillColor(brandColor)
    .text("DESCRIPTION", columns.description, tableTop, { characterSpacing: 0.5 })
    .text("QTY", columns.qty, tableTop, { characterSpacing: 0.5 })
    .text("PRICE", columns.unitPrice, tableTop, { characterSpacing: 0.5 })
    .text("TAX", columns.tax, tableTop, { characterSpacing: 0.5 })
    .text("AMOUNT", columns.amount, tableTop, { width: 80, align: "right", characterSpacing: 0.5 });
  doc.rect(50, tableTop + 16, 495, 1.5).fill(brandColor);

  let rowTop = tableTop + 26;
  doc.fontSize(9).fillColor("#111111");
  invoice.items.forEach((item) => {
    const rowHeight = 26;
    doc
      .fillColor("#111111")
      .text(item.description, columns.description, rowTop, { width: 220 })
      .text(String(item.quantity), columns.qty, rowTop)
      .text(money(item.unitPrice), columns.unitPrice, rowTop)
      .text(item.taxRate ? `${item.taxRate}%` : "-", columns.tax, rowTop)
      .text(money(item.total), columns.amount, rowTop, { width: 80, align: "right" });
    doc.rect(50, rowTop + 18, 495, 0.75).fill("#eeeeee");
    rowTop += rowHeight;
  });

  const invoiceDiscountAmount = invoiceDiscountAmountOf(invoice);

  const panelLines: [string, string, boolean?][] = [["Subtotal", money(invoice.subtotal)]];
  if (invoice.discount > 0) panelLines.push(["Item discounts", `-${money(invoice.discount)}`]);
  if (invoice.taxTotal > 0) panelLines.push(["Tax", money(invoice.taxTotal)]);
  if (invoiceDiscountAmount > 0) {
    const label =
      invoice.invoiceDiscountType === "PERCENT" ? `Discount (${invoice.invoiceDiscountValue}%)` : "Discount";
    panelLines.push([label, `-${money(invoiceDiscountAmount)}`]);
  }
  panelLines.push(["Total", money(invoice.total), true]);
  if (invoice.amountPaid > 0) {
    panelLines.push(["Paid", money(invoice.amountPaid)]);
    panelLines.push(["Balance due", money(invoice.total - invoice.amountPaid), true]);
  }

  const panelTop = rowTop + 14;
  const panelHeight = panelLines.length * 20 + 16;
  const panelX = 320;
  const panelWidth = 225;
  doc.rect(panelX, panelTop, panelWidth, panelHeight).fill("#f7f7fb");

  let lineY = panelTop + 12;
  panelLines.forEach(([label, value, bold]) => {
    doc
      .fontSize(bold ? 11 : 10)
      .fillColor(bold ? "#111111" : "#555555")
      .text(label, panelX + 14, lineY, { width: 100 })
      .text(value, panelX + panelWidth - 94, lineY, { width: 80, align: "right" });
    lineY += 20;
  });

  let afterPanelY = panelTop + panelHeight + 24;
  if (invoice.notes) {
    doc
      .fontSize(9)
      .fillColor(brandColor)
      .text("NOTES", 50, afterPanelY, { characterSpacing: 0.5 })
      .fontSize(10)
      .fillColor("#333333")
      .text(invoice.notes, 50, afterPanelY + 14, { width: 495 });
    afterPanelY = doc.y + 16;
  }
  if (invoice.terms) {
    doc
      .fontSize(9)
      .fillColor(brandColor)
      .text("TERMS", 50, afterPanelY, { characterSpacing: 0.5 })
      .fontSize(10)
      .fillColor("#333333")
      .text(invoice.terms, 50, afterPanelY + 14, { width: 495 });
  }
}

// Builds a branded invoice/quote PDF entirely in memory. Runs inside a worker
// thread (see pdfWorker.ts) so a malformed logo -- which can hang PDFKit's
// image decoder indefinitely -- only stalls that worker, never the server.
export function generateDocumentPdfBuffer(invoice: PdfDocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      if (invoice.organization.pdfTemplate === "modern") {
        renderModernLayout(doc, invoice);
      } else {
        renderClassicLayout(doc, invoice);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
