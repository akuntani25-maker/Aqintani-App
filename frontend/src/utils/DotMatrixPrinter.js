// Dot Matrix Printer Utility - Epson LX-310 (ESC/P)
// Format: Invoice pada kertas continuous form 22cm x 14cm NCR 3-ply
// Pendekatan: Continuous printing - setiap halaman tepat 33 baris (14cm di 6 LPI)
// Tidak pakai FF, cukup padding baris kosong agar pas dengan potongan kertas
import { escapeHtml as eH } from './htmlEscape';

const LOCAL_PRINT_SERVER = 'http://localhost:9100';
const MAX_ITEMS_PER_PAGE = 10;
const LINES_PER_PAGE = 33; // 14cm / (1/6 inch per line) ≈ 33 lines

// === Terbilang ===
const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
function terbilang(n) {
  n = Math.abs(Math.floor(n));
  if (n === 0) return 'Nol';
  if (n < 12) return satuan[n];
  if (n < 20) return satuan[n - 10] + ' Belas';
  if (n < 100) return satuan[Math.floor(n / 10)] + ' Puluh' + (n % 10 ? ' ' + satuan[n % 10] : '');
  if (n < 200) return 'Seratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 1000) return satuan[Math.floor(n / 100)] + ' Ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 2000) return 'Seribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
  if (n < 1000000) return terbilang(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
  if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + ' Juta' + (n % 1000000 ? ' ' + terbilang(n % 1000000) : '');
  if (n < 1000000000000) return terbilang(Math.floor(n / 1000000000)) + ' Milyar' + (n % 1000000000 ? ' ' + terbilang(n % 1000000000) : '');
  return terbilang(Math.floor(n / 1000000000000)) + ' Triliun' + (n % 1000000000000 ? ' ' + terbilang(n % 1000000000000) : '');
}

class DotMatrixPrinter {
  cmd = {
    INIT: [0x1B, 0x40],
    LF: [0x0A],
    BOLD_ON: [0x1B, 0x45],
    BOLD_OFF: [0x1B, 0x46],
    EXPANDED_ON: [0x1B, 0x57, 0x01],
    EXPANDED_OFF: [0x1B, 0x57, 0x00],
    ITALIC_ON: [0x1B, 0x34],
    ITALIC_OFF: [0x1B, 0x35],
    CPI_10: [0x1B, 0x50],
    LINE_SPACING_1_6: [0x1B, 0x32], // 1/6 inch = 6 LPI
  };

  W = 80;
  lineCount = 0; // track baris yang sudah dicetak di halaman ini

