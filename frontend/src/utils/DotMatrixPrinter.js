// Dot Matrix Printer Utility - Epson LX-310 (ESC/P)
// Format: Faktur pada kertas continuous form 9.5" x 11" NCR 3-ply
// Lebar cetak: 80 kolom (10 CPI) atau 136 kolom (17 CPI condensed)

const LOCAL_PRINT_SERVER = 'http://localhost:9100';

class DotMatrixPrinter {
  // ESC/P commands (berbeda dari ESC/POS thermal)
  commands = {
    INIT: [0x1B, 0x40],                    // Reset printer
    CR: [0x0D],                             // Carriage return
    LF: [0x0A],                             // Line feed
    FF: [0x0C],                             // Form feed (eject page)
    BOLD_ON: [0x1B, 0x45],                  // ESC E - Bold on
    BOLD_OFF: [0x1B, 0x46],                 // ESC F - Bold off
    CONDENSED_ON: [0x0F],                   // SI - Condensed mode (17 CPI)
    CONDENSED_OFF: [0x12],                  // DC2 - Cancel condensed
    EXPANDED_ON: [0x1B, 0x57, 0x01],        // ESC W 1 - Double width on
    EXPANDED_OFF: [0x1B, 0x57, 0x00],       // ESC W 0 - Double width off
    UNDERLINE_ON: [0x1B, 0x2D, 0x01],       // ESC - 1
    UNDERLINE_OFF: [0x1B, 0x2D, 0x00],      // ESC - 0
    ITALIC_ON: [0x1B, 0x34],                // ESC 4
    ITALIC_OFF: [0x1B, 0x35],               // ESC 5
    CPI_10: [0x1B, 0x50],                   // ESC P - 10 CPI (normal)
    CPI_12: [0x1B, 0x4D],                   // ESC M - 12 CPI
    LINE_SPACING_DEFAULT: [0x1B, 0x32],      // ESC 2 - 1/6 inch line spacing
    LINE_SPACING_N216: [0x1B, 0x33],         // ESC 3 n - n/216 inch
  };

  LINE_WIDTH = 80; // 80 kolom pada 10 CPI (9.5" printable area)
  CONDENSED_WIDTH = 136; // 136 kolom pada 17 CPI condensed

