import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Package, ArrowRightLeft, Filter, AlertTriangle } from 'lucide-react';
import { CurrencyInput } from '../components/CurrencyInput';

export const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterWarehouse, setFilterWarehouse] = useState('all');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Transfer
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    product_id: '', from_warehouse_id: '', to_warehouse_id: '', quantity: 1, notes: ''
  });

  const [formData, setFormData] = useState({
    name: '', barcode: '', category_id: '', supplier_id: '',
    stock: 0, warehouse_id: 'gudang_utama', price: 0, cost_price: 0,
    box_price: 0, items_per_box: 1, initial_paid: 0, expiry_date: '', batch_number: '',
    description: '', min_stock_alert: 10
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [productsRes, categoriesRes, suppliersRes, whRes, stockRes] = await Promise.all([
        api.get('/products'), api.get('/categories'), api.get('/suppliers'),
        api.get('/warehouses'), api.get('/warehouse-stock')
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setSuppliers(suppliersRes.data);
      setWarehouses(whRes.data);
      setWarehouseStock(stockRes.data);
    } catch (error) {
      toast.error('Gagal memuat data');
    } finally { setLoading(false); }
  };

  const getStock = (productId, warehouseId) => {
    const entry = warehouseStock.find(s => s.product_id === productId && s.warehouse_id === warehouseId);
    return entry ? entry.stock : 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, formData);
        toast.success('Produk berhasil diperbarui');
      } else {
        await api.post('/products', formData);
        toast.success('Produk berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan produk');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus produk ini?')) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Produk berhasil dihapus');
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus produk');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name, barcode: product.barcode, category_id: product.category_id,
      supplier_id: product.supplier_id, stock: product.stock, warehouse_id: 'gudang_utama',
      price: product.price, cost_price: product.cost_price,
      box_price: product.box_price || 0, items_per_box: product.items_per_box || 1,
      expiry_date: product.expiry_date, batch_number: product.batch_number,
      description: product.description, min_stock_alert: product.min_stock_alert
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '', barcode: '', category_id: '', supplier_id: '',
      stock: 0, warehouse_id: 'gudang_utama', price: 0, cost_price: 0,
      box_price: 0, items_per_box: 1, initial_paid: 0, expiry_date: '', batch_number: '',
      description: '', min_stock_alert: 10
    });
  };

  const openTransfer = (product) => {
    setTransferForm({ product_id: product.id, from_warehouse_id: '', to_warehouse_id: '', quantity: 1, notes: '' });
    setTransferDialogOpen(true);
  };

  const handleTransfer = async () => {
    const { product_id, from_warehouse_id, to_warehouse_id, quantity, notes } = transferForm;
    if (!product_id || !from_warehouse_id || !to_warehouse_id) {
      toast.error('Lengkapi semua field'); return;
    }
    try {
      await api.post('/stock-transfers', { product_id, from_warehouse_id, to_warehouse_id, quantity, notes });
      toast.success('Transfer stok berhasil');
      setTransferDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal transfer stok');
    }
  };

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '-';
  const getSupplierName = (id) => suppliers.find(s => s.id === id)?.name || '-';
  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
  const fmtNum = (v) => new Intl.NumberFormat('id-ID').format(v);

  const filteredProducts = products.filter(p => {
    const matchSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCategory === 'all' || p.category_id === filterCategory;
    const matchSup = filterSupplier === 'all' || p.supplier_id === filterSupplier;
    const matchLow = !filterLowStock || p.stock <= p.min_stock_alert;
    let matchWh = true;
    if (filterWarehouse !== 'all') {
      matchWh = getStock(p.id, filterWarehouse) > 0;
    }
    return matchSearch && matchCat && matchSup && matchLow && matchWh;
  });

  const activeFilters = (filterCategory !== 'all' ? 1 : 0) + (filterSupplier !== 'all' ? 1 : 0) + (filterWarehouse !== 'all' ? 1 : 0) + (filterLowStock ? 1 : 0);

  const transferProduct = products.find(p => p.id === transferForm.product_id);
  const fromWh = warehouses.find(w => w.id === transferForm.from_warehouse_id);
  const toWh = warehouses.find(w => w.id === transferForm.to_warehouse_id);
  const ipb = transferProduct?.items_per_box || 1;
  let convertedQty = transferForm.quantity;
  if (fromWh && toWh) {
    if (fromWh.unit === 'dus' && toWh.unit === 'satuan') convertedQty = transferForm.quantity * ipb;
    else if (fromWh.unit === 'satuan' && toWh.unit === 'dus') convertedQty = Math.floor(transferForm.quantity / ipb);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="products-page">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Produk</h1>
            <p className="text-sm text-muted-foreground mt-1">Kelola produk, stok gudang & transfer</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="w-auto self-start" data-testid="add-product-button">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Produk
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Produk *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="product-name-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input id="barcode" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} data-testid="product-barcode-input" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                    <SelectTrigger data-testid="product-category-select"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select value={formData.supplier_id} onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}>
                    <SelectTrigger data-testid="product-supplier-select"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                    <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!editingProduct && (
                  <>
                    <div className="space-y-2">
                      <Label>Stok Awal (dus)</Label>
                      <Input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })} data-testid="product-stock-input" />
                    </div>
                    <div className="space-y-2">
                      <Label>Gudang Tujuan</Label>
                      <Select value={formData.warehouse_id} onValueChange={(v) => setFormData({ ...formData, warehouse_id: v })}>
                        <SelectTrigger data-testid="product-warehouse-select"><SelectValue /></SelectTrigger>
                        <SelectContent>{warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name} ({wh.unit})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Isi per Dus *</Label>
                  <Input type="number" min="1" value={formData.items_per_box} onChange={(e) => setFormData({ ...formData, items_per_box: parseInt(e.target.value) || 1 })} required data-testid="product-items-per-box-input" />
                </div>
              </div>
              {formData.stock > 0 && formData.items_per_box > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">{formData.stock} dus x {formData.items_per_box} satuan/dus = <span className="font-bold">{formData.stock * formData.items_per_box} satuan</span> masuk ke {warehouses.find(w => w.id === formData.warehouse_id)?.name || 'gudang'}</p>
                </div>
              )}
              {!editingProduct && formData.stock > 0 && formData.supplier_id && formData.cost_price > 0 && (() => {
                const totalPurchase = formData.cost_price * formData.stock;
                const paid = Math.min(formData.initial_paid || 0, totalPurchase);
                const debt = totalPurchase - paid;
                return (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                    <p className="text-sm font-semibold text-amber-900">Pembelian Otomatis ke Supplier</p>
                    <div className="flex items-center justify-between text-sm text-amber-800">
                      <span>Total: {fmt(totalPurchase)}</span>
                      <span>({formData.stock} dus x {fmt(formData.cost_price)}/dus)</span>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-900">Bayar di Muka</Label>
                      <CurrencyInput
                        value={formData.initial_paid}
                        onChange={(v) => setFormData({ ...formData, initial_paid: v })}
                        data-testid="product-initial-paid-input"
                      />
                    </div>
                    {debt > 0 ? (
                      <p className="text-sm font-medium text-red-700">Sisa hutang: {fmt(debt)}</p>
                    ) : (
                      <p className="text-sm font-medium text-green-700">Lunas</p>
                    )}
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Harga Beli/Dus *</Label>
                  <CurrencyInput value={formData.cost_price} onChange={(v) => setFormData({ ...formData, cost_price: v })} required data-testid="product-cost-input" />
                </div>
                <div className="space-y-2">
                  <Label>Harga Jual Satuan *</Label>
                  <CurrencyInput value={formData.price} onChange={(v) => setFormData({ ...formData, price: v })} required data-testid="product-price-input" />
                </div>
                <div className="space-y-2">
                  <Label>Harga Jual/Dus</Label>
                  <CurrencyInput value={formData.box_price} onChange={(v) => setFormData({ ...formData, box_price: v })} data-testid="product-box-price-input" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Kadaluarsa</Label>
                  <Input type="date" value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>No. Batch</Label>
                  <Input value={formData.batch_number} onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Min. Stok Alert</Label>
                  <Input type="number" value={formData.min_stock_alert} onChange={(e) => setFormData({ ...formData, min_stock_alert: parseInt(e.target.value) || 10 })} />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                <Button type="submit" data-testid="product-submit-button">{editingProduct ? 'Perbarui' : 'Simpan'}</Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cari nama produk atau barcode..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" data-testid="search-product-input" />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full md:w-44" data-testid="filter-category">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-full md:w-44" data-testid="filter-supplier">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Supplier</SelectItem>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
              <SelectTrigger className="w-full md:w-44" data-testid="filter-warehouse">
                <SelectValue placeholder="Gudang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Gudang</SelectItem>
                {warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={filterLowStock ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterLowStock(!filterLowStock)}
              data-testid="filter-low-stock"
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Stok Rendah
            </Button>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterCategory('all'); setFilterSupplier('all'); setFilterWarehouse('all'); setFilterLowStock(false); }}>
                Hapus Filter ({activeFilters})
              </Button>
            )}
            <span className="text-sm text-muted-foreground ml-auto">{filteredProducts.length} dari {products.length} produk</span>
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <Card className="p-6">
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-center">Isi/Dus</TableHead>
                <TableHead className="text-center">G. Utama<br/><span className="text-xs font-normal">(dus)</span></TableHead>
                <TableHead className="text-center">G. Toko<br/><span className="text-xs font-normal">(satuan)</span></TableHead>
                <TableHead className="text-center">G. Lainnya<br/><span className="text-xs font-normal">(dus)</span></TableHead>
                <TableHead className="text-center">Total<br/><span className="text-xs font-normal">(satuan)</span></TableHead>
                <TableHead className="text-right">Harga Satuan</TableHead>
                <TableHead className="text-right">HPP/Satuan</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Tidak ada produk</p>
                  </TableCell>
                </TableRow>
              ) : filteredProducts.map(product => {
                const utama = getStock(product.id, 'gudang_utama');
                const toko = getStock(product.id, 'gudang_toko');
                const lainnya = getStock(product.id, 'gudang_lainnya');
                const isLow = product.stock <= product.min_stock_alert;
                return (
                  <TableRow key={product.id} data-testid={`product-row-${product.id}`} className={isLow ? 'bg-orange-50/50' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{getCategoryName(product.category_id)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{getSupplierName(product.supplier_id)}</TableCell>
                    <TableCell className="text-center">{product.items_per_box || 1}</TableCell>
                    <TableCell className="text-center">
                      <span className={utama > 0 ? 'font-semibold' : 'text-muted-foreground'}>{fmtNum(utama)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={toko > 0 ? 'font-semibold' : 'text-muted-foreground'}>{fmtNum(toko)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={lainnya > 0 ? 'font-semibold' : 'text-muted-foreground'}>{fmtNum(lainnya)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${isLow ? 'text-orange-600' : ''}`}>{fmtNum(product.stock)}</span>
                      {isLow && <AlertTriangle className="w-3 h-3 text-orange-500 inline ml-1" />}
                    </TableCell>
                    <TableCell className="text-right">{fmt(product.price)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(product.cost_price / Math.max(1, product.items_per_box || 1))}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openTransfer(product)} title="Transfer Stok" data-testid={`transfer-${product.id}`}>
                          <ArrowRightLeft className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(product)} data-testid={`edit-product-${product.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(product.id)} data-testid={`delete-product-${product.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Stok</DialogTitle>
          </DialogHeader>
          {transferProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-accent rounded-lg">
                <p className="font-semibold">{transferProduct.name}</p>
                <p className="text-xs text-muted-foreground">{transferProduct.items_per_box || 1} satuan/dus</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {warehouses.map(wh => (
                  <div key={wh.id} className="p-2 bg-accent/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">{wh.name}</p>
                    <p className="font-bold">{fmtNum(getStock(transferProduct.id, wh.id))} {wh.unit}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dari Gudang *</Label>
                  <Select value={transferForm.from_warehouse_id} onValueChange={(v) => setTransferForm({ ...transferForm, from_warehouse_id: v })}>
                    <SelectTrigger data-testid="transfer-from-select"><SelectValue placeholder="Asal" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map(wh => (
                        <SelectItem key={wh.id} value={wh.id}>{wh.name} ({getStock(transferProduct.id, wh.id)} {wh.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ke Gudang *</Label>
                  <Select value={transferForm.to_warehouse_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_warehouse_id: v })}>
                    <SelectTrigger data-testid="transfer-to-select"><SelectValue placeholder="Tujuan" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.filter(wh => wh.id !== transferForm.from_warehouse_id).map(wh => (
                        <SelectItem key={wh.id} value={wh.id}>{wh.name} ({wh.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Jumlah ({fromWh?.unit || '-'})</Label>
                <Input type="number" min="1" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) || 0 })} data-testid="transfer-quantity" />
              </div>
              {fromWh && toWh && fromWh.unit !== toWh.unit && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">Konversi: <span className="font-bold">{transferForm.quantity} {fromWh.unit}</span> = <span className="font-bold">{convertedQty} {toWh.unit}</span></p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} placeholder="Opsional" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Batal</Button>
                <Button onClick={handleTransfer} data-testid="confirm-transfer-btn">
                  <ArrowRightLeft className="w-4 h-4 mr-2" />Transfer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
