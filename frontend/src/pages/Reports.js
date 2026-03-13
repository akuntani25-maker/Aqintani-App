import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { FileText, Download, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Store, Award, FileDown, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const Reports = () => {
  const [activeTab, setActiveTab] = useState('pos');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [loading, setLoading] = useState(false);
  const [storeSettings, setStoreSettings] = useState(null);

  useEffect(() => {
    api.get('/store-settings').then(res => setStoreSettings(res.data)).catch(() => {});
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setReportData(null);
    setProfitLoss(null);
    try {
      if (activeTab === 'profit_loss') {
        const res = await api.get(`/reports/profit-loss?date_from=${dateFrom}&date_to=${dateTo}`);
        setProfitLoss(res.data);
      } else {
        const endpoints = {
          pos: '/reports/sales-detail',
          partner: '/reports/partner-sales-detail',
          bestseller: '/reports/best-sellers'
        };
        const res = await api.get(`${endpoints[activeTab]}?date_from=${dateFrom}&date_to=${dateTo}`);
        setReportData({ ...res.data, type: activeTab });
      }
    } catch (error) {
      toast.error('Gagal memuat laporan');
    } finally { setLoading(false); }
  };

  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
  const fmtNum = (v) => new Intl.NumberFormat('id-ID').format(v);

  const exportCSV = () => {
    if (!reportData || !reportData.rows.length) return;
    const tabLabels = { pos: 'Penjualan POS', partner: 'Penjualan Kios Mitra', bestseller: 'Barang Terlaris' };
    let csv = "\uFEFF"; // BOM for Excel UTF-8

    // Header / Headline
    csv += `${storeSettings?.store_name || 'UD. AQIN TANI'}\n`;
    csv += `Laporan ${tabLabels[reportData.type]}\n`;
    csv += `Periode: ${dateFrom} s/d ${dateTo}\n`;
    csv += `Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n`;
    if (storeSettings?.phone) csv += `Telp: ${storeSettings.phone}\n`;
    if (storeSettings?.address) csv += `Alamat: ${storeSettings.address}\n`;
    csv += "\n";

    if (reportData.type === 'pos') {
      if (reportData.total_sales !== undefined) {
        csv += `Total Penjualan:,${reportData.total_sales}\n`;
        csv += `Total HPP:,${reportData.total_cost}\n`;
        csv += `Total Margin:,${reportData.total_margin}\n`;
        csv += `Margin %:,${marginPercent}%\n`;
        csv += "\n";
      }
      csv += "Tanggal,No Transaksi,Barang,Qty,Harga Pokok,Harga Jual,Total Jual,Total HPP,Margin\n";
      reportData.rows.forEach(r => {
        csv += `${r.date},${r.transaction_number},"${r.product_name}",${r.quantity},${r.cost_price},${r.sell_price},${r.total_sell},${r.total_cost},${r.margin}\n`;
      });
      csv += `\n,,TOTAL,,,,${reportData.total_sales},${reportData.total_cost},${reportData.total_margin}\n`;
    } else if (reportData.type === 'partner') {
      if (reportData.total_sales !== undefined) {
        csv += `Total Penjualan:,${reportData.total_sales}\n`;
        csv += `Total HPP:,${reportData.total_cost}\n`;
        csv += `Total Margin:,${reportData.total_margin}\n`;
        csv += `Margin %:,${marginPercent}%\n`;
        csv += "\n";
      }
      csv += "Tanggal,No Order,Kios Mitra,Barang,Qty (satuan),HPP/satuan,Jual/satuan,Total Jual,Total HPP,Margin\n";
      reportData.rows.forEach(r => {
        csv += `${r.date},${r.order_number},"${r.partner_store_name}","${r.product_name}",${r.quantity_satuan},${r.cost_price_per_unit},${r.sell_price_per_unit},${r.total_sell},${r.total_cost},${r.margin}\n`;
      });
      csv += `\n,,,TOTAL,,,,,${reportData.total_sales},${reportData.total_cost},${reportData.total_margin}\n`;
    } else {
      csv += "Rank,Barang,Qty POS,Qty Mitra,Qty Total,Revenue POS,Revenue Mitra,Revenue Total,Total HPP,Margin\n";
      reportData.rows.forEach((r, i) => {
        csv += `${i + 1},"${r.product_name}",${r.qty_pos},${r.qty_partner},${r.qty_total},${r.revenue_pos},${r.revenue_partner},${r.revenue_total},${r.cost_total},${r.margin}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `UD_AQIN_TANI-${tabLabels[reportData.type].replace(/\s/g, '_')}-${dateFrom}_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV berhasil diexport');
  };

  const exportPDF = () => {
    if (!reportData || !reportData.rows.length) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Kop Surat
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 32, pageWidth, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(storeSettings?.store_name || 'UD. AQIN TANI', 14, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Menjual Pupuk, Obat Pertanian, dan Alat Pertanian', 14, 20);
    const contactLine = [
      storeSettings?.phone ? `Telp: ${storeSettings.phone}` : '',
      storeSettings?.address || ''
    ].filter(Boolean).join('  |  ');
    doc.text(contactLine || '', 14, 26);

    const tabLabels = { pos: 'Penjualan POS', partner: 'Penjualan Kios Mitra', bestseller: 'Barang Terlaris' };
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`Laporan ${tabLabels[reportData.type]} | Periode: ${dateFrom} s/d ${dateTo}`, pageWidth - 14, 14, { align: 'right' });
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - 14, 20, { align: 'right' });

    let startY = 40;

    // Summary boxes (2 per row for portrait)
    doc.setTextColor(30, 41, 59);
    if (reportData.type === 'pos' || reportData.type === 'partner') {
      const summaryItems = [
        { label: 'Total Penjualan', value: fmt(reportData.total_sales) },
        { label: 'Total HPP', value: fmt(reportData.total_cost) },
        { label: 'Total Margin', value: fmt(reportData.total_margin) },
        { label: 'Margin %', value: marginPercent + '%' },
      ];
      const boxW = (pageWidth - 28 - 4) / 2;
      summaryItems.forEach((item, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = 14 + col * (boxW + 4);
        const y = startY + row * 20;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, boxW, 16, 2, 2, 'F');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(item.label.toUpperCase(), x + 4, y + 6);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(item.value, x + 4, y + 13);
        doc.setFont('helvetica', 'normal');
      });
      startY += 44;
    }

    // Table
    let head, body, footRow;
    if (reportData.type === 'pos') {
      head = [['Tanggal', 'Barang', 'Qty', 'HPP/Unit', 'Jual/Unit', 'Total Jual', 'Total HPP', 'Margin']];
      body = reportData.rows.map(r => [r.date, r.product_name, fmtNum(r.quantity), fmt(r.cost_price), fmt(r.sell_price), fmt(r.total_sell), fmt(r.total_cost), fmt(r.margin)]);
      footRow = [['', 'TOTAL', '', '', '', fmt(reportData.total_sales), fmt(reportData.total_cost), fmt(reportData.total_margin)]];
    } else if (reportData.type === 'partner') {
      head = [['Tanggal', 'Barang', 'Kios Mitra', 'Qty', 'HPP/Unit', 'Jual/Unit', 'Total Jual', 'Total HPP', 'Margin']];
      body = reportData.rows.map(r => [r.date, r.product_name, r.partner_store_name, fmtNum(r.quantity_satuan), fmt(r.cost_price_per_unit), fmt(r.sell_price_per_unit), fmt(r.total_sell), fmt(r.total_cost), fmt(r.margin)]);
      footRow = [['', 'TOTAL', '', '', '', '', fmt(reportData.total_sales), fmt(reportData.total_cost), fmt(reportData.total_margin)]];
    } else {
      head = [['#', 'Barang', 'Qty POS', 'Qty Mitra', 'Qty Total', 'Rev POS', 'Rev Mitra', 'Rev Total', 'HPP', 'Margin']];
      body = reportData.rows.map((r, i) => [i + 1, r.product_name, fmtNum(r.qty_pos), fmtNum(r.qty_partner), fmtNum(r.qty_total), fmt(r.revenue_pos), fmt(r.revenue_partner), fmt(r.revenue_total), fmt(r.cost_total), fmt(r.margin)]);
      footRow = null;
    }

    autoTable(doc, {
      head,
      body,
      foot: footRow || undefined,
      showFoot: 'lastPage',
      startY,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageNum = doc.internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`UD. AQIN TANI - Laporan ${tabLabels[reportData.type]}`, 14, doc.internal.pageSize.getHeight() - 8);
        doc.text(`Halaman ${data.pageNumber} dari ${pageNum}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      }
    });

    doc.save(`laporan-${reportData.type}-${dateFrom}-${dateTo}.pdf`);
    toast.success('PDF berhasil diexport');
  };

  const exportProfitLossPDF = () => {
    if (!profitLoss || !profitLoss.daily_data?.length) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header / Kop Surat
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 32, pageWidth, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(storeSettings?.store_name || 'UD. AQIN TANI', 14, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Menjual Pupuk, Obat Pertanian, dan Alat Pertanian', 14, 20);
    const plContact = [
      storeSettings?.phone ? `Telp: ${storeSettings.phone}` : '',
      storeSettings?.address || ''
    ].filter(Boolean).join('  |  ');
    doc.text(plContact || '', 14, 26);

    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`Laporan Laba/Rugi | Periode: ${dateFrom} s/d ${dateTo}`, pageWidth - 14, 14, { align: 'right' });
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - 14, 20, { align: 'right' });

    let startY = 40;

    // Summary boxes (3 per row for portrait)
    const summaryItems = [
      { label: 'Revenue POS', value: fmt(profitLoss.pos_revenue) },
      { label: 'Revenue Mitra', value: fmt(profitLoss.partner_revenue) },
      { label: 'Total Revenue', value: fmt(profitLoss.total_revenue) },
      { label: 'Total HPP', value: fmt(profitLoss.total_cogs), color: [220, 38, 38] },
      { label: 'Laba Kotor', value: fmt(profitLoss.gross_profit), color: [5, 150, 105] },
      { label: 'Margin', value: profitLoss.margin_percent + '%', color: [37, 99, 235] },
    ];

    const boxW = (pageWidth - 28 - 8) / 3;
    summaryItems.forEach((item, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = 14 + col * (boxW + 4);
      const y = startY + row * 20;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, boxW, 16, 2, 2, 'F');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(item.label.toUpperCase(), x + 3, y + 6);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      if (item.color) doc.setTextColor(...item.color);
      else doc.setTextColor(15, 23, 42);
      doc.text(item.value, x + 3, y + 13);
      doc.setFont('helvetica', 'normal');
    });
    startY += 44;

    // Additional info line
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Transaksi POS: ${profitLoss.total_transactions}  |  Total Order Mitra: ${profitLoss.total_partner_orders}`, 14, startY);
    startY += 8;

    // Daily breakdown table
    const head = [['Tanggal', 'Revenue', 'HPP (COGS)', 'Laba Kotor']];
    const body = profitLoss.daily_data.map(d => [
      d.date,
      fmt(d.revenue),
      fmt(d.cogs),
      fmt(d.profit),
    ]);
    const footRow = [['TOTAL', fmt(profitLoss.total_revenue), fmt(profitLoss.total_cogs), fmt(profitLoss.gross_profit)]];

    autoTable(doc, {
      head,
      body,
      foot: footRow,
      showFoot: 'lastPage',
      startY,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { halign: 'right' },
        2: { halign: 'right', textColor: [220, 38, 38] },
        3: { halign: 'right', textColor: [5, 150, 105], fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageNum = doc.internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`${storeSettings?.store_name || 'UD. AQIN TANI'} - Laporan Laba/Rugi`, 14, doc.internal.pageSize.getHeight() - 8);
        doc.text(`Halaman ${data.pageNumber} dari ${pageNum}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      }
    });

    doc.save(`laporan-laba-rugi-${dateFrom}-${dateTo}.pdf`);
    toast.success('PDF Laba/Rugi berhasil diexport');
  };

  const marginPercent = reportData && reportData.total_sales > 0
    ? ((reportData.total_margin / reportData.total_sales) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Laporan</h1>
        <p className="text-sm text-muted-foreground mt-1">Laporan penjualan rinci per barang</p>
      </div>

      {/* Tab & Filter */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={activeTab === 'pos' ? 'default' : 'outline'} size="sm" onClick={() => { setActiveTab('pos'); setReportData(null); }} data-testid="tab-pos">
            <ShoppingCart className="w-4 h-4 mr-1" />POS
          </Button>
          <Button variant={activeTab === 'partner' ? 'default' : 'outline'} size="sm" onClick={() => { setActiveTab('partner'); setReportData(null); }} data-testid="tab-partner">
            <Store className="w-4 h-4 mr-1" />Kios Mitra
          </Button>
          <Button variant={activeTab === 'bestseller' ? 'default' : 'outline'} size="sm" onClick={() => { setActiveTab('bestseller'); setReportData(null); setProfitLoss(null); }} data-testid="tab-bestseller">
            <Award className="w-4 h-4 mr-1" />Terlaris
          </Button>
          <Button variant={activeTab === 'profit_loss' ? 'default' : 'outline'} size="sm" onClick={() => { setActiveTab('profit_loss'); setReportData(null); setProfitLoss(null); }} data-testid="tab-profit-loss">
            <BarChart3 className="w-4 h-4 mr-1" />Laba/Rugi
          </Button>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="space-y-2 flex-1">
            <Label>Dari Tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="date-from" />
          </div>
          <div className="space-y-2 flex-1">
            <Label>Sampai Tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="date-to" />
          </div>
          <Button onClick={fetchReport} disabled={loading} data-testid="generate-report-button">
            <FileText className="w-4 h-4 mr-2" />{loading ? 'Memuat...' : 'Generate Laporan'}
          </Button>
        </div>
      </Card>

      {/* Report Result */}
      {reportData && (
        <div className="space-y-6" data-testid="report-result">
          {/* Summary - POS & Partner */}
          {(reportData.type === 'pos' || reportData.type === 'partner') && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Penjualan</p>
                    <p className="text-base md:text-lg lg:text-xl font-bold truncate" data-testid="total-sales">{fmt(reportData.total_sales)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total HPP</p>
                    <p className="text-base md:text-lg lg:text-xl font-bold text-red-600 truncate" data-testid="total-cost">{fmt(reportData.total_cost)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Margin</p>
                    <p className="text-base md:text-lg lg:text-xl font-bold text-emerald-600 truncate" data-testid="total-margin">{fmt(reportData.total_margin)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Margin %</p>
                    <p className="text-base md:text-lg lg:text-xl font-bold text-blue-600 truncate" data-testid="margin-percent">{marginPercent}%</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Summary - Bestseller */}
          {reportData.type === 'bestseller' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center"><Award className="w-5 h-5 text-amber-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Barang Terjual</p>
                    <p className="text-base md:text-lg lg:text-xl font-bold truncate" data-testid="total-products">{fmtNum(reportData.total_products)} produk</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p>
                    <p className="text-base md:text-lg lg:text-xl font-bold truncate" data-testid="total-revenue-bs">{fmt(reportData.rows.reduce((s, r) => s + r.revenue_total, 0))}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Margin</p>
                    <p className="text-base md:text-lg lg:text-xl font-bold text-emerald-600 truncate" data-testid="total-margin-bs">{fmt(reportData.rows.reduce((s, r) => s + r.margin, 0))}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Export */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{fmtNum(reportData.rows.length)} item produk terjual</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCSV} disabled={!reportData.rows.length} data-testid="export-csv-button">
                <Download className="w-4 h-4 mr-2" />Export CSV
              </Button>
              <Button onClick={exportPDF} disabled={!reportData.rows.length} data-testid="export-pdf-button">
                <FileDown className="w-4 h-4 mr-2" />Export PDF
              </Button>
            </div>
          </div>

          {/* POS Sales Table */}
          {reportData.type === 'pos' && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Rincian Penjualan POS</h3>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Barang</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">HPP/Unit</TableHead>
                      <TableHead className="text-right">Jual/Unit</TableHead>
                      <TableHead className="text-right">Total Jual</TableHead>
                      <TableHead className="text-right">Total HPP</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada data penjualan</TableCell></TableRow>
                    ) : reportData.rows.map((row, i) => {
                      const isPositive = row.margin >= 0;
                      return (
                        <TableRow key={i} data-testid={`pos-row-${i}`}>
                          <TableCell className="text-sm whitespace-nowrap">{row.date}</TableCell>
                          <TableCell className="font-medium">{row.product_name}</TableCell>
                          <TableCell className="text-center">{fmtNum(row.quantity)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmt(row.cost_price)}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(row.sell_price)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(row.total_sell)}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">{fmt(row.total_cost)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(row.margin)}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {reportData.rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/30 font-bold">
                        <td className="p-3" colSpan={5}>TOTAL</td>
                        <td className="p-3 text-right">{fmt(reportData.total_sales)}</td>
                        <td className="p-3 text-right text-red-600">{fmt(reportData.total_cost)}</td>
                        <td className="p-3 text-right text-emerald-600">{fmt(reportData.total_margin)}</td>
                      </tr>
                    </tfoot>
                  )}
                </Table>
              </div>
            </Card>
          )}

          {/* Partner Sales Table */}
          {reportData.type === 'partner' && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Rincian Penjualan Kios Mitra</h3>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Barang</TableHead>
                      <TableHead>Kios Mitra</TableHead>
                      <TableHead className="text-center">Qty (satuan)</TableHead>
                      <TableHead className="text-right">HPP/Unit</TableHead>
                      <TableHead className="text-right">Jual/Unit</TableHead>
                      <TableHead className="text-right">Total Jual</TableHead>
                      <TableHead className="text-right">Total HPP</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Tidak ada data penjualan kios mitra</TableCell></TableRow>
                    ) : reportData.rows.map((row, i) => {
                      const isPositive = row.margin >= 0;
                      return (
                        <TableRow key={i} data-testid={`partner-row-${i}`}>
                          <TableCell className="text-sm whitespace-nowrap">{row.date}</TableCell>
                          <TableCell className="font-medium">{row.product_name}</TableCell>
                          <TableCell className="text-sm">{row.partner_store_name}</TableCell>
                          <TableCell className="text-center">
                            {fmtNum(row.quantity_satuan)}
                            {row.unit_original === 'dus' && (
                              <span className="text-xs text-muted-foreground ml-1">({row.quantity_original} dus)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{fmt(row.cost_price_per_unit)}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(row.sell_price_per_unit)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(row.total_sell)}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">{fmt(row.total_cost)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(row.margin)}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {reportData.rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/30 font-bold">
                        <td className="p-3" colSpan={6}>TOTAL</td>
                        <td className="p-3 text-right">{fmt(reportData.total_sales)}</td>
                        <td className="p-3 text-right text-red-600">{fmt(reportData.total_cost)}</td>
                        <td className="p-3 text-right text-emerald-600">{fmt(reportData.total_margin)}</td>
                      </tr>
                    </tfoot>
                  )}
                </Table>
              </div>
            </Card>
          )}
          {/* Bestseller Table */}
          {reportData.type === 'bestseller' && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Peringkat Barang Terlaris</h3>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-14 text-center">#</TableHead>
                      <TableHead>Barang</TableHead>
                      <TableHead className="text-center">Qty POS</TableHead>
                      <TableHead className="text-center">Qty Mitra</TableHead>
                      <TableHead className="text-center">Qty Total</TableHead>
                      <TableHead className="text-right">Revenue POS</TableHead>
                      <TableHead className="text-right">Revenue Mitra</TableHead>
                      <TableHead className="text-right">Revenue Total</TableHead>
                      <TableHead className="text-right">HPP</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Tidak ada data produk</TableCell></TableRow>
                    ) : reportData.rows.map((row, i) => {
                      const maxRevenue = reportData.rows[0]?.revenue_total || 1;
                      const pct = (row.revenue_total / maxRevenue) * 100;
                      const medal = i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-600' : '';
                      return (
                        <TableRow key={row.product_id} data-testid={`bs-row-${i}`}>
                          <TableCell className="text-center">
                            <span className={`font-bold text-lg ${medal}`}>{i + 1}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{row.product_name}</p>
                              <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-32">
                                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{fmtNum(row.qty_pos)}</TableCell>
                          <TableCell className="text-center">{fmtNum(row.qty_partner)}</TableCell>
                          <TableCell className="text-center font-semibold">{fmtNum(row.qty_total)}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(row.revenue_pos)}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(row.revenue_partner)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(row.revenue_total)}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">{fmt(row.cost_total)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${row.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(row.margin)}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Profit & Loss Report */}
      {profitLoss && (
        <div className="space-y-6" data-testid="profit-loss-result">
          {/* Export Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={exportProfitLossPDF} data-testid="export-pl-pdf">
              <Download className="w-4 h-4 mr-2" />Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              if (!profitLoss?.daily_data?.length) return;
              let csv = `${storeSettings?.store_name || 'UD. AQIN TANI'}\nLaporan Laba/Rugi\nPeriode: ${dateFrom} s/d ${dateTo}\nDicetak: ${new Date().toLocaleDateString('id-ID')}\n`;
              if (storeSettings?.phone) csv += `Telp: ${storeSettings.phone}\n`;
              if (storeSettings?.address) csv += `Alamat: ${storeSettings.address}\n`;
              csv += `\nTotal Revenue,${profitLoss.total_revenue}\nTotal HPP,${profitLoss.total_cogs}\nLaba Kotor,${profitLoss.gross_profit}\nMargin,${profitLoss.margin_percent}%\n`;
              csv += `\nTanggal,Revenue,HPP,Laba\n`;
              profitLoss.daily_data.forEach(d => { csv += `${d.date},${d.revenue},${d.cogs},${d.profit}\n`; });
              csv += `TOTAL,${profitLoss.total_revenue},${profitLoss.total_cogs},${profitLoss.gross_profit}\n`;
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `laporan-laba-rugi-${dateFrom}-${dateTo}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              toast.success('CSV Laba/Rugi berhasil diexport');
            }} data-testid="export-pl-csv">
              <FileDown className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p>
              <p className="text-lg md:text-xl font-bold mt-1" data-testid="pl-revenue">{fmt(profitLoss.total_revenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">POS: {fmt(profitLoss.pos_revenue)} | Mitra: {fmt(profitLoss.partner_revenue)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total HPP (COGS)</p>
              <p className="text-lg md:text-xl font-bold text-red-600 mt-1" data-testid="pl-cogs">{fmt(profitLoss.total_cogs)}</p>
              <p className="text-xs text-muted-foreground mt-1">POS: {fmt(profitLoss.pos_cogs)} | Mitra: {fmt(profitLoss.partner_cogs)}</p>
            </Card>
            <Card className="p-5 bg-emerald-50 border-emerald-200">
              <p className="text-xs text-emerald-700 uppercase tracking-wider font-semibold">Laba Kotor</p>
              <p className={`text-lg md:text-xl font-bold mt-1 ${profitLoss.gross_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} data-testid="pl-gross-profit">{fmt(profitLoss.gross_profit)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Margin</p>
              <p className="text-lg md:text-xl font-bold text-blue-600 mt-1" data-testid="pl-margin">{profitLoss.margin_percent}%</p>
              <p className="text-xs text-muted-foreground mt-1">{profitLoss.total_transactions} transaksi | {profitLoss.total_partner_orders} order mitra</p>
            </Card>
          </div>

          {profitLoss.daily_data?.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Grafik Laba/Rugi Harian</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={profitLoss.daily_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cogs" name="HPP" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Laba" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {profitLoss.daily_data?.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Rincian Harian</h3>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">HPP</TableHead>
                      <TableHead className="text-right">Laba</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitLoss.daily_data.map((d, i) => (
                      <TableRow key={i} data-testid={`pl-row-${i}`}>
                        <TableCell>{d.date}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(d.revenue)}</TableCell>
                        <TableCell className="text-right text-red-600">{fmt(d.cogs)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${d.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(d.profit)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/30 font-bold">
                      <td className="p-3">TOTAL</td>
                      <td className="p-3 text-right">{fmt(profitLoss.total_revenue)}</td>
                      <td className="p-3 text-right text-red-600">{fmt(profitLoss.total_cogs)}</td>
                      <td className="p-3 text-right text-emerald-600">{fmt(profitLoss.gross_profit)}</td>
                    </tr>
                  </tfoot>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
