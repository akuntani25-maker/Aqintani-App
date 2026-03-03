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
      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
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
      <div className="max-w-md mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
        <div id="receipt-content" className="bg-white rounded-xl shadow-lg p-5 sm:p-6 print:shadow-none print:rounded-none print:p-2 print:text-xs" data-testid="receipt-content">

          {/* Header */}
          <div className="text-center mb-4 print:mb-2 border-b-2 border-dashed border-gray-300 pb-3 print:pb-1">
            <h1 className="text-xl sm:text-2xl print:text-base font-bold mb-1">{storeSettings?.store_name || 'UD. AQIN TANI'}</h1>
            <p className="text-gray-600 text-xs sm:text-sm print:text-[10px]">{storeSettings?.address || 'Toko Obat & Alat Pertanian'}</p>
            <p className="text-xs print:text-[9px] text-gray-500 mt-1">Telp: {storeSettings?.phone || '-'}</p>
          </div>

          {/* Order & Partner Info */}
          <div className="mb-3 print:mb-1 text-sm print:text-[9px] space-y-1 print:space-y-0 print:leading-tight">
            <p className="font-bold text-sm print:text-[10px] mb-1 print:mb-0">STRUK PESANAN KIOS MITRA</p>
            <div className="flex justify-between"><span className="text-gray-600">No:</span><span className="font-mono font-semibold">{order.order_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Tgl:</span><span className="font-semibold">{new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Kios:</span><span className="font-semibold">{order.partner_store_name}</span></div>
            {order.partner_phone && <div className="flex justify-between"><span className="text-gray-600">Telp Kios:</span><span>{order.partner_phone}</span></div>}
            {order.canvasser_name && <div className="flex justify-between"><span className="text-gray-600">Kanvaser:</span><span>{order.canvasser_name}</span></div>}
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3 print:mb-2"></div>

          {/* Items - Desktop */}
          <div className="mb-4 print:mb-2">
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

            {/* Items - Thermal */}
            <div className="hidden print:block text-[9px] space-y-1">
              {order.items.map((item, i) => (
                <div key={i} className="leading-tight">
                  <div className="font-semibold">{item.product_name}</div>
                  <div className="flex justify-between">
                    <span>{item.quantity} x {fmt(item.price).replace('Rp ', '')}</span>
                    <span className="font-semibold">{fmt(item.subtotal).replace('Rp ', '')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3 print:mb-2"></div>

          {/* Totals */}
          <div className="mb-4 print:mb-2 space-y-2 print:space-y-0 text-sm print:text-[9px] print:leading-tight">
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
            <div className="flex justify-between text-lg print:text-[10px] font-bold border-t border-gray-300 pt-2 print:pt-1">
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
              <div className="border-t-2 border-dashed border-gray-400 mb-2 print:mb-1"></div>
              <div className="mb-3 print:mb-1 p-3 print:p-0 bg-orange-50 print:bg-transparent rounded-lg print:rounded-none space-y-1 print:space-y-0 text-sm print:text-[9px] print:leading-tight">
                <p className="font-bold text-orange-800 print:text-black mb-1 print:mb-0">REKAP BON / HUTANG</p>
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
                <div className="flex justify-between text-lg print:text-[10px] font-bold border-t border-orange-300 pt-2 print:pt-1 mt-1">
                  <span>TOTAL SELURUH HUTANG:</span>
                  <span className="text-red-600">{fmt(order.partner_debt_total || 0)}</span>
                </div>
              </div>
            </>
          )}

          {/* Grand Total with Debt */}
          <div className="border-t-2 border-dashed border-gray-400 mb-2 print:mb-1"></div>
          <div className="mb-3 print:mb-1 text-sm print:text-[9px] print:leading-tight">
            <div className="flex justify-between text-lg print:text-[11px] font-bold">
              <span>GRAND TOTAL:</span>
              <span className="text-primary">{fmt(grandTotal)}</span>
            </div>
            <p className="text-xs print:text-[8px] text-gray-500 mt-1">(Pesanan ini + Sisa bon sebelumnya)</p>
          </div>

          <div className="border-t border-dashed border-gray-300 mb-2 print:mb-1"></div>

          {/* Footer */}
          <div className="text-center text-sm print:text-[8px] print:leading-tight">
            <p className="font-semibold mb-2 print:mb-1">Terima kasih atas kepercayaan Anda!</p>
            <p className="text-gray-500 text-xs print:text-[7px]">Harap simpan struk ini sebagai bukti pesanan</p>
          </div>
        </div>
      </div>

      {/* Print styles - optimized for thermal printers (58mm/80mm) */}
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
          .print\\:hidden { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          h1 { margin: 0 !important; padding: 0 !important; }
          .bg-orange-50 { background: transparent !important; }
        }
      `}</style>
    </div>
  );
};
