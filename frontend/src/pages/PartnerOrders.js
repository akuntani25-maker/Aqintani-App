import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Search, Package, Trash2, ShoppingCart } from 'lucide-react';

export const PartnerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [partnerStores, setPartnerStores] = useState([]);
  const [canvassers, setCanvassers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [selectedCanvasser, setSelectedCanvasser] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('gudang_utama');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [cart, setCart] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [discount, setDiscount] = useState(0);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [partnerPrices, setPartnerPrices] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  // Fetch partner prices when partner changes
  useEffect(() => {
    if (selectedPartner) {
      api.get(`/partner-prices?partner_store_id=${selectedPartner}`).then(res => setPartnerPrices(res.data)).catch(() => {});
    } else {
      setPartnerPrices([]);
    }
  }, [selectedPartner]);

  const getPartnerPrice = (productId) => {
    const pp = partnerPrices.find(p => p.product_id === productId);
    return pp ? pp.custom_price : null;
  };

  const getWarehouseStockQty = (productId, warehouseId) => {
    const entry = warehouseStock.find(s => s.product_id === productId && s.warehouse_id === warehouseId);
    return entry ? entry.stock : 0;
  };

  const addToCart = (product) => {
    const customPrice = getPartnerPrice(product.id);
    const price = customPrice !== null ? customPrice : product.price;
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        price,
        subtotal: price
      }]);
    }
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.product_id !== productId));
    } else {
      setCart(cart.map(item =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price }
          : item
      ));
    }
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal - discount;
    return { subtotal, total };
  };

  const handleSubmit = async () => {
    if (!selectedPartner) {
      toast.error('Pilih kios mitra');
      return;
    }
    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }

    const { subtotal, total } = calculateTotal();

    try {
      await api.post('/partner-orders', {
        partner_store_id: selectedPartner,
        items: cart,
        subtotal,
        discount,
        total,
        paid: 0,
        delivery_date: deliveryDate,
        canvasser_id: selectedCanvasser
      });
      toast.success('Pesanan berhasil dibuat');
      resetForm();
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal membuat pesanan');
    }
  };

  const resetForm = () => {
    setSelectedPartner('');
    setSelectedCanvasser('');
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { subtotal, total } = calculateTotal();

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="partner-orders-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pesanan Kios Mitra</h1>
          <p className="text-sm text-muted-foreground mt-2">Buat dan kelola pesanan untuk kios mitra</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="create-order-button">
              <Plus className="w-4 h-4 mr-2" />
              Buat Pesanan Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Buat Pesanan Kios Mitra</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Product Selection */}
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-2">
                  <Label>Pilih Kios Mitra *</Label>
                  <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kios mitra" />
                    </SelectTrigger>
                    <SelectContent>
                      {partnerStores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name} - {store.owner_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kanvaser</Label>
                    <Select value={selectedCanvasser} onValueChange={setSelectedCanvasser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kanvaser" />
                      </SelectTrigger>
                      <SelectContent>
                        {canvassers.map((canvasser) => (
                          <SelectItem key={canvasser.id} value={canvasser.id}>
                            {canvasser.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tanggal Kirim</Label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cari Produk</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari produk..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {filteredProducts.slice(0, 10).map((product) => (
                    <div
                      key={product.id}
                      className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                      onClick={() => addToCart(product)}
                    >
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">Stok: {product.stock}</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(product.price)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cart */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Keranjang</Label>
                  <span className="text-sm text-muted-foreground">{cart.length} item</span>
                </div>

                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Keranjang kosong</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.product_id} className="p-3 border-b last:border-b-0">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-medium flex-1">{item.product_name}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateQuantity(item.product_id, 0)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            >
                              +
                            </Button>
                          </div>
                          <span className="text-sm font-semibold">{formatCurrency(item.subtotal)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-semibold">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="space-y-2">
                    <Label>Diskon</Label>
                    <Input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-primary">{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Batal
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1" disabled={cart.length === 0}>
                    Buat Pesanan
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Belum ada pesanan</p>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell>{order.partner_store_name}</TableCell>
                    <TableCell>{order.canvasser_name || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(order.total)}</TableCell>
                    <TableCell className="text-right">
                      <span className={order.remaining > 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                        {formatCurrency(order.remaining)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={order.status}
                        onValueChange={(value) => updateOrderStatus(order.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {/* View detail */}}
                      >
                        Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
