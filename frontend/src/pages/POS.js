import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Search, Plus, Minus, Trash2, ShoppingCart, LogOut, CreditCard, Banknote, Smartphone, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import ThermalPrinter from '../utils/ThermalPrinter';

const Receipt = React.forwardRef(({ transaction }, ref) => {
  if (!transaction) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <div ref={ref} className="p-8 bg-white" style={{ width: '80mm' }}>
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold">UD. AQIN TANI</h2>
        <p className="text-xs">Toko Obat & Alat Pertanian</p>
        <p className="text-xs mt-2">{new Date(transaction.created_at).toLocaleString('id-ID')}</p>
        <p className="text-xs font-mono">{transaction.transaction_number}</p>
      </div>
      <div className="border-t border-b border-black py-2 my-2">
        {transaction.items.map((item, index) => (
          <div key={index} className="mb-2">
            <div className="flex justify-between text-sm">
              <span>{item.product_name}</span>
              <span>{formatCurrency(item.price)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>{item.quantity} x {formatCurrency(item.price)}</span>
              <span>{formatCurrency(item.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(transaction.subtotal)}</span>
        </div>
        {transaction.discount > 0 && (
          <div className="flex justify-between">
            <span>Diskon:</span>
            <span>-{formatCurrency(transaction.discount)}</span>
          </div>
        )}
        {transaction.tax > 0 && (
          <div className="flex justify-between">
            <span>Pajak:</span>
            <span>{formatCurrency(transaction.tax)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t border-black pt-1">
          <span>Total:</span>
          <span>{formatCurrency(transaction.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Bayar ({transaction.payment_method}):</span>
          <span>{formatCurrency(transaction.payment_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Kembali:</span>
          <span>{formatCurrency(transaction.change)}</span>
        </div>
      </div>
      <div className="text-center mt-4 text-xs">
        <p>Terima kasih atas kunjungan Anda!</p>
        <p>Kasir: {transaction.cashier_name}</p>
      </div>
    </div>
  );
});

export const POS = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const receiptRef = useRef();
  const [thermalPrinter] = useState(() => new ThermalPrinter());

  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.filter(p => p.stock > 0));
    } catch (error) {
      toast.error('Gagal memuat produk');
    }
  };

  const handleBarcodeSearch = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      const response = await api.get(`/products/barcode/${barcodeInput}`);
      const product = response.data;
      if (product.stock > 0) {
        addToCart(product);
        setBarcodeInput('');
      } else {
        toast.error('Produk stok habis');
      }
    } catch (error) {
      toast.error('Produk tidak ditemukan');
    }
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast.error('Stok tidak mencukupi');
        return;
      }
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
        price: product.price,
        subtotal: product.price,
        max_stock: product.stock
      }]);
    }
    toast.success(`${product.name} ditambahkan`);
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.max_stock) {
          toast.error('Stok tidak mencukupi');
          return item;
        }
        return { ...item, quantity: newQty, subtotal: newQty * item.price };
      }
      return item;
    }));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    return { subtotal, tax: 0, discount: 0, total: subtotal };
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Keranjang kosong');
      return;
    }
    const { total } = calculateTotal();
    setPaymentAmount(total);
    setShowPayment(true);
  };

  const handlePayment = async () => {
    const { subtotal, tax, discount, total } = calculateTotal();
    
    if (paymentAmount < total) {
      toast.error('Jumlah pembayaran kurang');
      return;
    }

    try {
      const response = await api.post('/transactions', {
        items: cart,
        subtotal,
        tax,
        discount,
        total,
        payment_method: paymentMethod,
        payment_amount: paymentAmount,
        change: paymentAmount - total
      });

      setLastTransaction(response.data);
      toast.success('Transaksi berhasil!');
      
      setCart([]);
      setShowPayment(false);
      setPaymentAmount(0);
      fetchProducts();

      // Redirect to receipt preview page
      setTimeout(() => {
        navigate(`/receipt-preview?id=${response.data.id}`);
      }, 500);

    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transaksi gagal');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { subtotal, tax, discount, total } = calculateTotal();
  const change = paymentAmount - total;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const paymentMethods = [
    { value: 'cash', label: 'Tunai', icon: Banknote },
    { value: 'card', label: 'Kartu', icon: CreditCard },
    { value: 'e-wallet', label: 'E-Wallet', icon: Smartphone }
  ];

  return (
    <div className="min-h-screen bg-background flex" data-testid="pos-page">
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Point of Sale</h1>
              <p className="text-sm text-muted-foreground">Kasir: {user?.name}</p>
            </div>
            <Button variant="outline" onClick={handleLogout} data-testid="pos-logout-button">
              <LogOut className="w-4 h-4 mr-2" />
              Keluar
            </Button>
          </div>

          <form onSubmit={handleBarcodeSearch} className="flex gap-2 mb-4">
            <Input
              placeholder="Scan atau ketik barcode..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="flex-1"
              data-testid="barcode-input"
            />
            <Button type="submit" data-testid="barcode-search-button">Cari</Button>
          </form>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-product-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="p-4 cursor-pointer hover:border-primary transition-colors"
              onClick={() => addToCart(product)}
              data-testid={`product-card-${product.id}`}
            >
              <div className="aspect-square bg-accent rounded-lg mb-3 flex items-center justify-center">
                <span className="text-4xl">📦</span>
              </div>
              <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
              <p className="text-lg font-bold text-primary">{formatCurrency(product.price)}</p>
              <p className="text-xs text-muted-foreground">Stok: {product.stock}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="w-full md:w-96 bg-white border-l shadow-xl flex flex-col" data-testid="cart-panel">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Keranjang ({cart.length})
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-20" />
              <p>Keranjang kosong</p>
            </div>
          ) : (
            cart.map((item) => (
              <Card key={item.product_id} className="p-4" data-testid={`cart-item-${item.product_id}`}>
                <div className="flex justify-between mb-2">
                  <h3 className="font-semibold text-sm flex-1">{item.product_name}</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFromCart(item.product_id)}
                    data-testid={`remove-item-${item.product_id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.product_id, -1)}
                      disabled={item.quantity <= 1}
                      data-testid={`decrease-qty-${item.product_id}`}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.product_id, 1)}
                      data-testid={`increase-qty-${item.product_id}`}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="font-bold">{formatCurrency(item.subtotal)}</span>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="p-6 border-t space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {!showPayment ? (
            <Button
              className="w-full h-12"
              onClick={handleCheckout}
              disabled={cart.length === 0}
              data-testid="checkout-button"
            >
              Checkout
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Metode Pembayaran</label>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map((method) => (
                    <Button
                      key={method.value}
                      variant={paymentMethod === method.value ? 'default' : 'outline'}
                      onClick={() => setPaymentMethod(method.value)}
                      className="flex flex-col h-auto py-3"
                      data-testid={`payment-method-${method.value}`}
                    >
                      <method.icon className="w-5 h-5 mb-1" />
                      <span className="text-xs">{method.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Jumlah Bayar</label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  data-testid="payment-amount-input"
                />
                <div className="flex gap-2">
                  {[50000, 100000, 200000].map((amount) => (
                    <Button
                      key={amount}
                      size="sm"
                      variant="outline"
                      onClick={() => setPaymentAmount(amount)}
                      className="flex-1"
                    >
                      {formatCurrency(amount)}
                    </Button>
                  ))}
                </div>
              </div>

              {change >= 0 && paymentAmount > 0 && (
                <div className="p-3 bg-accent rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Kembali:</span>
                    <span className="font-bold text-lg">{formatCurrency(change)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPayment(false)}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  onClick={handlePayment}
                  className="flex-1"
                  disabled={paymentAmount < total}
                  data-testid="confirm-payment-button"
                >
                  Bayar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'none' }}>
        <Receipt ref={receiptRef} transaction={lastTransaction} />
      </div>
    </div>
  );
};