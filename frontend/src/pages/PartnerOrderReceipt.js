import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export const PartnerOrderReceipt = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orderId = searchParams.get('id');
    if (orderId) {
      fetchData(orderId);
    } else {
      toast.error('Order ID tidak ditemukan');
      navigate('/admin/partner-orders');
    }
  }, [searchParams]);

  const fetchData = async (id) => {
    try {
      const [orderRes, settingsRes] = await Promise.all([
        api.get(`/partner-orders/${id}`),
        api.get('/store-settings')
      ]);
      setOrder(orderRes.data);
      setStoreSettings(settingsRes.data);
    } catch (error) {
      toast.error('Gagal memuat data pesanan');
      navigate('/admin/partner-orders');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!order) return null;

  const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
  const grandTotal = previousDebt + order.total;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Action bar - hidden when printing */}
      <div className="no-print bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/admin/partner-orders')} data-testid="back-button">
            <ArrowLeft className="w-4 h-4 mr-2" />Kembali
          </Button>
          <Button onClick={() => window.print()} data-testid="print-receipt-button">
            <Printer className="w-4 h-4 mr-2" />Print Struk
          </Button>
        </div>
      </div>

      {/* Receipt */}
      <div className="receipt-wrapper max-w-md mx-auto p-4 sm:p-6">
        <div id="receipt-content" className="bg-white rounded-xl shadow-lg p-5 sm:p-6" data-testid="receipt-content">

          {/* Header */}
          <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-3">
            <h1 className="text-xl sm:text-2xl font-bold mb-1 receipt-store-name">{storeSettings?.store_name || 'UD. AQIN TANI'}</h1>
            <p className="text-gray-600 text-xs sm:text-sm receipt-address">{storeSettings?.address || 'Toko Obat & Alat Pertanian'}</p>
            <p className="text-xs text-gray-500 mt-1 receipt-phone">Telp: {storeSettings?.phone || '-'}</p>
          </div>

          {/* Order & Partner Info */}
          <div className="mb-3 text-sm space-y-1 receipt-info">
            <p className="font-bold text-sm mb-1 receipt-section-title">STRUK PESANAN KIOS MITRA</p>
            <div className="flex justify-between"><span className="text-gray-600">No:</span><span className="font-mono font-semibold">{order.order_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Tgl:</span><span className="font-semibold">{new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Kios:</span><span className="font-semibold">{order.partner_store_name}</span></div>
            {order.partner_phone && <div className="flex justify-between"><span className="text-gray-600">Telp Kios:</span><span>{order.partner_phone}</span></div>}
            {order.canvasser_name && <div className="flex justify-between"><span className="text-gray-600">Kanvaser:</span><span>{order.canvasser_name}</span></div>}
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3"></div>

          {/* Items Table */}
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
                {order.items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-3">{item.product_name}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right">{fmt(item.price)}</td>
                    <td className="text-right font-semibold">{fmt(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Items - Thermal print layout */}
            <div className="thermal-items">
              {order.items.map((item, i) => (
                <div key={i} className="receipt-item">
                  <div className="font-semibold">{item.product_name}</div>
                  <div className="flex justify-between">
                    <span>{item.quantity} x {fmt(item.price).replace('Rp ', '')}</span>
                    <span className="font-semibold">{fmt(item.subtotal).replace('Rp ', '')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3"></div>

          {/* Totals */}
          <div className="mb-4 space-y-2 text-sm receipt-totals">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">{fmt(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Diskon:</span>
                <span>-{fmt(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2 receipt-total-line">
              <span>TOTAL PESANAN INI:</span>
              <span className="text-primary">{fmt(order.total)}</span>
            </div>
            {order.paid > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Dibayar:</span>
                <span className="text-green-600 font-semibold">{fmt(order.paid)}</span>
              </div>
            )}
            {order.remaining > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Bon Pesanan Ini:</span>
                <span className="text-orange-600 font-semibold">{fmt(order.remaining)}</span>
              </div>
            )}
          </div>

          {/* Outstanding Balance Section */}
          {(previousDebt > 0 || order.remaining > 0) && (
            <>
              <div className="border-t-2 border-dashed border-gray-400 mb-2"></div>
              <div className="mb-3 p-3 bg-orange-50 rounded-lg space-y-1 text-sm receipt-debt-section">
                <p className="font-bold text-orange-800 mb-1 receipt-section-title">REKAP BON / HUTANG</p>
                {previousDebt > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Sisa Bon Sebelumnya:</span>
                    <span className="font-semibold text-orange-700">{fmt(previousDebt)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-700">Bon Pesanan Ini:</span>
                  <span className="font-semibold">{fmt(order.remaining)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-orange-300 pt-2 mt-1 receipt-total-line">
                  <span>TOTAL SELURUH HUTANG:</span>
                  <span className="text-red-600">{fmt(order.partner_debt_total || 0)}</span>
                </div>
              </div>
            </>
          )}

          {/* Grand Total with Debt */}
          <div className="border-t-2 border-dashed border-gray-400 mb-2"></div>
          <div className="mb-3 text-sm">
            <div className="flex justify-between text-lg font-bold receipt-grand-total">
              <span>GRAND TOTAL:</span>
              <span className="text-primary">{fmt(grandTotal)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 receipt-note">(Pesanan ini + Sisa bon sebelumnya)</p>
          </div>

          <div className="border-t border-dashed border-gray-300 mb-2"></div>

          {/* Footer */}
          <div className="text-center text-sm receipt-footer">
            <p className="font-semibold mb-2">Terima kasih atas kepercayaan Anda!</p>
            <p className="text-gray-500 text-xs receipt-note">Harap simpan struk ini sebagai bukti pesanan</p>
          </div>
        </div>
      </div>

      {/* Print styles - thermal printer optimized */}
      <style>{`
        /* Hide thermal-only elements on screen */
        .thermal-items { display: none; }

        @media print {
          /* Force consistent rendering across devices */
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
          .no-print, .receipt-wrapper > :not(#receipt-content) { display: none !important; }
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
          .receipt-section-title { font-size: 12px !important; font-weight: bold !important; }
          .receipt-info { font-size: 11px !important; line-height: 1.4 !important; }
          .receipt-info > * { margin-bottom: 0 !important; }

          /* Items */
          .screen-table { display: none !important; }
          .thermal-items { display: block !important; font-size: 11px !important; }
          .receipt-item { margin-bottom: 3px !important; line-height: 1.3 !important; }

          /* Totals */
          .receipt-totals { font-size: 11px !important; line-height: 1.4 !important; }
          .receipt-totals > * { margin-bottom: 1px !important; }
          .receipt-total-line { font-size: 13px !important; }
          .receipt-grand-total { font-size: 14px !important; }

          /* Debt section */
          .receipt-debt-section {
            background: transparent !important;
            border-radius: 0 !important;
            padding: 0 !important;
            font-size: 11px !important;
            line-height: 1.4 !important;
          }

          /* Footer & notes */
          .receipt-footer { font-size: 11px !important; }
          .receipt-note { font-size: 10px !important; }

          /* Spacing overrides */
          .mb-4, .mb-3 { margin-bottom: 3px !important; }
          .mb-2, .mb-1 { margin-bottom: 2px !important; }
          .pb-3, .pb-2 { padding-bottom: 2px !important; }
          .pt-2 { padding-top: 2px !important; }
          .p-3 { padding: 0 !important; }
          .space-y-2 > :not(:first-child), .space-y-1 > :not(:first-child) { margin-top: 1px !important; }

          /* Borders */
          .border-dashed { border-style: dashed !important; }

          /* Colors - ensure readable on thermal */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .text-primary, .text-green-600, .text-orange-600, .text-orange-700, .text-red-600 { color: #000 !important; }
          .text-orange-800 { color: #000 !important; }
        }
      `}</style>
    </div>
  );
};
