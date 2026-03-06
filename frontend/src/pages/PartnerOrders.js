import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Package, Trash2, ShoppingCart, Warehouse, FileText, DollarSign, TrendingUp, RotateCcw, Pencil, Trash } from 'lucide-react';
import { CurrencyInput } from '../components/CurrencyInput';
import { Pagination } from '../components/Pagination';

export const PartnerOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [partnerStores, setPartnerStores] = useState([]);
  const [canvassers, setCanvassers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [selectedCanvasser, setSelectedCanvasser] = useState('');
  const [defaultWarehouse, setDefaultWarehouse] = useState('gudang_utama');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [cart, setCart] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [discount, setDiscount] = useState(0);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [partnerPrices, setPartnerPrices] = useState([]);
  const [returnDialog, setReturnDialog] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnWarehouse, setReturnWarehouse] = useState('gudang_toko');
  const [searchOrder, setSearchOrder] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, storesRes, canvassersRes, productsRes, whRes, whStockRes] = await Promise.all([
        api.get('/partner-orders'),
        api.get('/partner-stores'),
        api.get('/canvassers'),
        api.get('/products'),
        api.get('/warehouses'),
        api.get('/warehouse-stock')
      ]);
      setOrders(ordersRes.data);
      setPartnerStores(storesRes.data);
      setCanvassers(canvassersRes.data);
      setProducts(productsRes.data);
      setWarehouses(whRes.data);
      setWarehouseStock(whStockRes.data);
    } catch (error) {
      toast.error('Gagal memuat data');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedPartner) {
      api.get(`/partner-prices?partner_store_id=${selectedPartner}`).then(res => setPartnerPrices(res.data)).catch(() => {});
    } else { setPartnerPrices([]); }
  }, [selectedPartner]);

  // Today's summary
  const todaySummary = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.date === today);
    const totalOrders = todayOrders.length;
    const totalItems = todayOrders.reduce((s, o) => s + (o.items?.reduce((si, i) => si + i.quantity, 0) || 0), 0);
    const totalRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalPaid = todayOrders.reduce((s, o) => s + (o.paid || 0), 0);

    // Per-warehouse breakdown
    const whBreakdown = {};
    todayOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const whId = item.warehouse_id || o.warehouse_id || 'gudang_utama';
        if (!whBreakdown[whId]) whBreakdown[whId] = { count: 0, items: 0 };
        whBreakdown[whId].count++;
        whBreakdown[whId].items += item.quantity;
      });
    });

    return { totalOrders, totalItems, totalRevenue, totalPaid, whBreakdown };
  }, [orders]);

  const getPartnerPrice = (productId) => {
    const pp = partnerPrices.find(p => p.product_id === productId);
    return pp ? pp.custom_price : null;
  };

  const getWarehouseStockQty = (productId, warehouseId) => {
    const entry = warehouseStock.find(s => s.product_id === productId && s.warehouse_id === warehouseId);
    return entry ? entry.stock : 0;
  };

  const getWarehouseUnit = (warehouseId) => {
    return warehouses.find(w => w.id === warehouseId)?.unit || 'satuan';
  };

  const getPriceForWarehouse = (product, warehouseId) => {
    const customPrice = getPartnerPrice(product.id);
    if (customPrice !== null) return customPrice;
    const unit = getWarehouseUnit(warehouseId);
    return unit === 'dus' ? (product.box_price || product.price) : product.price;
  };

  const addToCart = (product) => {
    const whId = defaultWarehouse;
    const price = getPriceForWarehouse(product, whId);
    const existing = cart.find(item => item.product_id === product.id && item.warehouse_id === whId);
    if (existing) {
      setCart(cart.map(item =>
        (item.product_id === product.id && item.warehouse_id === whId)
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, { product_id: product.id, product_name: product.name, quantity: 1, price, subtotal: price, warehouse_id: whId }]);
    }
  };

  const updateQuantity = (idx, newQuantity) => {
    if (newQuantity <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
    } else {
      setCart(cart.map((item, i) => i === idx ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price } : item));
    }
  };

  const updateItemPrice = (idx, newPrice) => {
    setCart(cart.map((item, i) => i === idx ? { ...item, price: newPrice, subtotal: item.quantity * newPrice } : item));
  };

  const changeItemWarehouse = (idx, newWhId) => {
    const item = cart[idx];
    if (!item || item.warehouse_id === newWhId) return;
    const product = products.find(p => p.id === item.product_id);
    if (!product) return;
    const newPrice = getPriceForWarehouse(product, newWhId);
    setCart(cart.map((it, i) => i === idx ? { ...it, warehouse_id: newWhId, price: newPrice, subtotal: it.quantity * newPrice } : it));
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    return { subtotal, total: subtotal - discount };
  };

  const handleSubmit = async () => {
    if (!selectedPartner) { toast.error('Pilih kios mitra'); return; }
    if (cart.length === 0) { toast.error('Keranjang kosong'); return; }
    const { subtotal, total } = calculateTotal();
    try {
      const res = await api.post('/partner-orders', {
        partner_store_id: selectedPartner,
        items: cart, subtotal, discount, total,
        paid: 0, delivery_date: deliveryDate,
        canvasser_id: selectedCanvasser, warehouse_id: defaultWarehouse
      });
      toast.success('Pesanan berhasil dibuat');
      const orderId = res.data?.id;
      resetForm();
      setIsDialogOpen(false);
      fetchData();
      if (orderId) {
        navigate(`/partner-receipt?id=${orderId}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal membuat pesanan');
    }
  };

  const openReturnDialog = (order) => {
    setReturnDialog(order);
    setReturnItems(order.items.map(i => ({ ...i, return_qty: 0, reason: '' })));
    setReturnNotes('');
    setReturnWarehouse('gudang_toko');
  };

  const handleReturn = async () => {
    const items = returnItems.filter(i => i.return_qty > 0).map(i => ({
      product_id: i.product_id, product_name: i.product_name,
      quantity: i.return_qty, reason: i.reason, subtotal: i.return_qty * i.price
    }));
    if (items.length === 0) { toast.error('Pilih produk yang diretur'); return; }
    try {
      await api.post('/returns', {
        source_type: 'partner_order', source_id: returnDialog.id,
        items, notes: returnNotes, warehouse_id: returnWarehouse
      });
      toast.success('Retur berhasil dicatat');
      setReturnDialog(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mencatat retur');
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Yakin ingin menghapus pesanan ini?')) return;
    try {
      await api.delete(`/partner-orders/${orderId}`);
      toast.success('Pesanan berhasil dihapus');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menghapus pesanan');
    }
  };


  const resetForm = () => {
    setSelectedPartner('');
    setSelectedCanvasser('');
    setDefaultWarehouse('gudang_utama');
    setCart([]);
    setDiscount(0);
    setDeliveryDate(new Date().toISOString().split('T')[0]);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/partner-orders/${orderId}/status?status=${newStatus}`);
      toast.success('Status berhasil diperbarui');
      fetchData();
    } catch (error) {
      toast.error('Gagal memperbarui status');
    }
  };

  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
  const fmtNum = (v) => new Intl.NumberFormat('id-ID').format(v);

  const filteredOrders = orders.filter(o =>
    !searchOrder || o.order_number?.toLowerCase().includes(searchOrder.toLowerCase()) ||
    o.partner_store_name?.toLowerCase().includes(searchOrder.toLowerCase()) ||
    o.canvasser_name?.toLowerCase().includes(searchOrder.toLowerCase())
  );

  useEffect(() => { setPage(1); }, [searchOrder]);

  const totalPages = Math.ceil(filteredOrders.length / perPage);
  const paginatedOrders = filteredOrders.slice((page - 1) * perPage, page * perPage);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()));

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const { subtotal, total } = calculateTotal();

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="partner-orders-page">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Pesanan Kios Mitra</h1>
            <p className="text-sm text-muted-foreground mt-1">Buat dan kelola pesanan untuk kios mitra</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="w-auto self-start" data-testid="create-order-button"><Plus className="w-4 h-4 mr-2" />Buat Pesanan</Button>
            </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Buat Pesanan Kios Mitra</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-2">
                  <Label>Pilih Kios Mitra *</Label>
                  <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                    <SelectTrigger data-testid="order-partner-select"><SelectValue placeholder="Pilih kios mitra" /></SelectTrigger>
                    <SelectContent>{partnerStores.map(store => <SelectItem key={store.id} value={store.id}>{store.name} - {store.owner_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kanvaser</Label>
                    <Select value={selectedCanvasser} onValueChange={setSelectedCanvasser}>
                      <SelectTrigger data-testid="order-canvasser-select"><SelectValue placeholder="Pilih kanvaser" /></SelectTrigger>
                      <SelectContent>{canvassers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Kirim</Label>
                    <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} data-testid="order-delivery-date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Gudang Default (untuk item baru)</Label>
                  <Select value={defaultWarehouse} onValueChange={setDefaultWarehouse}>
                    <SelectTrigger data-testid="order-warehouse-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name} ({wh.unit})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cari Produk</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Cari produk..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} className="pl-10" data-testid="order-search-product" />
                  </div>
                </div>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {filteredProducts.slice(0, 10).map(product => {
                    const whStock = getWarehouseStockQty(product.id, defaultWarehouse);
                    const unit = getWarehouseUnit(defaultWarehouse);
                    const displayPrice = getPriceForWarehouse(product, defaultWarehouse);
                    const customPrice = getPartnerPrice(product.id);
                    return (
                      <div key={product.id} className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0 flex justify-between items-center" onClick={() => addToCart(product)} data-testid={`product-item-${product.id}`}>
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">Stok: {whStock} {unit}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{fmt(displayPrice)}<span className="text-xs font-normal text-muted-foreground">/{unit}</span></p>
                          {customPrice !== null && <p className="text-xs text-green-600">Harga mitra</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Keranjang</Label>
                  <span className="text-sm text-muted-foreground">{cart.length} item</span>
                </div>
                <div className="border rounded-lg max-h-80 overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Keranjang kosong</p>
                    </div>
                  ) : cart.map((item, idx) => {
                    const unit = getWarehouseUnit(item.warehouse_id);
                    const stock = getWarehouseStockQty(item.product_id, item.warehouse_id);
                    return (
                      <div key={idx} className="p-3 border-b last:border-b-0 space-y-2">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium flex-1">{item.product_name}</p>
                          <Button size="sm" variant="ghost" onClick={() => updateQuantity(idx, 0)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Warehouse className="w-3 h-3 text-muted-foreground shrink-0" />
                          <Select value={item.warehouse_id} onValueChange={(v) => changeItemWarehouse(idx, v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name} ({getWarehouseStockQty(item.product_id, wh.id)} {wh.unit})</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1">
                          <Pencil className="w-3 h-3 text-muted-foreground shrink-0" />
                          <CurrencyInput value={item.price} className="h-7 text-xs font-medium w-28"
                            onChange={(v) => updateItemPrice(idx, v)}
                            data-testid={`cart-price-${idx}`} />
                          <span className="text-xs text-muted-foreground">/{unit}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => updateQuantity(idx, item.quantity - 1)}>-</Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button size="sm" variant="outline" onClick={() => updateQuantity(idx, item.quantity + 1)}>+</Button>
                            <span className="text-xs text-muted-foreground">{unit}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold">{fmt(item.subtotal)}</span>
                          </div>
                        </div>
                        {item.quantity > stock && <p className="text-xs text-red-600">Stok tidak cukup! ({stock} {unit})</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm"><span>Subtotal:</span><span className="font-semibold">{fmt(subtotal)}</span></div>
                  <div className="space-y-2">
                    <Label>Diskon</Label>
                    <CurrencyInput value={discount} onChange={(v) => setDiscount(v)} data-testid="order-discount" />
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total:</span><span className="text-primary">{fmt(total)}</span></div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Batal</Button>
                  <Button onClick={handleSubmit} className="flex-1" disabled={cart.length === 0} data-testid="submit-order-button">Buat Pesanan</Button>
                </div>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Today Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4" data-testid="today-summary">
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-11 md:h-11 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Pesanan Hari Ini</p>
              <p className="text-lg md:text-2xl font-bold truncate" data-testid="today-orders-count">{todaySummary.totalOrders}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-11 md:h-11 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Total Produk Dipesan</p>
              <p className="text-lg md:text-2xl font-bold text-blue-600 truncate" data-testid="today-items-count">{fmtNum(todaySummary.totalItems)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-11 md:h-11 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Total Penjualan</p>
              <p className="text-lg md:text-2xl font-bold text-emerald-600 truncate" data-testid="today-revenue">{fmt(todaySummary.totalRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-11 md:h-11 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Uang Diterima</p>
              <p className="text-lg md:text-2xl font-bold text-green-600 truncate" data-testid="today-paid">{fmt(todaySummary.totalPaid)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Warehouse Breakdown */}
      {Object.keys(todaySummary.whBreakdown).length > 0 && (
        <Card className="p-5" data-testid="warehouse-breakdown">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Warehouse className="w-4 h-4" />Ringkasan Per Gudang Hari Ini</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {warehouses.map(wh => {
              const data = todaySummary.whBreakdown[wh.id];
              return (
                <div key={wh.id} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{wh.name}</p>
                    <p className="text-xs text-muted-foreground">{wh.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{data ? fmtNum(data.items) : 0}</p>
                    <p className="text-xs text-muted-foreground">{wh.unit} dikirim</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Search Orders */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari no. order, kios mitra, kanvaser..." value={searchOrder} onChange={(e) => setSearchOrder(e.target.value)} className="pl-10" data-testid="search-order-input" />
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="p-6">
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Order</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kios Mitra</TableHead>
                <TableHead>Kanvaser</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Belum ada pesanan</p>
                  </TableCell>
                </TableRow>
              ) : paginatedOrders.map(order => (
                <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                  <TableCell className="font-mono text-sm">
                    {order.order_number}
                    {order.has_return && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">RETUR</span>}
                  </TableCell>
                  <TableCell>{new Date(order.created_at).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell>{order.partner_store_name}</TableCell>
                  <TableCell>{order.canvasser_name || '-'}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(order.total)}</TableCell>
                  <TableCell className="text-right">
                    <span className={order.remaining > 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}>{fmt(order.remaining)}</span>
                  </TableCell>
                  <TableCell>
                    <Select value={order.status} onValueChange={(value) => updateOrderStatus(order.id, value)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/partner-receipt?id=${order.id}`)} data-testid={`receipt-${order.id}`}>
                        <FileText className="w-4 h-4 mr-1" />Struk
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openReturnDialog(order)} data-testid={`return-${order.id}`} className="text-orange-600 border-orange-200 hover:bg-orange-50">
                        <RotateCcw className="w-4 h-4 mr-1" />Retur
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteOrder(order.id)} data-testid={`delete-${order.id}`} className="text-red-600 border-red-200 hover:bg-red-50">
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={filteredOrders.length} perPage={perPage} onChange={setPage} />
      </Card>

      {/* Return Dialog */}
      <Dialog open={!!returnDialog} onOpenChange={(open) => { if (!open) setReturnDialog(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Retur Pesanan {returnDialog?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Kios: <span className="font-semibold text-foreground">{returnDialog?.partner_store_name}</span></p>
            <div className="space-y-3">
              {returnItems.map((item, idx) => (
                <div key={idx} className="p-3 border rounded-lg space-y-2">
                  <p className="text-sm font-medium">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">Dipesan: {item.quantity} — Harga: {fmt(item.price)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Qty Retur</Label>
                      <Input type="number" min="0" max={item.quantity} value={item.return_qty}
                        onChange={(e) => {
                          const v = Math.min(parseInt(e.target.value) || 0, item.quantity);
                          setReturnItems(returnItems.map((it, i) => i === idx ? { ...it, return_qty: v } : it));
                        }}
                        data-testid={`return-qty-${idx}`} />
                    </div>
                    <div>
                      <Label className="text-xs">Alasan</Label>
                      <Input value={item.reason} placeholder="Rusak, expired, dll"
                        onChange={(e) => setReturnItems(returnItems.map((it, i) => i === idx ? { ...it, reason: e.target.value } : it))}
                        data-testid={`return-reason-${idx}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Gudang Tujuan Retur</Label>
              <Select value={returnWarehouse} onValueChange={setReturnWarehouse}>
                <SelectTrigger data-testid="return-warehouse-select"><SelectValue /></SelectTrigger>
                <SelectContent>{warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="Keterangan tambahan..." data-testid="return-notes" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setReturnDialog(null)} className="flex-1">Batal</Button>
              <Button onClick={handleReturn} className="flex-1 bg-orange-600 hover:bg-orange-700" data-testid="submit-return-button">Catat Retur</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
