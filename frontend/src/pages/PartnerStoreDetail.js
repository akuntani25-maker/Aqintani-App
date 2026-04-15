import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Pagination } from '../components/Pagination';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, ShoppingBag, MapPin, Phone, User, CreditCard, Clock, Search, X, Upload } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const fmtNum = (v) => new Intl.NumberFormat('id-ID').format(v);

export const PartnerStoreDetail = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storePayDialogOpen, setStorePayDialogOpen] = useState(false);
  const [storePayAmount, setStorePayAmount] = useState(0);
  const [storePayNotes, setStorePayNotes] = useState('');

  // Order items (flattened)
  const [orderItems, setOrderItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orderItemPage, setOrderItemPage] = useState(1);
  const orderItemPerPage = 10;

  // Import CSV orders
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importSubmitting, setImportSubmitting] = useState(false);

  // Import CSV setoran
  const [importPayOpen, setImportPayOpen] = useState(false);
  const [importPayRows, setImportPayRows] = useState([]);
  const [importPaySubmitting, setImportPaySubmitting] = useState(false);

  useEffect(() => { fetchData(); }, [storeId]);

  const fetchData = async () => {
    try {
      const [storeRes, ordersRes, paymentsRes, itemsRes] = await Promise.all([
        api.get('/partner-stores'),
        api.get(`/partner-orders?partner_store_id=${storeId}`),
        api.get(`/partner-stores/${storeId}/payments`),
        api.get(`/partner-stores/${storeId}/order-items`)
      ]);
      setStore(storeRes.data.find(s => s.id === storeId));
      setOrders(ordersRes.data);
      setPayments(paymentsRes.data);
      setOrderItems(itemsRes.data);
    } catch (error) {
      toast.error('Gagal memuat data');
      navigate('/admin/partner-stores');
    } finally { setLoading(false); }
  };

  const fetchOrderItems = async (search = '', df = '', dt = '') => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (df) params.append('date_from', df);
      if (dt) params.append('date_to', dt);
      const res = await api.get(`/partner-stores/${storeId}/order-items?${params.toString()}`);
      setOrderItems(res.data);
      setOrderItemPage(1);
    } catch { toast.error('Gagal memuat data pesanan'); }
  };

  const handleStorePay = async () => {
    if (storePayAmount <= 0) { toast.error('Masukkan jumlah setoran yang valid'); return; }
    try {
      await api.post(`/partner-stores/${storeId}/pay?amount=${storePayAmount}&notes=${encodeURIComponent(storePayNotes)}`);
      toast.success('Setoran berhasil dicatat');
      setStorePayDialogOpen(false);
      setStorePayAmount(0);
      setStorePayNotes('');
      fetchData();
    } catch (error) { toast.error('Gagal mencatat setoran'); }
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
          const dateVal = row['tanggal'] || row['date'] || row['tgl'] || '';
          const nameVal = row['nama barang'] || row['nama_barang'] || row['product_name'] || row['barang'] || row['nama'] || '';
          const qtyVal = row['qty'] || row['jumlah'] || row['quantity'] || '0';
          const unitVal = row['unit'] || row['satuan'] || 'satuan';
          const priceVal = row['harga'] || row['harga jual'] || row['price'] || '0';
          let parsedDate = dateVal;
          if (dateVal.includes('/')) {
            const parts = dateVal.split('/');
            if (parts.length === 3 && parts[2].length === 4) {
              parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          if (nameVal) {
            rows.push({
              date: parsedDate, product_name: nameVal,
              qty: parseInt(qtyVal) || 0,
              unit: unitVal.toLowerCase().includes('dus') ? 'dus' : 'satuan',
              price: parseFloat(priceVal.replace(/[^0-9.-]/g, '')) || 0
            });
          }
        }
        setImportRows(rows);
        if (rows.length === 0) toast.error('Tidak ada data valid');
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
      const res = await api.post(`/partner-stores/${storeId}/import-orders-csv`, { rows: importRows });
      toast.success(res.data.message);
      setImportOpen(false);
      setImportRows([]);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal import data');
    } finally { setImportSubmitting(false); }
  };

  const handleCSVPayFile = (e) => {
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
          if (vals.length < 2) continue;
          const row = {};
          headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
          const dateVal = row['tanggal'] || row['date'] || row['tgl'] || '';
          const amountVal = row['jumlah'] || row['amount'] || row['nominal'] || row['bayar'] || '0';
          const notesVal = row['catatan'] || row['notes'] || row['keterangan'] || '';
          let parsedDate = dateVal;
          if (dateVal.includes('/')) {
            const parts = dateVal.split('/');
            if (parts.length === 3 && parts[2].length === 4) {
              parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          const amount = parseFloat(amountVal.replace(/[^0-9.-]/g, '')) || 0;
          if (amount > 0) {
            rows.push({ date: parsedDate, amount, notes: notesVal || 'Import CSV' });
          }
        }
        setImportPayRows(rows);
        if (rows.length === 0) toast.error('Tidak ada data valid');
        else toast.success(`${rows.length} baris data berhasil dibaca`);
      } catch { toast.error('Gagal membaca file CSV'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportPaySubmit = async () => {
    if (importPayRows.length === 0) return;
    setImportPaySubmitting(true);
    try {
      const res = await api.post(`/partner-stores/${storeId}/import-payments-csv`, { rows: importPayRows });
      toast.success(res.data.message);
      setImportPayOpen(false);
      setImportPayRows([]);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal import data');
    } finally { setImportPaySubmitting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!store) return null;

  const totalOrders = orders.reduce((s, o) => s + o.total, 0);

  // Group order items by date
  const grouped = {};
  orderItems.forEach(item => {
    const d = item.date || 'tanpa-tanggal';
    if (!grouped[d]) grouped[d] = { items: [], total: 0, setoran: item.setoran, order_number: item.order_number };
    grouped[d].items.push(item);
    grouped[d].total += item.subtotal;
    if (!grouped[d].order_number) grouped[d].order_number = item.order_number;
    // Use first non-zero setoran
    if (item.setoran > 0 && !grouped[d].setoran) grouped[d].setoran = item.setoran;
  });
  const allDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const grandTotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
  const totalDatePages = Math.ceil(allDates.length / orderItemPerPage);
  const dates = allDates.slice((orderItemPage - 1) * orderItemPerPage, orderItemPage * orderItemPerPage);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="partner-store-detail-page">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/partner-stores')} data-testid="back-button">
          <ArrowLeft className="w-4 h-4 mr-2" />Kembali
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">{store.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Detail kios mitra, riwayat transaksi & setoran</p>
        </div>
        {store.current_debt > 0 && (
          <Button onClick={() => { setStorePayAmount(store.current_debt); setStorePayDialogOpen(true); }} data-testid="store-pay-button">
            <DollarSign className="w-4 h-4 mr-2" />Catat Setoran
          </Button>
        )}
      </div>

      {/* Store Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2"><User className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground uppercase tracking-wider">Pemilik</span></div>
          <p className="font-semibold">{store.owner_name}</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2"><Phone className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground uppercase tracking-wider">Telepon</span></div>
          <p className="font-semibold">{store.phone}</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2"><ShoppingBag className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground uppercase tracking-wider">Total Pesanan</span></div>
          <p className="font-semibold">{fmt(totalOrders)}</p>
        </Card>
        <Card className="p-6 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-3 mb-2"><CreditCard className="w-5 h-5 text-orange-600" /><span className="text-xs text-orange-600 uppercase tracking-wider font-semibold">Sisa Piutang</span></div>
          <p className="font-bold text-xl text-orange-600">{fmt(store.current_debt || 0)}</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-2"><MapPin className="w-5 h-5 text-muted-foreground" /><span className="text-sm font-semibold">Alamat</span></div>
        <p className="text-sm">{store.address}</p>
      </Card>

      {/* Payment History - Riwayat Setoran */}
      <Card className="p-6" data-testid="payment-history-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-green-600" /><h2 className="text-lg font-semibold">Riwayat Setoran</h2></div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { setImportPayRows([]); setImportPayOpen(true); }} data-testid="import-payments-csv-btn">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </Button>
        </div>
        {payments.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">Belum ada riwayat setoran.</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead className="text-right">Jumlah</TableHead><TableHead>Catatan</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{fmt(p.amount)}</TableCell>
                    <TableCell>{p.notes || '-'}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-green-50 font-bold">
                  <TableCell>Total Setoran</TableCell>
                  <TableCell className="text-right text-green-600">{fmt(payments.reduce((s, p) => s + p.amount, 0))}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Orders Detail - Flattened Items */}
      <Card className="p-6" data-testid="orders-history-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Detail Pesanan</h2>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Cari nama barang..." value={itemSearch} className="pl-8 h-8 text-sm"
              onChange={(e) => { setItemSearch(e.target.value); fetchOrderItems(e.target.value, dateFrom, dateTo); }}
              data-testid="order-item-search" />
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" className="h-8 text-xs w-36" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); fetchOrderItems(itemSearch, e.target.value, dateTo); }}
              data-testid="order-date-from" />
            <span className="text-xs text-muted-foreground">-</span>
            <Input type="date" className="h-8 text-xs w-36" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); fetchOrderItems(itemSearch, dateFrom, e.target.value); }}
              data-testid="order-date-to" />
            {(itemSearch || dateFrom || dateTo) && (
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => {
                setItemSearch(''); setDateFrom(''); setDateTo('');
                fetchOrderItems('', '', '');
              }}><X className="w-3.5 h-3.5" /></Button>
            )}
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { setImportRows([]); setImportOpen(true); }} data-testid="import-orders-csv-btn">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </Button>
        </div>

        {orderItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {itemSearch || dateFrom || dateTo ? 'Tidak ada data yang cocok dengan filter.' : 'Belum ada pesanan.'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tanggal</TableHead>
                    <TableHead className="text-xs">No. Order</TableHead>
                    <TableHead className="text-xs">Nama Barang Terjual</TableHead>
                    <TableHead className="text-xs text-right">Qty Dus</TableHead>
                    <TableHead className="text-xs text-right">Qty Satuan</TableHead>
                    <TableHead className="text-xs text-right">Harga Jual</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs text-right">Setoran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dates.map(date => {
                    const group = grouped[date];
                    return group.items.map((item, idx) => (
                      <TableRow key={`${date}-${idx}`}>
                        {idx === 0 ? (
                          <TableCell rowSpan={group.items.length + 1} className="text-xs font-medium align-top border-r bg-muted/30">
                            {date !== 'tanpa-tanggal' ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-xs font-mono text-muted-foreground">{item.order_number}</TableCell>
                        <TableCell className="text-sm">{item.product_name}</TableCell>
                        <TableCell className="text-sm text-right font-medium">
                          {item.unit === 'dus' ? fmtNum(item.qty) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium">
                          {item.unit !== 'dus' ? fmtNum(item.qty) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-sm text-right">{fmt(item.price)}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{fmt(item.subtotal)}</TableCell>
                        {idx === 0 ? (
                          <TableCell rowSpan={group.items.length + 1} className="text-sm text-right font-medium align-top border-l">
                            {group.setoran > 0 ? (
                              <span className="text-green-600">{fmt(group.setoran)}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )).concat([
                      <TableRow key={`${date}-sub`} className="bg-muted/50 border-b-2">
                        <TableCell colSpan={5} className="text-xs text-right font-semibold text-muted-foreground">
                          Subtotal {date !== 'tanpa-tanggal' ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : ''}:
                        </TableCell>
                        <TableCell className="text-sm text-right font-bold">{fmt(group.total)}</TableCell>
                      </TableRow>
                    ]);
                  })}
                  <TableRow className="bg-primary/5 font-bold">
                    <TableCell colSpan={3} className="text-sm">GRAND TOTAL</TableCell>
                    <TableCell className="text-sm text-right">{fmtNum(orderItems.filter(i => i.unit === 'dus').reduce((s, i) => s + i.qty, 0))}</TableCell>
                    <TableCell className="text-sm text-right">{fmtNum(orderItems.filter(i => i.unit !== 'dus').reduce((s, i) => s + i.qty, 0))}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-sm text-right">{fmt(grandTotal)}</TableCell>
                    <TableCell className="text-sm text-right text-green-600">
                      {fmt(Object.values(grouped).reduce((s, g) => s + (g.setoran || 0), 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {dates.map(date => {
                const group = grouped[date];
                return (
                  <Card key={date} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {date !== 'tanpa-tanggal' ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                      {group.setoran > 0 && (
                        <span className="text-xs text-green-600 font-medium">Setoran: {fmt(group.setoran)}</span>
                      )}
                    </div>
                    {group.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 border-t text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.unit === 'dus' ? `${fmtNum(item.qty)} dus` : `${fmtNum(item.qty)} satuan`} x {fmt(item.price)}
                          </p>
                        </div>
                        <p className="font-semibold ml-2 shrink-0">{fmt(item.subtotal)}</p>
                      </div>
                    ))}
                    <div className="flex justify-between mt-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground font-medium">Subtotal:</span>
                      <span className="text-sm font-bold">{fmt(group.total)}</span>
                    </div>
                  </Card>
                );
              })}
              <Card className="p-3 bg-primary/5">
                <div className="flex justify-between"><span className="font-semibold text-sm">Grand Total:</span><span className="font-bold text-sm">{fmt(grandTotal)}</span></div>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-2">{orderItems.length} item dari {allDates.length} tanggal</p>
            <Pagination page={orderItemPage} totalPages={totalDatePages} total={allDates.length} perPage={orderItemPerPage} onChange={setOrderItemPage} />
          </>
        )}
      </Card>

      {/* Store Direct Payment Dialog */}
      <Dialog open={storePayDialogOpen} onOpenChange={setStorePayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catat Setoran dari {store.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-800">Sisa Piutang Saat Ini</p>
              <p className="text-2xl font-bold text-orange-600">{fmt(store.current_debt || 0)}</p>
            </div>
            <div className="space-y-2">
              <Label>Jumlah Setoran</Label>
              <Input type="number" value={storePayAmount} onChange={(e) => setStorePayAmount(parseFloat(e.target.value) || 0)} data-testid="store-pay-amount" />
            </div>
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Input value={storePayNotes} onChange={(e) => setStorePayNotes(e.target.value)} placeholder="Misal: Setoran tunai via kanvaser" data-testid="store-pay-notes" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStorePayDialogOpen(false)}>Batal</Button>
              <Button onClick={handleStorePay} data-testid="confirm-store-payment"><DollarSign className="w-4 h-4 mr-2" />Simpan Setoran</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="import-orders-modal">
          <DialogHeader><DialogTitle>Import Riwayat Pesanan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-3 bg-muted/50">
              <p className="font-semibold">{store.name}</p>
              <p className="text-xs text-muted-foreground mt-1">Format kolom CSV:</p>
              <p className="text-xs font-mono bg-white rounded p-2 mt-1 border">Tanggal, Nama Barang, Qty, Unit, Harga</p>
              <p className="text-[10px] text-muted-foreground mt-1">Unit: "dus" atau "satuan". Format tanggal: DD/MM/YYYY atau YYYY-MM-DD.</p>
            </Card>

            <div className="space-y-2">
              <Label>Pilih File CSV</Label>
              <Input type="file" accept=".csv" onChange={handleCSVFile} data-testid="import-orders-file-input" />
            </div>

            {importRows.length > 0 && (
              <>
                <div className="rounded-lg border overflow-hidden max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tanggal</TableHead>
                        <TableHead className="text-xs">Nama Barang</TableHead>
                        <TableHead className="text-xs text-right">Qty</TableHead>
                        <TableHead className="text-xs">Unit</TableHead>
                        <TableHead className="text-xs text-right">Harga</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{row.date}</TableCell>
                          <TableCell className="text-sm">{row.product_name}</TableCell>
                          <TableCell className="text-sm text-right">{fmtNum(row.qty)}</TableCell>
                          <TableCell className="text-xs">{row.unit}</TableCell>
                          <TableCell className="text-sm text-right">{fmt(row.price)}</TableCell>
                          <TableCell className="text-sm text-right font-medium">{fmt(row.price * row.qty)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Card className="p-3 bg-amber-50 border-amber-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-900">Total import ({importRows.length} item):</span>
                    <span className="font-bold text-amber-900">{fmt(importRows.reduce((s, r) => s + (r.price * r.qty), 0))}</span>
                  </div>
                  <p className="text-xs text-amber-700 mt-1">Semua item akan dicatat sebagai piutang baru (belum dibayar).</p>
                </Card>
              </>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
              <Button onClick={handleImportSubmit} disabled={importSubmitting || importRows.length === 0} data-testid="submit-import-orders-btn">
                {importSubmitting ? 'Mengimport...' : `Import ${importRows.length} Item`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Setoran CSV Dialog */}
      <Dialog open={importPayOpen} onOpenChange={setImportPayOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="import-payments-modal">
          <DialogHeader><DialogTitle>Import Riwayat Setoran</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-3 bg-muted/50">
              <p className="font-semibold">{store.name}</p>
              <p className="text-xs text-muted-foreground mt-1">Format kolom CSV:</p>
              <p className="text-xs font-mono bg-white rounded p-2 mt-1 border">Tanggal, Jumlah, Catatan</p>
              <p className="text-[10px] text-muted-foreground mt-1">Format tanggal: DD/MM/YYYY atau YYYY-MM-DD. Kolom Catatan opsional.</p>
            </Card>

            <div className="space-y-2">
              <Label>Pilih File CSV</Label>
              <Input type="file" accept=".csv" onChange={handleCSVPayFile} data-testid="import-payments-file-input" />
            </div>

            {importPayRows.length > 0 && (
              <>
                <div className="rounded-lg border overflow-hidden max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tanggal</TableHead>
                        <TableHead className="text-xs text-right">Jumlah</TableHead>
                        <TableHead className="text-xs">Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPayRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{row.date}</TableCell>
                          <TableCell className="text-sm text-right font-medium text-green-600">{fmt(row.amount)}</TableCell>
                          <TableCell className="text-xs">{row.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Card className="p-3 bg-green-50 border-green-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-900">Total setoran ({importPayRows.length} pembayaran):</span>
                    <span className="font-bold text-green-900">{fmt(importPayRows.reduce((s, r) => s + r.amount, 0))}</span>
                  </div>
                  <p className="text-xs text-green-700 mt-1">Piutang kios akan dikurangi sesuai total setoran ini.</p>
                </Card>
              </>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setImportPayOpen(false)}>Batal</Button>
              <Button onClick={handleImportPaySubmit} disabled={importPaySubmitting || importPayRows.length === 0} data-testid="submit-import-payments-btn">
                {importPaySubmitting ? 'Mengimport...' : `Import ${importPayRows.length} Setoran`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
