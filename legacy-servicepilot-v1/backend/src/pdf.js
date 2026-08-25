import PDFDocument from "pdfkit";

function money(amount) {
  return `$${amount.toFixed(2)}`;
}

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

// Builds a branded, professional invoice PDF entirely in memory and resolves
// with the resulting Buffer. Runs inside a worker thread (see pdfWorker.js) so
// that a malformed logo image -- which can hang PDFKit's image decoder
// indefinitely -- only stalls that one worker instead of the whole server.
export function generateInvoicePdfBuffer(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const owner = invoice.owner;
      const client = invoice.client;
      const brandColor = owner.brandColor || "#4f46e5";
      const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const taxAmount = (subtotal - invoice.discount) * (invoice.taxRate / 100);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const logoBuffer = decodeDataUrl(owner.logoUrl);
      let headerTop = 50;
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, headerTop, { fit: [110, 60] });
        } catch {
          // Malformed logo data shouldn't block PDF generation.
        }
      }

      doc
        .fontSize(20)
        .fillColor(brandColor)
        .text("INVOICE", 350, headerTop, { align: "right" });
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text(`#${invoice.number}`, 350, headerTop + 26, { align: "right" })
        .text(invoice.status.toUpperCase(), 350, headerTop + 40, { align: "right" });

      const businessTop = logoBuffer ? headerTop + 70 : headerTop;
      doc
        .fontSize(14)
        .fillColor("#111111")
        .text(owner.businessName || owner.name, 50, businessTop);
      doc.fontSize(9).fillColor("#555555");
      if (owner.address) doc.text(owner.address, 50, doc.y + 2);
      if (owner.phone) doc.text(owner.phone, 50, doc.y + 2);
      doc.text(owner.email, 50, doc.y + 2);

      doc
        .moveTo(50, doc.y + 15)
        .lineTo(545, doc.y + 15)
        .strokeColor(brandColor)
        .lineWidth(2)
        .stroke();

      const detailsTop = doc.y + 30;
      doc.fontSize(9).fillColor("#888888").text("BILL TO", 50, detailsTop);
      doc.fontSize(11).fillColor("#111111").text(client.name, 50, detailsTop + 14);
      doc.fontSize(9).fillColor("#555555");
      if (client.company) doc.text(client.company, 50, doc.y + 2);
      if (client.email) doc.text(client.email, 50, doc.y + 2);

      doc.fontSize(9).fillColor("#888888").text("ISSUED", 350, detailsTop, { align: "right" });
      doc
        .fontSize(10)
        .fillColor("#111111")
        .text(new Date(invoice.createdAt).toLocaleDateString(), 350, detailsTop + 14, { align: "right" });
      doc.fontSize(9).fillColor("#888888").text("DUE", 350, detailsTop + 34, { align: "right" });
      doc
        .fontSize(10)
        .fillColor("#111111")
        .text(new Date(invoice.dueDate).toLocaleDateString(), 350, detailsTop + 48, { align: "right" });

      let tableTop = detailsTop + 90;
      const columns = { description: 50, qty: 300, unitPrice: 370, amount: 460 };

      doc.rect(50, tableTop, 495, 22).fill(brandColor);
      doc
        .fontSize(9)
        .fillColor("#ffffff")
        .text("DESCRIPTION", columns.description + 8, tableTop + 6)
        .text("QTY", columns.qty, tableTop + 6)
        .text("UNIT PRICE", columns.unitPrice, tableTop + 6)
        .text("AMOUNT", columns.amount, tableTop + 6, { width: 80, align: "right" });

      let rowTop = tableTop + 22;
      doc.fontSize(10).fillColor("#111111");
      invoice.items.forEach((item, index) => {
        const rowHeight = 24;
        if (index % 2 === 1) {
          doc.rect(50, rowTop, 495, rowHeight).fill("#f7f7f9");
          doc.fillColor("#111111");
        }
        doc
          .text(item.description, columns.description + 8, rowTop + 6, { width: 240 })
          .text(String(item.quantity), columns.qty, rowTop + 6)
          .text(money(item.unitPrice), columns.unitPrice, rowTop + 6)
          .text(money(item.quantity * item.unitPrice), columns.amount, rowTop + 6, { width: 80, align: "right" });
        rowTop += rowHeight;
      });

      let totalsTop = rowTop + 20;
      const totalsLabelX = 380;
      const totalsValueX = 460;

      function totalsLine(label, value, opts = {}) {
        doc
          .fontSize(opts.bold ? 12 : 10)
          .fillColor(opts.bold ? "#111111" : "#555555")
          .text(label, totalsLabelX, totalsTop, { width: 80 })
          .text(value, totalsValueX, totalsTop, { width: 80, align: "right" });
        totalsTop += opts.bold ? 22 : 18;
      }

      totalsLine("Subtotal", money(subtotal));
      if (invoice.discount > 0) totalsLine("Discount", `-${money(invoice.discount)}`);
      if (invoice.taxRate > 0) totalsLine(`Tax (${invoice.taxRate}%)`, money(taxAmount));
      doc.moveTo(totalsLabelX, totalsTop).lineTo(545, totalsTop).strokeColor("#dddddd").lineWidth(1).stroke();
      totalsTop += 8;
      totalsLine("Total", money(invoice.amount), { bold: true });

      if (invoice.notes) {
        doc
          .fontSize(9)
          .fillColor("#888888")
          .text("NOTES", 50, totalsTop + 30)
          .fontSize(10)
          .fillColor("#333333")
          .text(invoice.notes, 50, totalsTop + 44, { width: 495 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
