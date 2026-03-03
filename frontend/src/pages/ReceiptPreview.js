import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
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
      <div className="no-print bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/pos')}
            data-testid="back-to-pos-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke POS
          </Button>
          <div className="flex gap-3">
            <Button
              variant="default"
              onClick={() => window.print()}
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
      <div className="receipt-wrapper max-w-md mx-auto p-4 sm:p-6">
        <div
          id="receipt-content"
          className="bg-white rounded-xl shadow-lg p-5 sm:p-6"
          data-testid="receipt-content"
        >
          {/* Receipt Header */}
          <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-3">
            <h1 className="text-xl sm:text-2xl font-bold mb-1 receipt-store-name">
              {storeSettings?.store_name || 'UD. AQIN TANI'}
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm receipt-address">
              {storeSettings?.address || 'Toko Obat & Alat Pertanian'}
            </p>
            <p className="text-xs text-gray-500 mt-1 receipt-phone">
              Telp: {storeSettings?.phone || '(021) 1234-5678'}
              {storeSettings?.email && (
                <><br className="screen-only" />
                <span className="thermal-only"> | </span>
                Email: {storeSettings.email}</>
              )}
            </p>
          </div>

          {/* Transaction Info */}
          <div className="mb-4 text-sm receipt-info">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">No:</span>
                <span className="font-mono font-semibold">{transaction.transaction_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tgl:</span>
                <span className="font-semibold">
                  {new Date(transaction.created_at).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Kasir:</span>
                <span className="font-semibold">{transaction.cashier_name}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3"></div>

          {/* Items - Screen table */}
          <div className="mb-4">
            <table className="w-full text-sm screen-table">
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

            {/* Items - Thermal print layout */}
            <div className="thermal-items">
              {transaction.items.map((item, index) => (
                <div key={index} className="receipt-item">
                  <div className="font-semibold">{item.product_name}</div>
                  <div className="flex justify-between">
                    <span>{item.quantity} x {formatCurrency(item.price).replace('Rp ', '')}</span>
                    <span className="font-semibold">{formatCurrency(item.subtotal).replace('Rp ', '')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3"></div>

          {/* Totals */}
          <div className="mb-4 receipt-totals">
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
              <div className="flex justify-between text-xl font-bold border-t-2 border-gray-300 pt-2 mt-2 receipt-total-line">
                <span>TOTAL:</span>
                <span className="text-primary">{formatCurrency(transaction.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3 receipt-payment">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bayar ({transaction.payment_method}):</span>
                <span className="font-semibold">{formatCurrency(transaction.payment_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-600 receipt-total-line">
                <span>Kembali:</span>
                <span>{formatCurrency(transaction.change)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3"></div>

          {/* Footer */}
          <div className="text-center text-sm receipt-footer">
            <p className="font-semibold mb-2">Terima kasih!</p>
            <p className="text-gray-600 text-xs mb-1 receipt-note">Barang yang sudah dibeli tidak dapat ditukar</p>
            <p className="text-gray-500 text-xs screen-only receipt-note">Simpan struk sebagai bukti pembelian</p>
          </div>
        </div>

        {/* Info Box - Hidden when printing */}
        <div className="no-print mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Tips:</strong> Pastikan printer sudah terhubung dan aktif. Anda bisa memilih printer mana yang akan digunakan di dialog print.
          </p>
        </div>
      </div>

      {/* Print styles - thermal printer optimized */}
      <style>{`
        /* Hide thermal-only elements on screen */
        .thermal-items { display: none; }
        .thermal-only { display: none; }

        @media print {
          /* Force consistent rendering across ALL devices (PC, tablet, mobile) */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            -webkit-text-size-adjust: 100% !important;
            text-size-adjust: 100% !important;
          }

          @page {
            size: 80mm 200mm;
            margin: 0mm;
          }

          /* Hide non-print elements */
          .no-print, .screen-only { display: none !important; }
          .thermal-only { display: inline !important; }
          .bg-gray-100, .bg-gradient-mesh, .min-h-screen { background: none !important; min-height: 0 !important; }

          .receipt-wrapper {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          #receipt-content {
            width: 76mm !important;
            max-width: 76mm !important;
            margin: 0 2mm !important;
            padding: 2mm 1mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            font-size: 12px !important;
            line-height: 1.35 !important;
          }

          /* Typography hierarchy for thermal */
          .receipt-store-name { font-size: 16px !important; line-height: 1.2 !important; margin-bottom: 2px !important; }
          .receipt-address { font-size: 11px !important; }
          .receipt-phone { font-size: 10px !important; }
          .receipt-info { font-size: 11px !important; line-height: 1.4 !important; }
          .receipt-info > div > * { margin-bottom: 0 !important; }

          /* Items */
          .screen-table { display: none !important; }
          .thermal-items { display: block !important; font-size: 11px !important; }
          .receipt-item { margin-bottom: 3px !important; line-height: 1.3 !important; }

          /* Totals */
          .receipt-totals { font-size: 11px !important; line-height: 1.4 !important; }
          .receipt-totals > div > * { margin-bottom: 1px !important; }
          .receipt-total-line { font-size: 13px !important; }

          /* Payment */
          .receipt-payment {
            background: transparent !important;
            border-radius: 0 !important;
            padding: 0 !important;
            font-size: 11px !important;
          }

          /* Footer & notes */
          .receipt-footer { font-size: 11px !important; }
          .receipt-note { font-size: 10px !important; }

          /* Spacing overrides for compact thermal output */
          .mb-4, .mb-3 { margin-bottom: 3px !important; }
          .mb-2, .mb-1 { margin-bottom: 2px !important; }
          .pb-3, .pb-2 { padding-bottom: 2px !important; }
          .pt-2 { padding-top: 2px !important; }
          .p-3 { padding: 0 !important; }
          .space-y-2 > :not(:first-child), .space-y-1 > :not(:first-child) { margin-top: 1px !important; }

          /* Borders */
          .border-dashed { border-style: dashed !important; }

          /* Colors - force black for thermal printers */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .text-primary, .text-green-600, .text-red-600 { color: #000 !important; }
          .bg-gray-50 { background: transparent !important; }
        }
      `}</style>
    </div>
  );
};
