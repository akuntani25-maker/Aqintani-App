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
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';

export const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category_id: '',
    supplier_id: '',
    stock: 0,
    price: 0,
    cost_price: 0,
    box_price: 0,
    items_per_box: 1,
    expiry_date: '',
    batch_number: '',
    description: '',
    min_stock_alert: 10
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, categoriesRes, suppliersRes] = await Promise.all([
        api.get('/products'),
        api.get('/categories'),
        api.get('/suppliers')
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setSuppliers(suppliersRes.data);
    } catch (error) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
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
      name: product.name,
      barcode: product.barcode,
      category_id: product.category_id,
      supplier_id: product.supplier_id,
      stock: product.stock,
      price: product.price,
      cost_price: product.cost_price,
      box_price: product.box_price || 0,
      items_per_box: product.items_per_box || 1,
      expiry_date: product.expiry_date,
      batch_number: product.batch_number,
      description: product.description,
      min_stock_alert: product.min_stock_alert
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      barcode: '',
      category_id: '',
      supplier_id: '',
      stock: 0,
      price: 0,
      cost_price: 0,
      box_price: 0,
      items_per_box: 1,
      expiry_date: '',
      batch_number: '',
      description: '',
      min_stock_alert: 10
    });
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryName = (categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : '-';
  };

  const getSupplierName = (supplierId) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier ? supplier.name : '-';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="products-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Produk</h1>
          <p className="text-sm text-muted-foreground mt-2">Kelola data produk toko Anda</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-product-button">
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
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="product-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    data-testid="product-barcode-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger data-testid="product-category-select">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Select
                    value={formData.supplier_id}
                    onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                  >
                    <SelectTrigger data-testid="product-supplier-select">
                      <SelectValue placeholder="Pilih supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((sup) => (
                        <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">Stok Awal (satuan)</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    data-testid="product-stock-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="items_per_box">Isi per Dus *</Label>
                  <Input
                    id="items_per_box"
                    type="number"
                    min="1"
                    value={formData.items_per_box}
                    onChange={(e) => setFormData({ ...formData, items_per_box: parseInt(e.target.value) || 1 })}
                    required
                    data-testid="product-items-per-box-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Harga Beli/Dus *</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                    required
                    data-testid="product-cost-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Harga Jual Satuan *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    required
                    data-testid="product-price-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="box_price">Harga Jual per Dus</Label>
                  <Input
                    id="box_price"
                    type="number"
                    value={formData.box_price}
                    onChange={(e) => setFormData({ ...formData, box_price: parseFloat(e.target.value) || 0 })}
                    data-testid="product-box-price-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry_date">Tanggal Kadaluarsa</Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    data-testid="product-expiry-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch_number">Nomor Batch</Label>
                  <Input
                    id="batch_number"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    data-testid="product-batch-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_stock_alert">Minimum Stok Alert</Label>
                <Input
                  id="min_stock_alert"
                  type="number"
                  value={formData.min_stock_alert}
                  onChange={(e) => setFormData({ ...formData, min_stock_alert: parseInt(e.target.value) || 10 })}
                  data-testid="product-min-stock-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="product-description-input"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" data-testid="product-submit-button">
                  {editingProduct ? 'Perbarui' : 'Simpan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk atau barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-product-input"
            />
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Produk</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Tidak ada produk</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.barcode || '-'}</TableCell>
                    <TableCell>{getCategoryName(product.category_id)}</TableCell>
                    <TableCell>{getSupplierName(product.supplier_id)}</TableCell>
                    <TableCell className="text-right">
                      <span className={product.stock <= product.min_stock_alert ? 'text-orange-600 font-semibold' : ''}>
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(product)}
                          data-testid={`edit-product-${product.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(product.id)}
                          data-testid={`delete-product-${product.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
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