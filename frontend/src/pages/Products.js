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
import { Plus, Search, Pencil, Trash2, Package, ArrowRightLeft, Filter, AlertTriangle, ClipboardEdit, History } from 'lucide-react';
import { CurrencyInput } from '../components/CurrencyInput';
import { Pagination } from '../components/Pagination';

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

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 15;

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

  // Stock Adjustment
  const [stockAdjDialogOpen, setStockAdjDialogOpen] = useState(false);
  const [stockAdjProduct, setStockAdjProduct] = useState(null);
  const [stockAdjValues, setStockAdjValues] = useState({});
  const [stockAdjReason, setStockAdjReason] = useState('Koreksi fisik');
  const [stockAdjSaving, setStockAdjSaving] = useState(false);

  // Price History
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceHistoryProduct, setPriceHistoryProduct] = useState(null);

  const [formData, setFormData] = useState({
    name: '', barcode: '', category_id: '', supplier_id: '',
    stock: 0, warehouse_id: 'gudang_utama', price: 0, cost_price: 0,
    supplier_cost_price: 0,
    box_price: 0, items_per_box: 1, initial_paid: 0, expiry_date: '', batch_number: '',
    description: '', min_stock_alert: 10, invoice_number: '', due_date: ''
  });

  // Form mode: 'new' or 'restock'
  const [formMode, setFormMode] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

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
        toast.success('Barang berhasil diperbarui');
      } else if (formMode === 'restock' && selectedProduct) {
        await api.post('/products', {
          ...formData,
          name: selectedProduct.name,
          is_restock: true,
          existing_product_id: selectedProduct.id
        });
        toast.success('Restok barang berhasil');
      } else {
        await api.post('/products', formData);
        toast.success('Barang berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan produk');
    }
  };

  const searchProducts = async (q) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await api.get(`/products/search-autocomplete?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  };

  const selectExistingProduct = (product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setSearchResults([]);
    setFormData({
      ...formData,
      name: product.name,
      barcode: product.barcode,
      category_id: product.category_id,
      supplier_id: product.supplier_id,
      price: product.price,
      cost_price: product.cost_price,
      supplier_cost_price: product.supplier_cost_price || 0,
      box_price: product.box_price || 0,
      items_per_box: product.items_per_box || 1,
      min_stock_alert: product.min_stock_alert,
      expiry_date: product.expiry_date || '',
      batch_number: product.batch_number || '',
      description: product.description || '',
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus produk ini?')) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Barang berhasil dihapus');
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus produk');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormMode('new');
    setFormData({
      name: product.name, barcode: product.barcode, category_id: product.category_id,
      supplier_id: product.supplier_id, stock: product.stock, warehouse_id: 'gudang_utama',
      price: product.price, cost_price: product.cost_price,
      supplier_cost_price: product.supplier_cost_price || 0,
      box_price: product.box_price || 0, items_per_box: product.items_per_box || 1,
      expiry_date: product.expiry_date, batch_number: product.batch_number,
      description: product.description, min_stock_alert: product.min_stock_alert
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormMode('new');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedProduct(null);
    setFormData({
      name: '', barcode: '', category_id: '', supplier_id: '',
      stock: 0, warehouse_id: 'gudang_utama', price: 0, cost_price: 0,
      supplier_cost_price: 0,
      box_price: 0, items_per_box: 1, initial_paid: 0, expiry_date: '', batch_number: '',
      description: '', min_stock_alert: 10, invoice_number: '', due_date: ''
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

  const openStockAdj = (product) => {
    setStockAdjProduct(product);
    const vals = {};
    warehouses.forEach(wh => { vals[wh.id] = getStock(product.id, wh.id); });
    setStockAdjValues(vals);
    setStockAdjReason('Koreksi fisik');
    setStockAdjDialogOpen(true);
  };

  const handleStockAdj = async () => {
    if (!stockAdjProduct) return;
    setStockAdjSaving(true);
    try {
      for (const wh of warehouses) {
        const oldVal = getStock(stockAdjProduct.id, wh.id);
        const newVal = stockAdjValues[wh.id] ?? oldVal;
        if (newVal !== oldVal) {
          await api.post('/stock-adjustments', {
            product_id: stockAdjProduct.id,
            warehouse_id: wh.id,
            new_stock: newVal,
            reason: stockAdjReason
          });
        }
      }
      toast.success('Stok berhasil disesuaikan');
      setStockAdjDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyesuaikan stok');
    } finally { setStockAdjSaving(false); }
  };

  const openPriceHistory = async (product) => {
    setPriceHistoryProduct(product);
    try {
      const res = await api.get(`/products/${product.id}/price-history`);
      setPriceHistory(res.data);
    } catch { setPriceHistory([]); }
    setPriceHistoryOpen(true);
  };

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

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchTerm, filterCategory, filterSupplier, filterWarehouse, filterLowStock]);

  const totalPages = Math.ceil(filteredProducts.length / perPage);
  const paginatedProducts = filteredProducts.slice((page - 1) * perPage, page * perPage);

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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Barang</h1>
            <p className="text-sm text-muted-foreground mt-1">Kelola produk, stok gudang & transfer</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="w-auto self-start" data-testid="add-product-button">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Barang
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Barang' : 'Tambah Barang'}</DialogTitle>
            </DialogHeader>

            {/* Mode Selector (only when adding new) */}
            {!editingProduct && (
              <div className="flex gap-2 mb-4" data-testid="form-mode-selector">
                <Button type="button" variant={formMode === 'new' ? 'default' : 'outline'} size="sm" onClick={() => { setFormMode('new'); setSelectedProduct(null); setSearchQuery(''); setSearchResults([]); }} data-testid="mode-new-btn">
                  Barang Baru
                </Button>
                <Button type="button" variant={formMode === 'restock' ? 'default' : 'outline'} size="sm" onClick={() => setFormMode('restock')} data-testid="mode-restock-btn">
                  Restok Barang
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Product Search (restock mode) */}
              {!editingProduct && formMode === 'restock' && (
                <div className="space-y-2 relative">
                  <Label>Cari Barang *</Label>
                  <Input
                    value={searchQuery}
                    onChange={(e) => searchProducts(e.target.value)}
                    placeholder="Ketik nama barang..."
                    data-testid="product-search-input"
                    autoComplete="off"
                  />
                  {searchLoading && <p className="text-xs text-muted-foreground mt-1">Mencari...</p>}
                  {searchResults.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto" data-testid="search-dropdown">
                      {searchResults.map(p => (
                        <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 transition-colors" onClick={() => selectExistingProduct(p)} data-testid={`search-result-${p.id}`}>
                          <p className="font-medium text-sm">{p.name}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>Stok: {fmtNum(p.stock)} satuan</span>
                            <span>Supplier: {p.supplier_name}</span>
                            <span>HPP: {fmt(p.cost_price)}/dus</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedProduct && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mt-2" data-testid="selected-product-info">
                      <p className="font-semibold text-emerald-800">{selectedProduct.name}</p>
                      <p className="text-xs text-emerald-700">Stok saat ini: {fmtNum(selectedProduct.stock)} satuan | Supplier: {selectedProduct.supplier_name}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Name + Barcode (new mode or editing) */}
              {(formMode === 'new' || editingProduct) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Barang *</Label>
                    <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="product-name-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input id="barcode" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} data-testid="product-barcode-input" />
                  </div>
                </div>
              )}

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
                      <Label>Stok {formMode === 'restock' ? 'Tambahan' : 'Awal'} (dus)</Label>
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
                  <Input type="number" min="0.1" step="0.1" value={formData.items_per_box} onChange={(e) => setFormData({ ...formData, items_per_box: parseFloat(e.target.value) || 1 })} required data-testid="product-items-per-box-input" />
                </div>
              </div>
              {formData.stock > 0 && formData.items_per_box > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">{formData.stock} dus x {formData.items_per_box} satuan/dus = <span className="font-bold">{formData.stock * formData.items_per_box} satuan</span> masuk ke {warehouses.find(w => w.id === formData.warehouse_id)?.name || 'gudang'}</p>
                </div>
              )}
              {!editingProduct && formData.stock > 0 && formData.supplier_id && (formData.supplier_cost_price > 0 || formData.cost_price > 0) && (() => {
                const supplierPrice = formData.supplier_cost_price || formData.cost_price;
                const totalPurchase = supplierPrice * formData.stock;
                const paid = Math.min(formData.initial_paid || 0, totalPurchase);
                const debt = totalPurchase - paid;
                return (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                    <p className="text-sm font-semibold text-amber-900">Pembelian Otomatis ke Supplier</p>
                    <div className="flex items-center justify-between text-sm text-amber-800">
                      <span>Total: {fmt(totalPurchase)}</span>
                      <span>({formData.stock} dus x {fmt(supplierPrice)}/dus)</span>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-900">Bayar di Muka</Label>
                      <CurrencyInput
                        value={formData.initial_paid}
                        onChange={(v) => setFormData({ ...formData, initial_paid: v })}
                        data-testid="product-initial-paid-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-amber-900">No. Invoice</Label>
                        <Input value={formData.invoice_number} onChange={(e) => setFormData({...formData, invoice_number: e.target.value})} placeholder="INV-001" data-testid="product-invoice-input" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-amber-900">Jatuh Tempo</Label>
                        <Input type="date" value={formData.due_date} onChange={(e) => setFormData({...formData, due_date: e.target.value})} data-testid="product-duedate-input" />
                      </div>
                    </div>
                    {debt > 0 ? (
                      <p className="text-sm font-medium text-red-700">Sisa hutang: {fmt(debt)}</p>
                    ) : (
                      <p className="text-sm font-medium text-green-700">Lunas</p>
                    )}
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Harga Pokok Supplier/Dus</Label>
                  <CurrencyInput value={formData.supplier_cost_price} onChange={(v) => setFormData({ ...formData, supplier_cost_price: v })} data-testid="product-supplier-cost-input" />
                  <p className="text-xs text-muted-foreground">Harga asli dari supplier (untuk hutang)</p>
                </div>
                <div className="space-y-2">
                  <Label>Harga Pokok Toko/Dus *</Label>
                  <CurrencyInput value={formData.cost_price} onChange={(v) => setFormData({ ...formData, cost_price: v })} required data-testid="product-cost-input" />
                  <p className="text-xs text-muted-foreground">HPP yang diset toko (untuk kalkulasi margin)</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <TableHead>Barang</TableHead>
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
              {paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Tidak ada barang</p>
                  </TableCell>
                </TableRow>
              ) : paginatedProducts.map(product => {
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
                        <Button size="sm" variant="ghost" onClick={() => openPriceHistory(product)} title="Riwayat Harga" data-testid={`price-history-${product.id}`}>
                          <History className="w-4 h-4 text-amber-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openStockAdj(product)} title="Koreksi Stok" data-testid={`adjust-stock-${product.id}`}>
                          <ClipboardEdit className="w-4 h-4 text-blue-600" />
                        </Button>
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
        <Pagination page={page} totalPages={totalPages} total={filteredProducts.length} perPage={perPage} onChange={setPage} />
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

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockAdjDialogOpen} onOpenChange={setStockAdjDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardEdit className="w-5 h-5 text-blue-600" />
              Koreksi Stok
            </DialogTitle>
          </DialogHeader>
          {stockAdjProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-accent rounded-lg">
                <p className="font-semibold">{stockAdjProduct.name}</p>
                <p className="text-xs text-muted-foreground">{stockAdjProduct.items_per_box || 1} satuan/dus &middot; Stok saat ini: {fmtNum(stockAdjProduct.stock)} satuan</p>
              </div>
              <div className="space-y-3">
                {warehouses.map(wh => {
                  const oldVal = getStock(stockAdjProduct.id, wh.id);
                  const newVal = stockAdjValues[wh.id] ?? oldVal;
                  const diff = newVal - oldVal;
                  return (
                    <div key={wh.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{wh.name} <span className="text-xs text-muted-foreground">({wh.unit})</span></p>
                        <p className="text-xs text-muted-foreground">Saat ini: {fmtNum(oldVal)}</p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        className="w-28 text-center"
                        value={stockAdjValues[wh.id] ?? ''}
                        onChange={(e) => setStockAdjValues({...stockAdjValues, [wh.id]: parseInt(e.target.value) || 0})}
                        data-testid={`adj-stock-${wh.id}`}
                      />
                      {diff !== 0 && (
                        <span className={`text-sm font-semibold min-w-[50px] text-right ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label>Alasan Penyesuaian</Label>
                <Select value={stockAdjReason} onValueChange={setStockAdjReason}>
                  <SelectTrigger data-testid="adj-reason-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Koreksi fisik">Koreksi fisik</SelectItem>
                    <SelectItem value="Stok opname">Stok opname</SelectItem>
                    <SelectItem value="Barang rusak">Barang rusak</SelectItem>
                    <SelectItem value="Barang hilang">Barang hilang</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setStockAdjDialogOpen(false)}>Batal</Button>
                <Button onClick={handleStockAdj} disabled={stockAdjSaving} data-testid="confirm-adj-btn">
                  <ClipboardEdit className="w-4 h-4 mr-2" />{stockAdjSaving ? 'Menyimpan...' : 'Simpan Koreksi'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={priceHistoryOpen} onOpenChange={setPriceHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Perubahan Harga</DialogTitle>
          </DialogHeader>
          {priceHistoryProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-accent rounded-lg">
                <p className="font-semibold">{priceHistoryProduct.name}</p>
                <p className="text-sm text-muted-foreground">HPP Saat Ini: {fmt(priceHistoryProduct.cost_price)} / Jual: {fmt(priceHistoryProduct.price)}</p>
              </div>
              {priceHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Belum ada riwayat perubahan harga</p>
              ) : (
                <div className="space-y-3">
                  {priceHistory.map((h, i) => (
                    <div key={h.id || i} className="border rounded-lg p-3 space-y-1" data-testid={`price-history-item-${i}`}>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{new Date(h.changed_at).toLocaleString('id-ID')}</span>
                        <span>oleh {h.changed_by}</span>
                      </div>
                      {h.old_cost_price !== h.new_cost_price && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">HPP:</span>
                          <span className="line-through text-red-500">{fmt(h.old_cost_price)}</span>
                          <span>→</span>
                          <span className="font-medium text-emerald-600">{fmt(h.new_cost_price)}</span>
                        </div>
                      )}
                      {h.old_price !== h.new_price && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Jual:</span>
                          <span className="line-through text-red-500">{fmt(h.old_price)}</span>
                          <span>→</span>
                          <span className="font-medium text-emerald-600">{fmt(h.new_price)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
