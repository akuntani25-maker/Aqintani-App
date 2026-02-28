import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Package, MapPin, DollarSign, CheckCircle, Truck, LogOut } from 'lucide-react';

export const CanvasserDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('cash');

  useEffect(() => {
    fetchMyOrders();
  }, []);

  const fetchMyOrders = async () => {
    try {
      const response = await api.get('/canvassers/my-orders');
      setOrders(response.data);
    } catch (error) {
      toast.error('Gagal memuat pesanan');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/partner-orders/${orderId}/status?status=${newStatus}`);
      toast.success('Status berhasil diperbarui');
      fetchMyOrders();
    } catch (error) {
      toast.error('Gagal memperbarui status');
    }
  };

  const handlePayment = async () => {
    if (!selectedOrder || paymentAmount <= 0) {
      toast.error('Masukkan jumlah pembayaran yang valid');
      return;
    }

    try {
      await api.post(`/partner-orders/${selectedOrder.id}/pay?amount=${paymentAmount}`);
      toast.success(`Pembayaran ${paymentType === 'cash' ? 'tunai' : 'bon'} berhasil dicatat`);
      setPaymentDialogOpen(false);
      setPaymentAmount(0);
      setSelectedOrder(null);
      fetchMyOrders();
    } catch (error) {
      toast.error('Gagal mencatat pembayaran');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || colors.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');

  return (
    <div className="min-h-screen bg-gradient-mesh">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Dashboard Kanvaser</h1>
              <p className="text-sm text-muted-foreground">{user?.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Keluar
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
                <p className="text-3xl font-bold">{pendingOrders.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Delivered</p>
                <p className="text-3xl font-bold">{deliveredOrders.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Order</p>
                <p className="text-3xl font-bold">{orders.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Orders List */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Pesanan Saya</h2>
          
          {orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
              <p>Belum ada pesanan yang diassign</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className="p-6 border-2 hover:border-primary transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-sm text-muted-foreground">{order.order_number}</p>
                          <h3 className="text-xl font-bold mt-1">{order.partner_store_name}</h3>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border-2 ${getStatusColor(order.status)}`}>
                          {order.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>Tanggal Kirim: {new Date(order.delivery_date).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span>{order.items.length} item</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Pesanan</p>
                          <p className="text-2xl font-bold text-primary">{formatCurrency(order.total)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Sisa Tagihan</p>
                          <p className={`text-2xl font-bold ${order.remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {formatCurrency(order.remaining)}
                          </p>
                        </div>
                      </div>

                      {/* Items List */}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">
                          Lihat Detail Produk ({order.items.length} item)
                        </summary>
                        <div className="mt-3 space-y-2 pl-4 border-l-2 border-primary/20">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{item.product_name} x {item.quantity}</span>
                              <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 md:w-48">
                      {order.status === 'pending' && (
                        <>
                          <Button
                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                            className="w-full"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Terkirim
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="w-full"
                          >
                            Batalkan
                          </Button>
                        </>
                      )}

                      {order.remaining > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedOrder(order);
                            setPaymentAmount(order.remaining);
                            setPaymentDialogOpen(true);
                          }}
                          className="w-full"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Catat Bayar
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Pembayaran</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Kios Mitra</p>
                <p className="text-lg font-semibold">{selectedOrder.partner_store_name}</p>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-800 mb-1">Sisa Tagihan</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(selectedOrder.remaining)}</p>
              </div>

              <div className="space-y-2">
                <Label>Jenis Pembayaran</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tunai</SelectItem>
                    <SelectItem value="bon">Masuk Bon (Tempo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentType === 'cash' && (
                <div className="space-y-2">
                  <Label htmlFor="payment-amount">Jumlah Bayar</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    max={selectedOrder.remaining}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maksimal: {formatCurrency(selectedOrder.remaining)}
                  </p>
                </div>
              )}

              {paymentType === 'bon' && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Pembayaran akan dicatat sebagai tempo/bon. Sisa tagihan tetap akan bertambah pada piutang kios mitra.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Batal
                </Button>
                <Button 
                  onClick={handlePayment}
                  disabled={paymentType === 'cash' && paymentAmount <= 0}
                >
                  {paymentType === 'cash' ? 'Catat Bayar Tunai' : 'Catat Bon'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
