import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Truck, Package, Plus, ShoppingCart, RotateCcw, Search, ArrowLeft, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CurrencyInput } from '../components/CurrencyInput';

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

export const VehicleStock = () => {
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [partnerStores, setPartnerStores] = useState([]);

  // Load modal
  const [loadModal, setLoadModal] = useState(false);
  const [loadVehicleId, setLoadVehicleId] = useState('');
  const [loadItems, setLoadItems] = useState([]);
  const [loadNotes, setLoadNotes] = useState('');
  const [loadSubmitting, setLoadSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);

  // Sell modal
  const [sellModal, setSellModal] = useState(null);
  const [sellQty, setSellQty] = useState(0);
  const [sellStoreId, setSellStoreId] = useState('');
  const [sellPayment, setSellPayment] = useState('bon');
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  // Return modal
  const [returnModal, setReturnModal] = useState(null);
  const [returnQty, setReturnQty] = useState(0);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnWarehouse, setReturnWarehouse] = useState('');

  // Edit price
  const [editPriceModal, setEditPriceModal] = useState(null);
  const [editPrice, setEditPrice] = useState(0);
  const [editPriceSubmitting, setEditPriceSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, vehRes, storeRes, whRes] = await Promise.all([
        api.get('/vehicle-stock/summary'),
        api.get('/vehicles'),
        api.get('/partner-stores'),
        api.get('/warehouses')
      ]);
      setSummaries(sumRes.data);
      setVehicles(vehRes.data);
      setPartnerStores(storeRes.data);
      setWarehouses(whRes.data);
    } catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const searchProducts = async (q) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    try {
      const res = await api.get(`/products/search?q=${encodeURIComponent(q)}`);
      setProductResults(res.data);
    } catch { setProductResults([]); }
  };

  const addLoadItem = (product) => {
    if (loadItems.find(i => i.product_id === product.id)) {
      toast.error('Produk sudah ada di daftar');
      return;
    }
    setLoadItems([...loadItems, {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      price: product.sell_price || 0,
      warehouse_id: warehouses.length > 0 ? warehouses[0].id : 'gudang_toko'
    }]);
    setProductSearch('');
    setProductResults([]);
  };

  const handleLoad = async () => {
    if (!loadVehicleId || loadItems.length === 0) {
      toast.error('Pilih kendaraan dan tambahkan barang');
      return;
    }
    setLoadSubmitting(true);
    try {
      await api.post('/vehicle-stock/load', {
        vehicle_id: loadVehicleId,
        items: loadItems,
        notes: loadNotes
      });
      toast.success('Barang berhasil dimuat ke kendaraan');
      setLoadModal(false);
      setLoadItems([]);
      setLoadNotes('');
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal memuat barang'); }
    finally { setLoadSubmitting(false); }
  };

  const handleSell = async () => {
    if (!sellStoreId || sellQty <= 0) {
      toast.error('Pilih kios mitra dan jumlah');
      return;
    }
    setSellSubmitting(true);
    try {
      // Save edited price first
      await api.put(`/vehicle-stock/${sellModal.id}/edit-price`, { price: sellModal.price });
      await api.post(`/vehicle-stock/${sellModal.id}/sell`, {
        partner_store_id: sellStoreId,
        quantity: sellQty,
        payment_type: sellPayment
      });
      toast.success('Penjualan berhasil dicatat');
      setSellModal(null);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal menjual'); }
    finally { setSellSubmitting(false); }
  };

  const handleReturn = async () => {
    if (returnQty <= 0) { toast.error('Jumlah retur harus > 0'); return; }
    setReturnSubmitting(true);
    try {
      await api.post(`/vehicle-stock/${returnModal.id}/return`, {
        quantity: returnQty,
        notes: returnNotes,
        warehouse_id: returnWarehouse
      });
      toast.success('Barang berhasil diretur ke gudang');
      setReturnModal(null);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal meretur'); }
    finally { setReturnSubmitting(false); }
  };

  const handleEditPrice = async () => {
    if (editPrice < 0) { toast.error('Harga tidak boleh negatif'); return; }
    setEditPriceSubmitting(true);
    try {
      await api.put(`/vehicle-stock/${editPriceModal.id}/edit-price`, { price: editPrice });
      toast.success('Harga berhasil diubah');
      setEditPriceModal(null);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal mengubah harga'); }
    finally { setEditPriceSubmitting(false); }
  };

  const filteredStores = storeSearch
    ? partnerStores.filter(s => s.name.toLowerCase().includes(storeSearch.toLowerCase()))
    : partnerStores;

  const activeVehicle = selectedVehicle ? summaries.find(s => s.vehicle_id === selectedVehicle) : null;
  const activeStocks = activeVehicle ? activeVehicle.stocks.filter(s => s.remaining_qty > 0) : [];

  if (loading) return <div className="p-8 text-center text-muted-foreground">Memuat data...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="vehicle-stock-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="vehicle-stock-title">Stok Mobil Box</h1>
          <p className="text-sm text-muted-foreground">Kelola barang kondisional di kendaraan</p>
        </div>
        <Button onClick={() => { setLoadModal(true); setLoadVehicleId(vehicles[0]?.id || ''); }} data-testid="load-vehicle-btn">
          <Plus className="w-4 h-4 mr-1" /> Muat Barang
        </Button>
      </div>

      {/* Vehicle Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map(v => (
          <Card
            key={v.vehicle_id}
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${selectedVehicle === v.vehicle_id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setSelectedVehicle(selectedVehicle === v.vehicle_id ? null : v.vehicle_id)}
            data-testid={`vehicle-card-${v.vehicle_id}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{v.vehicle_name}</p>
                <p className="text-xs text-muted-foreground">{v.plate_number}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-end">
              <div>
                <p className="text-xs text-muted-foreground">Jenis Barang</p>
                <p className="font-bold text-lg">{v.total_items}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Nilai Stok</p>
                <p className="font-bold text-lg text-primary">{fmt(v.total_value)}</p>
              </div>
            </div>
          </Card>
        ))}
        {summaries.length === 0 && (
          <Card className="p-8 col-span-full text-center text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Belum ada kendaraan terdaftar</p>
          </Card>
        )}
      </div>

      {/* Selected Vehicle Stock Detail */}
      {activeVehicle && (
        <Card className="p-4" data-testid="vehicle-stock-detail">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Stok di {activeVehicle.vehicle_name}
          </h2>
          {activeStocks.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Tidak ada stok aktif</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Produk</th>
                    <th className="pb-2 font-medium text-center">Muat</th>
                    <th className="pb-2 font-medium text-center">Terjual</th>
                    <th className="pb-2 font-medium text-center">Retur</th>
                    <th className="pb-2 font-medium text-center">Sisa</th>
                    <th className="pb-2 font-medium text-right">Harga</th>
                    <th className="pb-2 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStocks.map(s => (
                    <tr key={s.id} className="border-b last:border-0" data-testid={`stock-row-${s.id}`}>
                      <td className="py-2 font-medium">{s.product_name}</td>
                      <td className="py-2 text-center">{s.quantity}</td>
                      <td className="py-2 text-center text-green-600">{s.sold_qty}</td>
                      <td className="py-2 text-center text-orange-600">{s.returned_qty}</td>
                      <td className="py-2 text-center font-bold">{s.remaining_qty}</td>
                      <td className="py-2 text-right">{fmt(s.price)}</td>
                      <td className="py-2 text-right space-x-1">
                        <Button
                          size="sm" variant="outline"
                          onClick={() => { setSellModal(s); setSellQty(1); setSellStoreId(''); setSellPayment('bon'); setStoreSearch(''); }}
                          data-testid={`sell-btn-${s.id}`}
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" /> Jual
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => { setReturnModal(s); setReturnQty(s.remaining_qty); setReturnNotes(''); setReturnWarehouse(warehouses[0]?.id || 'gudang_toko'); }}
                          data-testid={`return-btn-${s.id}`}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Retur
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Load Modal */}
      <Dialog open={loadModal} onOpenChange={setLoadModal}>
        <DialogContent className="max-w-lg" data-testid="load-modal">
          <DialogHeader><DialogTitle>Muat Barang ke Kendaraan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kendaraan</Label>
              <Select value={loadVehicleId} onValueChange={setLoadVehicleId}>
                <SelectTrigger data-testid="load-vehicle-select"><SelectValue placeholder="Pilih kendaraan" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.plate_number})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cari Produk</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Ketik nama produk..."
                  value={productSearch}
                  onChange={e => searchProducts(e.target.value)}
                  data-testid="load-product-search"
                />
              </div>
              {productResults.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {productResults.map(p => (
                    <div key={p.id} className="px-3 py-2 hover:bg-muted cursor-pointer text-sm" onClick={() => addLoadItem(p)} data-testid={`search-result-${p.id}`}>
                      {p.name} — {fmt(p.sell_price)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loadItems.length > 0 && (
              <div className="space-y-2">
                <Label>Daftar Barang</Label>
                {loadItems.map((item, i) => (
                  <div key={item.product_id} className="flex items-center gap-2 p-2 border rounded-md text-sm">
                    <span className="flex-1 font-medium">{item.product_name}</span>
                    <Input
                      type="number" min="1" className="w-20 text-center"
                      value={item.quantity}
                      onChange={e => {
                        const ni = [...loadItems];
                        ni[i].quantity = parseInt(e.target.value) || 1;
                        setLoadItems(ni);
                      }}
                      data-testid={`load-qty-${item.product_id}`}
                    />
                    <span className="text-xs text-muted-foreground">pcs</span>
                    <CurrencyInput
                      value={item.price}
                      onChange={v => {
                        const ni = [...loadItems];
                        ni[i].price = v;
                        setLoadItems(ni);
                      }}
                      className="w-32"
                    />
                    <Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0" onClick={() => setLoadItems(loadItems.filter((_, j) => j !== i))}>
                      &times;
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input value={loadNotes} onChange={e => setLoadNotes(e.target.value)} placeholder="Opsional..." />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLoadModal(false)}>Batal</Button>
              <Button onClick={handleLoad} disabled={loadSubmitting || loadItems.length === 0} data-testid="submit-load-btn">
                {loadSubmitting ? 'Memuat...' : `Muat ${loadItems.length} Item`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sell Modal */}
      <Dialog open={!!sellModal} onOpenChange={() => setSellModal(null)}>
        <DialogContent className="max-w-md" data-testid="sell-modal">
          <DialogHeader><DialogTitle>Jual ke Kios Mitra</DialogTitle></DialogHeader>
          {sellModal && (
            <div className="space-y-4">
              <Card className="p-3 bg-muted/50">
                <p className="font-semibold">{sellModal.product_name}</p>
                <p className="text-sm text-muted-foreground">Sisa: {sellModal.remaining_qty} pcs | Harga: {fmt(sellModal.price)}</p>
              </Card>

              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input type="number" min={1} max={sellModal.remaining_qty} value={sellQty} onChange={e => setSellQty(parseInt(e.target.value) || 0)} data-testid="sell-qty-input" />
              </div>

              <div className="space-y-2">
                <Label>Harga Jual</Label>
                <CurrencyInput value={sellModal.price} onChange={v => setSellModal({...sellModal, price: v})} data-testid="sell-price-input" />
                <p className="text-xs text-muted-foreground">Subtotal: {fmt(sellQty * (sellModal?.price || 0))}</p>
              </div>

              <div className="space-y-2">
                <Label>Kios Mitra</Label>
                <Input placeholder="Cari kios mitra..." value={storeSearch} onChange={e => setStoreSearch(e.target.value)} data-testid="sell-store-search" />
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {filteredStores.map(s => (
                    <div
                      key={s.id}
                      className={`px-3 py-2 text-sm cursor-pointer ${sellStoreId === s.id ? 'bg-primary/10 font-medium' : 'hover:bg-muted'}`}
                      onClick={() => setSellStoreId(s.id)}
                      data-testid={`store-option-${s.id}`}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pembayaran</Label>
                <Select value={sellPayment} onValueChange={setSellPayment}>
                  <SelectTrigger data-testid="sell-payment-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash / Tunai</SelectItem>
                    <SelectItem value="bon">Bon / Hutang</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSellModal(null)}>Batal</Button>
                <Button onClick={handleSell} disabled={sellSubmitting || !sellStoreId} data-testid="submit-sell-btn">
                  {sellSubmitting ? 'Memproses...' : 'Jual'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Modal */}
      <Dialog open={!!returnModal} onOpenChange={() => setReturnModal(null)}>
        <DialogContent className="max-w-sm" data-testid="return-modal">
          <DialogHeader><DialogTitle>Retur ke Gudang</DialogTitle></DialogHeader>
          {returnModal && (
            <div className="space-y-4">
              <Card className="p-3 bg-muted/50">
                <p className="font-semibold">{returnModal.product_name}</p>
                <p className="text-sm text-muted-foreground">Sisa di mobil: {returnModal.remaining_qty} pcs</p>
              </Card>
              <div className="space-y-2">
                <Label>Jumlah Retur</Label>
                <Input type="number" min={1} max={returnModal.remaining_qty} value={returnQty} onChange={e => setReturnQty(parseInt(e.target.value) || 0)} data-testid="return-qty-input" />
              </div>
              <div className="space-y-2">
                <Label>Gudang Tujuan</Label>
                <Select value={returnWarehouse} onValueChange={setReturnWarehouse}>
                  <SelectTrigger data-testid="return-warehouse-select"><SelectValue placeholder="Pilih gudang" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name} ({wh.unit})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Input value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Opsional..." data-testid="return-notes-input" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setReturnModal(null)}>Batal</Button>
                <Button onClick={handleReturn} disabled={returnSubmitting} data-testid="submit-return-btn">
                  {returnSubmitting ? 'Memproses...' : 'Retur'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};
