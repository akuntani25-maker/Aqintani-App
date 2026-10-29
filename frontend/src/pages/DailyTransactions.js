import React, { useState, useEffect, useCallback } from 'react';
import { PageSkeleton } from '../components/PageSkeleton';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { ArrowLeft, ShoppingCart, DollarSign, Copy, Pencil, Check, X } from '../components/icons';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const fmtNum = (v) => new Intl.NumberFormat('id-ID').format(v);

export const DailyTransactions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [editDialog, setEditDialog] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // Fetch business date on mount
  useEffect(() => {
    const fetchBusinessDate = async () => {
      try {
        const res = await api.get('/pos/business-date');
        setDate(res.data.date);
      } catch {
        setDate(new Date().toISOString().split('T')[0]);
      }
    };
    fetchBusinessDate();
  }, []);

  const fetchData = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const res = await api.get(`/pos/daily-transactions?date=${date}`);
      setData(res.data);
    } catch { toast.error('Gagal memuat data transaksi'); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copyToClipboard = () => {
    const transactions = data?.transactions || [];
    const farmerTxns = data?.farmer_transactions || [];
    let rows = [];
    let no = 1;

    // Header
    rows.push(['No', 'Nama Barang', 'Qty', 'Harga Jual'].join('\t'));

    for (const txn of transactions) {
      for (const item of txn.items) {
        if (item.quantity <= 0) continue;
        rows.push([no, item.product_name, item.quantity, item.price].join('\t'));
        no++;
      }
    }
    for (const txn of farmerTxns) {
      for (const item of txn.items) {
        if (item.quantity <= 0) continue;
        rows.push([no, item.product_name, item.quantity, item.price].join('\t'));
        no++;
      }
    }

    navigator.clipboard.writeText(rows.join('\n')).then(() => {
      toast.success(`${no - 1} item berhasil disalin ke clipboard`);
    }).catch(() => {
      toast.error('Gagal menyalin ke clipboard');
    });
  };

  const openEditDialog = (txn) => {
    setEditDialog(txn);
    setEditItems(txn.items.map(item => ({ ...item, new_price: item.price, new_qty: item.quantity })));
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const payload = {
        items: editItems.map(item => ({ product_id: item.product_id, price: item.new_price, quantity: item.new_qty }))
      };
      await api.put(`/transactions/${editDialog.id}/edit-prices`, payload);
      toast.success('Harga transaksi berhasil diperbarui');
      setEditDialog(null);
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal menyimpan perubahan');
    } finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton variant="table" />;

  const transactions = data?.transactions || [];
  const farmerTxns = data?.farmer_transactions || [];

  // Running number berkelanjutan (ascending order)
  let runningNo = 0;
  const txnStartNos = transactions.map(txn => {
    const start = runningNo + 1;
    runningNo += txn.items.length;
    return start;
  });
  const farmerTxnStartNos = farmerTxns.map(txn => {
    const start = runningNo + 1;
    runningNo += txn.items.length;
    return start;
  });

  const totalItems = runningNo;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" data-testid="daily-transactions-page">
      <div className="max-w-6xl mx-auto space-y-6 stagger">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} data-testid="back-button"><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Rincian Transaksi Harian</h1>
              <p className="text-sm text-muted-foreground">Kasir: {user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={totalItems === 0} data-testid="copy-transactions-btn">
              <Copy className="w-4 h-4 mr-1.5" /> Salin ({totalItems})
            </Button>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" data-testid="date-picker" />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <p className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">Transaksi Tunai</p>
            <p className="text-xl font-bold text-emerald-800">{data?.count || 0}</p>
          </Card>
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-[10px] font-bold uppercase text-blue-700 tracking-wider">Total Penjualan</p>
            <p className="text-xl font-bold text-blue-800">{fmt(data?.total_sales || 0)}</p>
          </Card>
          <Card className="p-4 bg-amber-50 border-amber-200">
            <p className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">Transaksi Hutang</p>
            <p className="text-xl font-bold text-amber-800">{data?.farmer_count || 0}</p>
          </Card>
          <Card className="p-4 bg-violet-50 border-violet-200">
            <p className="text-[10px] font-bold uppercase text-violet-700 tracking-wider">Grand Total</p>
            <p className="text-xl font-bold text-violet-800">{fmt(data?.grand_total || 0)}</p>
          </Card>
        </div>

        {/* Cash Transactions */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="text-lg font-semibold flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" /> Transaksi Tunai ({transactions.length})</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Belum ada transaksi pada tanggal ini</div>
          ) : (
            <div className="divide-y">
              {transactions.map((txn, txnIdx) => (
                <div key={txn.id} className="p-4" data-testid={`txn-${txn.id}`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
                    <div>
                      <span className="font-mono text-sm font-medium">{txn.transaction_number}</span>
                      <span className="text-xs text-muted-foreground ml-3">{new Date(txn.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-xs text-muted-foreground ml-2">Kasir: {txn.cashier_name}</span>
                      {txn.edit_notes?.length > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-2">Diedit</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEditDialog(txn)} data-testid={`edit-txn-${txn.id}`}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${txn.payment_method === 'cash' ? 'bg-green-100 text-green-700' : txn.payment_method === 'card' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {txn.payment_method === 'cash' ? 'Tunai' : txn.payment_method === 'card' ? 'Kartu' : 'E-Wallet'}
                      </span>
                      <span className="text-lg font-bold">{fmt(txn.total)}</span>
                    </div>
                  </div>
                  <Table>
                    <TableHeader><TableRow className="text-xs">
                      <TableHead className="py-1 w-12 text-center">No</TableHead>
                      <TableHead className="py-1">Barang</TableHead>
                      <TableHead className="py-1 text-right">Harga</TableHead>
                      <TableHead className="py-1 text-center">Qty</TableHead>
                      <TableHead className="py-1 text-right">Subtotal</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {txn.items.map((item, idx) => (
                        <TableRow key={idx} className="text-sm">
                          <TableCell className="py-1 text-center font-mono text-muted-foreground">{txnStartNos[txnIdx] + idx}</TableCell>
                          <TableCell className="py-1">{item.product_name}</TableCell>
                          <TableCell className="py-1 text-right">{fmt(item.price)}</TableCell>
                          <TableCell className="py-1 text-center">{item.quantity}</TableCell>
                          <TableCell className="py-1 text-right font-medium">{fmt(item.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Farmer/Debt Transactions */}
        {farmerTxns.length > 0 && (
          <Card className="overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <h2 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="w-5 h-5 text-amber-500" /> Transaksi Hutang Petani ({farmerTxns.length})</h2>
            </div>
            <div className="divide-y">
              {farmerTxns.map((txn, txnIdx) => (
                <div key={txn.id} className="p-4" data-testid={`farmer-txn-${txn.id}`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
                    <div>
                      <span className="font-medium">{txn.farmer_name}</span>
                      <span className="text-xs text-muted-foreground ml-3">{new Date(txn.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-xs text-muted-foreground ml-2">Kasir: {txn.cashier_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Hutang: {fmt(txn.remaining)}</span>
                      <span className="text-lg font-bold">{fmt(txn.total)}</span>
                    </div>
                  </div>
                  <Table>
                    <TableHeader><TableRow className="text-xs">
                      <TableHead className="py-1 w-12 text-center">No</TableHead>
                      <TableHead className="py-1">Barang</TableHead>
                      <TableHead className="py-1 text-right">Harga</TableHead>
                      <TableHead className="py-1 text-center">Qty</TableHead>
                      <TableHead className="py-1 text-right">Subtotal</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {txn.items.map((item, idx) => (
                        <TableRow key={idx} className="text-sm">
                          <TableCell className="py-1 text-center font-mono text-muted-foreground">{farmerTxnStartNos[txnIdx] + idx}</TableCell>
                          <TableCell className="py-1">{item.product_name}</TableCell>
                          <TableCell className="py-1 text-right">{fmt(item.price)}</TableCell>
                          <TableCell className="py-1 text-center">{item.quantity}</TableCell>
                          <TableCell className="py-1 text-right font-medium">{fmt(item.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Edit Transaction Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
        <DialogContent className="max-w-lg" data-testid="edit-txn-dialog">
          <DialogHeader>
            <DialogTitle>Edit Harga Transaksi</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {editDialog.transaction_number} - {new Date(editDialog.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {editItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg" data-testid={`edit-item-${idx}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Lama: {item.quantity} x {fmt(item.price)} = {fmt(item.subtotal)}</p>
                    </div>
                    <div className="shrink-0 w-20">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.new_qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setEditItems(editItems.map((ei, i) => i === idx ? { ...ei, new_qty: val } : ei));
                        }}
                        className="h-8"
                        data-testid={`edit-qty-${idx}`}
                      />
                    </div>
                    <div className="shrink-0 w-32">
                      <Label className="text-xs">Harga</Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.new_price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditItems(editItems.map((ei, i) => i === idx ? { ...ei, new_price: val } : ei));
                        }}
                        className="h-8"
                        data-testid={`edit-price-${idx}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Total lama: {fmt(editDialog.total)}</p>
                  <p className="text-sm font-bold">Total baru: {fmt(editItems.reduce((s, i) => s + (i.new_price * i.new_qty), 0) - (editDialog.discount || 0) + (editDialog.tax || 0))}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} data-testid="cancel-edit-btn">
              <X className="w-4 h-4 mr-1" /> Batal
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving} data-testid="save-edit-btn">
              <Check className="w-4 h-4 mr-1" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
