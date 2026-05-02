import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Truck, Package, ShoppingCart, RotateCcw, Search, ArrowLeft, Pencil, Printer } from 'lucide-react';
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

  // Product search (masih dipakai oleh lainnya)
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
  const [returnDus, setReturnDus] = useState(0);
  const [returnPcs, setReturnPcs] = useState(0);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

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
    if (returnDus <= 0 && returnPcs <= 0) { toast.error('Masukkan jumlah retur'); return; }
    setReturnSubmitting(true);
    try {
      // Retur dus ke gudang_utama
      if (returnDus > 0) {
        await api.post(`/vehicle-stock/${returnModal.id}/return`, {
          quantity: returnDus,
          notes: returnNotes || 'Retur dus',
          warehouse_id: 'gudang_utama'
        });
      }
      // Retur satuan ke gudang_toko
      if (returnPcs > 0) {
        await api.post(`/vehicle-stock/${returnModal.id}/return`, {
          quantity: returnPcs,
          notes: returnNotes || 'Retur satuan',
          warehouse_id: 'gudang_toko'
        });
      }
      toast.success(`Berhasil retur${returnDus > 0 ? ` ${returnDus} dus` : ''}${returnDus > 0 && returnPcs > 0 ? ' +' : ''}${returnPcs > 0 ? ` ${returnPcs} pcs` : ''}`);
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

  const handlePrintStock = async () => {
    if (!activeVehicle) return;
    // Fetch today's partner orders for this vehicle's canvasser
    let todayOrders = [];
    try {
      const res = await api.get('/partner-orders');
      const today = new Date().toISOString().slice(0, 10);
      todayOrders = res.data.filter(o =>
        o.created_at?.slice(0, 10) === today &&
        o.status !== 'cancelled'
      );
    } catch {}

    // Collect today's order items by product
    const todayItemsMap = {};
    for (const order of todayOrders) {
      for (const item of order.items || []) {
        const key = item.product_id;
        if (!todayItemsMap[key]) {
          todayItemsMap[key] = { product_id: item.product_id, product_name: item.product_name, qty: 0, price: item.price || 0, stores: [] };
        }
        todayItemsMap[key].qty += item.quantity;
        if (!todayItemsMap[key].stores.includes(order.partner_store_name)) {
          todayItemsMap[key].stores.push(order.partner_store_name);
        }
      }
    }

    // Identify new items (loaded today)
    const today = new Date().toISOString().slice(0, 10);
    const fN = (v) => new Intl.NumberFormat('id-ID').format(v || 0);
    const fC = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

    const stockRows = activeStocks.map(s => {
      const isNew = s.loaded_at?.slice(0, 10) === today;
      const prod = products.find(p => p.id === s.product_id);
      const ipb = prod?.items_per_box || 1;
      const costPrice = prod?.cost_price || prod?.supplier_cost_price || 0;
      const dusFull = Math.floor(s.remaining_qty / ipb);
      const pcsSisa = s.remaining_qty % ipb;
      const stokLabel = dusFull > 0 ? `${dusFull} dus${pcsSisa > 0 ? ` + ${pcsSisa} pcs` : ''}` : `${s.remaining_qty} pcs`;
      const nilai = s.remaining_qty * (s.price || 0);
      const nilaiPokok = s.remaining_qty * costPrice;
      return `<tr class="${isNew ? 'new-item' : ''}">
        <td>${s.product_name}</td>
        <td class="c">${fN(s.quantity)}</td>
        <td class="c">${fN(s.sold_qty)}</td>
        <td class="c">${fN(s.returned_qty)}</td>
        <td class="c">${fN(s.remaining_qty)}</td>
        <td class="c">${stokLabel}</td>
        <td class="r">${fC(costPrice)}</td>
        <td class="r">${fC(s.price)}</td>
        <td class="r">${fC(nilaiPokok)}</td>
        <td class="r">${fC(nilai)}</td>
      </tr>`;
    }).join('');

    const orderRows = Object.values(todayItemsMap).map(item => {
      const prod = products.find(p => p.id === item.product_id);
      const costPrice = prod?.cost_price || prod?.supplier_cost_price || 0;
      return `<tr>
        <td>${item.product_name}</td>
        <td class="c">${fN(item.qty)}</td>
        <td class="r">${fC(costPrice)}</td>
        <td class="r">${fC(item.price)}</td>
        <td class="r">${fC(item.qty * item.price)}</td>
        <td>${item.stores.join(', ')}</td>
      </tr>`;
    }).join('');

    const totalNilai = activeStocks.reduce((s, st) => s + st.remaining_qty * (st.price || 0), 0);
    const totalNilaiPokok = activeStocks.reduce((s, st) => {
      const prod = products.find(p => p.id === st.product_id);
      const cp = prod?.cost_price || prod?.supplier_cost_price || 0;
      return s + st.remaining_qty * cp;
    }, 0);
    const totalNilaiPesanan = Object.values(todayItemsMap).reduce((s, item) => s + item.qty * item.price, 0);
    const totalNilaiPokokPesanan = Object.values(todayItemsMap).reduce((s, item) => {
      const prod = products.find(p => p.id === item.product_id);
      const cp = prod?.cost_price || prod?.supplier_cost_price || 0;
      return s + item.qty * cp;
    }, 0);

    const html = `<!DOCTYPE html><html><head><title>Stok ${activeVehicle.vehicle_name}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 15mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#1a1a2e; font-size:9pt; line-height:1.4; }

  .header { display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:10pt; border-bottom:3pt solid #16213e; margin-bottom:12pt; }
  .header h1 { font-size:16pt; color:#16213e; font-weight:800; letter-spacing:0.5pt; }
  .header .subtitle { font-size:9pt; color:#555; margin-top:2pt; }
  .header .date-box { text-align:right; }
  .header .date-box .date { font-size:11pt; font-weight:700; color:#16213e; }
  .header .date-box .plate { font-size:9pt; color:#666; }

  .section-title { font-size:11pt; font-weight:700; color:#16213e; margin:14pt 0 6pt; padding-left:8pt; border-left:4pt solid #0f3460; }

  table { width:100%; border-collapse:collapse; margin-bottom:10pt; }
  thead th { background:#16213e; color:#fff; font-size:7.5pt; font-weight:600; text-transform:uppercase; letter-spacing:0.3pt; padding:5pt 4pt; text-align:left; }
  thead th.c { text-align:center; }
  thead th.r { text-align:right; }
  tbody td { padding:4pt 4pt; font-size:8pt; border-bottom:1pt solid #e8e8e8; }
  tbody tr:nth-child(even) { background:#f8f9fa; }
  tbody td.c { text-align:center; }
  tbody td.r { text-align:right; font-variant-numeric:tabular-nums; }
  tbody tr.new-item { background:#e8f5e9 !important; }
  tbody tr.new-item td:first-child::after { content:" BARU"; font-size:6.5pt; color:#2e7d32; font-weight:700; background:#c8e6c9; padding:1pt 3pt; border-radius:3pt; margin-left:3pt; }

  .total-row td { background:#16213e !important; color:#fff !important; font-weight:700; font-size:8pt; padding:6pt 4pt; }

  .legend { font-size:7.5pt; color:#666; margin-top:6pt; display:flex; align-items:center; gap:6pt; }
  .legend .badge { background:#e8f5e9; color:#2e7d32; padding:2pt 6pt; border-radius:3pt; font-weight:700; font-size:7pt; }

  .footer { margin-top:14pt; padding-top:8pt; border-top:1pt solid #ddd; font-size:7.5pt; color:#999; display:flex; justify-content:space-between; }

  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>

<div class="header">
  <div>
    <h1>STOK MOBIL BOX</h1>
    <div class="subtitle">${activeVehicle.vehicle_name} &bull; ${activeStocks.length} jenis barang</div>
  </div>
  <div class="date-box">
    <div class="date">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
    <div class="plate">${activeVehicle.plate_number}</div>
  </div>
</div>

<div class="section-title">Stok Kendaraan</div>
<table>
  <thead><tr>
    <th style="width:22%">Nama Barang</th>
    <th class="c" style="width:6%">Muat</th>
    <th class="c" style="width:6%">Jual</th>
    <th class="c" style="width:6%">Retur</th>
    <th class="c" style="width:7%">Sisa</th>
    <th class="c" style="width:11%">Konversi</th>
    <th class="r" style="width:10%">Hrg Pokok</th>
    <th class="r" style="width:10%">Hrg Jual</th>
    <th class="r" style="width:11%">Nilai Pokok</th>
    <th class="r" style="width:11%">Nilai Jual</th>
  </tr></thead>
  <tbody>${stockRows}
    <tr class="total-row"><td colspan="8" style="text-align:right">TOTAL</td><td class="r">${fC(totalNilaiPokok)}</td><td class="r">${fC(totalNilai)}</td></tr>
  </tbody>
</table>

<div class="legend"><span class="badge">BARU</span> Barang baru dimuat hari ini</div>

${orderRows ? `
<div class="section-title">Pesanan Kios Hari Ini</div>
<table>
  <thead><tr>
    <th style="width:28%">Nama Barang</th>
    <th class="c" style="width:8%">Qty</th>
    <th class="r" style="width:14%">Hrg Pokok</th>
    <th class="r" style="width:14%">Hrg Jual</th>
    <th class="r" style="width:14%">Total</th>
    <th style="width:22%">Kios Mitra</th>
  </tr></thead>
  <tbody>${orderRows}
    <tr class="total-row"><td colspan="2" style="text-align:right">TOTAL</td><td class="r">${fC(totalNilaiPokokPesanan)}</td><td></td><td class="r">${fC(totalNilaiPesanan)}</td><td></td></tr>
  </tbody>
</table>` : ''}

<div class="footer">
  <span>UD. AQIN TANI - Stok Mobil Box</span>
  <span>Dicetak: ${new Date().toLocaleString('id-ID')}</span>
</div>

</body></html>`;

    const win = window.open('', '_blank', 'width=1100,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Memuat data...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="vehicle-stock-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="vehicle-stock-title">Stok Mobil Box</h1>
          <p className="text-sm text-muted-foreground">Kelola barang kondisional di kendaraan</p>
        </div>
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Package className="w-5 h-5" />
              Stok di {activeVehicle.vehicle_name}
            </h2>
            <Button size="sm" variant="outline" onClick={handlePrintStock} data-testid="print-stock-btn">
              <Printer className="w-4 h-4 mr-1.5" /> Cetak Stok
            </Button>
          </div>
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
                    <th className="pb-2 font-medium text-center">Sisa<br/><span className="text-xs font-normal">(pcs)</span></th>
                    <th className="pb-2 font-medium text-center">Dus</th>
                    <th className="pb-2 font-medium text-center">Satuan</th>
                    <th className="pb-2 font-medium text-right">Harga</th>
                    <th className="pb-2 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStocks.map(s => {
                    const prod = products.find(p => p.id === s.product_id);
                    const ipb = prod?.items_per_box || 1;
                    const dusFull = Math.floor(s.remaining_qty / ipb);
                    const pcsSisa = s.remaining_qty % ipb;
                    return (
                    <tr key={s.id} className="border-b last:border-0" data-testid={`stock-row-${s.id}`}>
                      <td className="py-2 font-medium">{s.product_name}</td>
                      <td className="py-2 text-center">{s.quantity}</td>
                      <td className="py-2 text-center text-green-600">{s.sold_qty}</td>
                      <td className="py-2 text-center text-orange-600">{s.returned_qty}</td>
                      <td className="py-2 text-center font-bold">{s.remaining_qty}</td>
                      <td className="py-2 text-center font-semibold text-blue-700">{dusFull > 0 ? dusFull : '-'}</td>
                      <td className="py-2 text-center font-semibold text-amber-700">{pcsSisa > 0 ? pcsSisa : (dusFull === 0 ? s.remaining_qty : '-')}</td>
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
                          onClick={() => { setReturnModal(s); setReturnDus(0); setReturnPcs(0); setReturnNotes(''); }}
                          data-testid={`return-btn-${s.id}`}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Retur
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Load Modal */}
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
          {returnModal && (() => {
            const product = products.find(p => p.id === returnModal.product_id);
            const ipb = product?.items_per_box || 1;
            const maxDus = Math.floor(returnModal.remaining_qty / ipb);
            const maxPcsAfterDus = returnModal.remaining_qty - (returnDus * ipb);
            return (
            <div className="space-y-4">
              <Card className="p-3 bg-muted/50">
                <p className="font-semibold">{returnModal.product_name}</p>
                <p className="text-sm text-muted-foreground">Sisa di mobil: <span className="font-bold">{returnModal.remaining_qty} pcs</span></p>
                {ipb > 1 && (
                  <p className="text-xs text-muted-foreground mt-0.5">1 dus = {ipb} pcs &bull; Maks {maxDus} dus + {returnModal.remaining_qty - maxDus * ipb} pcs</p>
                )}
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Retur Dus
                    <span className="text-xs font-normal text-blue-600">&rarr; Gudang Utama</span>
                  </Label>
                  <Input type="number" min={0} max={maxDus} value={returnDus}
                    onChange={e => {
                      const v = Math.min(parseInt(e.target.value) || 0, maxDus);
                      setReturnDus(v);
                      // Auto-correct pcs if over limit
                      const leftover = returnModal.remaining_qty - v * ipb;
                      if (returnPcs > leftover) setReturnPcs(leftover);
                    }}
                    disabled={maxDus === 0}
                    className={maxDus === 0 ? 'opacity-50' : ''}
                    data-testid="return-dus-input" />
                  {maxDus === 0 && <p className="text-[10px] text-amber-600">Stok kurang dari 1 dus ({ipb} pcs)</p>}
                  {returnDus > 0 && <p className="text-[10px] text-muted-foreground">{returnDus} dus = {returnDus * ipb} pcs</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Retur Satuan
                    <span className="text-xs font-normal text-amber-600">&rarr; Gudang Toko</span>
                  </Label>
                  <Input type="number" min={0} max={Math.max(0, maxPcsAfterDus)} value={returnPcs}
                    onChange={e => setReturnPcs(Math.min(parseInt(e.target.value) || 0, Math.max(0, maxPcsAfterDus)))}
                    data-testid="return-pcs-input" />
                  {returnPcs > 0 && <p className="text-[10px] text-muted-foreground">{returnPcs} pcs</p>}
                </div>
              </div>

              {(returnDus > 0 || returnPcs > 0) && (
                <Card className="p-2.5 bg-blue-50 border-blue-200 text-xs">
                  <p className="font-medium text-blue-900">Total retur: {returnDus * ipb + returnPcs} pcs dari {returnModal.remaining_qty} pcs</p>
                  {returnDus > 0 && <p className="text-blue-700">&bull; {returnDus} dus &rarr; Gudang Utama</p>}
                  {returnPcs > 0 && <p className="text-blue-700">&bull; {returnPcs} pcs &rarr; Gudang Toko</p>}
                </Card>
              )}

              <div className="space-y-1.5">
                <Label>Catatan</Label>
                <Input value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Opsional..." data-testid="return-notes-input" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setReturnModal(null)}>Batal</Button>
                <Button onClick={handleReturn} disabled={returnSubmitting || (returnDus <= 0 && returnPcs <= 0)} data-testid="submit-return-btn">
                  {returnSubmitting ? 'Memproses...' : 'Retur'}
                </Button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
};
