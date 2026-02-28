import React, { useState } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { FileText, Download, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';

export const Reports = () => {
  const [reportType, setReportType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reports/daily?date=${selectedDate}`);
      setReportData({ ...response.data, type: 'daily' });
    } catch (error) {
      toast.error('Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reports/monthly?year=${selectedYear}&month=${selectedMonth}`);
      setReportData({ ...response.data, type: 'monthly' });
    } catch (error) {
      toast.error('Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (reportType === 'daily') {
      fetchDailyReport();
    } else {
      fetchMonthlyReport();
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('UD. AQIN TANI', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(
      reportData.type === 'daily' 
        ? `Laporan Harian - ${selectedDate}`
        : `Laporan Bulanan - ${selectedMonth}/${selectedYear}`,
      105, 30, { align: 'center' }
    );

    doc.setFontSize(10);
    let yPos = 50;
    doc.text(`Total Penjualan: ${formatCurrency(reportData.total_sales)}`, 20, yPos);
    yPos += 10;
    doc.text(`Total Transaksi: ${reportData.total_transactions}`, 20, yPos);

    doc.save(`laporan-${reportData.type}-${reportType === 'daily' ? selectedDate : `${selectedMonth}-${selectedYear}`}.pdf`);
    toast.success('Laporan berhasil diexport');
  };

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (reportData.type === 'daily') {
      csvContent += "No Transaksi,Tanggal,Kasir,Total,Metode Pembayaran\n";
      reportData.transactions.forEach(t => {
        csvContent += `${t.transaction_number},${t.created_at},${t.cashier_name},${t.total},${t.payment_method}\n`;
      });
    } else {
      csvContent += "Tanggal,Total Penjualan\n";
      Object.entries(reportData.daily_sales).forEach(([date, total]) => {
        csvContent += `${date},${total}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan-${reportData.type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Laporan berhasil diexport');
  };

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Laporan</h1>
        <p className="text-sm text-muted-foreground mt-2">Lihat dan export laporan penjualan</p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex gap-4">
            <Button
              variant={reportType === 'daily' ? 'default' : 'outline'}
              onClick={() => setReportType('daily')}
              data-testid="daily-report-button"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Laporan Harian
            </Button>
            <Button
              variant={reportType === 'monthly' ? 'default' : 'outline'}
              onClick={() => setReportType('monthly')}
              data-testid="monthly-report-button"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Laporan Bulanan
            </Button>
          </div>

          {reportType === 'daily' ? (
            <div className="flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="date">Pilih Tanggal</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  data-testid="date-input"
                />
              </div>
              <Button onClick={handleGenerate} disabled={loading} data-testid="generate-report-button">
                {loading ? 'Memuat...' : 'Generate Laporan'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="month">Bulan</Label>
                <Input
                  id="month"
                  type="number"
                  min="1"
                  max="12"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  data-testid="month-input"
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="year">Tahun</Label>
                <Input
                  id="year"
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  data-testid="year-input"
                />
              </div>
              <Button onClick={handleGenerate} disabled={loading} data-testid="generate-report-button">
                {loading ? 'Memuat...' : 'Generate Laporan'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {reportData && (
        <Card className="p-6" data-testid="report-result">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold">
                {reportData.type === 'daily' ? `Laporan Harian` : `Laporan Bulanan`}
              </h2>
              <p className="text-sm text-muted-foreground">
                {reportData.type === 'daily' 
                  ? selectedDate
                  : `${selectedMonth}/${selectedYear}`
                }
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToPDF} data-testid="export-pdf-button">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" onClick={exportToCSV} data-testid="export-csv-button">
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-6 bg-primary/5 rounded-lg border">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Total Penjualan
              </p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(reportData.total_sales)}</p>
            </div>
            <div className="p-6 bg-secondary/5 rounded-lg border">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Total Transaksi
              </p>
              <p className="text-3xl font-bold text-secondary">{reportData.total_transactions}</p>
            </div>
          </div>

          {reportData.type === 'daily' && reportData.payment_methods && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Metode Pembayaran</h3>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(reportData.payment_methods).map(([method, total]) => (
                  <div key={method} className="p-4 bg-accent rounded-lg">
                    <p className="text-xs text-muted-foreground capitalize">{method}</p>
                    <p className="text-lg font-bold">{formatCurrency(total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportData.type === 'daily' && reportData.transactions && (
            <div>
              <h3 className="font-semibold mb-3">Daftar Transaksi</h3>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No Transaksi</TableHead>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Kasir</TableHead>
                      <TableHead>Metode</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-sm">{transaction.transaction_number}</TableCell>
                        <TableCell>{new Date(transaction.created_at).toLocaleTimeString('id-ID')}</TableCell>
                        <TableCell>{transaction.cashier_name}</TableCell>
                        <TableCell className="capitalize">{transaction.payment_method}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(transaction.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};