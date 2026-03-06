import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  DollarSign, AlertTriangle, CreditCard, Users, Search, Download,
  ChevronDown, ChevronUp, Clock, FileText, Bell, Banknote, CalendarDays, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '../components/CurrencyInput';
import { Pagination } from '../components/Pagination';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export const SupplierDebt = () => {
  const [overview, setOverview] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedSupplier, setExpandedSupplier] = useState(null);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [paySupplier, setPaySupplier] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [showAllPurchases, setShowAllPurchases] = useState(false);
  const [detailTab, setDetailTab] = useState('purchases');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [returnWarehouse, setReturnWarehouse] = useState('gudang_utama');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, summaryRes] = await Promise.all([
        api.get('/supplier-debts/overview'),
        api.get('/supplier-debts/summary')
      ]);
      setOverview(overviewRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      toast.error('Gagal memuat data hutang supplier');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get('/warehouses').then(res => setWarehouses(res.data)).catch(() => {});
  }, []);

  const openReturnModal = (purchase) => {
    setReturnPurchase(purchase);
    setReturnItems(purchase.items.map(it => ({ ...it, return_qty: 0 })));
    setReturnNotes('');
    setReturnWarehouse('gudang_utama');
    setReturnModalOpen(true);
  };

  const handleReturn = async () => {
    const items = returnItems.filter(it => it.return_qty > 0).map(it => ({
      product_id: it.product_id, quantity: it.return_qty
    }));
    if (items.length === 0) { toast.error('Pilih minimal 1 item untuk diretur'); return; }
    setReturnSubmitting(true);
    try {
      const res = await api.post(`/purchases/${returnPurchase.id}/return`, {
        items, notes: returnNotes, warehouse_id: returnWarehouse
      });
      toast.success(res.data.message);
      setReturnModalOpen(false);
      const purchRes = await api.get(`/supplier-debts/${expandedSupplier}/purchases?show_all=${showAllPurchases}`);
      setSupplierPurchases(purchRes.data);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memproses retur');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const toggleSupplier = async (supplierId) => {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null);
      return;
    }
    setExpandedSupplier(supplierId);
    setDetailLoading(true);
    setDetailTab('purchases');
    setShowAllPurchases(false);
    try {
      const [purchasesRes, paymentsRes] = await Promise.all([
        api.get(`/supplier-debts/${supplierId}/purchases?show_all=false`),
        api.get(`/suppliers/${supplierId}/payments`)
      ]);
      setSupplierPurchases(purchasesRes.data);
      setSupplierPayments(paymentsRes.data);
    } catch (error) {
      toast.error('Gagal memuat detail supplier');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchPurchases = async (supplierId, showAll) => {
    try {
      const res = await api.get(`/supplier-debts/${supplierId}/purchases?show_all=${showAll}`);
      setSupplierPurchases(res.data);
    } catch (error) {
      toast.error('Gagal memuat data pembelian');
    }
  };

  const openPayModal = (supplier) => {
    setPaySupplier(supplier);
    setPayAmount('');
    setPayNotes('');
    setPayModalOpen(true);
  };

  const handlePay = async () => {
    if (!paySupplier || !payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Masukkan jumlah pembayaran yang valid');
      return;
    }
    setPaySubmitting(true);
    try {
      await api.post(
        `/supplier-debts/${paySupplier.supplier_id}/pay?amount=${parseFloat(payAmount)}&notes=${encodeURIComponent(payNotes)}`
      );
      toast.success(`Pembayaran ${fmt(parseFloat(payAmount))} berhasil dicatat`);
      setPayModalOpen(false);
      fetchData();
      if (expandedSupplier === paySupplier.supplier_id) {
        const sid = paySupplier.supplier_id;
        setExpandedSupplier(null);
        setTimeout(() => toggleSupplier(sid), 200);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mencatat pembayaran');
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/supplier-debts/export-csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hutang_supplier_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('File CSV berhasil diunduh');
    } catch (error) {
      toast.error('Gagal mengexport CSV');
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const filteredOverview = overview.filter(s => {
    const matchSearch = s.supplier_name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'has_debt') return s.outstanding > 0;
    if (filter === 'overdue') return s.outstanding > 0 && s.oldest_unpaid_date && s.oldest_unpaid_date <= thirtyDaysAgo;
    if (filter === 'no_debt') return s.outstanding <= 0;
    return true;
  });

  useEffect(() => { setPage(1); }, [search, filter]);

  const totalPages = Math.ceil(filteredOverview.length / perPage);
  const paginatedOverview = filteredOverview.slice((page - 1) * perPage, page * perPage);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="supplier-debt-page">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight" data-testid="page-title">Hutang Supplier</h1>
            <p className="text-sm text-muted-foreground mt-1">Kelola dan pantau hutang ke semua supplier</p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" className="w-full sm:w-auto gap-2" data-testid="export-csv-btn">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4" data-testid="summary-cards">
          <Card className="p-3 md:p-4" data-testid="total-debt-card">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-red-600" />
              <span className="text-xs md:text-sm text-muted-foreground font-medium">Total Hutang</span>
            </div>
            <p className="text-base md:text-xl font-bold text-red-600 truncate">{fmt(summary.total_debt)}</p>
          </Card>
          <Card className="p-3 md:p-4" data-testid="suppliers-with-debt-card">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-orange-600" />
              <span className="text-xs md:text-sm text-muted-foreground font-medium">Supplier Berhutang</span>
            </div>
            <p className="text-base md:text-xl font-bold text-orange-600">{summary.suppliers_with_debt}</p>
          </Card>
          <Card className="p-3 md:p-4" data-testid="paid-this-month-card">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-green-600" />
              <span className="text-xs md:text-sm text-muted-foreground font-medium">Dibayar Bulan Ini</span>
            </div>
            <p className="text-base md:text-xl font-bold text-green-600 truncate">{fmt(summary.total_paid_this_month)}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">{summary.payments_this_month_count} pembayaran</p>
          </Card>
        </div>
      )}

      {/* Overdue Alert */}
      {summary && summary.overdue_count > 0 && (
        <Card className="p-3 md:p-4 border-yellow-300 bg-yellow-50" data-testid="overdue-alert">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-800 text-sm">Peringatan Hutang Jatuh Tempo</p>
              <p className="text-yellow-700 text-xs md:text-sm mt-1">
                Ada <b>{summary.overdue_count} pembelian</b> dengan hutang lebih dari 30 hari senilai <b>{fmt(summary.overdue_total)}</b>. Segera lakukan pembayaran.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Search & Filter */}
      <Card className="p-4" data-testid="search-filter-bar">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cari supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" data-testid="search-input" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'Semua' },
              { key: 'has_debt', label: 'Ada Hutang' },
              { key: 'overdue', label: 'Jatuh Tempo' },
              { key: 'no_debt', label: 'Lunas' },
            ].map(f => (
              <Button key={f.key} variant={filter === f.key ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.key)} data-testid={`filter-${f.key}-btn`}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Supplier List */}
      <div className="space-y-3" data-testid="supplier-list">
        {paginatedOverview.length === 0 && (
          <Card className="p-12 text-center" data-testid="empty-state">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">Tidak ada data supplier yang cocok dengan filter.</p>
          </Card>
        )}

        {paginatedOverview.map(s => {
          const isExpanded = expandedSupplier === s.supplier_id;
          const isOverdue = s.outstanding > 0 && s.oldest_unpaid_date && s.oldest_unpaid_date <= thirtyDaysAgo;
          const daysSinceOldest = s.oldest_unpaid_date
            ? Math.floor((new Date(today) - new Date(s.oldest_unpaid_date)) / 86400000)
            : 0;

          return (
            <Card key={s.supplier_id} className={`overflow-hidden ${isOverdue ? 'border-yellow-300' : ''}`} data-testid={`supplier-card-${s.supplier_id}`}>
              {/* Supplier Row */}
              <div
                className="p-3 md:p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => toggleSupplier(s.supplier_id)}
                data-testid={`supplier-row-${s.supplier_id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm md:text-base truncate">{s.supplier_name}</h3>
                      {isOverdue && (
                        <span className="text-[10px] md:text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium whitespace-nowrap" data-testid="overdue-badge">
                          {daysSinceOldest}hr jatuh tempo
                        </span>
                      )}
                      {s.outstanding <= 0 && s.purchase_count > 0 && (
                        <span className="text-[10px] md:text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Lunas</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      {s.phone && <span>{s.phone}</span>}
                      <span>{s.purchase_count} pembelian</span>
                      {s.unpaid_count > 0 && <span className="text-orange-600">{s.unpaid_count} belum lunas</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className={`font-bold text-sm md:text-base ${s.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {s.outstanding > 0 ? fmt(s.outstanding) : 'Rp 0'}
                      </p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">Sisa hutang</p>
                    </div>
                    {s.outstanding > 0 && (
                      <Button size="sm" className="hidden md:flex gap-1" onClick={(e) => { e.stopPropagation(); openPayModal(s); }} data-testid={`pay-btn-${s.supplier_id}`}>
                        <CreditCard className="w-3.5 h-3.5" /> Bayar
                      </Button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {/* Mobile pay button */}
                {s.outstanding > 0 && (
                  <Button size="sm" className="md:hidden mt-2 w-full gap-1" onClick={(e) => { e.stopPropagation(); openPayModal(s); }} data-testid={`pay-btn-mobile-${s.supplier_id}`}>
                    <CreditCard className="w-3.5 h-3.5" /> Bayar Hutang
                  </Button>
                )}
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t bg-muted/30 p-3 md:p-4" data-testid={`supplier-detail-${s.supplier_id}`}>
                  {detailLoading ? (
                    <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                  ) : (
                    <>
                      {/* Tabs */}
                      <div className="flex gap-2 mb-4">
                        <Button size="sm" variant={detailTab === 'purchases' ? 'default' : 'outline'} onClick={() => setDetailTab('purchases')} data-testid="tab-purchases">
                          <FileText className="w-3.5 h-3.5 mr-1" /> Pembelian {supplierPurchases.length > 0 && `(${supplierPurchases.length})`}
                        </Button>
                        <Button size="sm" variant={detailTab === 'payments' ? 'default' : 'outline'} onClick={() => setDetailTab('payments')} data-testid="tab-payments">
                          <CreditCard className="w-3.5 h-3.5 mr-1" /> Riwayat Bayar {supplierPayments.length > 0 && `(${supplierPayments.length})`}
                        </Button>
                      </div>

                      {/* Purchases Tab */}
                      {detailTab === 'purchases' && (
                        <div className="space-y-3">
                          {supplierPurchases.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4 text-sm">{showAllPurchases ? 'Tidak ada pembelian.' : 'Tidak ada pembelian yang belum lunas.'}</p>
                          ) : (
                            <>
                              {/* Desktop Table */}
                              <div className="hidden md:block rounded-lg border overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Tanggal</TableHead>
                                      <TableHead>Total</TableHead>
                                      <TableHead>Dibayar</TableHead>
                                      <TableHead>Sisa</TableHead>
                                      <TableHead>Jatuh Tempo</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Catatan</TableHead>
                                      <TableHead></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {supplierPurchases.map(p => {
                                      const age = Math.floor((new Date(today) - new Date(p.date)) / 86400000);
                                      const isOld = p.remaining > 0 && age > 30;
                                      const handleDueDate = async (e) => {
                                        try {
                                          await api.put(`/purchases/${p.id}/due-date?due_date=${e.target.value}`);
                                          toast.success('Jatuh tempo diperbarui');
                                          const res = await api.get(`/supplier-debts/${expandedSupplier}/purchases?show_all=${showAllPurchases}`);
                                          setSupplierPurchases(res.data);
                                        } catch { toast.error('Gagal update jatuh tempo'); }
                                      };
                                      return (
                                        <TableRow key={p.id} className={isOld ? 'bg-yellow-50' : ''}>
                                          <TableCell>{new Date(p.date).toLocaleDateString('id-ID')}</TableCell>
                                          <TableCell>{fmt(p.total)}</TableCell>
                                          <TableCell className="text-green-600">{fmt(p.paid)}</TableCell>
                                          <TableCell className="font-semibold text-red-600">{fmt(p.remaining)}</TableCell>
                                          <TableCell>
                                            {p.remaining > 0 ? (
                                              <input
                                                type="date"
                                                className="text-xs border rounded px-1.5 py-0.5 w-32"
                                                value={p.due_date || ''}
                                                onChange={handleDueDate}
                                                data-testid={`due-date-${p.id}`}
                                              />
                                            ) : (
                                              <span className="text-xs text-muted-foreground">-</span>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {p.remaining <= 0
                                              ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Lunas</span>
                                              : isOld
                                                ? <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{age}hr</span>
                                                : <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Tempo</span>
                                            }
                                          </TableCell>
                                          <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">{p.notes || '-'}</TableCell>
                                          <TableCell>
                                            {p.remaining > 0 && (
                                              <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 h-7 px-2" onClick={() => openReturnModal(p)} data-testid={`return-btn-${p.id}`}>
                                                <RotateCcw className="w-3.5 h-3.5 mr-1" />Retur
                                              </Button>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>

                              {/* Mobile Cards */}
                              <div className="md:hidden space-y-2">
                                {supplierPurchases.map(p => {
                                  const age = Math.floor((new Date(today) - new Date(p.date)) / 86400000);
                                  const isOld = p.remaining > 0 && age > 30;
                                  const handleMobileDueDate = async (e) => {
                                    try {
                                      await api.put(`/purchases/${p.id}/due-date?due_date=${e.target.value}`);
                                      toast.success('Jatuh tempo diperbarui');
                                      const res = await api.get(`/supplier-debts/${expandedSupplier}/purchases?show_all=${showAllPurchases}`);
                                      setSupplierPurchases(res.data);
                                    } catch { toast.error('Gagal update'); }
                                  };
                                  return (
                                    <Card key={p.id} className={`p-3 text-sm ${isOld ? 'bg-yellow-50 border-yellow-200' : ''}`}>
                                      <div className="flex justify-between items-start">
                                        <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString('id-ID')}</span>
                                        {p.remaining > 0
                                          ? isOld
                                            ? <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{age}hr jatuh tempo</span>
                                            : <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Tempo</span>
                                          : <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Lunas</span>
                                        }
                                      </div>
                                      <div className="flex justify-between mt-1">
                                        <span>Total: {fmt(p.total)}</span>
                                        <span className="font-bold text-red-600">Sisa: {fmt(p.remaining)}</span>
                                      </div>
                                      {p.remaining > 0 && (
                                        <div className="flex items-center gap-2 mt-2">
                                          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                                          <input type="date" className="text-xs border rounded px-1.5 py-0.5 flex-1" value={p.due_date || ''} onChange={handleMobileDueDate} />
                                          <Button variant="ghost" size="sm" className="text-orange-600 h-7 px-2" onClick={() => openReturnModal(p)}>
                                            <RotateCcw className="w-3.5 h-3.5 mr-1" />Retur
                                          </Button>
                                        </div>
                                      )}
                                      {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                                    </Card>
                                  );
                                })}
                              </div>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
                            const newVal = !showAllPurchases;
                            setShowAllPurchases(newVal);
                            fetchPurchases(s.supplier_id, newVal);
                          }} data-testid="toggle-all-purchases">
                            {showAllPurchases ? 'Tampilkan belum lunas saja' : 'Tampilkan semua pembelian'}
                          </Button>
                        </div>
                      )}

                      {/* Payments Tab */}
                      {detailTab === 'payments' && (
                        <div className="space-y-2">
                          {supplierPayments.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4 text-sm">Belum ada riwayat pembayaran.</p>
                          ) : (
                            supplierPayments.map(p => (
                              <Card key={p.id} className="p-3 flex items-center justify-between text-sm">
                                <div>
                                  <p className="font-semibold text-green-700">{fmt(p.amount)}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{p.notes || '-'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('id-ID')}</p>
                                  <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                              </Card>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        <Pagination page={page} totalPages={totalPages} total={filteredOverview.length} perPage={perPage} onChange={setPage} />
      </div>

      {/* Payment Dialog */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-md" data-testid="pay-modal">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran</DialogTitle>
          </DialogHeader>
          {paySupplier && (
            <div className="space-y-4">
              <Card className="p-3 bg-muted/50">
                <p className="font-semibold">{paySupplier.supplier_name}</p>
                <p className="text-sm text-red-600 font-bold mt-1">Sisa hutang: {fmt(paySupplier.outstanding)}</p>
              </Card>
              <div className="space-y-2">
                <Label>Jumlah Bayar</Label>
                <CurrencyInput value={parseInt(payAmount) || 0} onChange={(v) => setPayAmount(String(v))} data-testid="pay-amount-input" />
                <div className="flex gap-2 mt-1">
                  {[0.25, 0.5, 1].map(pct => (
                    <button key={pct} className="text-xs bg-muted hover:bg-muted-foreground/10 px-2 py-1 rounded transition-colors"
                      onClick={() => setPayAmount(String(Math.round(paySupplier.outstanding * pct)))}>
                      {pct === 1 ? 'Lunasi' : `${pct * 100}%`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Catatan (opsional)</Label>
                <Input placeholder="Catatan pembayaran..." value={payNotes} onChange={(e) => setPayNotes(e.target.value)} data-testid="pay-notes-input" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setPayModalOpen(false)}>Batal</Button>
                <Button onClick={handlePay} disabled={paySubmitting || !payAmount} data-testid="submit-pay-btn">
                  {paySubmitting ? 'Memproses...' : `Bayar ${payAmount ? fmt(parseFloat(payAmount) || 0) : ''}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
        <DialogContent className="max-w-lg" data-testid="return-modal">
          <DialogHeader>
            <DialogTitle>Retur Barang ke Supplier</DialogTitle>
          </DialogHeader>
          {returnPurchase && (
            <div className="space-y-4">
              <Card className="p-3 bg-muted/50">
                <p className="font-semibold">{returnPurchase.supplier_name}</p>
                <p className="text-sm text-red-600 font-bold mt-1">Sisa hutang: {fmt(returnPurchase.remaining)}</p>
              </Card>
              <div className="space-y-2">
                <Label>Pilih item & jumlah retur:</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {returnItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded text-sm">
                      <span className="flex-1 truncate">{item.product_name}</span>
                      <span className="text-xs text-muted-foreground">maks {item.quantity}</span>
                      <Input
                        type="number" min="0" max={item.quantity}
                        className="w-20 h-8 text-center"
                        value={item.return_qty || ''}
                        onChange={(e) => {
                          const val = Math.min(parseInt(e.target.value) || 0, item.quantity);
                          setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, return_qty: val } : it));
                        }}
                        data-testid={`return-qty-${idx}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Gudang asal stok</Label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={returnWarehouse} onChange={(e) => setReturnWarehouse(e.target.value)}>
                  {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Catatan (opsional)</Label>
                <Input placeholder="Alasan retur..." value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} data-testid="return-notes-input" />
              </div>
              {returnItems.some(it => it.return_qty > 0) && (
                <Card className="p-3 bg-orange-50 border-orange-200">
                  <p className="text-sm font-semibold text-orange-800">Estimasi pengurangan hutang:</p>
                  <p className="text-lg font-bold text-orange-700">
                    {fmt(returnItems.reduce((sum, it) => sum + (it.return_qty * it.cost_price), 0))}
                  </p>
                </Card>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setReturnModalOpen(false)}>Batal</Button>
                <Button onClick={handleReturn} disabled={returnSubmitting || !returnItems.some(it => it.return_qty > 0)} className="bg-orange-600 hover:bg-orange-700" data-testid="submit-return-btn">
                  {returnSubmitting ? 'Memproses...' : 'Proses Retur'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
