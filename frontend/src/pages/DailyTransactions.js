import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ArrowLeft, ShoppingCart, DollarSign, TrendingUp, Printer } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export const DailyTransactions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/pos/daily-transactions?date=${date}`);
        setData(res.data);
      } catch { toast.error('Gagal memuat data transaksi'); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [date]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  const transactions = data?.transactions || [];
  const farmerTxns = data?.farmer_transactions || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" data-testid="daily-transactions-page">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} data-testid="back-button"><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Rincian Transaksi Harian</h1>
              <p className="text-sm text-muted-foreground">Kasir: {user?.name}</p>
            </div>
          </div>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" data-testid="date-picker" />
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
              {transactions.map(txn => (
                <div key={txn.id} className="p-4" data-testid={`txn-${txn.id}`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
                    <div>
                      <span className="font-mono text-sm font-medium">{txn.transaction_number}</span>
                      <span className="text-xs text-muted-foreground ml-3">{new Date(txn.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-xs text-muted-foreground ml-2">Kasir: {txn.cashier_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${txn.payment_method === 'cash' ? 'bg-green-100 text-green-700' : txn.payment_method === 'card' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {txn.payment_method === 'cash' ? 'Tunai' : txn.payment_method === 'card' ? 'Kartu' : 'E-Wallet'}
                      </span>
                      <span className="text-lg font-bold">{fmt(txn.total)}</span>
                    </div>
                  </div>
                  <Table>
                    <TableHeader><TableRow className="text-xs">
                      <TableHead className="py-1">Barang</TableHead>
                      <TableHead className="py-1 text-right">Harga</TableHead>
                      <TableHead className="py-1 text-center">Qty</TableHead>
                      <TableHead className="py-1 text-right">Subtotal</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {txn.items.map((item, idx) => (
                        <TableRow key={idx} className="text-sm">
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
              {farmerTxns.map(txn => (
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
                      <TableHead className="py-1">Barang</TableHead>
                      <TableHead className="py-1 text-right">Harga</TableHead>
                      <TableHead className="py-1 text-center">Qty</TableHead>
                      <TableHead className="py-1 text-right">Subtotal</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {txn.items.map((item, idx) => (
                        <TableRow key={idx} className="text-sm">
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
    </div>
  );
};
