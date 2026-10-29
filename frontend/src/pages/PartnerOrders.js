import React, { useState, useEffect, useMemo } from 'react';
import { PageSkeleton } from '../components/PageSkeleton';
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
import { Plus, Search, Package, Trash2, ShoppingCart, Warehouse, FileText, DollarSign, TrendingUp, RotateCcw, Pencil, Trash, X, Store, Truck, ArrowRightLeft } from '../components/icons';
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
  const [returnToVehicle, setReturnToVehicle] = useState(false);
  const [returnVehicleId, setReturnVehicleId] = useState('');
  const [searchOrder, setSearchOrder] = useState('');
  const [orderType, setOrderType] = useState('regular');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerSearchFocused, setPartnerSearchFocused] = useState(false);
  const [addItemDialog, setAddItemDialog] = useState(null);
  const [addItemCart, setAddItemCart] = useState([]);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 15;
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');

  // Transfer dialog
  const [transferDialog, setTransferDialog] = useState(null);
  const [transferItems, setTransferItems] = useState([]);
  const [transferStoreId, setTransferStoreId] = useState('');
  const [transferPayment, setTransferPayment] = useState('bon');
  const [transferStoreSearch, setTransferStoreSearch] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Barter cart - barang yang TOKO ambil dari kios mitra (tambah stok gudang)
  const [barterCart, setBarterCart] = useState([]);
  const [barterSearch, setBarterSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, storesRes, canvassersRes, productsRes, whRes, whStockRes, vehRes] = await Promise.all([
        api.get('/partner-orders'),
        api.get('/partner-stores'),
        api.get('/canvassers'),
        api.get('/products'),
        api.get('/warehouses'),
        api.get('/warehouse-stock'),
        api.get('/vehicles')
      ]);
      setOrders(ordersRes.data);
      setPartnerStores(storesRes.data);
      setCanvassers(canvassersRes.data);
      setProducts(productsRes.data);
      setWarehouses(whRes.data);
      setWarehouseStock(whStockRes.data);
      setVehicles(vehRes.data);
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
    // Always use unit price (harga satuan)
    return product.price;
  };

  const getSubtotalForItem = (item) => {
    const unit = getWarehouseUnit(item.warehouse_id);
    const product = products.find(p => p.id === item.product_id);
    const ipb = product?.items_per_box || 1;
    // If warehouse is dus, subtotal = price_per_unit * items_per_box * qty_dus
    if (unit === 'dus') {
      return item.price * ipb * item.quantity;
    }
    return item.price * item.quantity;
  };

  const addToCart = (product) => {
    const whId = defaultWarehouse;
    const price = getPriceForWarehouse(product, whId);
    const unit = getWarehouseUnit(whId);
    const ipb = product.items_per_box || 1;
    const subtotal = unit === 'dus' ? price * ipb * 1 : price * 1;
    const existing = cart.find(item => item.product_id === product.id && item.warehouse_id === whId);
    if (existing) {
      const newQty = existing.quantity + 1;
      const newSub = unit === 'dus' ? price * ipb * newQty : price * newQty;
      setCart(cart.map(item =>
        (item.product_id === product.id && item.warehouse_id === whId)
          ? { ...item, quantity: newQty, subtotal: newSub }
          : item
      ));
    } else {
      setCart([...cart, { product_id: product.id, product_name: product.name, quantity: 1, price, subtotal, warehouse_id: whId }]);
    }
  };

  const updateQuantity = (idx, newQuantity) => {
    if (newQuantity <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
    } else {
      setCart(cart.map((item, i) => {
        if (i !== idx) return item;
        return { ...item, quantity: newQuantity, subtotal: getSubtotalForItem({ ...item, quantity: newQuantity }) };
      }));
    }
  };

  const updateItemPrice = (idx, newPrice) => {
    setCart(cart.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, price: newPrice, subtotal: getSubtotalForItem({ ...item, price: newPrice }) };
    }));
  };

  const changeItemWarehouse = (idx, newWhId) => {
    const item = cart[idx];
    if (!item || item.warehouse_id === newWhId) return;
    const product = products.find(p => p.id === item.product_id);
    if (!product) return;
    const newPrice = getPriceForWarehouse(product, newWhId);
    const unit = getWarehouseUnit(newWhId);
    const ipb = product.items_per_box || 1;
    const newSub = unit === 'dus' ? newPrice * ipb * item.quantity : newPrice * item.quantity;
    setCart(cart.map((it, i) => i === idx ? { ...it, warehouse_id: newWhId, price: newPrice, subtotal: newSub } : it));
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + getSubtotalForItem(item), 0);
    return { subtotal, total: subtotal - discount };
  };

  const handleSubmit = async () => {
    if (cart.length === 0 && !(orderType === 'barter' && barterCart.length > 0)) {
      toast.error('Keranjang kosong');
      return;
    }

    // Conditional order → load to vehicle stock
    if (orderType === 'conditional') {
      if (!selectedVehicle) { toast.error('Pilih mobil box tujuan'); return; }
      try {
        const items = cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          warehouse_id: item.warehouse_id || defaultWarehouse
        }));
        await api.post('/vehicle-stock/load', {
          vehicle_id: selectedVehicle,
          items,
          notes: `Pesanan kondisional ${deliveryDate}`
        });
        const veh = vehicles.find(v => v.id === selectedVehicle);
        toast.success(`${cart.length} item dimuat ke ${veh?.name || 'mobil box'}`);
        resetForm();
        setIsDialogOpen(false);
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Gagal memuat barang ke mobil');
      }
      return;
    }

    // Regular / Barter order → create partner order
    if (!selectedPartner) { toast.error('Pilih kios mitra'); return; }
    const { subtotal, total } = calculateTotal();

    // Barter: validasi minimal 1 barang di salah satu sisi
    if (orderType === 'barter') {
      if (cart.length === 0 && barterCart.length === 0) {
        toast.error('Tambahkan minimal 1 barang barter');
        return;
      }
      const invalidBarter = barterCart.find(b => !b.product_name || b.quantity <= 0);
      if (invalidBarter) { toast.error('Lengkapi nama barang dan qty untuk semua item barter'); return; }
    }

    try {
      const payload = {
        partner_store_id: selectedPartner,
        items: cart, subtotal, discount, total,
        paid: 0, delivery_date: deliveryDate,
        canvasser_id: selectedCanvasser, warehouse_id: defaultWarehouse,
        order_type: orderType
      };
      if (orderType === 'barter') {
        payload.barter_received_items = barterCart.map(b => ({
          product_id: b.product_id || '',
          product_name: b.product_name,
          quantity: b.quantity,
          price: b.price,
          sell_price: b.sell_price || 0,
          warehouse_id: b.warehouse_id || 'gudang_toko'
        }));
      }
      const res = await api.post('/partner-orders', payload);
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
    // Default gudang sesuai asal order
    const orderWh = order.warehouse_id || order.items?.[0]?.warehouse_id || 'gudang_toko';
    setReturnWarehouse(orderWh);
    setReturnToVehicle(false);
    setReturnVehicleId('');
  };

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
        items: selected.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          new_price: i.new_price
        })),
        payment_type: transferPayment
      });
      toast.success('Pesanan berhasil dioper');
      setTransferDialog(null);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal mengoper pesanan'); }
    finally { setTransferSubmitting(false); }
  };

  const handleReturn = async () => {
    const items = returnItems.filter(i => i.return_qty > 0).map(i => ({
      product_id: i.product_id, product_name: i.product_name,
      quantity: i.return_qty, reason: i.reason, subtotal: i.return_qty * i.price
    }));
    if (items.length === 0) { toast.error('Pilih produk yang diretur'); return; }
    try {
      const payload = {
        source_type: 'partner_order', source_id: returnDialog.id,
        items, notes: returnNotes,
        warehouse_id: returnToVehicle ? 'gudang_toko' : returnWarehouse,
        vehicle_id: returnToVehicle ? returnVehicleId : ''
      };
      await api.post('/returns', payload);
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


  const selectedPartnerStore = partnerStores.find(s => s.id === selectedPartner);

  const filteredPartnerStores = partnerStores.filter(s =>
    !partnerSearch || s.name?.toLowerCase().includes(partnerSearch.toLowerCase()) ||
    s.owner_name?.toLowerCase().includes(partnerSearch.toLowerCase()) ||
    s.address?.toLowerCase().includes(partnerSearch.toLowerCase())
  );

  const selectPartnerStore = (store) => {
    setSelectedPartner(store.id);
    setPartnerSearch('');
    setPartnerSearchFocused(false);
  };

  const clearPartnerSelection = () => {
    setSelectedPartner('');
    setPartnerSearch('');
  };

  const resetForm = () => {
    setSelectedPartner('');
    setSelectedCanvasser('');
    setSelectedVehicle('');
    setDefaultWarehouse('gudang_utama');
    setCart([]);
    setBarterCart([]);
    setBarterSearch('');
    setDiscount(0);
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setOrderType('regular');
    setPartnerSearch('');
    setPartnerSearchFocused(false);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      if (newStatus === 'cancelled') {
        if (!window.confirm('Pesanan akan dibatalkan dan stok akan dikembalikan otomatis. Lanjutkan?')) return;
      }
      await api.put(`/partner-orders/${orderId}/status?status=${newStatus}`);
      toast.success(newStatus === 'cancelled' ? 'Pesanan dibatalkan, stok dikembalikan' : 'Status berhasil diperbarui');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal memperbarui status');
    }
  };

  const openAddItemDialog = (order) => {
    setAddItemDialog(order);
    setAddItemCart([]);
    setAddItemSearch('');
  };

  const addToAddItemCart = (product) => {
    const existing = addItemCart.find(i => i.product_id === product.id);
    if (existing) {
      setAddItemCart(addItemCart.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setAddItemCart([...addItemCart, {
        product_id: product.id, product_name: product.name,
        quantity: 1, price: product.price,
        source: 'gudang_toko', external_cost: 0
      }]);
    }
  };

  const handleSubmitAddItems = async () => {
    if (addItemCart.length === 0) { toast.error('Tambahkan item terlebih dahulu'); return; }
    try {
      await api.post(`/partner-orders/${addItemDialog.id}/add-items`, { items: addItemCart });
      toast.success('Item tambahan berhasil ditambahkan');
      setAddItemDialog(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menambahkan item');
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
    return <PageSkeleton variant="table" />;
  }

  const { subtotal, total } = calculateTotal();
  // Barter: hitung total nilai barang yang TOKO ambil dari kios
  const barterTotal = barterCart.reduce((sum, b) => {
    const ipb = (products.find(p => p.id === b.product_id)?.items_per_box) || 1;
    const wh = warehouses.find(w => w.id === b.warehouse_id);
    const isDus = wh?.unit === 'dus';
    return sum + (b.price || 0) * (b.quantity || 0) * (isDus ? ipb : 1);
  }, 0);
  const barterNet = subtotal - barterTotal;

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
                  <Label>Tipe Pesanan</Label>
                  <Select value={orderType} onValueChange={(v) => { setOrderType(v); setSelectedPartner(''); setSelectedVehicle(''); setPartnerSearch(''); }}>
                    <SelectTrigger data-testid="order-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Pesanan Langsung</SelectItem>
                      <SelectItem value="conditional">Kondisional (Barang Pegangan)</SelectItem>
                      <SelectItem value="barter">Barter (Toko ↔ Kios)</SelectItem>
                    </SelectContent>
                  </Select>
                  {orderType === 'conditional' && <p className="text-xs text-amber-600">Barang akan dimuat ke stok mobil box, bukan ke kios mitra.</p>}
                  {orderType === 'barter' && <p className="text-xs text-blue-600">Catat barang yang kios ambil dari toko & barang yang toko ambil dari kios. Jika toko ambil &gt; kios ambil, piutang menjadi minus (toko hutang ke kios).</p>}
                </div>

                {orderType === 'conditional' ? (
                  <div className="space-y-2">
                    <Label>Pilih Mobil Box *</Label>
                    <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                      <SelectTrigger data-testid="order-vehicle-select"><SelectValue placeholder="Pilih mobil box tujuan" /></SelectTrigger>
                      <SelectContent>
                        {vehicles.map(v => <SelectItem key={v.id} value={v.id}><Truck className="w-3 h-3 inline mr-1" />{v.name} ({v.plate_number})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                <div className="space-y-2">
                  <Label>Cari Kios Mitra *</Label>
                  {selectedPartnerStore ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg" data-testid="selected-partner-info">
                      <Store className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-emerald-900 truncate">{selectedPartnerStore.name}</p>
                        <div className="flex items-center gap-3 text-xs text-emerald-700">
                          <span>{selectedPartnerStore.owner_name}</span>
                          {selectedPartnerStore.current_debt > 0 && (
                            <span className="font-semibold text-orange-600">Hutang: {fmt(selectedPartnerStore.current_debt)}</span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={clearPartnerSelection} className="shrink-0 h-7 w-7 p-0" data-testid="clear-partner-btn">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Ketik nama kios mitra..."
                        value={partnerSearch}
                        onChange={(e) => setPartnerSearch(e.target.value)}
                        onFocus={() => setPartnerSearchFocused(true)}
                        onBlur={() => setTimeout(() => setPartnerSearchFocused(false), 200)}
                        className="pl-10"
                        data-testid="order-partner-search"
                      />
                      {partnerSearchFocused && filteredPartnerStores.length > 0 && (
                        <div className="absolute z-20 w-full bg-white border rounded-md shadow-lg mt-1 max-h-56 overflow-y-auto" data-testid="partner-search-results">
                          {filteredPartnerStores.map(store => (
                            <div
                              key={store.id}
                              className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0 transition-colors"
                              onClick={() => selectPartnerStore(store)}
                              data-testid={`partner-option-${store.id}`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm truncate">{store.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{store.owner_name}{store.address ? ` - ${store.address}` : ''}</p>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  {store.current_debt > 0 ? (
                                    <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{fmt(store.current_debt)}</span>
                                  ) : (
                                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">Lunas</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {partnerSearchFocused && partnerSearch && filteredPartnerStores.length === 0 && (
                        <div className="absolute z-20 w-full bg-white border rounded-md shadow-lg mt-1 p-3 text-center text-sm text-muted-foreground">
                          Kios mitra tidak ditemukan
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}
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
                  <Label>Cari Barang</Label>
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
                          <p className="text-xs text-muted-foreground">Stok: {whStock} {unit} | Isi/dus: {product.items_per_box || 1}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{fmt(displayPrice)}<span className="text-xs font-normal text-muted-foreground">/satuan</span></p>
                          {unit === 'dus' && <p className="text-xs text-muted-foreground">{fmt(displayPrice * (product.items_per_box || 1))}/dus</p>}
                          {customPrice !== null && <p className="text-xs text-green-600">Harga mitra</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Barter Section - Barang Toko Ambil dari Kios */}
                {orderType === 'barter' && (
                  <div className="space-y-2 border-2 border-orange-300 rounded-lg p-3 bg-orange-50/40" data-testid="barter-section">
                    <div className="flex items-center justify-between">
                      <Label className="text-orange-900 font-semibold flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4" />
                        Barang TOKO Ambil dari Kios
                      </Label>
                      <span className="text-xs text-orange-700">{barterCart.length} item</span>
                    </div>
                    <p className="text-xs text-orange-700">Stok gudang otomatis bertambah. Nilai mengurangi piutang kios (boleh sampai minus).</p>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Cari produk untuk barter dari kios..." value={barterSearch} onChange={(e) => setBarterSearch(e.target.value)} className="pl-10" data-testid="barter-search-product" />
                    </div>
                    {barterSearch.length >= 1 && (
                      <div className="border rounded-md max-h-40 overflow-y-auto bg-white">
                        {products.filter(p => p.name.toLowerCase().includes(barterSearch.toLowerCase())).slice(0, 8).map(p => (
                          <div key={p.id} className="p-2 hover:bg-orange-100 cursor-pointer border-b last:border-b-0 text-sm"
                            onClick={() => {
                              const existing = barterCart.find(b => b.product_id === p.id);
                              if (existing) {
                                setBarterCart(barterCart.map(b => b.product_id === p.id ? { ...b, quantity: b.quantity + 1 } : b));
                              } else {
                                setBarterCart([...barterCart, { product_id: p.id, product_name: p.name, quantity: 1, price: p.cost_price || 0, sell_price: p.price || 0, warehouse_id: 'gudang_toko' }]);
                              }
                              setBarterSearch('');
                            }}
                            data-testid={`barter-product-${p.id}`}>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">Isi/dus: {p.items_per_box || 1}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {barterCart.length > 0 && (
                      <div className="border rounded-lg max-h-80 overflow-y-auto bg-white">
                        {barterCart.map((b, idx) => {
                          const product = products.find(p => p.id === b.product_id);
                          const wh = warehouses.find(w => w.id === b.warehouse_id);
                          const ipb = product?.items_per_box || 1;
                          const isDus = wh?.unit === 'dus';
                          const subtotal = (b.price || 0) * (b.quantity || 0) * (isDus ? ipb : 1);
                          return (
                            <div key={idx} className="p-3 border-b last:border-b-0 space-y-2" data-testid={`barter-item-${idx}`}>
                              <div className="flex justify-between items-start">
                                <p className="text-sm font-medium flex-1">{b.product_name}</p>
                                <Button size="sm" variant="ghost" onClick={() => setBarterCart(barterCart.filter((_, i) => i !== idx))}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Gudang Tujuan</Label>
                                  <Select value={b.warehouse_id} onValueChange={(v) => setBarterCart(barterCart.map((bb, i) => i === idx ? { ...bb, warehouse_id: v } : bb))}>
                                    <SelectTrigger className="h-8 text-xs" data-testid={`barter-wh-${idx}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name} ({w.unit})</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Qty ({wh?.unit || 'satuan'})</Label>
                                  <Input type="number" min={1} value={b.quantity}
                                    onChange={(e) => setBarterCart(barterCart.map((bb, i) => i === idx ? { ...bb, quantity: parseInt(e.target.value) || 1 } : bb))}
                                    className="h-8 text-sm" data-testid={`barter-qty-${idx}`} />
                                </div>
                                <div>
                                  <Label className="text-xs">Harga Beli dari Kios (/satuan)</Label>
                                  <CurrencyInput value={b.price} onChange={(v) => setBarterCart(barterCart.map((bb, i) => i === idx ? { ...bb, price: v } : bb))} className="h-8 text-sm" data-testid={`barter-price-${idx}`} />
                                </div>
                                <div>
                                  <Label className="text-xs">Harga Jual Toko (/satuan)</Label>
                                  <CurrencyInput value={b.sell_price || 0} onChange={(v) => setBarterCart(barterCart.map((bb, i) => i === idx ? { ...bb, sell_price: v } : bb))} className="h-8 text-sm" data-testid={`barter-sell-${idx}`} />
                                </div>
                              </div>
                              <div className="flex justify-between items-center pt-1 border-t">
                                <span className="text-xs text-muted-foreground">{isDus ? `${b.quantity} dus × ${ipb} pcs × ${fmt(b.price)}` : `${b.quantity} × ${fmt(b.price)}`}</span>
                                <span className="text-sm font-semibold text-orange-700">{fmt(subtotal)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
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
                          <span className="text-xs text-muted-foreground">/satuan</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => updateQuantity(idx, item.quantity - 1)}>-</Button>
                            <Input type="number" min={1} value={item.quantity}
                              onChange={(e) => updateQuantity(idx, parseInt(e.target.value) || 1)}
                              className="w-16 h-8 text-center text-sm font-medium"
                              data-testid={`cart-qty-${idx}`}
                            />
                            <Button size="sm" variant="outline" onClick={() => updateQuantity(idx, item.quantity + 1)}>+</Button>
                            <span className="text-xs text-muted-foreground">{unit}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold">{fmt(getSubtotalForItem(item))}</span>
                            {unit === 'dus' && <p className="text-[10px] text-muted-foreground">{item.quantity} dus x {products.find(p => p.id === item.product_id)?.items_per_box || 1} pcs x {fmt(item.price)}</p>}
                          </div>
                        </div>
                        {item.quantity > stock && <p className="text-xs text-red-600">Stok tidak cukup! ({stock} {unit})</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm"><span>{orderType === 'barter' ? 'Kios Ambil dari Toko' : 'Subtotal'}:</span><span className="font-semibold">{fmt(subtotal)}</span></div>
                  {orderType === 'barter' && (
                    <>
                      <div className="flex justify-between text-sm"><span>Toko Ambil dari Kios:</span><span className="font-semibold text-orange-600">-{fmt(barterTotal)}</span></div>
                      <div className="flex justify-between text-base font-bold border-t pt-2">
                        <span>Selisih:</span>
                        <span className={barterNet >= 0 ? 'text-primary' : 'text-red-600'}>
                          {fmt(barterNet)}{barterNet < 0 ? ' (Toko hutang)' : ''}
                        </span>
                      </div>
                    </>
                  )}
                  {orderType !== 'barter' && (
                    <>
                      <div className="space-y-2">
                        <Label>Diskon</Label>
                        <CurrencyInput value={discount} onChange={(v) => setDiscount(v)} data-testid="order-discount" />
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total:</span><span className="text-primary">{fmt(total)}</span></div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Batal</Button>
                  <Button onClick={handleSubmit} className="flex-1" disabled={cart.length === 0 && !(orderType === 'barter' && barterCart.length > 0)} data-testid="submit-order-button">
                    {orderType === 'conditional' ? 'Muat ke Mobil Box' : orderType === 'barter' ? 'Catat Barter' : 'Buat Pesanan'}
                  </Button>
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
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Total Barang Dipesan</p>
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
                    {order.order_type === 'conditional' && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">KONDISIONAL</span>}
                    {order.is_settled && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">SELESAI</span>}
                    {order.status === 'cancelled' && <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">RETUR STOK</span>}
                    {order.items?.some(i => i.is_addition) && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">+TAMBAHAN</span>}
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
                      {order.status !== 'cancelled' && (
                        <Button size="sm" variant="outline" onClick={() => openAddItemDialog(order)} data-testid={`add-item-${order.id}`} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                          <Plus className="w-4 h-4 mr-1" />Tambah
                        </Button>
                      )}
                      {order.status !== 'cancelled' && order.items.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => openTransferDialog(order)} data-testid={`transfer-${order.id}`} className="text-purple-600 border-purple-200 hover:bg-purple-50">
                          <ArrowRightLeft className="w-4 h-4 mr-1" />Oper
                        </Button>
                      )}
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
              <Label>Tujuan Retur</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={!returnToVehicle ? 'default' : 'outline'}
                  onClick={() => setReturnToVehicle(false)} data-testid="return-dest-warehouse">
                  <Warehouse className="w-3.5 h-3.5 mr-1.5" />Gudang
                </Button>
                <Button type="button" size="sm" variant={returnToVehicle ? 'default' : 'outline'}
                  onClick={() => setReturnToVehicle(true)} data-testid="return-dest-vehicle">
                  <Truck className="w-3.5 h-3.5 mr-1.5" />Mobil Box
                </Button>
              </div>
              {!returnToVehicle ? (
                <Select value={returnWarehouse} onValueChange={setReturnWarehouse}>
                  <SelectTrigger data-testid="return-warehouse-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Select value={returnVehicleId} onValueChange={setReturnVehicleId}>
                  <SelectTrigger data-testid="return-vehicle-select"><SelectValue placeholder="Pilih mobil box" /></SelectTrigger>
                  <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.plate_number})</SelectItem>)}</SelectContent>
                </Select>
              )}
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

      {/* Add Item Dialog */}
      <Dialog open={!!addItemDialog} onOpenChange={(o) => !o && setAddItemDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="add-item-dialog">
          <DialogHeader><DialogTitle>Tambah Item — {addItemDialog?.order_number}</DialogTitle></DialogHeader>
          {addItemDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Kios: <span className="font-semibold text-foreground">{addItemDialog.partner_store_name}</span></p>

              {/* Search product */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Cari barang..." value={addItemSearch} onChange={(e) => setAddItemSearch(e.target.value)} className="pl-10" data-testid="add-item-search" />
              </div>
              {addItemSearch && (
                <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                  {products.filter(p => p.name.toLowerCase().includes(addItemSearch.toLowerCase())).slice(0, 8).map(p => (
                    <div key={p.id} className="p-2 hover:bg-accent cursor-pointer flex justify-between text-sm" onClick={() => { addToAddItemCart(p); setAddItemSearch(''); }}>
                      <span>{p.name}</span><span className="text-muted-foreground">{fmt(p.price)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cart */}
              {addItemCart.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-semibold">Item Tambahan:</Label>
                  {addItemCart.map((item, idx) => (
                    <div key={idx} className="p-3 border rounded-lg space-y-2" data-testid={`add-cart-item-${idx}`}>
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setAddItemCart(addItemCart.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" min={1} value={item.quantity} onChange={(e) => setAddItemCart(addItemCart.map((i, idx2) => idx2 === idx ? { ...i, quantity: parseInt(e.target.value) || 1 } : i))} className="h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Harga Jual</Label>
                          <Input type="number" min={0} value={item.price} onChange={(e) => setAddItemCart(addItemCart.map((i, idx2) => idx2 === idx ? { ...i, price: parseFloat(e.target.value) || 0 } : i))} className="h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Sumber</Label>
                          <Select value={item.source} onValueChange={(v) => setAddItemCart(addItemCart.map((i, idx2) => idx2 === idx ? { ...i, source: v, warehouse_id: v === 'external' ? '' : v } : i))}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gudang_utama">Gudang Utama</SelectItem>
                              <SelectItem value="gudang_toko">Gudang Toko</SelectItem>
                              <SelectItem value="external">Beli dari Luar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {item.source === 'external' && (
                          <div>
                            <Label className="text-xs">Harga Beli (Modal)</Label>
                            <Input type="number" min={0} value={item.external_cost} onChange={(e) => setAddItemCart(addItemCart.map((i, idx2) => idx2 === idx ? { ...i, external_cost: parseFloat(e.target.value) || 0 } : i))} className="h-8" data-testid={`ext-cost-${idx}`} />
                          </div>
                        )}
                      </div>
                      {item.source === 'external' && item.external_cost > 0 && (
                        <p className="text-xs text-amber-600">Modal: {fmt(item.external_cost * item.quantity)} — Margin: {fmt((item.price - item.external_cost) * item.quantity)}</p>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-2 bg-muted rounded-lg">
                    <span className="text-sm font-semibold">Total Tambahan</span>
                    <span className="font-bold">{fmt(addItemCart.reduce((s, i) => s + i.price * i.quantity, 0))}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddItemDialog(null)} className="flex-1">Batal</Button>
                <Button onClick={handleSubmitAddItems} className="flex-1" disabled={addItemCart.length === 0} data-testid="submit-add-items">Tambahkan</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={!!transferDialog} onOpenChange={() => setTransferDialog(null)}>
        <DialogContent className="max-w-lg" data-testid="transfer-dialog">
          <DialogHeader><DialogTitle>Oper Pesanan</DialogTitle></DialogHeader>
          {transferDialog && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <Card className="p-3 bg-muted/50">
                <p className="text-sm">Dari: <strong>{transferDialog.partner_store_name}</strong></p>
                <p className="text-xs text-muted-foreground">No. Order: {transferDialog.order_number}</p>
              </Card>

              <div className="space-y-2">
                <Label>Pilih item yang dioper:</Label>
                {transferItems.map((item, idx) => (
                  <div key={item.product_id} className={`p-3 border rounded-lg space-y-2 ${item.selected ? 'border-purple-300 bg-purple-50/50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={item.selected} onChange={e => {
                        const ni = [...transferItems]; ni[idx].selected = e.target.checked; setTransferItems(ni);
                      }} className="rounded" data-testid={`transfer-check-${idx}`} />
                      <span className="flex-1 text-sm font-medium">{item.product_name}</span>
                    </div>
                    {item.selected && (
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <div>
                          <Label className="text-xs">Jumlah (max: {item.max_qty})</Label>
                          <Input type="number" min={1} max={item.max_qty} value={item.quantity}
                            onChange={e => { const ni = [...transferItems]; ni[idx].quantity = Math.min(parseInt(e.target.value) || 1, item.max_qty); setTransferItems(ni); }}
                            className="h-8" data-testid={`transfer-qty-${idx}`} />
                        </div>
                        <div>
                          <Label className="text-xs">Harga Jual Baru</Label>
                          <CurrencyInput value={item.new_price} onChange={v => { const ni = [...transferItems]; ni[idx].new_price = v; setTransferItems(ni); }}
                            className="h-8" data-testid={`transfer-price-${idx}`} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Kios Mitra Tujuan *</Label>
                <Input placeholder="Cari kios mitra..." value={transferStoreSearch} onChange={e => setTransferStoreSearch(e.target.value)} data-testid="transfer-store-search" />
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {partnerStores.filter(s => s.id !== transferDialog.partner_store_id && (!transferStoreSearch || s.name.toLowerCase().includes(transferStoreSearch.toLowerCase()))).map(s => (
                    <div key={s.id}
                      className={`px-3 py-2 text-sm cursor-pointer ${transferStoreId === s.id ? 'bg-purple-100 font-medium' : 'hover:bg-muted'}`}
                      onClick={() => setTransferStoreId(s.id)} data-testid={`transfer-store-${s.id}`}>{s.name}</div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pembayaran</Label>
                <Select value={transferPayment} onValueChange={setTransferPayment}>
                  <SelectTrigger data-testid="transfer-payment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash / Tunai</SelectItem>
                    <SelectItem value="bon">Bon / Hutang</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm font-semibold">Total Oper: {fmt(transferItems.filter(i => i.selected).reduce((s, i) => s + i.quantity * i.new_price, 0))}</p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setTransferDialog(null)}>Batal</Button>
                <Button onClick={handleTransfer} disabled={transferSubmitting} className="bg-purple-600 hover:bg-purple-700" data-testid="submit-transfer">
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
