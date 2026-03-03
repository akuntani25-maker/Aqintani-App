import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  DollarSign, AlertTriangle, CreditCard, Users, Search, Download,
  ChevronDown, ChevronUp, X, Clock, CheckCircle, FileText, Bell
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export const SupplierDebt = () => {
  const [overview, setOverview] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, has_debt, overdue, no_debt
  const [expandedSupplier, setExpandedSupplier] = useState(null);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [showAllPurchases, setShowAllPurchases] = useState(false);
  const [detailTab, setDetailTab] = useState('purchases'); // purchases, payments

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

  const handlePay = async () => {
    if (!payModalOpen || !payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Masukkan jumlah pembayaran yang valid');
      return;
    }
    setPaySubmitting(true);
    try {
      const res = await api.post(
        `/supplier-debts/${payModalOpen}/pay?amount=${parseFloat(payAmount)}&notes=${encodeURIComponent(payNotes)}`
      );
      toast.success(`Pembayaran ${fmt(parseFloat(payAmount))} berhasil dicatat`);
      setPayModalOpen(null);
      setPayAmount('');
      setPayNotes('');
      fetchData();
      if (expandedSupplier === payModalOpen) {
        toggleSupplier(payModalOpen);
        setTimeout(() => toggleSupplier(payModalOpen), 100);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="supplier-debt-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900" data-testid="page-title">Manajemen Hutang Supplier</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola dan pantau hutang ke semua supplier</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2 self-start" data-testid="export-csv-btn">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="summary-cards">
          <SummaryCard
            icon={DollarSign}
            label="Total Hutang"
            value={fmt(summary.total_debt)}
            color="text-red-600"
            bg="bg-red-50"
            testId="total-debt-card"
          />
          <SummaryCard
            icon={Users}
            label="Supplier Berhutang"
            value={summary.suppliers_with_debt}
            color="text-orange-600"
            bg="bg-orange-50"
            testId="suppliers-with-debt-card"
          />
          <SummaryCard
            icon={CreditCard}
            label="Dibayar Bulan Ini"
            value={fmt(summary.total_paid_this_month)}
            sub={`${summary.payments_this_month_count} pembayaran`}
            color="text-green-600"
            bg="bg-green-50"
            testId="paid-this-month-card"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Jatuh Tempo (>30hr)"
            value={summary.overdue_count}
            sub={summary.overdue_total > 0 ? fmt(summary.overdue_total) : ''}
            color="text-yellow-600"
            bg="bg-yellow-50"
            testId="overdue-card"
          />
        </div>
      )}

      {/* Overdue Alert */}
      {summary && summary.overdue_count > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 flex items-start gap-3" data-testid="overdue-alert">
          <Bell className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-800 text-sm">Peringatan Hutang Jatuh Tempo</p>
            <p className="text-yellow-700 text-xs sm:text-sm mt-1">
              Ada <b>{summary.overdue_count} pembelian</b> dengan hutang lebih dari 30 hari senilai <b>{fmt(summary.overdue_total)}</b>. Segera lakukan pembayaran.
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3" data-testid="search-filter-bar">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="search-input"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'Semua' },
            { key: 'has_debt', label: 'Ada Hutang' },
            { key: 'overdue', label: 'Jatuh Tempo' },
            { key: 'no_debt', label: 'Lunas' },
          ].map(f => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.key)}
              data-testid={`filter-${f.key}-btn`}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Supplier List */}
      <div className="space-y-3" data-testid="supplier-list">
        {filteredOverview.length === 0 && (
          <div className="text-center py-12 text-gray-500" data-testid="empty-state">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Tidak ada data supplier yang cocok dengan filter.</p>
          </div>
        )}

        {filteredOverview.map(s => {
          const isExpanded = expandedSupplier === s.supplier_id;
          const isOverdue = s.outstanding > 0 && s.oldest_unpaid_date && s.oldest_unpaid_date <= thirtyDaysAgo;
          const daysSinceOldest = s.oldest_unpaid_date
            ? Math.floor((new Date(today) - new Date(s.oldest_unpaid_date)) / 86400000)
            : 0;

          return (
            <div
              key={s.supplier_id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isOverdue ? 'border-yellow-300' : 'border-gray-200'}`}
              data-testid={`supplier-card-${s.supplier_id}`}
            >
              {/* Supplier Row */}
              <div
                className="p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleSupplier(s.supplier_id)}
                data-testid={`supplier-row-${s.supplier_id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{s.supplier_name}</h3>
                      {isOverdue && (
                        <span className="text-[10px] sm:text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium whitespace-nowrap" data-testid="overdue-badge">
                          {daysSinceOldest}hr jatuh tempo
                        </span>
                      )}
                      {s.outstanding <= 0 && s.purchase_count > 0 && (
                        <span className="text-[10px] sm:text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Lunas</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                      {s.phone && <span>{s.phone}</span>}
                      <span>{s.purchase_count} pembelian</span>
                      {s.unpaid_count > 0 && <span className="text-orange-600">{s.unpaid_count} belum lunas</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className={`font-bold text-sm sm:text-base ${s.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {s.outstanding > 0 ? fmt(s.outstanding) : 'Rp 0'}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400">Sisa hutang</p>
                    </div>
                    {s.outstanding > 0 && (
                      <Button
                        size="sm"
                        variant="default"
                        className="hidden sm:flex gap-1"
                        onClick={(e) => { e.stopPropagation(); setPayModalOpen(s.supplier_id); setPayAmount(''); setPayNotes(''); }}
                        data-testid={`pay-btn-${s.supplier_id}`}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Bayar
                      </Button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                {/* Mobile pay button */}
                {s.outstanding > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    className="sm:hidden mt-2 w-full gap-1"
                    onClick={(e) => { e.stopPropagation(); setPayModalOpen(s.supplier_id); setPayAmount(''); setPayNotes(''); }}
                    data-testid={`pay-btn-mobile-${s.supplier_id}`}
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Bayar Hutang
                  </Button>
                )}
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t bg-gray-50 p-3 sm:p-4" data-testid={`supplier-detail-${s.supplier_id}`}>
                  {detailLoading ? (
                    <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                  ) : (
                    <>
                      {/* Tabs */}
                      <div className="flex gap-2 mb-3">
                        <Button size="sm" variant={detailTab === 'purchases' ? 'default' : 'outline'} onClick={() => setDetailTab('purchases')} data-testid="tab-purchases">
                          <FileText className="w-3.5 h-3.5 mr-1" /> Pembelian {supplierPurchases.length > 0 && `(${supplierPurchases.length})`}
                        </Button>
                        <Button size="sm" variant={detailTab === 'payments' ? 'default' : 'outline'} onClick={() => setDetailTab('payments')} data-testid="tab-payments">
                          <CreditCard className="w-3.5 h-3.5 mr-1" /> Riwayat Bayar {supplierPayments.length > 0 && `(${supplierPayments.length})`}
                        </Button>
                      </div>

                      {/* Purchases Tab */}
                      {detailTab === 'purchases' && (
                        <div className="space-y-2">
                          {supplierPurchases.length === 0 ? (
                            <p className="text-center text-gray-500 py-4 text-sm">{showAllPurchases ? 'Tidak ada pembelian.' : 'Tidak ada pembelian yang belum lunas.'}</p>
                          ) : (
                            <>
                              {/* Table - Desktop */}
                              <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b text-left text-gray-500">
                                      <th className="pb-2 font-medium">Tanggal</th>
                                      <th className="pb-2 font-medium">Total</th>
                                      <th className="pb-2 font-medium">Dibayar</th>
                                      <th className="pb-2 font-medium">Sisa</th>
                                      <th className="pb-2 font-medium">Status</th>
                                      <th className="pb-2 font-medium">Catatan</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {supplierPurchases.map(p => {
                                      const age = Math.floor((new Date(today) - new Date(p.date)) / 86400000);
                                      const isOld = p.remaining > 0 && age > 30;
                                      return (
                                        <tr key={p.id} className={`border-b last:border-0 ${isOld ? 'bg-yellow-50' : ''}`}>
                                          <td className="py-2">{new Date(p.date).toLocaleDateString('id-ID')}</td>
                                          <td className="py-2">{fmt(p.total)}</td>
                                          <td className="py-2 text-green-600">{fmt(p.paid)}</td>
                                          <td className="py-2 font-semibold text-red-600">{fmt(p.remaining)}</td>
                                          <td className="py-2">
                                            {p.remaining <= 0
                                              ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Lunas</span>
                                              : isOld
                                                ? <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{age}hr</span>
                                                : <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Tempo</span>
                                            }
                                          </td>
                                          <td className="py-2 text-gray-500 text-xs max-w-[150px] truncate">{p.notes || '-'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Cards - Mobile */}
                              <div className="sm:hidden space-y-2">
                                {supplierPurchases.map(p => {
                                  const age = Math.floor((new Date(today) - new Date(p.date)) / 86400000);
                                  const isOld = p.remaining > 0 && age > 30;
                                  return (
                                    <div key={p.id} className={`p-3 rounded-lg border text-sm ${isOld ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
                                      <div className="flex justify-between items-start">
                                        <span className="text-gray-600">{new Date(p.date).toLocaleDateString('id-ID')}</span>
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
                                      {p.notes && <p className="text-xs text-gray-400 mt-1">{p.notes}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => {
                              const newVal = !showAllPurchases;
                              setShowAllPurchases(newVal);
                              fetchPurchases(s.supplier_id, newVal);
                            }}
                            data-testid="toggle-all-purchases"
                          >
                            {showAllPurchases ? 'Tampilkan belum lunas saja' : 'Tampilkan semua pembelian'}
                          </Button>
                        </div>
                      )}

                      {/* Payments Tab */}
                      {detailTab === 'payments' && (
                        <div className="space-y-2">
                          {supplierPayments.length === 0 ? (
                            <p className="text-center text-gray-500 py-4 text-sm">Belum ada riwayat pembayaran.</p>
                          ) : (
                            <div className="space-y-2">
                              {supplierPayments.map(p => (
                                <div key={p.id} className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between text-sm">
                                  <div>
                                    <p className="font-semibold text-green-700">{fmt(p.amount)}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{p.notes || '-'}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('id-ID')}</p>
                                    <p className="text-[10px] text-gray-400">{new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Payment Modal */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="pay-modal">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Catat Pembayaran</h2>
              <button onClick={() => setPayModalOpen(null)} className="p-1 hover:bg-gray-100 rounded" data-testid="close-pay-modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const supplier = overview.find(s => s.supplier_id === payModalOpen);
              return supplier ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="font-semibold">{supplier.supplier_name}</p>
                    <p className="text-sm text-red-600 font-bold mt-1">Sisa hutang: {fmt(supplier.outstanding)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Bayar</label>
                    <Input
                      type="number"
                      placeholder="Masukkan jumlah..."
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      data-testid="pay-amount-input"
                    />
                    <div className="flex gap-2 mt-2">
                      {[0.25, 0.5, 1].map(pct => (
                        <button
                          key={pct}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                          onClick={() => setPayAmount(String(Math.round(supplier.outstanding * pct)))}
                        >
                          {pct === 1 ? 'Lunasi' : `${pct * 100}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catatan (opsional)</label>
                    <Input
                      placeholder="Catatan pembayaran..."
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      data-testid="pay-notes-input"
                    />
                  </div>
                  <Button onClick={handlePay} disabled={paySubmitting || !payAmount} className="w-full" data-testid="submit-pay-btn">
                    {paySubmitting ? 'Memproses...' : `Bayar ${payAmount ? fmt(parseFloat(payAmount) || 0) : ''}`}
                  </Button>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

function SummaryCard({ icon: Icon, label, value, sub, color, bg, testId }) {
  return (
    <div className={`${bg} rounded-xl p-3 sm:p-4 border`} data-testid={testId}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs sm:text-sm text-gray-600 font-medium">{label}</span>
      </div>
      <p className={`text-base sm:text-xl font-bold ${color} truncate`}>{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