  textToBytes(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      bytes.push(c > 127 ? 63 : c);
    }
    return bytes;
  }

  pad(text, width, align = 'left') {
    const t = String(text).substring(0, width);
    const gap = Math.max(0, width - t.length);
    if (align === 'right') return ' '.repeat(gap) + t;
    if (align === 'center') return ' '.repeat(Math.floor(gap / 2)) + t + ' '.repeat(gap - Math.floor(gap / 2));
    return t + ' '.repeat(gap);
  }

  fmtN(v) { return new Intl.NumberFormat('id-ID').format(v); }
  fmtDate(ds) { return new Date(ds).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

  // Tulis 1 baris teks + LF, increment counter
  writeLine(d, text) {
    d.push(...this.textToBytes(text));
    d.push(...this.cmd.LF);
    this.lineCount++;
  }

  // Tulis baris kosong
  writeBlank(d) {
    d.push(...this.cmd.LF);
    this.lineCount++;
  }

  // Padding baris kosong sampai genap LINES_PER_PAGE (= batas potongan kertas)
  padToPageEnd(d) {
    while (this.lineCount < LINES_PER_PAGE) {
      d.push(...this.cmd.LF);
      this.lineCount++;
    }
    this.lineCount = 0; // reset untuk halaman berikutnya
  }

  prepareItems(order) {
    return (order.is_settled && order.settled_items)
      ? order.settled_items.filter(si => si.qty_sold > 0).map(si => ({
          name: si.product_name, qty: si.qty_sold, price: si.price,
          subtotal: si.qty_sold * si.price, unit: 'satuan', ipb: 1
        }))
      : order.items.filter(item => (item.quantity || 0) > 0).map(item => {
          const unit = item.sell_unit || item.unit || 'satuan';
          const ipb = item.items_per_box || 1;
          return {
            name: item.product_name, qty: item.quantity, price: item.price,
            subtotal: item.subtotal || (item.quantity * item.price), unit, ipb
          };
        });
  }

  // ============================================================
  // BUILD INVOICE - ESC/P raw
  // Continuous form: setiap halaman tepat 33 baris, tanpa FF
  // ============================================================
  buildPartnerInvoice(order, storeSettings = {}) {
    const d = [];
    const W = this.W;
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storePhone = storeSettings?.phone || '';
    const tgl = this.fmtDate(order.created_at);
    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
    const sep = '-'.repeat(W);
    const items = this.prepareItems(order);

    // Split items max 10 per halaman
    const pages = [];
    for (let i = 0; i < items.length; i += MAX_ITEMS_PER_PAGE) {
      pages.push(items.slice(i, i + MAX_ITEMS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);
    const totalPages = pages.length;

    // Init
    d.push(...this.cmd.INIT);
    d.push(...this.cmd.CPI_10);
    d.push(...this.cmd.LINE_SPACING_1_6);
    this.lineCount = 0;

    const R = 40; // kolom mulai sisi kanan

    for (let p = 0; p < totalPages; p++) {
      const pageItems = pages[p];
      const isFirst = p === 0;
      const isLast = p === totalPages - 1;
      const startIdx = p * MAX_ITEMS_PER_PAGE;

      if (isFirst) {
        // ===== HEADER HALAMAN 1 =====
        // Baris 1: INVOICE + UD. AQIN TANI (bold expanded) -> 1 line
        d.push(...this.cmd.BOLD_ON, ...this.cmd.EXPANDED_ON);
        d.push(...this.textToBytes(this.pad('INVOICE', 20)));
        d.push(...this.textToBytes(storeName));
        d.push(...this.cmd.LF);
        d.push(...this.cmd.EXPANDED_OFF, ...this.cmd.BOLD_OFF);
        this.lineCount++;

        // Baris 2: Kepada + Alamat toko
        this.writeLine(d, this.pad('Kepada :', R) + 'Jl. Raya Labuhan Lombok, Wanasaba');

        // Baris 3: Nama kios bold + Telp
        d.push(...this.cmd.BOLD_ON);
        d.push(...this.textToBytes(this.pad(order.partner_store_name, R)));
        d.push(...this.cmd.BOLD_OFF);
        d.push(...this.textToBytes(storePhone ? 'Telp: ' + storePhone : ''));
        d.push(...this.cmd.LF);
        this.lineCount++;

        // Baris 4: Alamat kios
        this.writeLine(d, order.partner_address || '');

        // Baris 5: No Invoice (kanan)
        this.writeLine(d, this.pad('', R) + 'No Invoice : ' + order.order_number);

        // Baris 6: Tanggal (kanan)
        this.writeLine(d, this.pad('', R) + 'Tanggal    : ' + tgl);

        // Baris 7: Kode Sales
        if (order.canvasser_name) {
          this.writeLine(d, 'Kode Sales : ' + order.canvasser_name);
        }

        // Baris 8: blank
        this.writeBlank(d);

      } else {
        // ===== HEADER HALAMAN SAMBUNGAN =====
        d.push(...this.cmd.BOLD_ON);
        this.writeLine(d, this.pad(storeName, R) + 'INVOICE ' + order.order_number);
        d.push(...this.cmd.BOLD_OFF);
        this.writeLine(d, this.pad('Kepada: ' + order.partner_store_name, R) + 'Tanggal: ' + tgl);
        this.writeBlank(d);
      }

      // ===== TABEL =====
      this.writeLine(d, sep);
      d.push(...this.cmd.BOLD_ON);
      this.writeLine(d,
        this.pad('No.', 4) +
        this.pad('Nama Barang', 28) +
        this.pad('Jumlah CTN', 12, 'center') +
        this.pad('Quantity', 10, 'center') +
        this.pad('Harga', 12, 'right') +
        this.pad('Jumlah', 14, 'right')
      );
      d.push(...this.cmd.BOLD_OFF);
      this.writeLine(d, sep);

      // Item rows
      pageItems.forEach((item, i) => {
        const isDus = item.unit === 'dus';
        const jmlCtn = isDus ? item.qty + ' DUS' : item.qty + ' PCS';
        const totalQty = isDus ? this.fmtN(item.qty * (item.ipb || 1)) : this.fmtN(item.qty);
        this.writeLine(d,
          this.pad(String(startIdx + i + 1), 4) +
          this.pad(item.name, 28) +
          this.pad(jmlCtn, 12, 'center') +
          this.pad(totalQty, 10, 'center') +
          this.pad(this.fmtN(item.price), 12, 'right') +
          this.pad(this.fmtN(item.subtotal), 14, 'right')
        );
      });

      this.writeLine(d, sep);

      if (isLast) {
        // ===== FOOTER (halaman terakhir) =====
        d.push(...this.cmd.BOLD_ON);
        this.writeLine(d,
          this.pad('', 54) +
          this.pad('Sub Total', 12, 'right') +
          this.pad(this.fmtN(order.total), 14, 'right')
        );
        d.push(...this.cmd.BOLD_OFF);
        this.writeLine(d, sep);

        // Terbilang
        d.push(...this.cmd.ITALIC_ON);
        this.writeLine(d, 'Terbilang: ' + terbilang(order.total) + ' Rupiah');
        d.push(...this.cmd.ITALIC_OFF);
        this.writeLine(d, sep);

        // Catatan (kiri) + Ringkasan (kanan)
        const leftCol = 44;
        const rightCol = W - leftCol;

        const catatanLines = [
          'Catatan :',
          '- Barang yg sudah dibeli tidak dapat',
          '  dikembalikan kecuali ada perjanjian.',
          '- Mohon diperiksa dengan teliti.',
          '- Terima kasih.',
        ];

        const sumLines = [];
        const isCash = order.payment_type === 'cash';
        if (isCash) {
          sumLines.push({ label: 'Total Pesanan', val: this.fmtN(order.total), bold: true });
          sumLines.push({ label: 'Pembayaran', val: 'CASH', bold: true });
        } else {
          if (previousDebt > 0) {
            sumLines.push({ label: 'Total Pesanan Ini', val: this.fmtN(order.total), bold: false });
            sumLines.push({ label: 'Bon Sebelumnya', val: this.fmtN(previousDebt), bold: false });
          }
          sumLines.push({ label: 'Total Tagihan', val: this.fmtN(previousDebt > 0 ? previousDebt + order.total : order.total), bold: true });
          if (order.paid > 0) {
            sumLines.push({ label: 'Dibayar', val: '(' + this.fmtN(order.paid) + ')', bold: false });
            sumLines.push({ label: 'Sisa Hutang', val: this.fmtN(order.partner_debt_total || 0), bold: false });
          }
        }

        const maxRows = Math.max(catatanLines.length, sumLines.length);
        for (let i = 0; i < maxRows; i++) {
          const leftText = catatanLines[i] || '';
          const isHead = leftText === 'Catatan :';
          let line = '';

          if (isHead) {
            d.push(...this.cmd.BOLD_ON);
            line = this.pad(leftText, leftCol);
            d.push(...this.textToBytes(line));
            d.push(...this.cmd.BOLD_OFF);
          } else {
            line = this.pad(leftText, leftCol);
            d.push(...this.textToBytes(line));
          }

          if (i < sumLines.length) {
            const s = sumLines[i];
            if (s.bold) d.push(...this.cmd.BOLD_ON);
            d.push(...this.textToBytes(this.pad(s.label, rightCol - s.val.length - 2) + ': ' + s.val));
            if (s.bold) d.push(...this.cmd.BOLD_OFF);
          }
          d.push(...this.cmd.LF);
          this.lineCount++;
        }

        // Pad sisa halaman terakhir sampai batas potongan kertas
        this.padToPageEnd(d);

      } else {
        // Bersambung
        d.push(...this.cmd.ITALIC_ON);
        this.writeLine(d, this.pad('Bersambung...   Hal ' + (p + 1) + '/' + totalPages, W, 'right'));
        d.push(...this.cmd.ITALIC_OFF);

        // Pad baris kosong sampai genap 33 baris (batas potongan kertas)
        this.padToPageEnd(d);
      }
    }

    return d;
  }

  // ============================================================
  // BROWSER PRINT - HTML preview (identik dengan ESC/P)
  // ============================================================
  browserPrintFallback(order, storeSettings = {}) {
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storePhone = storeSettings?.phone || '';
    const tgl = this.fmtDate(order.created_at);
    const fN = (v) => new Intl.NumberFormat('id-ID').format(v);
    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
    const totalWords = terbilang(order.total) + ' Rupiah';
    const items = this.prepareItems(order);

    const pages = [];
    for (let i = 0; i < items.length; i += MAX_ITEMS_PER_PAGE) {
      pages.push(items.slice(i, i + MAX_ITEMS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);
    const totalPages = pages.length;

    let summaryRows = '';
    const isCash = order.payment_type === 'cash';
    if (isCash) {
      summaryRows += `<tr class="grand"><td><strong>Total Pesanan</strong></td><td class="r"><strong>${fN(order.total)}</strong></td></tr>`;
      summaryRows += `<tr class="grand"><td><strong>Pembayaran</strong></td><td class="r"><strong>CASH</strong></td></tr>`;
    } else {
      if (previousDebt > 0) {
        summaryRows += `<tr><td>Total Pesanan Ini</td><td class="r">${fN(order.total)}</td></tr>`;
        summaryRows += `<tr><td>Bon Sebelumnya</td><td class="r">${fN(previousDebt)}</td></tr>`;
      }
      summaryRows += `<tr class="grand"><td><strong>Total Tagihan</strong></td><td class="r"><strong>${fN(previousDebt > 0 ? previousDebt + order.total : order.total)}</strong></td></tr>`;
      if (order.paid > 0) {
        summaryRows += `<tr><td>Dibayar</td><td class="r">(${fN(order.paid)})</td></tr>`;
        summaryRows += `<tr><td>Sisa Hutang</td><td class="r">${fN(order.partner_debt_total || 0)}</td></tr>`;
      }
    }

    let pagesHtml = '';
    for (let p = 0; p < totalPages; p++) {
      const pageItems = pages[p];
      const isFirst = p === 0;
      const isLast = p === totalPages - 1;
      const startIdx = p * MAX_ITEMS_PER_PAGE;
      const pageBreak = !isLast ? 'page-break-after:always;' : '';

      const tableRows = pageItems.map((item, i) => {
        const isDus = item.unit === 'dus';
        const jmlCtn = isDus ? item.qty + ' DUS' : item.qty + ' PCS';
        const totalQty = isDus ? fN(item.qty * item.ipb) : fN(item.qty);
        return `<tr><td class="c">${startIdx + i + 1}</td><td>${eH(item.name)}</td><td class="c">${jmlCtn}</td><td class="c">${totalQty}</td><td class="r">${fN(item.price)}</td><td class="r">${fN(item.subtotal)}</td></tr>`;
      }).join('');

      let headerHtml = isFirst
        ? `<div class="head">
            <div class="head-left"><h1>INVOICE</h1><div class="kepada">Kepada :<br><strong>${eH(order.partner_store_name)}</strong><br>${eH(order.partner_address || '')}</div></div>
            <div class="head-right"><h2>${eH(storeName)}</h2><div style="font-size:8.5pt">Jl. Raya Labuhan Lombok, Wanasaba</div>${storePhone ? `<div style="font-size:8.5pt">Telp: ${eH(storePhone)}</div>` : ''}<table style="margin-top:6pt"><tr><td>No Invoice</td><td>: <strong>${eH(order.order_number)}</strong></td></tr><tr><td>Tanggal</td><td>: ${eH(tgl)}</td></tr></table></div>
          </div>${order.canvasser_name ? `<div class="sales">Kode Sales: <strong>${eH(order.canvasser_name)}</strong></div>` : ''}`
        : `<div style="margin-bottom:4pt"><strong>${eH(storeName)}</strong> &mdash; INVOICE ${eH(order.order_number)}<br><span style="font-size:9pt">Kepada: ${eH(order.partner_store_name)} &nbsp;&nbsp; Tanggal: ${eH(tgl)}</span></div>`;

      let footerHtml = isLast
        ? `<div class="terbilang">Terbilang: <em>${eH(totalWords)}</em></div>
          <div class="bottom"><div class="catatan"><h3>Catatan :</h3><ul><li>Barang yang sudah dibeli tidak dapat dikembalikan kecuali ada perjanjian.</li><li>Mohon diperiksa dengan teliti (karena kami tidak menerima komplain setelah barang diterima).</li><li>Terima kasih.</li></ul></div><div class="summary"><table>${summaryRows}</table></div></div>`
        : `<div style="text-align:right;font-style:italic;font-size:8.5pt;margin-top:4pt">Bersambung...   Hal ${p + 1}/${totalPages}</div>`;

      pagesHtml += `<div class="page" style="${pageBreak}">${headerHtml}
        <table class="items"><thead><tr><th style="width:5%;" class="c">No.</th><th style="width:31%;">Nama Barang</th><th style="width:13%;" class="c">Jumlah CTN</th><th style="width:11%;" class="c">Quantity</th><th style="width:17%;" class="r">Harga</th><th style="width:23%;" class="r">Jumlah</th></tr></thead>
        <tbody>${tableRows}${isLast ? `<tr class="sub-row"><td colspan="5" style="text-align:right"><strong>Sub Total</strong></td><td style="text-align:right"><strong>${fN(order.total)}</strong></td></tr>` : ''}</tbody></table>
        ${footerHtml}</div>`;
    }

    const html = `<!DOCTYPE html><html><head><title>Invoice ${eH(order.order_number)}</title>
<style>
  @page { size: 22cm 14cm; margin: 6mm 8mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font: 10pt/1.3 'Courier New', monospace; color:#000; }
  .head { display:flex; justify-content:space-between; margin-bottom:4pt; }
  .head-left { width:50%; } .head-right { width:48%; }
  .head-right table { text-align:left; font-size:9pt; }
  h1 { font-size:15pt; font-weight:bold; margin-bottom:2pt; }
  h2 { font-size:14pt; font-weight:bold; margin-bottom:1pt; }
  .kepada { font-size:9pt; } .kepada strong { font-size:10pt; }
  .sales { font-size:9pt; margin:3pt 0 4pt; }
  .items { width:100%; border-collapse:collapse; font-size:9pt; }
  .items th { font-weight:bold; text-align:left; padding:2pt 3pt; border-top:1.5pt solid #000; border-bottom:1.5pt solid #000; }
  .items td { padding:1.5pt 3pt; border-bottom:0.5pt dotted #999; }
  .items .c { text-align:center; } .items .r { text-align:right; }
  .items th.c { text-align:center; } .items th.r { text-align:right; }
  .sub-row td { font-weight:bold; border-top:1.5pt solid #000; border-bottom:none; }
  .terbilang { font-size:8.5pt; font-style:italic; padding:3pt 0; border-top:1pt solid #000; border-bottom:1pt solid #000; margin:2pt 0; }
  .bottom { display:flex; justify-content:space-between; margin-top:3pt; font-size:8.5pt; }
  .catatan { width:52%; } .catatan h3 { font-size:9pt; font-weight:bold; margin-bottom:2pt; }
  .catatan ul { list-style:none; padding:0; } .catatan li { margin-bottom:1pt; } .catatan li:before { content:"- "; }
  .summary { width:44%; } .summary table { width:100%; font-size:9pt; border-collapse:collapse; }
  .summary td { padding:1pt 2pt; } .summary .r { text-align:right; }
  .summary .grand td { border-top:1.5pt solid #000; font-weight:bold; padding-top:2pt; }
</style></head><body>${pagesHtml}</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=600');
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); setTimeout(() => win.close(), 1000); }, 500);
    return true;
  }

  // ============================================================
  // BUILD SURAT JALAN - ESC/P raw (font bawaan printer)
  // Continuous form 22cm x 14cm = 33 baris/halaman, max 8 baris item/halaman
  // Tiap halaman: HEADER + TABEL + FOOTER (statis), padding kosong sampai 33 baris
  // ============================================================
  buildSuratJalan(order, storeSettings = {}) {
    const d = [];
    const W = this.W; // 80 char (10 CPI)
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storePhone = storeSettings?.phone || '';
    const tgl = this.fmtDate(order.created_at);
    const sep = '-'.repeat(W);
    const items = this.prepareItems(order);

    const ROWS_PER_PAGE = 8;
    const pages = [];
    if (items.length === 0) pages.push([]);
    else {
      for (let i = 0; i < items.length; i += ROWS_PER_PAGE) {
        pages.push(items.slice(i, i + ROWS_PER_PAGE));
      }
    }
    const totalPages = pages.length;

    // Init
    d.push(...this.cmd.INIT);
    d.push(...this.cmd.CPI_10);
    d.push(...this.cmd.LINE_SPACING_1_6);
    this.lineCount = 0;

    for (let p = 0; p < totalPages; p++) {
      const pageItems = pages[p];
      const startIdx = p * ROWS_PER_PAGE;

      // ===== HEADER (statis tiap halaman) =====
      // Baris 1: SURAT JALAN (bold expanded, kanan)
      d.push(...this.cmd.BOLD_ON, ...this.cmd.EXPANDED_ON);
      d.push(...this.textToBytes(this.pad('SURAT JALAN', W / 2, 'right')));
      d.push(...this.cmd.LF);
      d.push(...this.cmd.EXPANDED_OFF, ...this.cmd.BOLD_OFF);
      this.lineCount++;

      // Baris 2: Kepada Yth + No Invoice (kanan)
      this.writeLine(d, this.pad('Kepada Yth,', 40) + 'No. Invoice : ' + order.order_number);
      // Baris 3: Nama (bold) + Tanggal
      d.push(...this.cmd.BOLD_ON);
      d.push(...this.textToBytes(this.pad('Nama   : ' + (order.partner_store_name || ''), 40)));
      d.push(...this.cmd.BOLD_OFF);
      d.push(...this.textToBytes('Tanggal     : ' + tgl));
      d.push(...this.cmd.LF);
      this.lineCount++;
      // Baris 4: No Telp + Pengirim
      this.writeLine(d, this.pad('Telp   : ' + (order.partner_phone || '-'), 40) + 'Pengirim    : ' + storeName);
      // Baris 5: Alamat + Telp pengirim
      this.writeLine(d, this.pad('Alamat : ' + (order.partner_address || '-'), 40) + (storePhone ? 'Telp        : ' + storePhone : ''));

      // ===== TABEL =====
      this.writeLine(d, sep);
      d.push(...this.cmd.BOLD_ON);
      this.writeLine(d,
        this.pad('No', 4) +
        this.pad('Nama Barang', 36) +
        this.pad('Quantity', 18, 'center') +
        this.pad('Keterangan', 22)
      );
      d.push(...this.cmd.BOLD_OFF);
      this.writeLine(d, sep);

      // Item rows (max 8)
      pageItems.forEach((item, i) => {
        const isDus = item.unit === 'dus';
        const qtyStr = isDus
          ? item.qty + ' DUS (' + this.fmtN(item.qty * (item.ipb || 1)) + ' pcs)'
          : this.fmtN(item.qty) + ' PCS';
        this.writeLine(d,
          this.pad(String(startIdx + i + 1), 4) +
          this.pad(item.name, 36) +
          this.pad(qtyStr, 18, 'center') +
          this.pad('', 22)
        );
      });

      // Padding baris kosong agar tabel tetap 8 baris penuh
      const padRows = ROWS_PER_PAGE - pageItems.length;
      for (let i = 0; i < padRows; i++) {
        this.writeLine(d,
          this.pad('', 4) + this.pad('', 36) + this.pad('', 18) + this.pad('', 22)
        );
      }
      this.writeLine(d, sep);

      // ===== FOOTER (statis tiap halaman) =====
      // PERHATIAN (di atas)
      d.push(...this.cmd.BOLD_ON);
      this.writeLine(d, 'PERHATIAN:');
      d.push(...this.cmd.BOLD_OFF);
      this.writeLine(d, '1. Surat Jalan ini merupakan bukti resmi penerimaan barang.');
      this.writeLine(d, '2. Surat Jalan ini bukan bukti penjualan.');
      this.writeLine(d, '3. Surat Jalan ini akan dilengkapi Invoice sebagai bukti penjualan.');

      // BARANG SUDAH DITERIMA (rata kiri, bold)
      d.push(...this.cmd.BOLD_ON);
      this.writeLine(d, 'BARANG SUDAH DITERIMA DALAM KEADAAN BAIK DAN SESUAI');
      d.push(...this.cmd.BOLD_OFF);

      // Spasi 1 baris sebelum label TTD
      this.writeBlank(d);

      // 3 kolom tanda tangan label
      const colW = Math.floor(W / 3);
      d.push(...this.cmd.BOLD_ON);
      this.writeLine(d,
        this.pad('Penerima / Pembeli', colW, 'center') +
        this.pad('Bagian Pengiriman', colW, 'center') +
        this.pad('Petugas Gudang', W - 2 * colW, 'center')
      );
      d.push(...this.cmd.BOLD_OFF);

      // 3 baris kosong (ruang untuk tanda tangan)
      this.writeBlank(d);
      this.writeBlank(d);
      this.writeBlank(d);

      // Garis panjang di bawah masing-masing label TTD (baris ke-4)
      const lineSeg = '_'.repeat(colW - 4); // garis pendek dalam kolom
      this.writeLine(d,
        this.pad(lineSeg, colW, 'center') +
        this.pad(lineSeg, colW, 'center') +
        this.pad(lineSeg, W - 2 * colW, 'center')
      );

      // Padding sampai genap 33 baris (batas potongan kertas)
      this.padToPageEnd(d);
    }

    return d;
  }

  // Browser fallback - jika print server tidak aktif
  async printSuratJalan(order, storeSettings) {
    const serverOk = await this.checkLocalServer();
    if (!serverOk) throw new Error('Print Server tidak aktif');
    const data = this.buildSuratJalan(order, storeSettings);
    await this.printViaServer(data);
    return { success: true, method: 'server' };
  }



  // ============================================================
  // PRINT VIA LOCAL SERVER
  // ============================================================
  async checkLocalServer() {
    try {
      const res = await fetch(`${LOCAL_PRINT_SERVER}/status`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch { return false; }
  }

  async printViaServer(data) {
    const buffer = new Uint8Array(data);
    const res = await fetch(`${LOCAL_PRINT_SERVER}/print-dotmatrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buffer,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Unknown error'));
    return true;
  }

  async printPartnerInvoice(order, storeSettings) {
    const serverOk = await this.checkLocalServer();
    if (!serverOk) throw new Error('Print Server tidak aktif');
    const data = this.buildPartnerInvoice(order, storeSettings);
    await this.printViaServer(data);
    return { success: true, method: 'server' };
  }
}

export const dotMatrixPrinter = new DotMatrixPrinter();
export default DotMatrixPrinter;
