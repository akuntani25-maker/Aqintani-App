import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Search, Plus, Minus, Trash2, ShoppingCart, Users, DollarSign, Banknote, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '../components/CurrencyInput';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export const FarmerDebts = () => {
  const [overview, setOverview] = useState({ farmers: [], total_debt: 0, active_debtors: 0, total_farmers: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddFarmer, setShowAddFarmer] = useState(false);
  const [farmerForm, setFarmerForm] = useState({ name: '', phone: '', address: '', debt_limit: 0 });
  const [editFarmer, setEditFarmer] = useState(null);
  const [expandedFarmer, setExpandedFarmer] = useState(null);
  const [farmerTxns, setFarmerTxns] = useState([]);
  const [farmerPayments, setFarmerPaymentsList] = useState([]);
  const [detailTab, setDetailTab] = useState('transactions');
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payNotes, setPayNotes] = useState('');
  const [showNewDebt, setShowNewDebt] = useState(null);
  const [debtCart, setDebtCart] = useState([]);
  const [debtPaid, setDebtPaid] = useState(0);
  const [debtNotes, setDebtNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [correctModal, setCorrectModal] = useState(null);
  const [correctAmount, setCorrectAmount] = useState(0);
  const [correctNotes, setCorrectNotes] = useState('');

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get('/farmer-debts/overview');
      setOverview(res.data);
    } catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const handleAddFarmer = async () => {
    if (!farmerForm.name) { toast.error('Nama wajib diisi'); return; }
    setSubmitting(true);
    try {
      if (editFarmer) {
        await api.put(`/farmers/${editFarmer.id}`, null, { params: farmerForm });
        toast.success('Data petani diperbarui');
      } else {
        await api.post('/farmers', null, { params: farmerForm });
        toast.success('Petani berhasil ditambahkan');
      }
      setShowAddFarmer(false);
      setEditFarmer(null);
      setFarmerForm({ name: '', phone: '', address: '', debt_limit: 0 });
      fetchOverview();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal menyimpan'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteFarmer = async (id) => {
    if (!window.confirm('Hapus petani ini?')) return;
    try {
      await api.delete(`/farmers/${id}`);
      toast.success('Petani dihapus');
      fetchOverview();
    } catch { toast.error('Gagal menghapus'); }
  };

  const toggleExpand = async (farmer) => {
    if (expandedFarmer === farmer.id) { setExpandedFarmer(null); return; }
    setExpandedFarmer(farmer.id);
    setDetailTab('transactions');
    try {
      const [txnRes, payRes] = await Promise.all([
        api.get(`/farmer-debts/${farmer.id}/transactions`),
        api.get(`/farmer-debts/${farmer.id}/payments`)
      ]);
      setFarmerTxns(txnRes.data);
      setFarmerPaymentsList(payRes.data);
    } catch { setFarmerTxns([]); setFarmerPaymentsList([]); }
  };

  const handlePay = async () => {
    if (payAmount <= 0) { toast.error('Jumlah harus > 0'); return; }
    setSubmitting(true);
    try {
      await api.post(`/farmer-debts/${payModal.id}/pay`, null, { params: { amount: payAmount, notes: payNotes } });
      toast.success('Pembayaran berhasil');
      setPayModal(null); setPayAmount(0); setPayNotes('');
      fetchOverview();
      if (expandedFarmer) toggleExpand({ id: expandedFarmer });
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal membayar'); }
    finally { setSubmitting(false); }
  };

  const handleCorrection = async () => {
    if (correctAmount < 0) { toast.error('Nilai hutang tidak boleh negatif'); return; }
    setSubmitting(true);
    try {
      await api.put(`/farmer-debts/${correctModal.id}/correct`, {
        new_debt: parseFloat(correctAmount) || 0,
        notes: correctNotes
      });
      toast.success('Hutang petani berhasil dikoreksi');
      setCorrectModal(null);
      fetchOverview();
      if (expandedFarmer) toggleExpand({ id: expandedFarmer });
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal mengoreksi hutang'); }
    finally { setSubmitting(false); }
  };

  // Product search for debt transaction
  const searchProducts = async (q) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    try {
      const res = await api.get(`/canvassers/product-search?q=${encodeURIComponent(q)}`);
      setProductResults(res.data);
    } catch { setProductResults([]); }
  };

  const addToDebtCart = (product) => {
    const existing = debtCart.find(i => i.product_id === product.id);
    if (existing) {
      setDebtCart(debtCart.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price } : i));
    } else {
      setDebtCart([...debtCart, { product_id: product.id, product_name: product.name, quantity: 1, price: product.price, subtotal: product.price }]);
    }
    setProductSearch('');
    setProductResults([]);
  };

  const updateDebtQty = (pid, delta) => {
    setDebtCart(debtCart.map(i => {
      if (i.product_id !== pid) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, subtotal: newQty * i.price };
    }));
  };

  const debtTotal = debtCart.reduce((s, i) => s + i.subtotal, 0);

  const handleCreateDebt = async () => {
    if (debtCart.length === 0) { toast.error('Pilih barang dulu'); return; }
    setSubmitting(true);
    try {
      await api.post('/farmer-debts/transaction', {
        farmer_id: showNewDebt.id, items: debtCart, total: debtTotal, paid: debtPaid, notes: debtNotes
      });
      toast.success('Transaksi hutang berhasil');
      setShowNewDebt(null); setDebtCart([]); setDebtPaid(0); setDebtNotes('');
      fetchOverview();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal membuat transaksi'); }
    finally { setSubmitting(false); }
  };

  const filteredFarmers = overview.farmers.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="farmer-debts-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Hutang Petani</h1>
          <p className="text-sm text-muted-foreground">Kelola hutang petani yang belanja di toko</p>
        </div>
        <Button onClick={() => { setEditFarmer(null); setFarmerForm({ name: '', phone: '', address: '', debt_limit: 0 }); setShowAddFarmer(true); }} data-testid="add-farmer-btn"><Plus className="w-4 h-4 mr-2" />Tambah Petani</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Hutang Petani</p><p className="text-lg font-bold text-red-600">{fmt(overview.total_debt)}</p></div><div className="bg-red-500 text-white p-2 rounded-lg"><Banknote className="w-4 h-4" /></div></div></Card>
        <Card className="p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Petani Berhutang</p><p className="text-lg font-bold">{overview.active_debtors} / {overview.total_farmers}</p></div><div className="bg-amber-500 text-white p-2 rounded-lg"><Users className="w-4 h-4" /></div></div></Card>
        <Card className="p-4 col-span-2 lg:col-span-1"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Petani</p><p className="text-lg font-bold">{overview.total_farmers}</p></div><div className="bg-emerald-500 text-white p-2 rounded-lg"><Users className="w-4 h-4" /></div></div></Card>
      </div>

      {/* Search */}
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Cari nama petani..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="search-farmer" /></div>

      {/* Farmer Table */}
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nama</TableHead><TableHead>No HP</TableHead><TableHead>Alamat</TableHead><TableHead className="text-right">Limit</TableHead><TableHead className="text-right">Hutang</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredFarmers.map(farmer => (
              <React.Fragment key={farmer.id}>
                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(farmer)} data-testid={`farmer-row-${farmer.id}`}>
                  <TableCell className="font-medium">{farmer.name}</TableCell>
                  <TableCell>{farmer.phone || '-'}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{farmer.address || '-'}</TableCell>
                  <TableCell className="text-right">{farmer.debt_limit > 0 ? fmt(farmer.debt_limit) : '-'}</TableCell>
                  <TableCell className="text-right font-bold text-red-600">{fmt(farmer.current_debt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setShowNewDebt(farmer); setDebtCart([]); setDebtPaid(0); }} data-testid={`new-debt-${farmer.id}`}><ShoppingCart className="w-3 h-3 mr-1" />Bon</Button>
                      {farmer.current_debt > 0 && <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setPayModal(farmer); setPayAmount(farmer.current_debt); }} data-testid={`pay-farmer-${farmer.id}`}><DollarSign className="w-3 h-3 mr-1" />Bayar</Button>}
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setCorrectModal(farmer); setCorrectAmount(farmer.current_debt); setCorrectNotes(''); }} data-testid={`correct-farmer-${farmer.id}`}><Edit3 className="w-3 h-3 mr-1" />Koreksi</Button>
                      <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setEditFarmer(farmer); setFarmerForm({ name: farmer.name, phone: farmer.phone || '', address: farmer.address || '', debt_limit: farmer.debt_limit || 0 }); setShowAddFarmer(true); }}>Edit</Button>
                      {expandedFarmer === farmer.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </TableCell>
                </TableRow>
                {expandedFarmer === farmer.id && (
                  <TableRow><TableCell colSpan={6} className="bg-muted/30 p-4">
                    <div className="flex gap-2 mb-3">
                      <Button size="sm" variant={detailTab === 'transactions' ? 'default' : 'outline'} onClick={() => setDetailTab('transactions')}>Transaksi</Button>
                      <Button size="sm" variant={detailTab === 'payments' ? 'default' : 'outline'} onClick={() => setDetailTab('payments')}>Pembayaran</Button>
                    </div>
                    {detailTab === 'transactions' && (farmerTxns.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada transaksi</p> :
                      <div className="space-y-2">{farmerTxns.map(t => (
                        <Card key={t.id} className="p-3 bg-white">
                          <div className="flex justify-between items-center mb-2"><span className="text-xs text-muted-foreground">{t.date} - {t.cashier_name}</span><span className="font-bold">{fmt(t.total)}</span></div>
                          <div className="space-y-1">{t.items.map((item, idx) => (<div key={idx} className="flex justify-between text-sm"><span>{item.product_name} x{item.quantity}</span><span>{fmt(item.subtotal)}</span></div>))}</div>
                          <div className="flex justify-between text-sm mt-2 pt-2 border-t"><span>Dibayar: {fmt(t.paid)}</span><span className="text-red-600 font-medium">Sisa: {fmt(t.remaining)}</span></div>
                        </Card>
                      ))}</div>
                    )}
                    {detailTab === 'payments' && (farmerPayments.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pembayaran</p> :
                      <div className="space-y-1">{farmerPayments.map(p => (
                        <div key={p.id} className="flex justify-between text-sm bg-white p-2 rounded border"><span>{p.date} - {p.recorded_by}</span><span className="font-medium text-emerald-600">{fmt(p.amount)}{p.notes ? ` (${p.notes})` : ''}</span></div>
                      ))}</div>
                    )}
                  </TableCell></TableRow>
                )}
              </React.Fragment>
            ))}
            {filteredFarmers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada petani terdaftar</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Farmer Dialog */}
      <Dialog open={showAddFarmer} onOpenChange={setShowAddFarmer}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editFarmer ? 'Edit Petani' : 'Tambah Petani'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nama *</Label><Input value={farmerForm.name} onChange={e => setFarmerForm({...farmerForm, name: e.target.value})} data-testid="farmer-name-input" /></div>
            <div className="space-y-2"><Label>No HP</Label><Input value={farmerForm.phone} onChange={e => setFarmerForm({...farmerForm, phone: e.target.value})} /></div>
            <div className="space-y-2"><Label>Alamat</Label><Input value={farmerForm.address} onChange={e => setFarmerForm({...farmerForm, address: e.target.value})} /></div>
            <div className="space-y-2"><Label>Limit Hutang (0 = tanpa limit)</Label><CurrencyInput value={farmerForm.debt_limit} onChange={v => setFarmerForm({...farmerForm, debt_limit: v})} data-testid="farmer-limit-input" /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddFarmer(false)}>Batal</Button>
              <Button onClick={handleAddFarmer} disabled={submitting} data-testid="save-farmer-btn">{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Farmer Dialog */}
      <Dialog open={!!payModal} onOpenChange={() => setPayModal(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Bayar Hutang</DialogTitle></DialogHeader>
          {payModal && (
            <div className="space-y-4">
              <p className="text-sm">Petani: <strong>{payModal.name}</strong></p>
              <p className="text-sm">Hutang: <strong className="text-red-600">{fmt(payModal.current_debt)}</strong></p>
              <div className="space-y-2"><Label>Jumlah Bayar</Label><CurrencyInput value={payAmount} onChange={setPayAmount} data-testid="farmer-pay-amount" /></div>
              <div className="space-y-2"><Label>Catatan</Label><Input value={payNotes} onChange={e => setPayNotes(e.target.value)} /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPayModal(null)}>Batal</Button>
                <Button onClick={handlePay} disabled={submitting} data-testid="confirm-farmer-pay">{submitting ? 'Memproses...' : 'Bayar'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Debt Transaction Dialog */}
      {/* Correction Dialog */}
      <Dialog open={!!correctModal} onOpenChange={() => setCorrectModal(null)}>
        <DialogContent className="max-w-sm" data-testid="correct-farmer-modal">
          <DialogHeader><DialogTitle>Koreksi Hutang Petani</DialogTitle></DialogHeader>
          {correctModal && (
            <div className="space-y-4">
              <p className="text-sm">Petani: <strong>{correctModal.name}</strong></p>
              <p className="text-sm">Hutang saat ini: <strong className="text-red-600">{fmt(correctModal.current_debt)}</strong></p>
              <div className="space-y-2">
                <Label>Nilai Hutang Baru</Label>
                <CurrencyInput value={correctAmount} onChange={setCorrectAmount} data-testid="correct-farmer-amount" />
                <p className="text-xs text-muted-foreground">Masukkan nilai hutang yang seharusnya</p>
              </div>
              <div className="space-y-2"><Label>Alasan Koreksi</Label><Input placeholder="Contoh: Selisih data..." value={correctNotes} onChange={e => setCorrectNotes(e.target.value)} data-testid="correct-farmer-notes" /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCorrectModal(null)}>Batal</Button>
                <Button onClick={handleCorrection} disabled={submitting} data-testid="confirm-farmer-correct">{submitting ? 'Memproses...' : 'Simpan Koreksi'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showNewDebt} onOpenChange={() => setShowNewDebt(null)}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Bon Baru - {showNewDebt?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {showNewDebt?.debt_limit > 0 && (
              <div className="text-sm bg-amber-50 border border-amber-200 p-2 rounded">
                Limit: {fmt(showNewDebt.debt_limit)} | Hutang saat ini: {fmt(showNewDebt.current_debt)} | Sisa limit: {fmt(showNewDebt.debt_limit - showNewDebt.current_debt)}
              </div>
            )}
            {/* Product Search */}
            <div className="relative">
              <Label>Cari Barang</Label>
              <Input value={productSearch} onChange={e => searchProducts(e.target.value)} placeholder="Ketik nama barang..." data-testid="debt-product-search" />
              {productResults.length > 0 && (
                <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                  {productResults.map(p => (
                    <div key={p.id} className="p-2 hover:bg-muted cursor-pointer flex justify-between" onClick={() => addToDebtCart(p)}>
                      <span className="text-sm">{p.name}</span>
                      <span className="text-sm font-medium">{fmt(p.price)} (stok: {p.stock})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Cart */}
            {debtCart.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-auto">
                {debtCart.map(item => (
                  <div key={item.product_id} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                    <span className="text-sm flex-1">{item.product_name}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateDebtQty(item.product_id, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateDebtQty(item.product_id, 1)}><Plus className="w-3 h-3" /></Button>
                      <span className="text-sm font-medium w-24 text-right">{fmt(item.subtotal)}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDebtCart(debtCart.filter(i => i.product_id !== item.product_id))}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t"><span>Total:</span><span>{fmt(debtTotal)}</span></div>
              </div>
            )}
            <div className="space-y-2"><Label>Dibayar di Muka</Label><CurrencyInput value={debtPaid} onChange={setDebtPaid} /></div>
            <div className="space-y-2"><Label>Catatan</Label><Input value={debtNotes} onChange={e => setDebtNotes(e.target.value)} /></div>
            {debtTotal > 0 && <p className="text-sm font-medium">Hutang baru: <span className="text-red-600">{fmt(debtTotal - debtPaid)}</span></p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNewDebt(null)}>Batal</Button>
              <Button onClick={handleCreateDebt} disabled={submitting || debtCart.length === 0} data-testid="confirm-debt-btn">{submitting ? 'Memproses...' : 'Simpan Bon'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
