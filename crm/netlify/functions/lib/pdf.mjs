// ============================================================================
// QUOTE PDF — renders a customer-facing PDF from a quote's stored snapshot.
// Used by both GET /quotes/:id/pdf (preview/download) and POST
// /quotes/:id/send (email attachment) so the document is built exactly once.
// ============================================================================

import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 495; // A4 width (595) minus left+right margins
const LOGO_PATH = fileURLToPath(new URL('../../../assets/cameron-co-logo-cropped.png', import.meta.url));
const WEBSITE = 'cameronco.com.au';

const BRANCH_INFO = {
  melbourne: {
    label: 'Melbourne Office',
    addressLines: ['73–75 Canterbury Road', 'Canterbury VIC 3126'],
    phone: '(03) 9836 9922',
    email: 'salesvic@cameronco.com.au',
    abn: '73 664 633 087',
  },
  sydney: {
    label: 'Sydney Office',
    addressLines: ['Suite 2, Level 7, 37 York St.', 'Sydney NSW 2000'],
    phone: '(02) 9699 2266',
    email: 'nswsales@cameronco.com.au',
    abn: '94 664 633 112',
  },
};

const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateStr = (d) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export async function buildQuotePdf(q, { itemTypeLabels = {}, categoryLabels = {} } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const customerName = [q.first_name, q.last_name].filter(Boolean).join(' ');
  const addressLines = [
    q.address_line1,
    q.address_line2,
    [q.suburb, q.state, q.postcode].filter(Boolean).join(' '),
  ].filter(Boolean);

  // -- header: logo (left) + issuing office letterhead (right) ---------------
  const office = BRANCH_INFO[q.branch] || BRANCH_INFO.melbourne;
  const headerTop = doc.y;

  const logoW = 170;
  const logoH = logoW * (820 / 2000);
  doc.image(LOGO_PATH, PAGE_MARGIN, headerTop, { width: logoW });
  doc.font('Helvetica').fontSize(9).fillColor('#666')
    .text('Insurance replacement quote', PAGE_MARGIN, headerTop + logoH + 4);
  const logoBottom = doc.y;

  const officeX = 300;
  const officeW = PAGE_MARGIN + PAGE_WIDTH - officeX;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a')
    .text(office.label, officeX, headerTop, { width: officeW, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor('#555');
  [...office.addressLines, office.phone, office.email, WEBSITE, `ABN ${office.abn}`].forEach((line) => {
    doc.text(line, officeX, doc.y, { width: officeW, align: 'right' });
  });
  const officeBottom = doc.y;

  doc.x = PAGE_MARGIN;
  doc.y = Math.max(logoBottom, officeBottom) + 10;
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + PAGE_WIDTH, doc.y).strokeColor('#cc5833').lineWidth(2).stroke();
  doc.moveDown(0.8);

  const statusLabel = q.status === 'draft' ? 'Draft' : titleCase(q.status);
  doc.font('Helvetica').fontSize(9).fillColor('#666')
    .text(`Quote v${q.version} — ${statusLabel}    ·    Generated ${dateStr(q.created_at)}`);
  doc.moveDown(1);

  // -- claim + customer details (single column, avoids two-column pdfkit
  // coordinate juggling that's easy to get subtly wrong) --------------------
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a').text('Claim details');
  doc.font('Helvetica').fontSize(9).fillColor('#333');
  doc.text(`Claim number: ${q.claim_number}`);
  if (q.our_ref) doc.text(`Our ref: ${q.our_ref}`);
  if (q.your_ref) doc.text(`Your ref: ${q.your_ref}`);
  doc.text(`Insurer: ${q.insurer_name || 'Private work (no insurer)'}`);
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a').text('Customer');
  doc.font('Helvetica').fontSize(9).fillColor('#333');
  doc.text(customerName || '—');
  addressLines.forEach((l) => doc.text(l));
  doc.moveDown(1.2);

  // -- items table -----------------------------------------------------------
  const items = Array.isArray(q.items_snapshot) ? q.items_snapshot : [];
  const col = { no: PAGE_MARGIN, desc: PAGE_MARGIN + 30, retail: 340, nett: 415, liability: 480 };
  const rowH = 22;

  const drawHeaderRow = (y) => {
    doc.rect(PAGE_MARGIN, y, PAGE_WIDTH, rowH).fill('#1a1a1a');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
    doc.text('#', col.no + 4, y + 7, { width: 20 });
    doc.text('Item', col.desc, y + 7, { width: 300 });
    doc.text('Retail', col.retail, y + 7, { width: 65, align: 'right' });
    doc.text('Nett', col.nett, y + 7, { width: 55, align: 'right' });
    doc.text('Liab.', col.liability, y + 7, { width: 45, align: 'right' });
    return y + rowH;
  };

  let y = drawHeaderRow(doc.y);
  doc.font('Helvetica').fontSize(9);

  items.forEach((it, i) => {
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    if (y + rowH > pageBottom) {
      doc.addPage();
      y = drawHeaderRow(PAGE_MARGIN);
      doc.font('Helvetica').fontSize(9);
    }
    if (i % 2 === 1) doc.rect(PAGE_MARGIN, y, PAGE_WIDTH, rowH).fill('#f5f3ee');
    doc.fillColor('#333');

    const typeLabel = itemTypeLabels[it.item_type] || titleCase(it.item_type);
    const catLabel = categoryLabels[it.category] || titleCase(it.category);
    const parts = [it.description, catLabel, typeLabel && typeLabel !== catLabel ? typeLabel : null]
      .filter(Boolean);
    const label = parts.join(' — ') || '—';

    doc.text(String(it.item_no ?? i + 1), col.no + 4, y + 7, { width: 20 });
    doc.text(label, col.desc, y + 7, { width: 300 });
    doc.text(money(it.retail_price), col.retail, y + 7, { width: 65, align: 'right' });
    doc.text(money(it.insurance_nett), col.nett, y + 7, { width: 55, align: 'right' });
    doc.text(money(it.liability), col.liability, y + 7, { width: 45, align: 'right' });
    y += rowH;
  });

  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + PAGE_WIDTH, y).strokeColor('#ccc').lineWidth(1).stroke();
  doc.x = PAGE_MARGIN;
  doc.y = y + 14;

  // -- totals ------------------------------------------------------------
  const totalsX = 300;
  const totalsLabelW = 140;
  const totalsValueX = PAGE_MARGIN + PAGE_WIDTH - 95;
  const totalsValueW = 95;

  const totalLine = (label, value, bold) => {
    const lineY = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9).fillColor('#1a1a1a');
    doc.text(label, totalsX, lineY, { width: totalsLabelW, align: 'left' });
    doc.text(value, totalsValueX, lineY, { width: totalsValueW, align: 'right' });
    doc.y = lineY + (bold ? 14 : 12);
  };

  if (Number(q.postage_handling)) totalLine('Postage & handling', money(q.postage_handling));
  if (Number(q.salvage_allocation)) totalLine('Salvage allocation', '-' + money(q.salvage_allocation));
  doc.moveDown(0.4);
  totalLine('Total retail (inc. GST)', money(q.total_retail));
  totalLine('Insurance nett', money(q.total_nett));
  doc.moveDown(0.2);
  totalLine('Liability — limits applied', money(q.total_liability), true);

  doc.moveDown(2);
  doc.font('Helvetica').fontSize(8).fillColor('#777');
  doc.text(
    'This quote is valid for 30 days from the date above and is subject to final inspection of the ' +
    'item(s) on completion. Prices reflect current metal spot rates and may vary if the quote is not ' +
    'accepted within the validity period.',
    PAGE_MARGIN, doc.y, { width: PAGE_WIDTH }
  );
  if (q.excess_amount && Number(q.excess_amount) > 0) {
    doc.text(`Policy excess payable by customer: ${money(q.excess_amount)}`, PAGE_MARGIN, doc.y, { width: PAGE_WIDTH });
  }

  doc.end();
  return finished;
}
