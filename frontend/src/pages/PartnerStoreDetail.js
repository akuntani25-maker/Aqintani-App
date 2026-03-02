import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, ShoppingBag, MapPin, Phone, User, CreditCard, Clock } from 'lucide-react';

export const PartnerStoreDetail = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [storePayDialogOpen, setStorePayDialogOpen] = useState(false);
  const [storePayAmount, setStorePayAmount] = useState(0);
  const [storePayNotes, setStorePayNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, [storeId]);

  const fetchData = async () => {
    try {
      const [storeRes, ordersRes, paymentsRes] = await Promise.all([
        api.get(`/partner-stores`),
        api.get(`/partner-orders?partner_store_id=${storeId}`),
        api.get(`/partner-stores/${storeId}/payments`)
      ]);
      
      const foundStore = storeRes.data.find(s => s.id === storeId);
      setStore(foundStore);
      setOrders(ordersRes.data);
      setPayments(paymentsRes.data);
    } catch (error) {
      toast.error('Gagal memuat data');
      navigate('/admin/partner-stores');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedOrder || paymentAmount <= 0) {
      toast.error('Masukkan jumlah pembayaran yang valid');
      return;
    }
    try {
      await api.post(`/partner-orders/${selectedOrder.id}/pay?amount=${paymentAmount}`);
      toast.success('Pembayaran berhasil dicatat');
      setPaymentDialogOpen(false);
      setPaymentAmount(0);
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      toast.error('Gagal mencatat pembayaran');
    }
  };

  const handleStorePay = async () => {
    if (storePayAmount <= 0) {
      toast.error('Masukkan jumlah setoran yang valid');
      return;
    }
    try {
      await api.post(`/partner-stores/${storeId}/pay?amount=${storePayAmount}&notes=${encodeURIComponent(storePayNotes)}`);
      toast.success('Setoran berhasil dicatat');
      setStorePayDialogOpen(false);
      setStorePayAmount(0);
      setStorePayNotes('');
      fetchData();
    } catch (error) {
      toast.error('Gagal mencatat setoran');
    }
  };

  const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {status === 'pending' ? 'Pending' : status === 'delivered' ? 'Terkirim' : 'Batal'}
      </span>
    );
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
  const totalPaid = orders.reduce((s, o) => s + o.paid, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="partner-store-detail-page">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/partner-stores')} data-testid="back-button">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">{store.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Detail kios mitra, riwayat transaksi & setoran</p>
        </div>
        {store.current_debt > 0 && (
          <Button onClick={() => { setStorePayAmount(store.current_debt); setStorePayDialogOpen(true); }} data-testid="store-pay-button">
            <DollarSign className="w-4 h-4 mr-2" />
            Catat Setoran
          </Button>
        )}
      </div>

      {/* Store Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <User className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Pemilik</span>
          </div>
          <p className="font-semibold">{store.owner_name}</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Telepon</span>
          </div>
          <p className="font-semibold">{store.phone}</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Pesanan</span>
          </div>
          <p className="font-semibold">{formatCurrency(totalOrders)}</p>
        </Card>
        <Card className="p-6 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-5 h-5 text-orange-600" />
            <span className="text-xs text-orange-600 uppercase tracking-wider font-semibold">Sisa Piutang</span>
          </div>
          <p className="font-bold text-xl text-orange-600">{formatCurrency(store.current_debt || 0)}</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-2">
          <MapPin className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-semibold">Alamat</span>
        </div>
        <p className="text-sm">{store.address}</p>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card className="p-6" data-testid="payment-history-card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-semibold">Riwayat Setoran</h2>
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{formatCurrency(p.amount)}</TableCell>
                    <TableCell>{p.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Orders History */}
      <Card className="p-6" data-testid="orders-history-card">
        <h2 className="text-xl font-semibold mb-4">Riwayat Pesanan</h2>
        {orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Belum ada pesanan</div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Order</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kanvaser</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Dibayar</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell>{order.canvasser_name || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(order.total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.paid)}</TableCell>
                    <TableCell className="text-right">
                      <span className={order.remaining > 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                        {formatCurrency(order.remaining)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        {order.remaining > 0 && (
                          <Button size="sm" onClick={() => { setSelectedOrder(order); setPaymentAmount(order.remaining); setPaymentDialogOpen(true); }} data-testid={`pay-order-${order.id}`}>
                            <DollarSign className="w-4 h-4 mr-1" />
                            Bayar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Order Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bayar Pesanan</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div><p className="text-sm text-muted-foreground">No. Order</p><p className="font-semibold">{selectedOrder.order_number}</p></div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-800">Sisa Tagihan</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(selectedOrder.remaining)}</p>
              </div>
              <div className="space-y-2">
                <Label>Jumlah Pembayaran</Label>
                <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} max={selectedOrder.remaining} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Batal</Button>
                <Button onClick={handlePayment}>Simpan Pembayaran</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Store Direct Payment Dialog */}
      <Dialog open={storePayDialogOpen} onOpenChange={setStorePayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Setoran dari {store.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-800">Sisa Piutang Saat Ini</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(store.current_debt || 0)}</p>
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
              <Button onClick={handleStorePay} data-testid="confirm-store-payment">
                <DollarSign className="w-4 h-4 mr-2" />
                Simpan Setoran
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
