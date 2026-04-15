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
  ChevronDown, ChevronUp, Clock, FileText, Bell, Banknote, CalendarDays, RotateCcw, Edit3,
  Upload, X, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '../components/CurrencyInput';
import { Pagination } from '../components/Pagination';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const fmtNum = (v) => new Intl.NumberFormat('id-ID').format(v);

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
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [correctSupplier, setCorrectSupplier] = useState(null);
  const [correctAmount, setCorrectAmount] = useState('');
  const [correctNotes, setCorrectNotes] = useState('');
  const [correctSubmitting, setCorrectSubmitting] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [returnWarehouse, setReturnWarehouse] = useState('gudang_utama');
  const [page, setPage] = useState(1);
  const perPage = 15;
  // Purchase items (flattened) states
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseDateFrom, setPurchaseDateFrom] = useState('');
  const [purchaseDateTo, setPurchaseDateTo] = useState('');
  // Import CSV states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importSupplierId, setImportSupplierId] = useState('');
  const [importSupplierName, setImportSupplierName] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [purchaseItemPage, setPurchaseItemPage] = useState(1);
  const purchaseItemPerPage = 10; // date groups per page

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
    setPurchaseSearch('');
    setPurchaseDateFrom('');
    setPurchaseDateTo('');
    setPurchaseItemPage(1);
    try {
      const [purchasesRes, paymentsRes, itemsRes] = await Promise.all([
        api.get(`/supplier-debts/${supplierId}/purchases?show_all=false`),
        api.get(`/suppliers/${supplierId}/payments`),
        api.get(`/supplier-debts/${supplierId}/purchase-items`)
      ]);
      setSupplierPurchases(purchasesRes.data);
      setSupplierPayments(paymentsRes.data);
      setPurchaseItems(itemsRes.data);
    } catch (error) {
      toast.error('Gagal memuat detail supplier');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchPurchaseItems = async (supplierId, search = '', dateFrom = '', dateTo = '') => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      const res = await api.get(`/supplier-debts/${supplierId}/purchase-items?${params.toString()}`);
      setPurchaseItems(res.data);
    } catch { toast.error('Gagal memuat data pembelian'); }
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

  const openCorrectModal = (supplier) => {
    setCorrectSupplier(supplier);
    setCorrectAmount(String(supplier.outstanding));
    setCorrectNotes('');
    setCorrectModalOpen(true);
  };

  const openImportModal = (supplier) => {
    setImportSupplierId(supplier.supplier_id);
    setImportSupplierName(supplier.supplier_name);
    setImportRows([]);
    setImportModalOpen(true);
  };

  const handleCSVFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast.error('CSV harus memiliki header dan minimal 1 baris data'); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          if (vals.length < 3) continue;
          const row = {};
          headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
          // Map common column names
          const dateVal = row['tanggal'] || row['date'] || row['tgl'] || '';
          const nameVal = row['nama barang'] || row['nama_barang'] || row['product_name'] || row['barang'] || row['nama'] || '';
          const qtyVal = row['qty'] || row['qty (dus)'] || row['qty_dus'] || row['jumlah'] || row['quantity'] || '0';
          const ipbVal = row['isi/dus'] || row['isi_per_dus'] || row['items_per_box'] || row['isi'] || '1';
          const costVal = row['harga'] || row['harga supplier'] || row['harga_supplier'] || row['harga pokok'] || row['cost_price'] || row['harga supplier/dus'] || '0';
          const dueVal = row['jatuh tempo'] || row['due_date'] || row['jatuh_tempo'] || '';
          // Parse date: support DD/MM/YYYY and YYYY-MM-DD
          let parsedDate = dateVal;
          if (dateVal.includes('/')) {
            const parts = dateVal.split('/');
            if (parts.length === 3) {
              parsedDate = parts[2].length === 4
                ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
                : dateVal;
            }
          }
          let parsedDue = dueVal;
          if (dueVal.includes('/')) {
            const parts = dueVal.split('/');
            if (parts.length === 3) {
              parsedDue = parts[2].length === 4
                ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
                : dueVal;
            }
          }
          if (nameVal) {
            rows.push({
              date: parsedDate, product_name: nameVal,
              qty_dus: parseInt(qtyVal) || 0, items_per_box: parseFloat(ipbVal) || 1,
              cost_price: parseFloat(costVal.replace(/[^0-9.-]/g, '')) || 0,
              due_date: parsedDue
            });
          }
        }
        setImportRows(rows);
        if (rows.length === 0) toast.error('Tidak ada data valid yang ditemukan di CSV');
        else toast.success(`${rows.length} baris data berhasil dibaca`);
      } catch { toast.error('Gagal membaca file CSV'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportSubmit = async () => {
    if (importRows.length === 0) return;
    setImportSubmitting(true);
    try {
      const res = await api.post(`/supplier-debts/${importSupplierId}/import-csv`, { rows: importRows });
      toast.success(res.data.message);
      setImportModalOpen(false);
      fetchData();
      if (expandedSupplier === importSupplierId) {
        setExpandedSupplier(null);
        setTimeout(() => toggleSupplier(importSupplierId), 200);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal import data');
    } finally { setImportSubmitting(false); }
  };

  const handleCorrection = async () => {
    if (!correctSupplier || correctAmount === '') return;
    setCorrectSubmitting(true);
    try {
      await api.put(`/supplier-debts/${correctSupplier.supplier_id}/correct`, {
        new_debt: parseFloat(correctAmount) || 0,
        notes: correctNotes
      });
      toast.success('Hutang supplier berhasil dikoreksi');
      setCorrectModalOpen(false);
      fetchData();
      if (expandedSupplier === correctSupplier.supplier_id) {
        setExpandedSupplier(null);
        setTimeout(() => toggleSupplier(correctSupplier.supplier_id), 200);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengoreksi hutang');
    } finally {
      setCorrectSubmitting(false);
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
              <span className="text-xs md:text-sm text-muted-foreground font-medium">Hutang ke Supplier</span>
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
                    <Button size="sm" variant="outline" className="hidden md:flex gap-1" onClick={(e) => { e.stopPropagation(); openCorrectModal(s); }} data-testid={`correct-btn-${s.supplier_id}`}>
                      <Edit3 className="w-3.5 h-3.5" /> Koreksi
                    </Button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {/* Mobile pay button */}
                {s.outstanding > 0 && (
                  <Button size="sm" className="md:hidden mt-2 w-full gap-1" onClick={(e) => { e.stopPropagation(); openPayModal(s); }} data-testid={`pay-btn-mobile-${s.supplier_id}`}>
                    <CreditCard className="w-3.5 h-3.5" /> Bayar Hutang
                  </Button>
                )}
                <Button size="sm" variant="outline" className="md:hidden mt-1 w-full gap-1" onClick={(e) => { e.stopPropagation(); openCorrectModal(s); }} data-testid={`correct-btn-mobile-${s.supplier_id}`}>
                  <Edit3 className="w-3.5 h-3.5" /> Koreksi Hutang
                </Button>
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

                      {/* Purchases Tab - Detailed Items View */}
                      {detailTab === 'purchases' && (
                        <div className="space-y-3">
                          {/* Search & Filter */}
                          <div className="flex flex-col md:flex-row gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input placeholder="Cari nama barang..." value={purchaseSearch} className="pl-8 h-8 text-sm"
                                onChange={(e) => {
                                  setPurchaseSearch(e.target.value);
                                  setPurchaseItemPage(1);
                                  fetchPurchaseItems(s.supplier_id, e.target.value, purchaseDateFrom, purchaseDateTo);
                                }} data-testid="purchase-item-search" />
                            </div>
                            <div className="flex items-center gap-2">
                              <Input type="date" className="h-8 text-xs w-36" value={purchaseDateFrom} placeholder="Dari"
                                onChange={(e) => {
                                  setPurchaseDateFrom(e.target.value);
                                  setPurchaseItemPage(1);
                                  fetchPurchaseItems(s.supplier_id, purchaseSearch, e.target.value, purchaseDateTo);
                                }} data-testid="purchase-date-from" />
                              <span className="text-xs text-muted-foreground">-</span>
                              <Input type="date" className="h-8 text-xs w-36" value={purchaseDateTo} placeholder="Sampai"
                                onChange={(e) => {
                                  setPurchaseDateTo(e.target.value);
                                  setPurchaseItemPage(1);
                                  fetchPurchaseItems(s.supplier_id, purchaseSearch, purchaseDateFrom, e.target.value);
                                }} data-testid="purchase-date-to" />
                              {(purchaseSearch || purchaseDateFrom || purchaseDateTo) && (
                                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => {
                                  setPurchaseSearch(''); setPurchaseDateFrom(''); setPurchaseDateTo('');
                                  setPurchaseItemPage(1);
                                  fetchPurchaseItems(s.supplier_id, '', '', '');
                                }}><X className="w-3.5 h-3.5" /></Button>
                              )}
                            </div>
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openImportModal(s)} data-testid="import-csv-btn">
                              <Upload className="w-3.5 h-3.5" /> Import CSV
                            </Button>
                          </div>

                          {purchaseItems.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4 text-sm">
                              {purchaseSearch || purchaseDateFrom || purchaseDateTo ? 'Tidak ada data yang cocok dengan filter.' : 'Tidak ada data pembelian.'}
                            </p>
                          ) : (() => {
                            // Group items by date
                            const grouped = {};
                            purchaseItems.forEach(item => {
                              const d = item.date || 'tanpa-tanggal';
                              if (!grouped[d]) grouped[d] = { items: [], due_date: item.due_date, total: 0, remaining: 0, purchase_id: item.purchase_id };
                              grouped[d].items.push(item);
                              grouped[d].total += item.subtotal;
                              if (!grouped[d].due_date && item.due_date) grouped[d].due_date = item.due_date;
                              grouped[d].remaining = Math.max(grouped[d].remaining, item.purchase_remaining);
                            });
                            const allDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
                            const grandTotal = purchaseItems.reduce((s, i) => s + i.subtotal, 0);
                            const totalDatePages = Math.ceil(allDates.length / purchaseItemPerPage);
                            const dates = allDates.slice((purchaseItemPage - 1) * purchaseItemPerPage, purchaseItemPage * purchaseItemPerPage);

                            return (
                              <>
                                {/* Desktop Table */}
                                <div className="hidden md:block rounded-lg border overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Tanggal</TableHead>
                                        <TableHead className="text-xs">Nama Barang</TableHead>
                                        <TableHead className="text-xs text-right">Qty (Dus)</TableHead>
                                        <TableHead className="text-xs text-right">Qty (Satuan)</TableHead>
                                        <TableHead className="text-xs text-right">Harga Pokok/Dus</TableHead>
                                        <TableHead className="text-xs text-right">Total</TableHead>
                                        <TableHead className="text-xs">Jatuh Tempo</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {dates.map(date => {
                                        const group = grouped[date];
                                        return group.items.map((item, idx) => (
                                          <TableRow key={`${date}-${idx}`} className={group.remaining > 0 ? '' : 'opacity-60'}>
                                            {idx === 0 ? (
                                              <TableCell rowSpan={group.items.length + 1} className="text-xs font-medium align-top border-r bg-muted/30">
                                                {date !== 'tanpa-tanggal' ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                              </TableCell>
                                            ) : null}
                                            <TableCell className="text-sm">{item.product_name}</TableCell>
                                            <TableCell className="text-sm text-right font-medium">{fmtNum(item.qty_dus)}</TableCell>
                                            <TableCell className="text-xs text-right text-muted-foreground">{fmtNum(item.qty_satuan)} <span className="text-[10px]">({item.items_per_box}/dus)</span></TableCell>
                                            <TableCell className="text-sm text-right">{fmt(item.cost_price)}</TableCell>
                                            <TableCell className="text-sm text-right font-medium">{fmt(item.subtotal)}</TableCell>
                                            {idx === 0 ? (
                                              <TableCell rowSpan={group.items.length + 1} className="align-top border-l">
                                                {group.remaining > 0 ? (
                                                  <input type="date" className="text-xs border rounded px-1.5 py-0.5 w-32"
                                                    value={group.due_date || ''}
                                                    onChange={async (e) => {
                                                      try {
                                                        await api.put(`/purchases/${group.purchase_id}/due-date?due_date=${e.target.value}`);
                                                        toast.success('Jatuh tempo diperbarui');
                                                        fetchPurchaseItems(s.supplier_id, purchaseSearch, purchaseDateFrom, purchaseDateTo);
                                                      } catch { toast.error('Gagal update'); }
                                                    }}
                                                    data-testid={`due-date-${date}`}
                                                  />
                                                ) : (
                                                  <span className="text-xs text-green-600 font-medium">Lunas</span>
                                                )}
                                              </TableCell>
                                            ) : null}
                                          </TableRow>
                                        )).concat([
                                          <TableRow key={`${date}-subtotal`} className="bg-muted/50 border-b-2">
                                            <TableCell colSpan={4} className="text-xs text-right font-semibold text-muted-foreground">Subtotal {new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}:</TableCell>
                                            <TableCell className="text-sm text-right font-bold">{fmt(group.total)}</TableCell>
                                          </TableRow>
                                        ]);
                                      })}
                                      <TableRow className="bg-primary/5 font-bold">
                                        <TableCell colSpan={2} className="text-sm">GRAND TOTAL</TableCell>
                                        <TableCell className="text-sm text-right">{fmtNum(purchaseItems.reduce((s, i) => s + i.qty_dus, 0))}</TableCell>
                                        <TableCell className="text-sm text-right">{fmtNum(purchaseItems.reduce((s, i) => s + i.qty_satuan, 0))}</TableCell>
                                        <TableCell></TableCell>
                                        <TableCell className="text-sm text-right">{fmt(grandTotal)}</TableCell>
                                        <TableCell></TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="md:hidden space-y-3">
                                  {dates.map(date => {
                                    const group = grouped[date];
                                    return (
                                      <Card key={date} className={`p-3 ${group.remaining > 0 ? '' : 'opacity-60'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-semibold text-muted-foreground">
                                            {date !== 'tanpa-tanggal' ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                          </span>
                                          {group.remaining > 0 ? (
                                            <span className="text-xs text-red-600 font-medium">Belum lunas</span>
                                          ) : (
                                            <span className="text-xs text-green-600 font-medium">Lunas</span>
                                          )}
                                        </div>
                                        {group.items.map((item, idx) => (
                                          <div key={idx} className="flex items-center justify-between py-1.5 border-t text-sm">
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium truncate">{item.product_name}</p>
                                              <p className="text-xs text-muted-foreground">{fmtNum(item.qty_dus)} dus ({fmtNum(item.qty_satuan)} satuan) x {fmt(item.cost_price)}</p>
                                            </div>
                                            <p className="font-semibold ml-2 shrink-0">{fmt(item.subtotal)}</p>
                                          </div>
                                        ))}
                                        <div className="flex justify-between mt-2 pt-2 border-t">
                                          <span className="text-xs text-muted-foreground font-medium">Subtotal:</span>
                                          <span className="text-sm font-bold">{fmt(group.total)}</span>
                                        </div>
                                        {group.remaining > 0 && (
                                          <div className="flex items-center gap-2 mt-2">
                                            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                                            <input type="date" className="text-xs border rounded px-1.5 py-0.5 flex-1"
                                              value={group.due_date || ''}
                                              onChange={async (e) => {
                                                try {
                                                  await api.put(`/purchases/${group.purchase_id}/due-date?due_date=${e.target.value}`);
                                                  toast.success('Jatuh tempo diperbarui');
                                                  fetchPurchaseItems(s.supplier_id, purchaseSearch, purchaseDateFrom, purchaseDateTo);
                                                } catch { toast.error('Gagal update'); }
                                              }} />
                                          </div>
                                        )}
                                      </Card>
                                    );
                                  })}
                                  <Card className="p-3 bg-primary/5">
                                    <div className="flex justify-between">
                                      <span className="font-semibold text-sm">Grand Total:</span>
                                      <span className="font-bold text-sm">{fmt(grandTotal)}</span>
                                    </div>
                                  </Card>
                                </div>

                                <p className="text-xs text-muted-foreground text-center">{purchaseItems.length} item dari {allDates.length} tanggal pembelian</p>
                                <Pagination page={purchaseItemPage} totalPages={totalDatePages} total={allDates.length} perPage={purchaseItemPerPage} onChange={setPurchaseItemPage} />
                              </>
                            );
                          })()}
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
      {/* Correction Dialog */}
      <Dialog open={correctModalOpen} onOpenChange={setCorrectModalOpen}>
        <DialogContent className="max-w-md" data-testid="correct-modal">
          <DialogHeader>
            <DialogTitle>Koreksi Hutang Supplier</DialogTitle>
          </DialogHeader>
          {correctSupplier && (
            <div className="space-y-4">
              <Card className="p-3 bg-muted/50">
                <p className="font-semibold">{correctSupplier.supplier_name}</p>
                <p className="text-sm text-red-600 font-bold mt-1">Hutang saat ini: {fmt(correctSupplier.outstanding)}</p>
              </Card>
              <div className="space-y-2">
                <Label>Nilai Hutang Baru</Label>
                <CurrencyInput value={parseInt(correctAmount) || 0} onChange={(v) => setCorrectAmount(String(v))} data-testid="correct-amount-input" />
                <p className="text-xs text-muted-foreground">Masukkan nilai hutang yang seharusnya. Sistem akan menyesuaikan selisihnya.</p>
              </div>
              <div className="space-y-2">
                <Label>Alasan Koreksi</Label>
                <Input placeholder="Contoh: Data tidak sesuai nota..." value={correctNotes} onChange={(e) => setCorrectNotes(e.target.value)} data-testid="correct-notes-input" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setCorrectModalOpen(false)}>Batal</Button>
                <Button onClick={handleCorrection} disabled={correctSubmitting} data-testid="submit-correct-btn">
                  {correctSubmitting ? 'Memproses...' : 'Simpan Koreksi'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Import CSV Dialog */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="import-modal">
          <DialogHeader>
            <DialogTitle>Import Riwayat Pembelian</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="p-3 bg-muted/50">
              <p className="font-semibold">{importSupplierName}</p>
              <p className="text-xs text-muted-foreground mt-1">Upload file CSV dengan format kolom:</p>
              <p className="text-xs font-mono bg-white rounded p-2 mt-1 border">Tanggal, Nama Barang, Qty, Isi/Dus, Harga Supplier, Jatuh Tempo</p>
              <p className="text-[10px] text-muted-foreground mt-1">Format tanggal: DD/MM/YYYY atau YYYY-MM-DD. Kolom Jatuh Tempo opsional.</p>
            </Card>

            <div className="space-y-2">
              <Label>Pilih File CSV</Label>
              <Input type="file" accept=".csv" onChange={handleCSVFile} data-testid="import-file-input" />
            </div>

            {importRows.length > 0 && (
              <>
                <div className="rounded-lg border overflow-hidden max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tanggal</TableHead>
                        <TableHead className="text-xs">Nama Barang</TableHead>
                        <TableHead className="text-xs text-right">Qty (Dus)</TableHead>
                        <TableHead className="text-xs text-right">Isi/Dus</TableHead>
                        <TableHead className="text-xs text-right">Harga/Dus</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs">Jatuh Tempo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{row.date}</TableCell>
                          <TableCell className="text-sm">{row.product_name}</TableCell>
                          <TableCell className="text-sm text-right">{fmtNum(row.qty_dus)}</TableCell>
                          <TableCell className="text-sm text-right">{row.items_per_box}</TableCell>
                          <TableCell className="text-sm text-right">{fmt(row.cost_price)}</TableCell>
                          <TableCell className="text-sm text-right font-medium">{fmt(row.cost_price * row.qty_dus)}</TableCell>
                          <TableCell className="text-xs">{row.due_date || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Card className="p-3 bg-amber-50 border-amber-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-900">Total import ({importRows.length} item):</span>
                    <span className="font-bold text-amber-900">
                      {fmt(importRows.reduce((s, r) => s + (r.cost_price * r.qty_dus), 0))}
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">Semua item akan dicatat sebagai hutang (belum dibayar). Stok barang tidak akan berubah.</p>
                </Card>
              </>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setImportModalOpen(false)}>Batal</Button>
              <Button onClick={handleImportSubmit} disabled={importSubmitting || importRows.length === 0} data-testid="submit-import-btn">
                {importSubmitting ? 'Mengimport...' : `Import ${importRows.length} Item`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