  textToBytes(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      bytes.push(c > 127 ? 63 : c); // Replace non-ASCII with '?'
    }
    return bytes;
  }

  line(char = '-') {
    return char.repeat(this.LINE_WIDTH);
  }

  doubleLine() {
    return '='.repeat(this.LINE_WIDTH);
  }

  pad(text, width, align = 'left') {
    const t = String(text).substring(0, width);
    const gap = Math.max(0, width - t.length);
    if (align === 'right') return ' '.repeat(gap) + t;
    if (align === 'center') {
      const l = Math.floor(gap / 2);
      return ' '.repeat(l) + t + ' '.repeat(gap - l);
    }
    return t + ' '.repeat(gap);
  }

  rightAlign(left, right, width = this.LINE_WIDTH) {
    const gap = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(gap) + right;
  }

  formatCurrency(v) {
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(v);
  }

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  formatDateTime(dateStr) {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // ============================================================
  // BUILD FAKTUR KIOS MITRA
  // Format: Faktur penjualan (bukan struk thermal)
  // Kertas: Continuous form 9.5" x 11" NCR 3-ply
  // ============================================================
  buildPartnerInvoice(order, storeSettings = {}) {
    const d = [];
    const W = this.LINE_WIDTH;
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || '';
    const storePhone = storeSettings?.phone || '';
    const tgl = this.formatDateTime(order.created_at);
    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));

    // Init printer
    d.push(...this.commands.INIT);
    d.push(...this.commands.CPI_10);
    d.push(...this.commands.LINE_SPACING_DEFAULT);

    // === HEADER: Nama Toko (bold, expanded) ===
    d.push(...this.commands.BOLD_ON);
    d.push(...this.commands.EXPANDED_ON);
    d.push(...this.textToBytes(this.pad(storeName, Math.floor(W / 2), 'center')));
    d.push(...this.commands.LF);
    d.push(...this.commands.EXPANDED_OFF);
    d.push(...this.commands.BOLD_OFF);

    // Alamat & Telepon (center)
    if (storeAddr) {
      d.push(...this.textToBytes(this.pad(storeAddr, W, 'center')));
      d.push(...this.commands.LF);
    }
    if (storePhone) {
      d.push(...this.textToBytes(this.pad('Telp: ' + storePhone, W, 'center')));
      d.push(...this.commands.LF);
    }

    // Garis double
    d.push(...this.textToBytes(this.doubleLine()));
    d.push(...this.commands.LF);

    // === JUDUL FAKTUR ===
    d.push(...this.commands.BOLD_ON);
    d.push(...this.textToBytes(this.pad('F A K T U R   P E N J U A L A N', W, 'center')));
    d.push(...this.commands.LF);
    d.push(...this.commands.BOLD_OFF);

    d.push(...this.textToBytes(this.doubleLine()));
    d.push(...this.commands.LF);

    // === INFO TRANSAKSI (2 kolom) ===
    const infoLeft = [
      `No. Faktur : ${order.order_number}`,
      `Tanggal    : ${tgl}`,
    ];
    const infoRight = [
      `Kepada : ${order.partner_store_name}`,
      order.canvasser_name ? `Sales  : ${order.canvasser_name}` : '',
    ];

    const halfW = Math.floor(W / 2);
    for (let i = 0; i < Math.max(infoLeft.length, infoRight.length); i++) {
      const left = this.pad(infoLeft[i] || '', halfW);
      const right = infoRight[i] || '';
      d.push(...this.textToBytes(left + right));
      d.push(...this.commands.LF);
    }

    d.push(...this.commands.LF);

    // === TABEL HEADER ===
    d.push(...this.textToBytes(this.line('-')));
    d.push(...this.commands.LF);
    d.push(...this.commands.BOLD_ON);
    // No(4) | Nama Barang(36) | Qty(8) | Harga(14) | Jumlah(14)  = 80 (incl separators)
    const hdr =
      this.pad('No', 4) + '| ' +
      this.pad('Nama Barang', 34) + '| ' +
      this.pad('Qty', 8, 'right') + ' | ' +
      this.pad('Harga', 13, 'right') + ' | ' +
      this.pad('Jumlah', 13, 'right');
    d.push(...this.textToBytes(hdr));
    d.push(...this.commands.LF);
    d.push(...this.commands.BOLD_OFF);
    d.push(...this.textToBytes(this.line('-')));
    d.push(...this.commands.LF);

    // === TABEL ITEMS ===
    const items = (order.is_settled && order.settled_items)
      ? order.settled_items.filter(si => si.qty_sold > 0).map(si => ({
          name: si.product_name,
          qty: si.qty_sold,
          price: si.price,
          subtotal: si.qty_sold * si.price
        }))
      : order.items.map(item => ({
          name: item.product_name,
          qty: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        }));

    items.forEach((item, idx) => {
      const row =
        this.pad(String(idx + 1), 4) + '| ' +
        this.pad(item.name, 34) + '| ' +
        this.pad(this.formatCurrency(item.qty), 8, 'right') + ' | ' +
        this.pad(this.formatCurrency(item.price), 13, 'right') + ' | ' +
        this.pad(this.formatCurrency(item.subtotal), 13, 'right');
      d.push(...this.textToBytes(row));
      d.push(...this.commands.LF);
    });

    d.push(...this.textToBytes(this.line('-')));
    d.push(...this.commands.LF);

    // === TOTAL ===
    const totalLabel = this.pad('', 4) + '| ' + this.pad('', 34) + '| ' + this.pad('', 8) + ' | ';
    d.push(...this.commands.BOLD_ON);
    d.push(...this.textToBytes(
      totalLabel +
      this.pad('TOTAL', 13, 'right') + ' | ' +
      this.pad(this.formatCurrency(order.total), 13, 'right')
    ));
    d.push(...this.commands.LF);
    d.push(...this.commands.BOLD_OFF);

    d.push(...this.textToBytes(this.doubleLine()));
    d.push(...this.commands.LF);
    d.push(...this.commands.LF);

    // === RINGKASAN HUTANG ===
    const summaryX = 44; // start column for summary (right side)
    const sumW = W - summaryX;

    const summaryLines = [];
    summaryLines.push(['Total Pesanan Ini', this.formatCurrency(order.total)]);
    if (previousDebt > 0) summaryLines.push(['Bon Sebelumnya', this.formatCurrency(previousDebt)]);
    summaryLines.push(['-'.repeat(sumW), '']);
    summaryLines.push(['Total Tagihan', this.formatCurrency(previousDebt + order.total)]);
    if (order.paid > 0) summaryLines.push(['Dibayar', '(' + this.formatCurrency(order.paid) + ')']);
    summaryLines.push(['='.repeat(sumW), '']);
    summaryLines.push(['SISA HUTANG', this.formatCurrency(order.partner_debt_total || 0)]);

    for (const [label, value] of summaryLines) {
      if (!value) {
        // separator line
        d.push(...this.textToBytes(' '.repeat(summaryX) + label));
      } else {
        const isBold = label === 'SISA HUTANG' || label === 'Total Tagihan';
        if (isBold) d.push(...this.commands.BOLD_ON);
        d.push(...this.textToBytes(
          ' '.repeat(summaryX) + this.rightAlign(label, value, sumW)
        ));
        if (isBold) d.push(...this.commands.BOLD_OFF);
      }
      d.push(...this.commands.LF);
    }

    d.push(...this.commands.LF);
    d.push(...this.commands.LF);

    // === TANDA TANGAN ===
    const sigLeft = this.pad('Penerima,', 26, 'center');
    const sigMid = this.pad('Sales,', 26, 'center');
    const sigRight = this.pad('Hormat Kami,', 26, 'center');
    d.push(...this.textToBytes(sigLeft + sigMid + sigRight));
    d.push(...this.commands.LF);
    d.push(...this.commands.LF);
    d.push(...this.commands.LF);
    d.push(...this.commands.LF);

    // Nama di bawah tanda tangan
    const nameLeft = this.pad('( ' + order.partner_store_name + ' )', 26, 'center');
    const nameMid = this.pad('( ' + (order.canvasser_name || '..................') + ' )', 26, 'center');
    const nameRight = this.pad('( ' + storeName + ' )', 26, 'center');
    d.push(...this.textToBytes(nameLeft + nameMid + nameRight));
    d.push(...this.commands.LF);

    d.push(...this.commands.LF);

    // === CATATAN KAKI ===
    d.push(...this.textToBytes(this.line('-')));
    d.push(...this.commands.LF);
    d.push(...this.commands.ITALIC_ON);
    d.push(...this.textToBytes('Catatan: Barang yang sudah dibeli tidak dapat dikembalikan kecuali ada perjanjian.'));
    d.push(...this.commands.LF);
    d.push(...this.textToBytes('Faktur ini sah sebagai bukti transaksi. Dicetak rangkap 3 (Putih: Pembeli, Merah: Kantor, Kuning: Arsip).'));
    d.push(...this.commands.LF);
    d.push(...this.commands.ITALIC_OFF);

    // Form feed (eject page / advance to next perforation)
    d.push(...this.commands.LF);
    d.push(...this.commands.LF);
    d.push(...this.commands.FF);

    return d;
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
    if (!res.ok) {
      const err = await res.text().catch(() => 'Unknown error');
      throw new Error(err);
    }
    return true;
  }

  // ============================================================
  // BROWSER PRINT FALLBACK
  // Format faktur HTML untuk window.print() ke dot matrix
  // ============================================================
  browserPrintFallback(order, storeSettings = {}) {
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || '';
    const storePhone = storeSettings?.phone || '';
    const tgl = this.formatDateTime(order.created_at);
    const fmtN = (v) => new Intl.NumberFormat('id-ID').format(v);
    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));

    const items = (order.is_settled && order.settled_items)
      ? order.settled_items.filter(si => si.qty_sold > 0).map(si => ({
          name: si.product_name, qty: si.qty_sold, price: si.price, subtotal: si.qty_sold * si.price
        }))
      : order.items.map(item => ({
          name: item.product_name, qty: item.quantity, price: item.price, subtotal: item.subtotal
        }));

    const tableRows = items.map((item, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${item.name}</td>
        <td style="text-align:right">${fmtN(item.qty)}</td>
        <td style="text-align:right">${fmtN(item.price)}</td>
        <td style="text-align:right">${fmtN(item.subtotal)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>Faktur ${order.order_number}</title>
<style>
  @page { size: 9.5in 11in; margin: 0.5in 0.3in; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 11pt; line-height: 1.4; color: #000; }
  .header { text-align: center; margin-bottom: 8pt; }
  .header h1 { font-size: 16pt; font-weight: bold; letter-spacing: 2pt; }
  .header p { font-size: 10pt; }
  .title { text-align: center; font-size: 13pt; font-weight: bold; letter-spacing: 3pt; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4pt 0; margin: 6pt 0; }
  .info { display: flex; justify-content: space-between; margin: 6pt 0; font-size: 10pt; }
  .info div { width: 48%; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 10pt; }
  th, td { padding: 2pt 4pt; border-bottom: 1px solid #000; }
  th { text-align: left; font-weight: bold; border-bottom: 2px solid #000; }
  .total-row td { font-weight: bold; border-top: 2px solid #000; border-bottom: none; }
  .summary { margin-left: 55%; margin-top: 10pt; font-size: 10pt; }
  .summary table { border: none; }
  .summary td { border: none; padding: 1pt 4pt; }
  .summary .bold { font-weight: bold; }
  .signatures { display: flex; justify-content: space-between; margin-top: 30pt; text-align: center; font-size: 10pt; }
  .signatures div { width: 30%; }
  .signatures .name { margin-top: 50pt; border-top: 1px solid #000; padding-top: 2pt; }
  .footer { margin-top: 12pt; border-top: 1px solid #000; padding-top: 4pt; font-size: 9pt; font-style: italic; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style></head><body>

<div class="header">
  <h1>${storeName}</h1>
  ${storeAddr ? `<p>${storeAddr}</p>` : ''}
  ${storePhone ? `<p>Telp: ${storePhone}</p>` : ''}
</div>

<div class="title">F A K T U R &nbsp; P E N J U A L A N</div>

<div class="info">
  <div>
    <div>No. Faktur : <strong>${order.order_number}</strong></div>
    <div>Tanggal &nbsp;&nbsp;&nbsp;: ${tgl}</div>
  </div>
  <div>
    <div>Kepada : <strong>${order.partner_store_name}</strong></div>
    ${order.canvasser_name ? `<div>Sales &nbsp;&nbsp;: ${order.canvasser_name}</div>` : ''}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:5%;text-align:center">No</th>
      <th style="width:40%">Nama Barang</th>
      <th style="width:12%;text-align:right">Qty</th>
      <th style="width:20%;text-align:right">Harga</th>
      <th style="width:23%;text-align:right">Jumlah</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
    <tr class="total-row">
      <td colspan="4" style="text-align:right"><strong>TOTAL</strong></td>
      <td style="text-align:right"><strong>${fmtN(order.total)}</strong></td>
    </tr>
  </tbody>
</table>

<div class="summary">
  <table>
    <tr><td>Total Pesanan Ini</td><td style="text-align:right">${fmtN(order.total)}</td></tr>
    ${previousDebt > 0 ? `<tr><td>Bon Sebelumnya</td><td style="text-align:right">${fmtN(previousDebt)}</td></tr>` : ''}
    <tr><td colspan="2" style="border-bottom:1px solid #000"></td></tr>
    <tr class="bold"><td><strong>Total Tagihan</strong></td><td style="text-align:right"><strong>${fmtN(previousDebt + order.total)}</strong></td></tr>
    ${order.paid > 0 ? `<tr><td>Dibayar</td><td style="text-align:right">(${fmtN(order.paid)})</td></tr>` : ''}
    <tr><td colspan="2" style="border-bottom:2px solid #000"></td></tr>
    <tr class="bold"><td><strong>SISA HUTANG</strong></td><td style="text-align:right"><strong>${fmtN(order.partner_debt_total || 0)}</strong></td></tr>
  </table>
</div>

<div class="signatures">
  <div>Penerima,<div class="name">( ${order.partner_store_name} )</div></div>
  <div>Sales,<div class="name">( ${order.canvasser_name || '..................'} )</div></div>
  <div>Hormat Kami,<div class="name">( ${storeName} )</div></div>
</div>

<div class="footer">
  Catatan: Barang yang sudah dibeli tidak dapat dikembalikan kecuali ada perjanjian.<br>
  Faktur ini sah sebagai bukti transaksi. Dicetak rangkap 3 (Putih: Pembeli, Merah: Kantor, Kuning: Arsip).
</div>

</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); setTimeout(() => win.close(), 1000); }, 500);
    return true;
  }

  // ============================================================
  // HIGH-LEVEL PRINT
  // ============================================================
  async printPartnerInvoice(order, storeSettings) {
    try {
      const serverOk = await this.checkLocalServer();
      if (serverOk) {
        const data = this.buildPartnerInvoice(order, storeSettings);
        await this.printViaServer(data);
        return { success: true, method: 'server' };
      }
    } catch (err) {
      console.warn('Dot matrix server print failed:', err);
    }
    // Fallback: browser print
    this.browserPrintFallback(order, storeSettings);
    return { success: true, method: 'browser' };
  }
}

export const dotMatrixPrinter = new DotMatrixPrinter();
export default DotMatrixPrinter;
