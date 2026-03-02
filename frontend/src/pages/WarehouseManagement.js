import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Warehouse, ArrowRightLeft, Package, Search, History } from 'lucide-react';

export const WarehouseManagement = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [showHistory, setShowHistory] = useState(false);

  const [transferForm, setTransferForm] = useState({
    product_id: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    quantity: 1,
    notes: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [whRes, prodRes, stockRes, trRes] = await Promise.all([
        api.get('/warehouses'),
        api.get('/products'),
        api.get('/warehouse-stock'),
        api.get('/stock-transfers')
      ]);
      setWarehouses(whRes.data);
      setProducts(prodRes.data);
      setWarehouseStock(stockRes.data);
      setTransfers(trRes.data);
    } catch (error) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const getStock = (productId, warehouseId) => {
    const entry = warehouseStock.find(s => s.product_id === productId && s.warehouse_id === warehouseId);
    return entry ? entry.stock : 0;
  };

  const getWarehouseUnit = (warehouseId) => {
    const wh = warehouses.find(w => w.id === warehouseId);
    return wh ? wh.unit : '';
  };

  const handleTransfer = async () => {
    const { product_id, from_warehouse_id, to_warehouse_id, quantity, notes } = transferForm;
    if (!product_id || !from_warehouse_id || !to_warehouse_id) {
      toast.error('Lengkapi semua field');
      return;
    }
    try {
      await api.post('/stock-transfers', { product_id, from_warehouse_id, to_warehouse_id, quantity, notes });
      toast.success('Transfer stok berhasil');
      setTransferDialogOpen(false);
      setTransferForm({ product_id: '', from_warehouse_id: '', to_warehouse_id: '', quantity: 1, notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal transfer stok');
    }
  };

  const fmt = (v) => new Intl.NumberFormat('id-ID').format(v);

  const filteredProducts = products.filter(p => {
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedWarehouse === 'all') return matchSearch;
    const stock = getStock(p.id, selectedWarehouse);
    return matchSearch && stock > 0;
  });

  const selectedProduct = products.find(p => p.id === transferForm.product_id);
  const fromUnit = getWarehouseUnit(transferForm.from_warehouse_id);
  const toUnit = getWarehouseUnit(transferForm.to_warehouse_id);
  const itemsPerBox = selectedProduct?.items_per_box || 1;
  let convertedQty = transferForm.quantity;
  if (fromUnit === 'dus' && toUnit === 'satuan') convertedQty = transferForm.quantity * itemsPerBox;
  else if (fromUnit === 'satuan' && toUnit === 'dus') convertedQty = Math.floor(transferForm.quantity / itemsPerBox);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="warehouse-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Manajemen Gudang</h1>
          <p className="text-sm text-muted-foreground mt-2">Kelola stok antar gudang dengan sistem dus & satuan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistory(!showHistory)} data-testid="toggle-history-btn">
            <History className="w-4 h-4 mr-2" />
            {showHistory ? 'Stok' : 'Riwayat'}
          </Button>
          <Button onClick={() => setTransferDialogOpen(true)} data-testid="transfer-stock-btn">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Transfer Stok
          </Button>
        </div>
      </div>

      {/* Warehouse Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {warehouses.map(wh => {
          const totalItems = warehouseStock.filter(s => s.warehouse_id === wh.id).reduce((sum, s) => sum + s.stock, 0);
          const productCount = warehouseStock.filter(s => s.warehouse_id === wh.id && s.stock > 0).length;
          return (
            <Card key={wh.id} className="p-6 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedWarehouse(wh.id === selectedWarehouse ? 'all' : wh.id)} data-testid={`warehouse-card-${wh.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Warehouse className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">{wh.name}</h3>
                  <p className="text-xs text-muted-foreground uppercase">{wh.unit}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-between">
                <div><p className="text-2xl font-bold">{fmt(totalItems)}</p><p className="text-xs text-muted-foreground">Total {wh.unit}</p></div>
                <div className="text-right"><p className="text-2xl font-bold">{productCount}</p><p className="text-xs text-muted-foreground">Produk</p></div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari produk..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="warehouse-search" />
        </div>
        <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
          <SelectTrigger className="w-full md:w-60" data-testid="warehouse-filter">
            <SelectValue placeholder="Semua Gudang" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Gudang</SelectItem>
            {warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!showHistory ? (
        /* Stock Table */
        <Card className="p-6">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Isi/Dus</TableHead>
                  {warehouses.map(wh => (
                    <TableHead key={wh.id} className="text-center">{wh.name}<br/><span className="text-xs font-normal">({wh.unit})</span></TableHead>
                  ))}
                  <TableHead className="text-center">Total (satuan)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={3 + warehouses.length} className="text-center py-8 text-muted-foreground"><Package className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Tidak ada produk</p></TableCell></TableRow>
                ) : filteredProducts.map(product => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-center">{product.items_per_box || 1}</TableCell>
                    {warehouses.map(wh => {
                      const stock = getStock(product.id, wh.id);
                      return (
                        <TableCell key={wh.id} className="text-center">
                          <span className={stock === 0 ? 'text-muted-foreground' : stock <= 5 ? 'text-orange-600 font-semibold' : 'font-semibold'}>
                            {fmt(stock)}
                          </span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold">{fmt(product.stock)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* Transfer History */
        <Card className="p-6" data-testid="transfer-history">
          <h2 className="text-xl font-bold mb-4">Riwayat Transfer</h2>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Dari</TableHead>
                  <TableHead>Ke</TableHead>
                  <TableHead className="text-center">Jumlah</TableHead>
                  <TableHead className="text-center">Konversi</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada transfer</TableCell></TableRow>
                ) : transfers.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.created_at).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="font-medium">{t.product_name}</TableCell>
                    <TableCell>{t.from_warehouse_name}</TableCell>
                    <TableCell>{t.to_warehouse_name}</TableCell>
                    <TableCell className="text-center">{t.quantity} {t.from_unit}</TableCell>
                    <TableCell className="text-center">{t.converted_quantity} {t.to_unit}</TableCell>
                    <TableCell>{t.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Stok Antar Gudang</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produk *</Label>
              <Select value={transferForm.product_id} onValueChange={(v) => setTransferForm({ ...transferForm, product_id: v })}>
                <SelectTrigger data-testid="transfer-product-select"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.items_per_box || 1} satuan/dus)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dari Gudang *</Label>
                <Select value={transferForm.from_warehouse_id} onValueChange={(v) => setTransferForm({ ...transferForm, from_warehouse_id: v })}>
                  <SelectTrigger data-testid="transfer-from-select"><SelectValue placeholder="Gudang asal" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name} ({transferForm.product_id ? getStock(transferForm.product_id, wh.id) : 0} {wh.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ke Gudang *</Label>
                <Select value={transferForm.to_warehouse_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_warehouse_id: v })}>
                  <SelectTrigger data-testid="transfer-to-select"><SelectValue placeholder="Gudang tujuan" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.filter(wh => wh.id !== transferForm.from_warehouse_id).map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>{wh.name} ({wh.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Jumlah ({fromUnit || '-'})</Label>
              <Input type="number" min="1" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) || 0 })} data-testid="transfer-quantity" />
            </div>
            {transferForm.from_warehouse_id && transferForm.to_warehouse_id && fromUnit !== toUnit && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  Konversi: <span className="font-bold">{transferForm.quantity} {fromUnit}</span> = <span className="font-bold">{convertedQty} {toUnit}</span>
                  {selectedProduct && <span className="text-xs ml-1">({itemsPerBox} satuan/dus)</span>}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} placeholder="Catatan opsional" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Batal</Button>
              <Button onClick={handleTransfer} data-testid="confirm-transfer-btn">
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transfer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
