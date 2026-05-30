import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Package, MapPin, DollarSign, CheckCircle, Truck, LogOut, Search, Bell, Filter, X, ShoppingBag, Warehouse, Printer, BarChart2, ArrowRightLeft } from 'lucide-react';
import { Pagination } from '../components/Pagination';

const fmtCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export const CanvasserDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('cash');
  const [notifications, setNotifications] = useState({ new_orders: 0, pending_orders: 0, total_remaining: 0 });

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Settlement (partial return)
  const [settleDialog, setSettleDialog] = useState(null);
  const [settleItems, setSettleItems] = useState([]);
  const [settleReturnTo, setSettleReturnTo] = useState('vehicle');

  // My Recap
  const [myRecap, setMyRecap] = useState(null);

  // Product search
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Transfer
  const [transferDialog, setTransferDialog] = useState(null);
  const [transferItems, setTransferItems] = useState([]);
  const [transferStoreId, setTransferStoreId] = useState('');
  const [transferPayment, setTransferPayment] = useState('bon');
  const [transferStoreSearch, setTransferStoreSearch] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [partnerStores, setPartnerStores] = useState([]);

  useEffect(() => {
    fetchMyOrders();
    fetchNotifications();
    fetchMyRecap();
    api.get('/partner-stores').then(r => setPartnerStores(r.data)).catch(() => {});
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
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

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/canvassers/notifications');
      setNotifications(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchMyRecap = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get(`/canvassers/my-recap?date=${today}`);
      setMyRecap(res.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!productQuery || productQuery.length < 2) {
      setProductResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setProductSearching(true);
      try {
        const res = await api.get(`/canvassers/product-search?q=${encodeURIComponent(productQuery)}`);
        setProductResults(res.data);
      } catch (e) { console.error(e); }
      setProductSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [productQuery]);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/partner-orders/${orderId}/status?status=${newStatus}`);
      toast.success('Status berhasil diperbarui');
      fetchMyOrders();
      fetchNotifications();
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
      fetchMyOrders();
      fetchNotifications();
      // Navigate to receipt page for printing
      navigate(`/partner-receipt?id=${selectedOrder.id}&from=canvasser`);
      setSelectedOrder(null);
    } catch (error) {
      toast.error('Gagal mencatat pembayaran');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openSettlement = (order) => {
    setSettleDialog(order);
    setSettleReturnTo('vehicle');
    setSettleItems(order.items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      original_qty: item.quantity,
      price: item.price,
      qty_sold: 0,
      items_per_box: item.items_per_box || 1,
      warehouse_id: item.warehouse_id || order.warehouse_id || 'gudang_utama',
      warehouse_unit: item.warehouse_unit || 'satuan'
    })));
  };

  const handleSettlement = async () => {
    if (!settleDialog) return;
    try {
      const res = await api.post(`/partner-orders/${settleDialog.id}/settle`, {
        items: settleItems.map(si => ({
          product_id: si.product_id,
          product_name: si.product_name,
          qty_sold: si.qty_sold,
          original_qty: si.original_qty,
          price: si.price
        })),
        return_to: settleReturnTo
      });
      const { return_items, new_total, debt_reduced } = res.data;
      const returnMsg = return_items.length > 0
        ? ` | Barang kembali: ${return_items.map(r => `${r.product_name} (${r.quantity} ${r.unit})`).join(', ')}`
        : '';
      toast.success(`Pesanan diselesaikan. Total baru: ${formatCurrency(new_total)}${returnMsg}`);
      setSettleDialog(null);
      fetchMyOrders();
      fetchMyRecap();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyelesaikan pesanan');
    }
  };

  const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  const openTransferDialog = (order) => {
    setTransferDialog(order);
    setTransferItems(order.items.filter(i => i.quantity > 0).map(i => ({
      product_id: i.product_id, product_name: i.product_name,
      quantity: i.quantity, max_qty: i.quantity,
      new_price: i.price, selected: false
    })));
    setTransferStoreId('');
    setTransferPayment('bon');
    setTransferStoreSearch('');
  };

  const handleTransfer = async () => {
    const selected = transferItems.filter(i => i.selected && i.quantity > 0);
    if (selected.length === 0) { toast.error('Pilih item yang akan dioper'); return; }
    if (!transferStoreId) { toast.error('Pilih kios mitra tujuan'); return; }
    setTransferSubmitting(true);
    try {
      await api.post(`/partner-orders/${transferDialog.id}/transfer`, {
        new_partner_store_id: transferStoreId,
        items: selected.map(i => ({ product_id: i.product_id, quantity: i.quantity, new_price: i.new_price })),
        payment_type: transferPayment
      });
      toast.success('Pesanan berhasil dioper');
      setTransferDialog(null);
      fetchMyOrders();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal mengoper pesanan'); }
    finally { setTransferSubmitting(false); }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || colors.pending;
  };

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    const matchSearch = !searchQuery ||
      o.partner_store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.order_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  useEffect(() => { setPage(1); }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredOrders.length / perPage);
  const paginatedOrders = filteredOrders.slice((page - 1) * perPage, page * perPage);

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
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" data-testid="canvasser-title">Dashboard Kanvaser</h1>
              <p className="text-sm text-muted-foreground">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Badge */}
            {notifications.pending_orders > 0 && (
              <div className="relative flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-xl border border-yellow-200" data-testid="notification-badge">
                <Bell className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">{notifications.pending_orders} pending</span>
              </div>
            )}
            {notifications.total_remaining > 0 && (
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-xl border border-orange-200" data-testid="remaining-badge">
                <DollarSign className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">{formatCurrency(notifications.total_remaining)}</span>
              </div>
            )}
            <Button variant="outline" onClick={handleLogout} data-testid="canvasser-logout-button">
              <LogOut className="w-4 h-4 mr-2" />
              Keluar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <Card className="p-4 md:p-6" data-testid="pending-count-card">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-12 md:h-12 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 md:w-6 md:h-6 text-yellow-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
                <p className="text-lg md:text-2xl font-bold truncate">{pendingOrders.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 md:p-6" data-testid="delivered-count-card">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4 md:w-6 md:h-6 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Terkirim</p>
                <p className="text-lg md:text-2xl font-bold truncate">{deliveredOrders.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 md:p-6" data-testid="total-remaining-card">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-12 md:h-12 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 md:w-6 md:h-6 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Sisa Tagihan</p>
                <p className="text-base md:text-xl lg:text-2xl font-bold text-orange-600 truncate">{formatCurrency(notifications.total_remaining)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Rekap Hari Ini */}
        {myRecap && myRecap.total_orders > 0 && (
          <Card className="p-4 md:p-6" data-testid="my-recap-section">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Rekap Hari Ini
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Pesanan</p>
                <p className="text-xl font-bold">{myRecap.total_orders}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-xs text-green-700">Diselesaikan</p>
                <p className="text-xl font-bold text-green-700">{myRecap.total_settled}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-blue-700">Nilai Total</p>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(myRecap.total_value)}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-center">
                <p className="text-xs text-amber-700">Dibayar</p>
                <p className="text-lg font-bold text-amber-700">{formatCurrency(myRecap.total_paid)}</p>
              </div>
            </div>
            {myRecap.stores_visited.length > 0 && (
              <p className="text-xs text-muted-foreground">Kios dikunjungi: <span className="font-medium text-foreground">{myRecap.stores_visited.join(', ')}</span></p>
            )}
            {myRecap.return_items.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Barang kembali:</p>
                <div className="flex flex-wrap gap-1">
                  {myRecap.return_items.map((ri, i) => (
                    <span key={i} className="text-xs bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">{ri.product_name}: {ri.quantity} {ri.unit}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Product Search */}
        <Card className="p-4 md:p-6" data-testid="product-search-section">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Cari Barang</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Ketik nama produk (min 2 huruf)..."
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              className="pl-10"
              data-testid="product-search-input"
            />
            {productQuery && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setProductQuery('')}>
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {productSearching && <p className="text-sm text-muted-foreground mt-3 text-center">Mencari...</p>}
          {productResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto" data-testid="product-search-results">
              {productResults.map(p => (
                <div key={p.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors" data-testid={`product-result-${p.id}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{p.name}</p>
                      {p.barcode && <p className="text-xs text-muted-foreground">{p.barcode}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary text-sm">{fmtCurrency(p.price)}</p>
                      {p.box_price > 0 && <p className="text-xs text-muted-foreground">{fmtCurrency(p.box_price)}/dus ({p.items_per_box}pcs)</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      Stok: {p.stock}
                    </span>
                    {p.warehouse_stock?.map((ws, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 flex items-center gap-1">
                        <Warehouse className="w-3 h-3" />{ws.warehouse}: {ws.stock}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!productSearching && productQuery.length >= 2 && productResults.length === 0 && (
            <p className="text-sm text-muted-foreground mt-3 text-center" data-testid="no-product-results">Barang tidak ditemukan</p>
          )}
        </Card>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama kios atau nomor order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="canvasser-search-input"
            />
            {searchQuery && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery('')}>
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48" data-testid="canvasser-status-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="delivered">Terkirim</SelectItem>
              <SelectItem value="cancelled">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" data-testid="orders-heading">Pesanan Saya</h2>
            <span className="text-sm text-muted-foreground">{filteredOrders.length} pesanan</span>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="empty-orders">
              <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
              <p>{searchQuery || statusFilter !== 'all' ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan yang diassign'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedOrders.map((order) => (
                <Card key={order.id} className="p-4 md:p-6 border-2 hover:border-primary/50 transition-colors" data-testid={`order-card-${order.id}`}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-sm text-muted-foreground">{order.order_number}</p>
                          <h3 className="text-base md:text-xl font-bold mt-1">{order.partner_store_name}</h3>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border-2 ${getStatusColor(order.status)}`} data-testid={`order-status-${order.id}`}>
                          {order.status === 'pending' ? 'PENDING' : order.status === 'delivered' ? 'TERKIRIM' : 'BATAL'}
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
                          <p className="text-base md:text-xl font-bold text-primary">{formatCurrency(order.total)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Sisa Tagihan</p>
                          <p className={`text-base md:text-xl font-bold ${order.remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {formatCurrency(order.remaining)}
                          </p>
                        </div>
                      </div>

                      {/* Debt info */}
                      {order.store_current_debt > 0 && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs" data-testid={`debt-info-${order.id}`}>
                          <p className="font-semibold text-amber-800">Sisa Bon {order.partner_store_name}:</p>
                          <p className="text-amber-700">Total bon saat ini: <span className="font-bold">{formatCurrency(order.store_current_debt)}</span></p>
                        </div>
                      )}
                      {order.order_type === 'conditional' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">KONDISIONAL</span>
                      )}

                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">
                          Lihat Detail Barang ({order.items.length} item)
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
                          <Button onClick={() => updateOrderStatus(order.id, 'delivered')} className="w-full" data-testid={`deliver-btn-${order.id}`}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Terkirim
                          </Button>
                          <Button variant="destructive" onClick={() => updateOrderStatus(order.id, 'cancelled')} className="w-full" data-testid={`cancel-btn-${order.id}`}>
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
                          data-testid={`pay-btn-${order.id}`}
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Catat Bayar
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => navigate(`/partner-receipt?id=${order.id}&from=canvasser`)}
                        className="w-full"
                        data-testid={`print-btn-${order.id}`}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Cetak Struk
                      </Button>

                      {!order.is_settled && order.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          onClick={() => openSettlement(order)}
                          className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                          data-testid={`settle-btn-${order.id}`}
                        >
                          <ShoppingBag className="w-4 h-4 mr-2" />
                          Selesaikan
                        </Button>
                      )}
                      {!order.is_settled && order.status !== 'cancelled' && order.items.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => openTransferDialog(order)}
                          className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
                          data-testid={`transfer-btn-${order.id}`}
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-2" />
                          Oper Pesanan
                        </Button>
                      )}
                      {order.is_settled && (
                        <span className="text-xs text-center text-green-600 font-semibold">Sudah Diselesaikan</span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} total={filteredOrders.length} perPage={perPage} onChange={setPage} />
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
                <p className="text-base md:text-xl lg:text-2xl font-bold text-orange-600 truncate">{formatCurrency(selectedOrder.remaining)}</p>
              </div>

              <div className="space-y-2">
                <Label>Jenis Pembayaran</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger data-testid="payment-type-select">
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
                    data-testid="canvasser-payment-amount"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maksimal: {formatCurrency(selectedOrder.remaining)}
                  </p>
                </div>
              )}

              {paymentType === 'bon' && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    Pembayaran akan dicatat sebagai tempo/bon. Sisa tagihan tetap pada piutang kios mitra.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Batal</Button>
                <Button
                  onClick={handlePayment}
                  disabled={paymentType === 'cash' && paymentAmount <= 0}
                  data-testid="confirm-canvasser-payment"
                >
                  {paymentType === 'cash' ? 'Catat Bayar Tunai' : 'Catat Bon'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settlement Dialog */}
      <Dialog open={!!settleDialog} onOpenChange={(open) => { if (!open) setSettleDialog(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selesaikan Pesanan</DialogTitle>
          </DialogHeader>
          {settleDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-semibold">{settleDialog.partner_store_name}</p>
                <p className="text-sm text-muted-foreground">{settleDialog.order_number}</p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Pilih jumlah yang laku terjual (dalam satuan):</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-200 text-green-700 hover:bg-green-50"
                  data-testid="sell-all-btn"
                  onClick={() => {
                    setSettleItems(settleItems.map(item => {
                      const isDus = item.warehouse_unit === 'dus';
                      const ipb = item.items_per_box || 1;
                      const totalPcs = isDus ? item.original_qty * ipb : item.original_qty;
                      return { ...item, qty_sold: totalPcs };
                    }));
                  }}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Terjual Semua
                </Button>
              </div>

              <div className="space-y-3">
                {settleItems.map((item, idx) => {
                  const isDus = item.warehouse_unit === 'dus';
                  const ipb = item.items_per_box || 1;
                  const totalPcs = isDus ? item.original_qty * ipb : item.original_qty;
                  const remaining = totalPcs - item.qty_sold;
                  const fullBoxes = ipb > 1 ? Math.floor(remaining / ipb) : 0;
                  const partialPcs = remaining - (fullBoxes * ipb);
                  return (
                    <div key={idx} className="p-3 border rounded-lg space-y-2" data-testid={`settle-item-${idx}`}>
                      <div className="flex justify-between">
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isDus ? `${item.original_qty} dus (${totalPcs} pcs)` : `${item.original_qty} pcs`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Laku (satuan):</Label>
                        <Input
                          type="number"
                          min={0}
                          max={totalPcs}
                          value={item.qty_sold}
                          onChange={(e) => {
                            const val = Math.min(Math.max(parseInt(e.target.value) || 0, 0), totalPcs);
                            setSettleItems(settleItems.map((si, i) => i === idx ? { ...si, qty_sold: val } : si));
                          }}
                          className="h-8 w-24"
                          data-testid={`settle-qty-${idx}`}
                        />
                        <span className="text-xs text-muted-foreground">/ {totalPcs} pcs</span>
                      </div>
                      {remaining > 0 && (
                        <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                          Sisa retur: <span className="font-semibold">{remaining} pcs</span>
                        </div>
                      )}
                      <p className="text-xs text-right font-semibold">
                        Total: {formatCurrency(item.qty_sold * item.price)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Asli:</span>
                  <span className="line-through text-muted-foreground">{formatCurrency(settleDialog.total)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Baru:</span>
                  <span className="text-primary">{formatCurrency(settleItems.reduce((s, i) => s + (i.qty_sold * i.price), 0))}</span>
                </div>
              </div>

              {settleItems.some(i => {
                const isDus = i.warehouse_unit === 'dus';
                const ipb = i.items_per_box || 1;
                const totalPcs = isDus ? i.original_qty * ipb : i.original_qty;
                return totalPcs - i.qty_sold > 0;
              }) && (
                <div className="p-3 border rounded-lg space-y-2 bg-muted/30">
                  <Label className="text-xs font-semibold">Tujuan retur barang sisa:</Label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" name="return_to" value="vehicle" checked={settleReturnTo === 'vehicle'}
                        onChange={() => setSettleReturnTo('vehicle')} className="accent-primary" data-testid="return-to-vehicle" />
                      Stok Mobil Box
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" name="return_to" value="warehouse" checked={settleReturnTo === 'warehouse'}
                        onChange={() => setSettleReturnTo('warehouse')} className="accent-primary" data-testid="return-to-warehouse" />
                      Gudang
                    </label>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setSettleDialog(null)}>Batal</Button>
                <Button onClick={handleSettlement} data-testid="confirm-settlement-btn">
                  Selesaikan Pesanan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={!!transferDialog} onOpenChange={() => setTransferDialog(null)}>
        <DialogContent className="max-w-lg" data-testid="canvasser-transfer-dialog">
          <DialogHeader><DialogTitle>Oper Pesanan</DialogTitle></DialogHeader>
          {transferDialog && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <Card className="p-3 bg-muted/50">
                <p className="text-sm">Dari: <strong>{transferDialog.partner_store_name}</strong></p>
                <p className="text-xs text-muted-foreground">{transferDialog.order_number}</p>
              </Card>

              <div className="space-y-2">
                <Label>Pilih item yang dioper:</Label>
                {transferItems.map((item, idx) => (
                  <div key={item.product_id} className={`p-3 border rounded-lg space-y-2 ${item.selected ? 'border-purple-300 bg-purple-50/50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={item.selected} onChange={e => {
                        const ni = [...transferItems]; ni[idx].selected = e.target.checked; setTransferItems(ni);
                      }} className="rounded" />
                      <span className="flex-1 text-sm font-medium">{item.product_name}</span>
                    </div>
                    {item.selected && (
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <div>
                          <Label className="text-xs">Jumlah (max: {item.max_qty})</Label>
                          <Input type="number" min={1} max={item.max_qty} value={item.quantity}
                            onChange={e => { const ni = [...transferItems]; ni[idx].quantity = Math.min(parseInt(e.target.value) || 1, item.max_qty); setTransferItems(ni); }}
                            className="h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Harga Jual Baru</Label>
                          <Input type="number" min={0} value={item.new_price}
                            onChange={e => { const ni = [...transferItems]; ni[idx].new_price = parseFloat(e.target.value) || 0; setTransferItems(ni); }}
                            className="h-8" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Kios Mitra Tujuan *</Label>
                <Input placeholder="Cari kios mitra..." value={transferStoreSearch} onChange={e => setTransferStoreSearch(e.target.value)} />
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {partnerStores.filter(s => s.id !== transferDialog.partner_store_id && (!transferStoreSearch || s.name.toLowerCase().includes(transferStoreSearch.toLowerCase()))).map(s => (
                    <div key={s.id}
                      className={`px-3 py-2 text-sm cursor-pointer ${transferStoreId === s.id ? 'bg-purple-100 font-medium' : 'hover:bg-muted'}`}
                      onClick={() => setTransferStoreId(s.id)}>{s.name}</div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pembayaran</Label>
                <Select value={transferPayment} onValueChange={setTransferPayment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash / Tunai</SelectItem>
                    <SelectItem value="bon">Bon / Hutang</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm font-semibold">Total Oper: {formatCurrency(transferItems.filter(i => i.selected).reduce((s, i) => s + i.quantity * i.new_price, 0))}</p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setTransferDialog(null)}>Batal</Button>
                <Button onClick={handleTransfer} disabled={transferSubmitting} className="bg-purple-600 hover:bg-purple-700">
                  {transferSubmitting ? 'Memproses...' : 'Oper Pesanan'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
