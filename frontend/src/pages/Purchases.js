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
import { Plus, DollarSign, ShoppingBag, Trash2, CreditCard, Search } from 'lucide-react';

export const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    supplier_id: '',
    items: [],
    notes: '',
    paid: 0,
    warehouse_id: 'gudang_utama'
  });
  const [searchProduct, setSearchProduct] = useState('');
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [purchasesRes, suppliersRes, productsRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/suppliers'),
        api.get('/products')
      ]);
      setPurchases(purchasesRes.data);
      setSuppliers(suppliersRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const addItem = (product) => {
    const existing = formData.items.find(i => i.product_id === product.id);
    if (existing) {
      setFormData({
        ...formData,
        items: formData.items.map(i =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.cost_price }
            : i
        )
      });
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          cost_price: product.cost_price,
          subtotal: product.cost_price
        }]
      });
    }
  };

  const updateItemQty = (productId, qty) => {
    if (qty <= 0) {
      setFormData({ ...formData, items: formData.items.filter(i => i.product_id !== productId) });
    } else {
      setFormData({
        ...formData,
        items: formData.items.map(i =>
          i.product_id === productId ? { ...i, quantity: qty, subtotal: qty * i.cost_price } : i
        )
      });
    }
  };

  const totalPurchase = formData.items.reduce((s, i) => s + i.subtotal, 0);

  const handleSubmit = async () => {
    if (!formData.supplier_id) { toast.error('Pilih supplier'); return; }
    if (formData.items.length === 0) { toast.error('Tambahkan item'); return; }
    try {
      await api.post('/purchases', {
        supplier_id: formData.supplier_id,
        items: formData.items,
        total: totalPurchase,
        paid: formData.paid,
        notes: formData.notes
      });
      toast.success('Pembelian berhasil dicatat');
      setIsDialogOpen(false);
      setFormData({ supplier_id: '', items: [], notes: '', paid: 0 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan');
    }
  };

  const handlePay = async () => {
    if (!selectedPurchase || paymentAmount <= 0) { toast.error('Jumlah tidak valid'); return; }
    try {
      await api.post(`/purchases/${selectedPurchase.id}/pay?amount=${paymentAmount}`);
      toast.success('Pembayaran berhasil dicatat');
      setPayDialogOpen(false);
      setSelectedPurchase(null);
      setPaymentAmount(0);
      fetchData();
    } catch (error) {
      toast.error('Gagal mencatat pembayaran');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus pembelian ini?')) return;
    try {
      await api.delete(`/purchases/${id}`);
      toast.success('Pembelian berhasil dihapus');
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus');
    }
  };

  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()));

  const filteredPurchases = purchases.filter(p => {
    const matchSupplier = filterSupplier === 'all' || p.supplier_id === filterSupplier;
    const matchSearch = !searchQuery || p.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.id?.includes(searchQuery);
    return matchSupplier && matchSearch;
  });

  const totalHutang = purchases.reduce((s, p) => s + (p.remaining || 0), 0);
  const totalBelanja = purchases.reduce((s, p) => s + (p.total || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="purchases-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pembelian</h1>
          <p className="text-sm text-muted-foreground mt-2">Catat pembelian dari supplier dan track hutang</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setFormData({ supplier_id: '', items: [], notes: '', paid: 0 });
        }}>
          <DialogTrigger asChild>
            <Button data-testid="create-purchase-button">
              <Plus className="w-4 h-4 mr-2" />
              Catat Pembelian
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Catat Pembelian Baru</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <Select value={formData.supplier_id} onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}>
                    <SelectTrigger data-testid="purchase-supplier-select">
                      <SelectValue placeholder="Pilih supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cari Produk</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Cari produk..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <div className="border rounded-lg max-h-52 overflow-y-auto">
                  {filteredProducts.slice(0, 10).map(product => (
                    <div key={product.id} className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0 flex justify-between items-center" onClick={() => addItem(product)}>
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">Stok: {product.stock}</p>
                      </div>
                      <p className="font-semibold text-sm">{fmt(product.cost_price)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <Label>Item Pembelian ({formData.items.length})</Label>
                <div className="border rounded-lg max-h-52 overflow-y-auto">
                  {formData.items.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">Belum ada item</div>
                  ) : formData.items.map(item => (
                    <div key={item.product_id} className="p-3 border-b last:border-b-0">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium flex-1">{item.product_name}</p>
                        <Button size="sm" variant="ghost" onClick={() => updateItemQty(item.product_id, 0)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateItemQty(item.product_id, item.quantity - 1)}>-</Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button size="sm" variant="outline" onClick={() => updateItemQty(item.product_id, item.quantity + 1)}>+</Button>
                        </div>
                        <span className="text-sm font-semibold">{fmt(item.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-primary">{fmt(totalPurchase)}</span>
                  </div>
                  <div className="space-y-2">
                    <Label>Bayar di Muka</Label>
                    <Input type="number" value={formData.paid} onChange={(e) => setFormData({ ...formData, paid: parseFloat(e.target.value) || 0 })} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Catatan</Label>
                    <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Catatan opsional" />
                  </div>
                  {totalPurchase - formData.paid > 0 && (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-sm text-orange-800">Sisa hutang: <span className="font-bold">{fmt(totalPurchase - formData.paid)}</span></p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Batal</Button>
                  <Button onClick={handleSubmit} className="flex-1" disabled={formData.items.length === 0}>Simpan</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Pembelian</p>
              <p className="text-2xl font-bold">{fmt(totalBelanja)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Sisa Hutang</p>
              <p className="text-2xl font-bold text-orange-600">{fmt(totalHutang)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Sudah Dibayar</p>
              <p className="text-2xl font-bold text-green-600">{fmt(totalBelanja - totalHutang)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari supplier..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="purchase-search-input" />
        </div>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-full md:w-60" data-testid="purchase-filter-supplier">
            <SelectValue placeholder="Semua supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Supplier</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="p-6">
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Dibayar</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Belum ada pembelian</p>
                  </TableCell>
                </TableRow>
              ) : filteredPurchases.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.created_at).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell className="font-medium">{p.supplier_name}</TableCell>
                  <TableCell>{p.items?.length || 0} item</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(p.total)}</TableCell>
                  <TableCell className="text-right">{fmt(p.paid)}</TableCell>
                  <TableCell className="text-right">
                    <span className={p.remaining > 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                      {fmt(p.remaining)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{p.notes || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {p.remaining > 0 && (
                        <Button size="sm" variant="outline" onClick={() => { setSelectedPurchase(p); setPaymentAmount(p.remaining); setPayDialogOpen(true); }} data-testid={`pay-purchase-${p.id}`}>
                          <DollarSign className="w-4 h-4 mr-1" />
                          Bayar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} data-testid={`delete-purchase-${p.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bayar Hutang Supplier</DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">Supplier</p>
                <p className="font-semibold">{selectedPurchase.supplier_name}</p>
                <p className="text-sm text-muted-foreground mt-1">Tanggal: {new Date(selectedPurchase.created_at).toLocaleDateString('id-ID')}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-800">Sisa Hutang</p>
                <p className="text-2xl font-bold text-orange-600">{fmt(selectedPurchase.remaining)}</p>
              </div>
              <div className="space-y-2">
                <Label>Jumlah Bayar</Label>
                <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} max={selectedPurchase.remaining} data-testid="payment-amount-input" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Batal</Button>
                <Button onClick={handlePay} data-testid="confirm-payment-button">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Bayar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
