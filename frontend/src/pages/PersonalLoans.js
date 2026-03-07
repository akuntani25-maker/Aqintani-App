import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { HandCoins, Plus, Search, DollarSign, Users, ChevronDown, ChevronUp, Banknote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '../components/CurrencyInput';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export const PersonalLoans = () => {
  const [data, setData] = useState({ loans: [], total_lent: 0, total_paid: 0, total_remaining: 0, active_count: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ borrower_name: '', borrower_phone: '', loan_type: 'cash', description: '', amount: 0, initial_paid: 0 });
  const [expandedLoan, setExpandedLoan] = useState(null);
  const [loanPayments, setLoanPayments] = useState([]);
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/personal-loans/overview');
      setData(res.data);
    } catch { toast.error('Gagal memuat data piutang'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!form.borrower_name || form.amount <= 0) { toast.error('Lengkapi nama dan jumlah'); return; }
    setSubmitting(true);
    try {
      await api.post('/personal-loans', null, { params: form });
      toast.success('Piutang berhasil ditambahkan');
      setShowAdd(false);
      setForm({ borrower_name: '', borrower_phone: '', loan_type: 'cash', description: '', amount: 0, initial_paid: 0 });
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal menambah piutang'); }
    finally { setSubmitting(false); }
  };

  const handlePay = async () => {
    if (payAmount <= 0) { toast.error('Jumlah harus > 0'); return; }
    setSubmitting(true);
    try {
      await api.post(`/personal-loans/${payModal.id}/pay`, null, { params: { amount: payAmount, notes: payNotes } });
      toast.success('Pembayaran berhasil dicatat');
      setPayModal(null); setPayAmount(0); setPayNotes('');
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal mencatat pembayaran'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus piutang ini?')) return;
    try {
      await api.delete(`/personal-loans/${id}`);
      toast.success('Piutang dihapus');
      fetchData();
    } catch { toast.error('Gagal menghapus'); }
  };

  const toggleExpand = async (loan) => {
    if (expandedLoan === loan.id) { setExpandedLoan(null); return; }
    setExpandedLoan(loan.id);
    try {
      const res = await api.get(`/personal-loans/${loan.id}/payments`);
      setLoanPayments(res.data);
    } catch { setLoanPayments([]); }
  };

  const filtered = data.loans.filter(l => {
    if (filter === 'aktif' && l.remaining <= 0) return false;
    if (filter === 'lunas' && l.remaining > 0) return false;
    if (search && !l.borrower_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="personal-loans-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Piutang Pribadi</h1>
          <p className="text-sm text-muted-foreground">Kelola pinjaman uang tunai dan barang</p>
        </div>
        <Button onClick={() => setShowAdd(true)} data-testid="add-loan-btn"><Plus className="w-4 h-4 mr-2" />Tambah Piutang</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Dipinjamkan</p><p className="text-lg font-bold">{fmt(data.total_lent)}</p></div><div className="bg-blue-500 text-white p-2 rounded-lg"><HandCoins className="w-4 h-4" /></div></div></Card>
        <Card className="p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Diterima</p><p className="text-lg font-bold">{fmt(data.total_paid)}</p></div><div className="bg-emerald-500 text-white p-2 rounded-lg"><DollarSign className="w-4 h-4" /></div></div></Card>
        <Card className="p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Sisa Piutang</p><p className="text-lg font-bold text-red-600">{fmt(data.total_remaining)}</p></div><div className="bg-red-500 text-white p-2 rounded-lg"><Banknote className="w-4 h-4" /></div></div></Card>
        <Card className="p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Peminjam Aktif</p><p className="text-lg font-bold">{data.active_count}</p></div><div className="bg-amber-500 text-white p-2 rounded-lg"><Users className="w-4 h-4" /></div></div></Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Cari nama peminjam..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="search-loan" /></div>
        <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-40" data-testid="filter-loan"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="aktif">Belum Lunas</SelectItem><SelectItem value="lunas">Lunas</SelectItem></SelectContent></Select>
      </div>

      {/* Loan Table */}
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nama</TableHead><TableHead>No HP</TableHead><TableHead>Jenis</TableHead><TableHead className="text-right">Jumlah</TableHead><TableHead className="text-right">Dibayar</TableHead><TableHead className="text-right">Sisa</TableHead><TableHead>Status</TableHead><TableHead>Tanggal</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(loan => (
              <React.Fragment key={loan.id}>
                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(loan)} data-testid={`loan-row-${loan.id}`}>
                  <TableCell className="font-medium">{loan.borrower_name}</TableCell>
                  <TableCell>{loan.borrower_phone || '-'}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${loan.loan_type === 'cash' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{loan.loan_type === 'cash' ? 'Uang' : 'Barang'}</span></TableCell>
                  <TableCell className="text-right font-medium">{fmt(loan.amount)}</TableCell>
                  <TableCell className="text-right">{fmt(loan.paid)}</TableCell>
                  <TableCell className="text-right font-bold text-red-600">{fmt(loan.remaining)}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${loan.status === 'lunas' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{loan.status === 'lunas' ? 'Lunas' : 'Aktif'}</span></TableCell>
                  <TableCell className="text-sm">{loan.date}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {loan.remaining > 0 && <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setPayModal(loan); setPayAmount(loan.remaining); }} data-testid={`pay-loan-${loan.id}`}>Bayar</Button>}
                      <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); handleDelete(loan.id); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                      {expandedLoan === loan.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </TableCell>
                </TableRow>
                {expandedLoan === loan.id && (
                  <TableRow><TableCell colSpan={9} className="bg-muted/30 p-4">
                    <div className="space-y-2">
                      {loan.description && <p className="text-sm text-muted-foreground">Keterangan: {loan.description}</p>}
                      <p className="text-sm font-medium">Riwayat Pembayaran:</p>
                      {loanPayments.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pembayaran</p> : (
                        <div className="space-y-1">{loanPayments.map(p => (
                          <div key={p.id} className="flex justify-between text-sm bg-white p-2 rounded border">
                            <span>{p.date} - {p.recorded_by}</span>
                            <span className="font-medium text-emerald-600">{fmt(p.amount)}{p.notes ? ` (${p.notes})` : ''}</span>
                          </div>
                        ))}</div>
                      )}
                    </div>
                  </TableCell></TableRow>
                )}
              </React.Fragment>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Tidak ada data piutang</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {/* Add Loan Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Tambah Piutang Baru</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nama Peminjam *</Label><Input value={form.borrower_name} onChange={e => setForm({...form, borrower_name: e.target.value})} data-testid="loan-name-input" /></div>
            <div className="space-y-2"><Label>No HP</Label><Input value={form.borrower_phone} onChange={e => setForm({...form, borrower_phone: e.target.value})} /></div>
            <div className="space-y-2"><Label>Jenis Pinjaman</Label>
              <Select value={form.loan_type} onValueChange={v => setForm({...form, loan_type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Uang Tunai</SelectItem><SelectItem value="goods">Barang</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Keterangan</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Deskripsi pinjaman..." /></div>
            <div className="space-y-2"><Label>Jumlah Pinjaman *</Label><CurrencyInput value={form.amount} onChange={v => setForm({...form, amount: v})} data-testid="loan-amount-input" /></div>
            <div className="space-y-2"><Label>Sudah Dibayar</Label><CurrencyInput value={form.initial_paid} onChange={v => setForm({...form, initial_paid: v})} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
              <Button onClick={handleAdd} disabled={submitting} data-testid="save-loan-btn">{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={!!payModal} onOpenChange={() => setPayModal(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Catat Pembayaran</DialogTitle></DialogHeader>
          {payModal && (
            <div className="space-y-4">
              <p className="text-sm">Peminjam: <strong>{payModal.borrower_name}</strong></p>
              <p className="text-sm">Sisa: <strong className="text-red-600">{fmt(payModal.remaining)}</strong></p>
              <div className="space-y-2"><Label>Jumlah Bayar</Label><CurrencyInput value={payAmount} onChange={setPayAmount} data-testid="loan-pay-amount" /></div>
              <div className="space-y-2"><Label>Catatan</Label><Input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Opsional..." /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPayModal(null)}>Batal</Button>
                <Button onClick={handlePay} disabled={submitting} data-testid="confirm-loan-pay">{submitting ? 'Memproses...' : 'Bayar'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
