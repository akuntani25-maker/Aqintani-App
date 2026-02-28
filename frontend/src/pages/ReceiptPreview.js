import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Printer, ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';

export const ReceiptPreview = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const transactionId = searchParams.get('id');
    if (transactionId) {
      fetchTransaction(transactionId);
    } else {
      toast.error('Transaction ID tidak ditemukan');
      navigate('/pos');
    }
  }, [searchParams]);

  const fetchTransaction = async (id) => {
    try {
      const response = await api.get(`/transactions/${id}`);
      setTransaction(response.data);
    } catch (error) {
      toast.error('Gagal memuat data transaksi');
      navigate('/pos');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate('/pos');
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!transaction) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-mesh">
      {/* Action Buttons - Hidden when printing */}
      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            data-testid="back-to-pos-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke POS
          </Button>
          <div className="flex gap-3">
            <Button
              variant="default"
              onClick={handlePrint}
              className="shadow-lg"
              data-testid="print-receipt-button"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Struk
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt Content */}
      <div className="max-w-4xl mx-auto p-6 print:p-0">
        <div 
          id="receipt-content" 
          className="bg-white rounded-xl shadow-lg p-8 print:shadow-none print:rounded-none"
          data-testid="receipt-content"
        >
          {/* Receipt Header */}
          <div className="text-center mb-8 border-b-2 border-dashed border-gray-300 pb-6">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
                <span className="text-3xl">🌾</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">UD. AQIN TANI</h1>
            <p className="text-gray-600">Toko Obat & Alat Pertanian</p>
            <p className="text-sm text-gray-500 mt-2">
              Jl. Contoh No. 123, Kota Anda<br />
              Telp: (021) 1234-5678
            </p>
          </div>

          {/* Transaction Info */}
          <div className="mb-6 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-600">No. Transaksi:</span>
                <p className="font-mono font-semibold">{transaction.transaction_number}</p>
              </div>
              <div className="text-right">
                <span className="text-gray-600">Tanggal:</span>
                <p className="font-semibold">
                  {new Date(transaction.created_at).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Kasir:</span>
                <p className="font-semibold">{transaction.cashier_name}</p>
              </div>
              <div className="text-right">
                <span className="text-gray-600">Metode Bayar:</span>
                <p className="font-semibold capitalize">{transaction.payment_method}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2">Produk</th>
                  <th className="text-center py-2">Qty</th>
                  <th className="text-right py-2">Harga</th>
                  <th className="text-right py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-3">{item.product_name}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right">{formatCurrency(item.price)}</td>
                    <td className="text-right font-semibold">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t-2 border-gray-300 pt-4 mb-6">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{formatCurrency(transaction.subtotal)}</span>
              </div>
              {transaction.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Diskon:</span>
                  <span className="font-semibold">-{formatCurrency(transaction.discount)}</span>
                </div>
              )}
              {transaction.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Pajak:</span>
                  <span className="font-semibold">{formatCurrency(transaction.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t-2 border-gray-300 pt-3 mt-3">
                <span>TOTAL:</span>
                <span className="text-primary">{formatCurrency(transaction.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Jumlah Bayar:</span>
                <span className="font-semibold">{formatCurrency(transaction.payment_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-600">
                <span>Kembalian:</span>
                <span>{formatCurrency(transaction.change)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-sm border-t-2 border-dashed border-gray-300 pt-6">
            <p className="font-semibold mb-2">Terima kasih atas kunjungan Anda!</p>
            <p className="text-gray-600 text-xs mb-1">Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
            <p className="text-gray-500 text-xs">Simpan struk ini sebagai bukti pembelian yang sah</p>
          </div>
        </div>

        {/* Info Box - Hidden when printing */}
        <div className="print:hidden mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            💡 <strong>Tips:</strong> Pastikan printer sudah terhubung dan aktif. Anda bisa memilih printer mana yang akan digunakan di dialog print.
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          @page {
            margin: 1cm;
            size: A4 portrait;
          }
          .no-print, button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
