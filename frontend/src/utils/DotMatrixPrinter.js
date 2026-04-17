// Dot Matrix Printer Utility - Epson LX-310 (ESC/P)
// Format: Invoice pada kertas continuous form 22cm x 14cm NCR 3-ply
// Multi-page support: otomatis sambung ke kertas berikutnya

const LOCAL_PRINT_SERVER = 'http://localhost:9100';

// === Terbilang: Angka ke kata Indonesia ===
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
  commands = {
    INIT: [0x1B, 0x40],
    CR: [0x0D],
    LF: [0x0A],
    FF: [0x0C],
    BOLD_ON: [0x1B, 0x45],
    BOLD_OFF: [0x1B, 0x46],
    CONDENSED_ON: [0x0F],
    CONDENSED_OFF: [0x12],
    EXPANDED_ON: [0x1B, 0x57, 0x01],
    EXPANDED_OFF: [0x1B, 0x57, 0x00],
    UNDERLINE_ON: [0x1B, 0x2D, 0x01],
    UNDERLINE_OFF: [0x1B, 0x2D, 0x00],
    ITALIC_ON: [0x1B, 0x34],
    ITALIC_OFF: [0x1B, 0x35],
    CPI_10: [0x1B, 0x50],
    CPI_12: [0x1B, 0x4D],
    LINE_SPACING_DEFAULT: [0x1B, 0x32],
  };

  W = 80;
  // 14cm ≈ 5.5in, 6 lines/inch = 33 lines per page
  LINES_PER_PAGE = 33;
  // First page: header(9) + table header(3) = 12 lines overhead
  ITEMS_FIRST_PAGE = 18;
  // Continuation page: mini header(3) + table header(3) = 6 lines overhead
  ITEMS_CONT_PAGE = 25;
  // Footer: terbilang(3) + remark/summary(8) = 11 lines
  FOOTER_LINES = 11;

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

  fmtDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ============================================================
  // BUILD INVOICE - ESC/P raw data for Epson LX-310
  // Multi-page: otomatis sambung jika item melebihi 1 halaman
  // ============================================================
  buildPartnerInvoice(order, storeSettings = {}) {
    const d = [];
    const W = this.W;
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || '';
    const storePhone = storeSettings?.phone || '';
    const tgl = this.fmtDate(order.created_at);
    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
    const sep = '-'.repeat(W);

    // Prepare items
    const items = (order.is_settled && order.settled_items)
      ? order.settled_items.filter(si => si.qty_sold > 0).map(si => ({
          name: si.product_name, qty: si.qty_sold, price: si.price,
          subtotal: si.qty_sold * si.price, unit: 'satuan', ipb: 1
        }))
      : order.items.map(item => ({
          name: item.product_name, qty: item.quantity, price: item.price,
          subtotal: item.subtotal || (item.quantity * item.price),
          unit: item.sell_unit || item.unit || 'satuan',
          ipb: item.items_per_box || 1
        }));

    // === PAGINATION: split items across pages ===
    const pages = [];
    let remaining = [...items];
    let pageNum = 0;

    while (remaining.length > 0) {
      const isFirst = pageNum === 0;
      const capacity = isFirst ? this.ITEMS_FIRST_PAGE : this.ITEMS_CONT_PAGE;
      // If this could be the last page, reserve space for footer
      if (remaining.length <= capacity) {
        pages.push({ items: remaining, isFirst, isLast: true });
        remaining = [];
      } else {
        // Check if remaining after this page would fit on next page with footer
        const takeCount = Math.min(capacity, remaining.length);
        const leftAfter = remaining.length - takeCount;
        const nextCapacity = this.ITEMS_CONT_PAGE - this.FOOTER_LINES;
        if (leftAfter <= nextCapacity) {
          // Everything after this page fits on one more page with footer
          pages.push({ items: remaining.slice(0, takeCount), isFirst, isLast: false });
          remaining = remaining.slice(takeCount);
        } else {
          pages.push({ items: remaining.slice(0, capacity), isFirst, isLast: false });
          remaining = remaining.slice(capacity);
        }
      }
      pageNum++;
    }

    if (pages.length === 0) {
      pages.push({ items: [], isFirst: true, isLast: true });
    }

    const totalPages = pages.length;
    let globalItemIdx = 0;

    // Init printer
    d.push(...this.commands.INIT);
    d.push(...this.commands.CPI_10);
    d.push(...this.commands.LINE_SPACING_DEFAULT);

    for (let p = 0; p < totalPages; p++) {
      const page = pages[p];
      const pageLabel = totalPages > 1 ? `  Hal ${p + 1}/${totalPages}` : '';

      if (page.isFirst) {
        // === HEADER HALAMAN PERTAMA ===

        // Baris 1: INVOICE (kiri, bold+expanded) | NAMA TOKO (kanan, bold+expanded)
        d.push(...this.commands.BOLD_ON);
        d.push(...this.commands.EXPANDED_ON);
        // Expanded = double width, so 80 cols becomes 40 char positions
        d.push(...this.textToBytes(this.pad('INVOICE', 20)));
        d.push(...this.textToBytes(this.pad(storeName, 20, 'right')));
        d.push(...this.commands.LF);
        d.push(...this.commands.EXPANDED_OFF);
        d.push(...this.commands.BOLD_OFF);

        // Baris 2-3: Kepada (kiri) | Alamat+telp toko (kanan, rata kanan)
        const rightStart = 40;
        if (storeAddr) {
          d.push(...this.textToBytes(this.pad('Kepada :', rightStart) + this.pad(storeAddr, W - rightStart, 'right')));
          d.push(...this.commands.LF);
        }

        d.push(...this.commands.BOLD_ON);
        d.push(...this.textToBytes(this.pad(order.partner_store_name, rightStart)));
        d.push(...this.commands.BOLD_OFF);
        if (storePhone) {
          d.push(...this.textToBytes(this.pad('Telp: ' + storePhone, W - rightStart, 'right')));
        }
        d.push(...this.commands.LF);

        // Baris 4: Alamat kios (kiri) | No Invoice (kanan)
        d.push(...this.textToBytes(this.pad(order.partner_address || '', rightStart)));
        d.push(...this.textToBytes('No Invoice : ' + order.order_number));
        d.push(...this.commands.LF);

        // Baris 5: kosong (kiri) | Tanggal (kanan)
        d.push(...this.textToBytes(this.pad('', rightStart)));
        d.push(...this.textToBytes('Tanggal    : ' + tgl));
        d.push(...this.commands.LF);

        // Baris 6: Kode Sales
        if (order.canvasser_name) {
          d.push(...this.textToBytes('Kode Sales : ' + order.canvasser_name));
          d.push(...this.commands.LF);
        }

        d.push(...this.commands.LF);
      } else {
        // === HEADER HALAMAN SAMBUNGAN ===
        d.push(...this.commands.BOLD_ON);
        d.push(...this.textToBytes(this.pad(storeName + ' - INVOICE ' + order.order_number, W - 12) + pageLabel));
        d.push(...this.commands.LF);
        d.push(...this.commands.BOLD_OFF);
        d.push(...this.commands.LF);
      }

      // === TABEL HEADER ===
      // No(4) | Nama Barang(28) | Jumlah(12) | Quantity(10) | Harga(12) | Jumlah(14) = 80
      d.push(...this.textToBytes(sep));
      d.push(...this.commands.LF);
      d.push(...this.commands.BOLD_ON);
      d.push(...this.textToBytes(
        this.pad('No.', 4) +
        this.pad('Nama Barang', 28) +
        this.pad('Jumlah', 12, 'center') +
        this.pad('Quantity', 10, 'center') +
        this.pad('Harga', 12, 'right') +
        this.pad('Jumlah', 14, 'right')
      ));
      d.push(...this.commands.LF);
      d.push(...this.commands.BOLD_OFF);
      d.push(...this.textToBytes(sep));
      d.push(...this.commands.LF);

      // === TABEL ITEMS ===
      for (const item of page.items) {
        globalItemIdx++;
        const isDus = item.unit === 'dus';
        // Kolom Jumlah: detail unit (misal "3 DUS" atau "5 Satuan")
        const jmlUnit = isDus ? item.qty + ' DUS' : item.qty + ' Satuan';
        // Kolom Quantity: total quantity per item
        const totalQty = isDus ? this.fmtN(item.qty * (item.ipb || 1)) : this.fmtN(item.qty);

        d.push(...this.textToBytes(
          this.pad(String(globalItemIdx), 4) +
          this.pad(item.name, 28) +
          this.pad(jmlUnit, 12, 'center') +
          this.pad(totalQty, 10, 'center') +
          this.pad(this.fmtN(item.price), 12, 'right') +
          this.pad(this.fmtN(item.subtotal), 14, 'right')
        ));
        d.push(...this.commands.LF);
      }

      d.push(...this.textToBytes(sep));
      d.push(...this.commands.LF);

      if (page.isLast) {
        // === FOOTER: hanya di halaman terakhir ===

        // Sub Total row
        d.push(...this.commands.BOLD_ON);
        d.push(...this.textToBytes(
          this.pad('', 4) +
          this.pad('', 28) +
          this.pad('', 12) +
          this.pad('', 10) +
          this.pad('Sub Total', 12, 'right') +
          this.pad(this.fmtN(order.total), 14, 'right')
        ));
        d.push(...this.commands.LF);
        d.push(...this.commands.BOLD_OFF);

        d.push(...this.textToBytes(sep));
        d.push(...this.commands.LF);

        // Terbilang
        d.push(...this.commands.ITALIC_ON);
        d.push(...this.textToBytes('Terbilang: ' + terbilang(order.total) + ' Rupiah'));
        d.push(...this.commands.LF);
        d.push(...this.commands.ITALIC_OFF);
        d.push(...this.textToBytes(sep));
        d.push(...this.commands.LF);

        // Remark (kiri) + Ringkasan (kanan)
        const leftCol = 44;
        const rightCol = W - leftCol;

        const remarkLines = [
          'Remark :',
          '- Barang yg sudah dibeli tidak dapat',
          '  dikembalikan kecuali ada perjanjian.',
          '- Mohon diperiksa dengan teliti.',
          '- Terima kasih.',
        ];

        const sumLines = [];
        if (previousDebt > 0) {
          sumLines.push(['Total Pesanan Ini', this.fmtN(order.total)]);
          sumLines.push(['Bon Sebelumnya', this.fmtN(previousDebt)]);
        }
        // Total Tagihan (bold) - ini jadi total utama
        sumLines.push(['Total Tagihan', this.fmtN(previousDebt > 0 ? previousDebt + order.total : order.total)]);
        if (order.paid > 0) sumLines.push(['Dibayar', '(' + this.fmtN(order.paid) + ')']);
        if (order.paid > 0) sumLines.push(['Sisa Hutang', this.fmtN(order.partner_debt_total || 0)]);

        const maxRows = Math.max(remarkLines.length, sumLines.length);
        for (let i = 0; i < maxRows; i++) {
          const left = remarkLines[i] || '';
          const isRemarkHead = left === 'Remark :';
          if (isRemarkHead) d.push(...this.commands.BOLD_ON);

          if (i < sumLines.length) {
            const [label, val] = sumLines[i];
            const isBold = label === 'Total Tagihan';
            const padLeft = this.pad(left, leftCol);
            if (isRemarkHead) d.push(...this.commands.BOLD_OFF);
            if (isBold) d.push(...this.commands.BOLD_ON);
            d.push(...this.textToBytes(
              (isRemarkHead ? '' : '') + padLeft +
              this.pad(label, rightCol - val.length - 2) + ': ' + val
            ));
            if (isBold) d.push(...this.commands.BOLD_OFF);
          } else {
            d.push(...this.textToBytes(this.pad(left, W)));
          }
          if (isRemarkHead) d.push(...this.commands.BOLD_OFF);
          d.push(...this.commands.LF);
        }
      } else {
        // Halaman belum selesai - tulis "Bersambung..."
        d.push(...this.commands.ITALIC_ON);
        d.push(...this.textToBytes(this.pad('Bersambung ke halaman berikutnya...' + pageLabel, W, 'right')));
        d.push(...this.commands.LF);
        d.push(...this.commands.ITALIC_OFF);
      }

      // Form feed ke halaman berikutnya
      d.push(...this.commands.LF);
      d.push(...this.commands.FF);
    }

    return d;
  }

  // ============================================================
  // BROWSER PRINT FALLBACK - HTML invoice preview
  // Multi-page via CSS page-break
  // ============================================================
  browserPrintFallback(order, storeSettings = {}) {
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || '';
    const storePhone = storeSettings?.phone || '';
    const tgl = this.fmtDate(order.created_at);
    const fN = (v) => new Intl.NumberFormat('id-ID').format(v);
    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
    const totalWords = terbilang(order.total) + ' Rupiah';

    const items = (order.is_settled && order.settled_items)
      ? order.settled_items.filter(si => si.qty_sold > 0).map(si => ({
          name: si.product_name, qty: si.qty_sold, price: si.price,
          subtotal: si.qty_sold * si.price, unit: 'satuan', ipb: 1
        }))
      : order.items.map(item => ({
          name: item.product_name, qty: item.quantity, price: item.price,
          subtotal: item.subtotal || (item.quantity * item.price),
          unit: item.sell_unit || item.unit || 'satuan',
          ipb: item.items_per_box || 1
        }));

    const tableRows = items.map((item, i) => {
      const isDus = item.unit === 'dus';
      const jmlUnit = isDus ? item.qty + ' DUS' : item.qty + ' Satuan';
      const totalQty = isDus ? fN(item.qty * item.ipb) : fN(item.qty);
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${item.name}</td>
        <td class="c">${jmlUnit}</td>
        <td class="c">${totalQty}</td>
        <td class="r">${fN(item.price)}</td>
        <td class="r">${fN(item.subtotal)}</td>
      </tr>`;
    }).join('');

    let summaryRows = '';
    if (previousDebt > 0) {
      summaryRows += `<tr><td>Total Pesanan Ini</td><td class="r">${fN(order.total)}</td></tr>`;
      summaryRows += `<tr><td>Bon Sebelumnya</td><td class="r">${fN(previousDebt)}</td></tr>`;
    }
    summaryRows += `<tr class="grand"><td><strong>Total Tagihan</strong></td><td class="r"><strong>${fN(previousDebt > 0 ? previousDebt + order.total : order.total)}</strong></td></tr>`;
    if (order.paid > 0) {
      summaryRows += `<tr><td>Dibayar</td><td class="r">(${fN(order.paid)})</td></tr>`;
      summaryRows += `<tr><td>Sisa Hutang</td><td class="r">${fN(order.partner_debt_total || 0)}</td></tr>`;
    }

    const html = `<!DOCTYPE html><html><head><title>Invoice ${order.order_number}</title>
<style>
  @page { size: 22cm 14cm; margin: 6mm 8mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font: 10pt/1.3 'Courier New', monospace; color:#000; width:100%; }
  .head { display:flex; justify-content:space-between; margin-bottom:4pt; }
  .head-left { width:50%; }
  .head-right { width:48%; text-align:right; }
  .head-right table { margin-left:auto; text-align:left; font-size:9pt; }
  .head-right table td:first-child { padding-right:4pt; }
  .head-right table td:last-child { padding-left:4pt; }
  h1 { font-size:15pt; font-weight:bold; margin-bottom:2pt; }
  h2 { font-size:14pt; font-weight:bold; margin-bottom:1pt; }
  .kepada { font-size:9pt; }
  .kepada strong { font-size:10pt; }
  .sales { font-size:9pt; margin:3pt 0 4pt; }
  .items { width:100%; border-collapse:collapse; font-size:9pt; margin:0; }
  .items th { font-weight:bold; text-align:left; padding:2pt 3pt; border-top:1.5pt solid #000; border-bottom:1.5pt solid #000; }
  .items td { padding:1.5pt 3pt; border-bottom:0.5pt dotted #999; vertical-align:top; }
  .items .c { text-align:center; }
  .items .r { text-align:right; }
  .items th.c { text-align:center; }
  .items th.r { text-align:right; }
  .sub-row td { font-weight:bold; border-top:1.5pt solid #000; border-bottom:none; }
  .terbilang { font-size:8.5pt; font-style:italic; padding:3pt 0; border-top:1pt solid #000; border-bottom:1pt solid #000; margin:2pt 0; }
  .bottom { display:flex; justify-content:space-between; margin-top:3pt; font-size:8.5pt; }
  .remark { width:52%; }
  .remark h3 { font-size:9pt; font-weight:bold; margin-bottom:2pt; }
  .remark ul { list-style:none; padding:0; }
  .remark li { margin-bottom:1pt; }
  .remark li:before { content:"- "; }
  .summary { width:44%; }
  .summary table { width:100%; font-size:9pt; border-collapse:collapse; }
  .summary td { padding:1pt 2pt; }
  .summary .r { text-align:right; }
  .summary .grand td { border-top:1.5pt solid #000; font-weight:bold; padding-top:2pt; }
  @media print { body { -webkit-print-color-adjust:exact; } }
</style></head><body>

<div class="head">
  <div class="head-left">
    <h1>INVOICE</h1>
    <div class="kepada">
      Kepada :<br>
      <strong>${order.partner_store_name}</strong><br>
      ${order.partner_address || ''}
    </div>
  </div>
  <div class="head-right">
    <h2>${storeName}</h2>
    ${storeAddr ? `<div style="font-size:8.5pt">${storeAddr}</div>` : ''}
    ${storePhone ? `<div style="font-size:8.5pt">Telp: ${storePhone}</div>` : ''}
    <table style="margin-top:3pt">
      <tr><td>No Invoice</td><td>: <strong>${order.order_number}</strong></td></tr>
      <tr><td>Tanggal</td><td>: ${tgl}</td></tr>
    </table>
  </div>
</div>

${order.canvasser_name ? `<div class="sales">Kode Sales: <strong>${order.canvasser_name}</strong></div>` : ''}

<table class="items">
  <thead>
    <tr>
      <th style="width:5%;" class="c">No.</th>
      <th style="width:31%;">Nama Barang</th>
      <th style="width:13%;" class="c">Jumlah</th>
      <th style="width:11%;" class="c">Quantity</th>
      <th style="width:17%;" class="r">Harga</th>
      <th style="width:23%;" class="r">Jumlah</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
    <tr class="sub-row">
      <td colspan="5" style="text-align:right"><strong>Sub Total</strong></td>
      <td style="text-align:right"><strong>${fN(order.total)}</strong></td>
    </tr>
  </tbody>
</table>

<div class="terbilang">Terbilang: <em>${totalWords}</em></div>

<div class="bottom">
  <div class="remark">
    <h3>Remark :</h3>
    <ul>
      <li>Barang yang sudah dibeli tidak dapat dikembalikan kecuali ada perjanjian.</li>
      <li>Mohon diperiksa dengan teliti (karena kami tidak menerima komplain setelah barang diterima).</li>
      <li>Terima kasih.</li>
    </ul>
  </div>
  <div class="summary">
    <table>${summaryRows}</table>
  </div>
</div>

</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=600');
    if (!win) return false;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); setTimeout(() => win.close(), 1000); }, 500);
    return true;
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

  async printPartnerInvoice(order, storeSettings) {
    const serverOk = await this.checkLocalServer();
    if (serverOk) {
      const data = this.buildPartnerInvoice(order, storeSettings);
      await this.printViaServer(data);
      return { success: true, method: 'server' };
    }
    throw new Error('Print Server tidak aktif');
  }
}

export const dotMatrixPrinter = new DotMatrixPrinter();
export default DotMatrixPrinter;
