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
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const transactionId = searchParams.get('id');
    if (transactionId) {
      fetchData(transactionId);
    } else {
      toast.error('Transaction ID tidak ditemukan');
      navigate('/pos');
    }
  }, [searchParams]);

  const fetchData = async (id) => {
    try {
      const [transRes, settingsRes] = await Promise.all([
        api.get(`/transactions/${id}`),
        api.get('/store-settings')
      ]);
      setTransaction(transRes.data);
      setStoreSettings(settingsRes.data);
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
      <div className="max-w-md mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
        <div 
          id="receipt-content" 
          className="bg-white rounded-xl shadow-lg p-5 sm:p-6 print:shadow-none print:rounded-none print:p-2 print:text-xs"
          data-testid="receipt-content"
        >
          {/* Receipt Header */}
          <div className="text-center mb-4 print:mb-2 border-b-2 border-dashed border-gray-300 pb-3 print:pb-1">
            <h1 className="text-xl sm:text-2xl print:text-base font-bold mb-1 print:mb-0">
              {storeSettings?.store_name || 'UD. AQIN TANI'}
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm print:text-[10px] print:leading-tight">
              {storeSettings?.address || 'Toko Obat & Alat Pertanian'}
            </p>
            <p className="text-xs print:text-[9px] text-gray-500 mt-1 print:mt-0 print:leading-tight">
              Telp: {storeSettings?.phone || '(021) 1234-5678'}
              {storeSettings?.email && (
                <><br className="print:hidden" />
                <span className="hidden print:inline"> | </span>
                Email: {storeSettings.email}</>
              )}
            </p>
          </div>

          {/* Transaction Info - Compact for thermal */}
          <div className="mb-4 print:mb-2 text-sm print:text-[9px] print:leading-tight">
            <div className="space-y-1 print:space-y-0">
              <div className="flex justify-between print:block">
                <span className="text-gray-600 print:inline">No:</span>
                <p className="font-mono font-semibold print:inline print:ml-1">{transaction.transaction_number}</p>
              </div>
              <div className="flex justify-between print:block">
                <span className="text-gray-600 print:inline">Tgl:</span>
                <p className="font-semibold print:inline print:ml-1">
                  {new Date(transaction.created_at).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: '2-digit', 
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="flex justify-between print:block">
                <span className="text-gray-600 print:inline">Kasir:</span>
                <p className="font-semibold print:inline print:ml-1">{transaction.cashier_name}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 print:border-gray-400 mb-3 print:mb-2"></div>

          {/* Items - Compact layout for thermal */}
          <div className="mb-4 print:mb-2">
            {/* Desktop/A4 Table */}
            <table className="w-full text-sm print:hidden">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2">Produk</th>
                  <th className="text-center py-2 w-16">Qty</th>
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

            {/* Thermal Compact List */}
            <div className="hidden print:block text-[9px] space-y-1">
              {transaction.items.map((item, index) => (
                <div key={index} className="leading-tight">
                  <div className="font-semibold">{item.product_name}</div>
                  <div className="flex justify-between">
                    <span>{item.quantity} x {formatCurrency(item.price).replace('Rp ', '')}</span>
                    <span className="font-semibold">{formatCurrency(item.subtotal).replace('Rp ', '')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 print:border-gray-400 mb-3 print:mb-2"></div>

          {/* Totals - Compact for thermal */}
          <div className="mb-4 print:mb-2">
            <div className="space-y-2 print:space-y-0 text-sm print:text-[9px] print:leading-tight">
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
              <div className="flex justify-between text-xl print:text-[10px] font-bold border-t-2 print:border-t border-gray-300 print:border-gray-400 pt-2 print:pt-1 mt-2 print:mt-1">
                <span>TOTAL:</span>
                <span className="text-primary">{formatCurrency(transaction.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Details - Compact */}
          <div className="bg-gray-50 print:bg-transparent rounded-lg print:rounded-none p-3 print:p-0 mb-3 print:mb-1">
            <div className="space-y-2 print:space-y-0 print:text-[9px] print:leading-tight">
              <div className="flex justify-between text-sm print:text-[9px]">
                <span className="text-gray-600">Bayar ({transaction.payment_method}):</span>
                <span className="font-semibold">{formatCurrency(transaction.payment_amount)}</span>
              </div>
              <div className="flex justify-between text-lg print:text-[10px] font-bold text-green-600">
                <span>Kembali:</span>
                <span>{formatCurrency(transaction.change)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 print:border-gray-400 mb-3 print:mb-2"></div>

          {/* Footer - Compact for thermal */}
          <div className="text-center text-sm print:text-[8px] print:leading-tight">
            <p className="font-semibold mb-2 print:mb-1">Terima kasih!</p>
            <p className="text-gray-600 text-xs print:text-[7px] print:leading-tight mb-1">Barang yang sudah dibeli<br className="hidden print:inline" /> tidak dapat ditukar</p>
            <p className="text-gray-500 text-xs print:text-[7px] print:leading-tight print:hidden">Simpan struk sebagai bukti pembelian</p>
          </div>
        </div>

        {/* Info Box - Hidden when printing */}
        <div className="print:hidden mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Tips:</strong> Pastikan printer sudah terhubung dan aktif. Anda bisa memilih printer mana yang akan digunakan di dialog print.
          </p>
        </div>
      </div>

      {/* Print Styles - optimized for thermal printers (58mm/80mm) */}
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          @page {
            margin: 2mm 1mm;
            size: auto;
          }
          #receipt-content {
            width: 100% !important;
            max-width: 76mm !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            font-size: 9px !important;
            line-height: 1.3 !important;
            page-break-inside: avoid;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .no-print, 
          button,
          .print\\:hidden {
            display: none !important;
          }
          h1 {
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1.1 !important;
          }
          .bg-gray-50 { background: transparent !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};
