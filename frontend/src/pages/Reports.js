import React, { useState } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { FileText, Download, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Store, Award } from 'lucide-react';

export const Reports = () => {
  const [activeTab, setActiveTab] = useState('pos');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setReportData(null);
    try {
      const endpoints = {
        pos: '/reports/sales-detail',
        partner: '/reports/partner-sales-detail',
        bestseller: '/reports/best-sellers'
      };
      const res = await api.get(`${endpoints[activeTab]}?date_from=${dateFrom}&date_to=${dateTo}`);
      setReportData({ ...res.data, type: activeTab });
    } catch (error) {
      toast.error('Gagal memuat laporan');
    } finally { setLoading(false); }
  };

  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
  const fmtNum = (v) => new Intl.NumberFormat('id-ID').format(v);

  const exportCSV = () => {
    if (!reportData || !reportData.rows.length) return;
    let csv = "data:text/csv;charset=utf-8,";
    if (reportData.type === 'pos') {
      csv += "Tanggal,No Transaksi,Produk,Qty,Harga Pokok,Harga Jual,Total Jual,Total HPP,Margin\n";
      reportData.rows.forEach(r => {
        csv += `${r.date},${r.transaction_number},${r.product_name},${r.quantity},${r.cost_price},${r.sell_price},${r.total_sell},${r.total_cost},${r.margin}\n`;
      });
    } else if (reportData.type === 'partner') {
      csv += "Tanggal,No Order,Kios Mitra,Produk,Qty (satuan),HPP/satuan,Jual/satuan,Total Jual,Total HPP,Margin\n";
      reportData.rows.forEach(r => {
        csv += `${r.date},${r.order_number},${r.partner_store_name},${r.product_name},${r.quantity_satuan},${r.cost_price_per_unit},${r.sell_price_per_unit},${r.total_sell},${r.total_cost},${r.margin}\n`;
      });
    } else {
      csv += "Rank,Produk,Qty POS,Qty Mitra,Qty Total,Revenue POS,Revenue Mitra,Revenue Total,Total HPP,Margin\n";
      reportData.rows.forEach((r, i) => {
        csv += `${i + 1},${r.product_name},${r.qty_pos},${r.qty_partner},${r.qty_total},${r.revenue_pos},${r.revenue_partner},${r.revenue_total},${r.cost_total},${r.margin}\n`;
      });
    }
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `laporan-${reportData.type}-${dateFrom}-${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV berhasil diexport');
  };

  const marginPercent = reportData && reportData.total_sales > 0
    ? ((reportData.total_margin / reportData.total_sales) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Laporan</h1>
        <p className="text-sm text-muted-foreground mt-1">Laporan penjualan rinci per produk</p>
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
          <Button variant={activeTab === 'bestseller' ? 'default' : 'outline'} size="sm" onClick={() => { setActiveTab('bestseller'); setReportData(null); }} data-testid="tab-bestseller">
            <Award className="w-4 h-4 mr-1" />Terlaris
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
                    <p className="text-xl font-bold" data-testid="total-sales">{fmt(reportData.total_sales)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total HPP</p>
                    <p className="text-xl font-bold text-red-600" data-testid="total-cost">{fmt(reportData.total_cost)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Margin</p>
                    <p className="text-xl font-bold text-emerald-600" data-testid="total-margin">{fmt(reportData.total_margin)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Margin %</p>
                    <p className="text-xl font-bold text-blue-600" data-testid="margin-percent">{marginPercent}%</p>
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
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Produk Terjual</p>
                    <p className="text-xl font-bold" data-testid="total-products">{fmtNum(reportData.total_products)} produk</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p>
                    <p className="text-xl font-bold" data-testid="total-revenue-bs">{fmt(reportData.rows.reduce((s, r) => s + r.revenue_total, 0))}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Margin</p>
                    <p className="text-xl font-bold text-emerald-600" data-testid="total-margin-bs">{fmt(reportData.rows.reduce((s, r) => s + r.margin, 0))}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Export */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{fmtNum(reportData.rows.length)} item produk terjual</p>
            <Button variant="outline" onClick={exportCSV} disabled={!reportData.rows.length} data-testid="export-csv-button">
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
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
                      <TableHead>Produk</TableHead>
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
                      <TableHead>Produk</TableHead>
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
              <h3 className="font-semibold mb-4">Peringkat Produk Terlaris</h3>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-14 text-center">#</TableHead>
                      <TableHead>Produk</TableHead>
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
    </div>
  );
};
