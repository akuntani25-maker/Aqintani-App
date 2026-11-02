import React, { useState, useEffect } from 'react';
import { PageSkeleton } from '../components/PageSkeleton';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Package, ArrowRightLeft, Filter, AlertTriangle, ClipboardEdit, History, ImagePlus, X } from '../components/icons';
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

  // Edit form data (used when editing existing product)
  const [formData, setFormData] = useState({
    name: '', barcode: '', category_id: '', supplier_id: '',
    stock: 0, warehouse_id: 'gudang_utama', price: 0, cost_price: 0,
    supplier_cost_price: 0,
    box_price: 0, items_per_box: 1, initial_paid: 0, expiry_date: '', batch_number: '',
    description: '', min_stock_alert: 10, invoice_number: '', due_date: ''
  });

  // Bulk add states
  const [bulkSupplier, setBulkSupplier] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierSearchFocused, setSupplierSearchFocused] = useState(false);
  const [bulkWarehouse, setBulkWarehouse] = useState('gudang_utama');
  const emptyBulkItem = { isNew: true, existing_product_id: '', name: '', barcode: '', category_id: '', stock: 1, items_per_box: 1, supplier_cost_price: 0, cost_price: 0, price: 0, box_price: 0, searchQuery: '', searchResults: [], searchOpen: false };
  const [bulkItems, setBulkItems] = useState([{ ...emptyBulkItem }]);
  const [bulkPaid, setBulkPaid] = useState(0);
  const [bulkInvoice, setBulkInvoice] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

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

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await api.put(`/products/${editingProduct.id}`, formData);
      toast.success('Barang berhasil diperbarui');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan produk');
    }
  };

  const searchBulkProduct = async (idx, query) => {
    const newItems = [...bulkItems];
    newItems[idx].searchQuery = query;
    newItems[idx].name = query;
    newItems[idx].isNew = true;
    newItems[idx].existing_product_id = '';
    if (query.length < 1) { newItems[idx].searchResults = []; newItems[idx].searchOpen = false; setBulkItems(newItems); return; }
    newItems[idx].searchOpen = true;
    setBulkItems([...newItems]);
    try {
      const res = await api.get(`/products/search-autocomplete?q=${encodeURIComponent(query)}`);
      setBulkItems(prev => {
        const updated = [...prev];
        if (updated[idx]) { updated[idx].searchResults = res.data; }
        return updated;
      });
    } catch {
      setBulkItems(prev => {
        const updated = [...prev];
        if (updated[idx]) { updated[idx].searchResults = []; }
        return updated;
      });
    }
  };

  const selectBulkProduct = (idx, product) => {
    setBulkItems(prev => {
      const updated = [...prev];
      if (product) {
        updated[idx] = {
          ...updated[idx], isNew: false, existing_product_id: product.id,
          name: product.name, barcode: product.barcode || '',
          category_id: product.category_id || '', items_per_box: product.items_per_box || 1,
          supplier_cost_price: product.supplier_cost_price || 0,
          cost_price: product.cost_price || 0, price: product.price || 0,
          box_price: product.box_price || 0, searchQuery: product.name,
          searchResults: [], searchOpen: false
        };
      } else {
        updated[idx] = { ...updated[idx], isNew: true, existing_product_id: '', searchResults: [], searchOpen: false };
      }
      return updated;
    });
  };

  const updateBulkItem = (idx, field, value) => {
    setBulkItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const addBulkItem = () => setBulkItems(prev => [...prev, { ...emptyBulkItem }]);

  const bulkTotal = bulkItems.reduce((sum, item) => {
    const cost = item.supplier_cost_price || item.cost_price;
    return sum + (cost * (item.stock || 0));
  }, 0);

  const handleBulkSubmit = async () => {
    if (!bulkSupplier) { toast.error('Pilih supplier terlebih dahulu'); return; }
    const validItems = bulkItems.filter(i => i.name && i.stock > 0);
    if (validItems.length === 0) { toast.error('Tambahkan minimal 1 item'); return; }
    setBulkSubmitting(true);
    try {
      const res = await api.post('/products/bulk', {
        supplier_id: bulkSupplier.id,
        warehouse_id: bulkWarehouse,
        items: validItems.map(i => ({
          existing_product_id: i.existing_product_id || '',
          name: i.name, barcode: i.barcode, category_id: i.category_id,
          stock: i.stock, items_per_box: i.items_per_box,
          supplier_cost_price: i.supplier_cost_price, cost_price: i.cost_price,
          price: i.price, box_price: i.box_price
        })),
        initial_paid: bulkPaid, invoice_number: bulkInvoice, due_date: bulkDueDate
      });
      toast.success(res.data.message || 'Barang berhasil disimpan');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan');
    } finally { setBulkSubmitting(false); }
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

  const handleImageUpload = async (productId, file) => {
    const formPayload = new FormData();
    formPayload.append('file', file);
    try {
      const res = await api.post(`/products/upload-image/${productId}`, formPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Gambar berhasil diupload');
      fetchData();
      return res.data.image_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal upload gambar');
      return null;
    }
  };

  const handleDeleteImage = async (productId) => {
    try {
      await api.delete(`/products/image/${productId}`);
      toast.success('Gambar berhasil dihapus');
      fetchData();
    } catch { toast.error('Gagal menghapus gambar'); }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setBulkSupplier(null);
    setSupplierSearch('');
    setSupplierSearchFocused(false);
    setBulkWarehouse('gudang_utama');
    setBulkItems([{ ...emptyBulkItem }]);
    setBulkPaid(0);
    setBulkInvoice('');
    setBulkDueDate('');
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
    return <PageSkeleton variant="table" />;
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit Barang' : 'Tambah Barang dari Supplier'}</DialogTitle>
            </DialogHeader>

            {editingProduct ? (
              /* ===== EDIT MODE ===== */
              <form onSubmit={handleEditSubmit} className="space-y-4">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Isi per Dus *</Label>
                    <Input type="number" min="0.1" step="0.1" value={formData.items_per_box} onChange={(e) => setFormData({ ...formData, items_per_box: parseFloat(e.target.value) || 1 })} required data-testid="product-items-per-box-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>Min. Stok Alert</Label>
                    <Input type="number" value={formData.min_stock_alert} onChange={(e) => setFormData({ ...formData, min_stock_alert: parseInt(e.target.value) || 10 })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Harga Pokok Supplier/Dus</Label>
                    <CurrencyInput value={formData.supplier_cost_price} onChange={(v) => setFormData({ ...formData, supplier_cost_price: v })} data-testid="product-supplier-cost-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>Harga Pokok Toko/Dus *</Label>
                    <CurrencyInput value={formData.cost_price} onChange={(v) => setFormData({ ...formData, cost_price: v })} required data-testid="product-cost-input" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kadaluarsa</Label>
                    <Input type="date" value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>No. Batch</Label>
                    <Input value={formData.batch_number} onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })} />
                  </div>
                </div>
                {/* Image Upload */}
                <div className="space-y-2 border-t pt-4">
                  <Label>Gambar Produk</Label>
                  <div className="flex items-center gap-4">
                    {editingProduct.image_url ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
                        <img src={`${process.env.REACT_APP_BACKEND_URL}${editingProduct.image_url}`} alt={editingProduct.name} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => handleDeleteImage(editingProduct.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                        <ImagePlus className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div>
                      <input type="file" accept="image/jpeg,image/png,image/webp" id="product-image-upload" className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleImageUpload(editingProduct.id, file);
                            if (url) setEditingProduct({ ...editingProduct, image_url: url });
                          }
                          e.target.value = '';
                        }}
                        data-testid="product-image-input"
                      />
                      <label htmlFor="product-image-upload">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span><ImagePlus className="w-4 h-4 mr-1.5" /> Upload Gambar</span>
                        </Button>
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP (maks 5MB)</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                  <Button type="submit" data-testid="product-submit-button">Perbarui</Button>
                </div>
              </form>
            ) : (
              /* ===== BULK ADD MODE ===== */
              <div className="space-y-5" data-testid="bulk-add-form">
                {/* Supplier Search */}
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  {bulkSupplier ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg" data-testid="bulk-selected-supplier">
                      <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-sm text-emerald-900 flex-1">{bulkSupplier.name}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setBulkSupplier(null)} data-testid="clear-bulk-supplier">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Ketik nama supplier..." value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        onFocus={() => setSupplierSearchFocused(true)}
                        onBlur={() => setTimeout(() => setSupplierSearchFocused(false), 200)}
                        className="pl-10" data-testid="bulk-supplier-search" autoComplete="off"
                      />
                      {supplierSearchFocused && (
                        <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                          {suppliers.filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map(s => (
                            <div key={s.id} className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                              onClick={() => { setBulkSupplier(s); setSupplierSearch(''); setSupplierSearchFocused(false); }}
                              data-testid={`supplier-option-${s.id}`}>
                              <p className="font-medium">{s.name}</p>
                              {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                            </div>
                          ))}
                          {suppliers.filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                            <p className="px-3 py-2 text-sm text-muted-foreground">Supplier tidak ditemukan</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Warehouse */}
                <div className="space-y-2">
                  <Label>Gudang Tujuan</Label>
                  <Select value={bulkWarehouse} onValueChange={setBulkWarehouse}>
                    <SelectTrigger data-testid="bulk-warehouse-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{warehouses.map(wh => <SelectItem key={wh.id} value={wh.id}>{wh.name} ({wh.unit})</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Daftar Barang ({bulkItems.filter(i => i.name && i.stock > 0).length} item)</Label>
                  </div>
                  {bulkItems.map((item, idx) => (
                    <div key={idx} className="p-3 border rounded-lg space-y-2 bg-muted/20" data-testid={`bulk-item-${idx}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          #{idx + 1}
                          {item.existing_product_id ? (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Restok</span>
                          ) : item.name ? (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Baru</span>
                          ) : null}
                        </span>
                        {bulkItems.length > 1 && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setBulkItems(bulkItems.filter((_, i) => i !== idx))} data-testid={`remove-bulk-item-${idx}`}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                      {/* Product search */}
                      <div className="relative">
                        <Input placeholder="Cari/ketik nama barang..." value={item.searchQuery}
                          onChange={(e) => searchBulkProduct(idx, e.target.value)}
                          onFocus={() => updateBulkItem(idx, 'searchOpen', true)}
                          onBlur={() => setTimeout(() => updateBulkItem(idx, 'searchOpen', false), 200)}
                          autoComplete="off" className="text-sm"
                          data-testid={`bulk-product-search-${idx}`}
                        />
                        {item.searchOpen && item.searchQuery.length > 0 && (
                          <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                            {item.searchResults.length > 0 ? (
                              <>
                                {item.searchResults.map(p => (
                                  <div key={p.id} className="px-3 py-2 hover:bg-accent cursor-pointer border-b last:border-b-0" onClick={() => selectBulkProduct(idx, p)} data-testid={`bulk-search-result-${p.id}`}>
                                    <p className="text-sm font-medium">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">Stok: {fmtNum(p.stock)} satuan | HPP: {fmt(p.cost_price)}/dus</p>
                                  </div>
                                ))}
                                <div className="px-3 py-2 text-xs text-blue-600 bg-blue-50 font-medium cursor-pointer hover:bg-blue-100 border-t"
                                  onClick={() => selectBulkProduct(idx, null)} data-testid={`bulk-new-product-${idx}`}>
                                  + Tambah sebagai Barang Baru: "{item.searchQuery}"
                                </div>
                              </>
                            ) : (
                              <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50">
                                Barang tidak ditemukan — akan otomatis dibuat sebagai <strong>barang baru</strong>
                              </div>
                            )}
                          </div>
                        )}
                        {item.existing_product_id ? (
                          <p className="text-xs text-emerald-600 mt-1">Restok: stok akan ditambahkan ke barang yang sudah ada</p>
                        ) : item.name && !item.existing_product_id ? (
                          <p className="text-xs text-blue-600 mt-1">Barang baru akan dibuat</p>
                        ) : null}
                      </div>
                      {/* Fields */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Qty (dus)</Label>
                          <Input type="number" min={0} value={item.stock} className="h-8 text-sm"
                            onChange={(e) => updateBulkItem(idx, 'stock', parseInt(e.target.value) || 0)}
                            data-testid={`bulk-qty-${idx}`} />
                        </div>
                        <div>
                          <Label className="text-xs">Isi/Dus</Label>
                          <Input type="number" min={0.1} step={0.1} value={item.items_per_box} className="h-8 text-sm"
                            onChange={(e) => updateBulkItem(idx, 'items_per_box', parseFloat(e.target.value) || 1)}
                            data-testid={`bulk-ipb-${idx}`} />
                        </div>
                        <div>
                          <Label className="text-xs">Harga Supplier/Dus</Label>
                          <CurrencyInput value={item.supplier_cost_price} className="h-8 text-sm"
                            onChange={(v) => updateBulkItem(idx, 'supplier_cost_price', v)}
                            data-testid={`bulk-supplier-cost-${idx}`} />
                        </div>
                      </div>
                      {item.isNew && !item.existing_product_id && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">HPP Toko/Dus</Label>
                            <CurrencyInput value={item.cost_price} className="h-8 text-sm"
                              onChange={(v) => updateBulkItem(idx, 'cost_price', v)}
                              data-testid={`bulk-cost-${idx}`} />
                          </div>
                          <div>
                            <Label className="text-xs">Jual/Satuan</Label>
                            <CurrencyInput value={item.price} className="h-8 text-sm"
                              onChange={(v) => updateBulkItem(idx, 'price', v)}
                              data-testid={`bulk-price-${idx}`} />
                          </div>
                          <div>
                            <Label className="text-xs">Jual/Dus</Label>
                            <CurrencyInput value={item.box_price} className="h-8 text-sm"
                              onChange={(v) => updateBulkItem(idx, 'box_price', v)}
                              data-testid={`bulk-box-price-${idx}`} />
                          </div>
                        </div>
                      )}
                      {item.stock > 0 && item.items_per_box > 0 && (
                        <p className="text-xs text-blue-600">{item.stock} dus x {item.items_per_box} = <strong>{Math.round(item.stock * item.items_per_box)} satuan</strong>
                          {item.supplier_cost_price > 0 && <span className="ml-2 text-amber-700">| Subtotal: {fmt(item.supplier_cost_price * item.stock)}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addBulkItem} className="w-full" data-testid="add-bulk-item-btn">
                    <Plus className="w-4 h-4 mr-2" /> Tambah Item
                  </Button>
                </div>

                {/* Payment Section */}
                {bulkSupplier && bulkTotal > 0 && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3" data-testid="bulk-payment-section">
                    <p className="text-sm font-semibold text-amber-900">Pembelian ke {bulkSupplier.name}</p>
                    <div className="flex items-center justify-between text-sm text-amber-800">
                      <span>Total Pembelian:</span>
                      <span className="font-bold text-base">{fmt(bulkTotal)}</span>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-900">Bayar di Muka</Label>
                      <CurrencyInput value={bulkPaid} onChange={setBulkPaid} data-testid="bulk-paid-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-900">No. Invoice</Label>
                        <Input value={bulkInvoice} onChange={(e) => setBulkInvoice(e.target.value)} placeholder="INV-001" data-testid="bulk-invoice-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-900">Jatuh Tempo</Label>
                        <Input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} data-testid="bulk-duedate-input" />
                      </div>
                    </div>
                    {bulkTotal - (bulkPaid || 0) > 0 ? (
                      <p className="text-sm font-medium text-red-700">Sisa hutang: {fmt(bulkTotal - (bulkPaid || 0))}</p>
                    ) : (
                      <p className="text-sm font-medium text-green-700">Lunas</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                  <Button onClick={handleBulkSubmit} disabled={bulkSubmitting || !bulkSupplier || bulkItems.every(i => !i.name || i.stock <= 0)} data-testid="product-submit-button">
                    {bulkSubmitting ? 'Menyimpan...' : `Simpan ${bulkItems.filter(i => i.name && i.stock > 0).length} Item`}
                  </Button>
                </div>
              </div>
            )}
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
