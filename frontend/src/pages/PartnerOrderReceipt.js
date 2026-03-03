import React, { useEffect, useState, useCallback } from 'react';
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

  const handlePrint = useCallback(() => {
    if (!order) return;

    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || 'Toko Obat & Alat Pertanian';
    const storePhone = storeSettings?.phone || '-';

    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
    const gTotal = previousDebt + order.total;

    const itemsHTML = order.items.map(item => `
      <div style="margin-bottom:1px"><b>${item.product_name}</b></div>
      <div style="display:flex;justify-content:space-between"><span>${item.quantity} x ${fmt(item.price).replace('Rp','').trim()}</span><b>${fmt(item.subtotal).replace('Rp','').trim()}</b></div>
    `).join('');

    let debtHTML = '';
    if (previousDebt > 0 || order.remaining > 0) {
      debtHTML = `
        <div style="border-top:2px dashed #000;margin:2px 0"></div>
        <div><b>REKAP BON / HUTANG</b></div>
        ${previousDebt > 0 ? `<div style="display:flex;justify-content:space-between"><span>Bon Sebelumnya:</span><b>${fmt(previousDebt).replace('Rp','').trim()}</b></div>` : ''}
        <div style="display:flex;justify-content:space-between"><span>Bon Pesanan Ini:</span><b>${fmt(order.remaining).replace('Rp','').trim()}</b></div>
        <div style="border-top:1px dashed #000;margin:2px 0"></div>
        <div style="display:flex;justify-content:space-between;font-size:12px"><b>TOTAL HUTANG:</b><b>${fmt(order.partner_debt_total || 0).replace('Rp','').trim()}</b></div>
      `;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:48mm;max-width:48mm;padding:1mm;font:10px/1.3 sans-serif;-webkit-text-size-adjust:100%}
@page{margin:0}
b{font-weight:700}
</style></head><body>
<div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:2px;margin-bottom:2px">
<div style="font-size:13px;font-weight:bold">${storeName}</div>
<div style="font-size:8px">${storeAddr}</div>
<div style="font-size:8px">Telp: ${storePhone}</div>
</div>
<div><b>STRUK PESANAN KIOS MITRA</b></div>
<div style="display:flex;justify-content:space-between"><span>No:</span><b>${order.order_number}</b></div>
<div style="display:flex;justify-content:space-between"><span>Tgl:</span><b>${new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</b></div>
<div style="display:flex;justify-content:space-between"><span>Kios:</span><b>${order.partner_store_name}</b></div>
${order.partner_phone ? `<div style="display:flex;justify-content:space-between"><span>Telp:</span><span>${order.partner_phone}</span></div>` : ''}
${order.canvasser_name ? `<div style="display:flex;justify-content:space-between"><span>Kanvaser:</span><span>${order.canvasser_name}</span></div>` : ''}
<div style="border-top:1px dashed #000;margin:2px 0"></div>
${itemsHTML}
<div style="border-top:1px dashed #000;margin:2px 0"></div>
<div style="display:flex;justify-content:space-between"><span>Subtotal:</span><b>${fmt(order.subtotal).replace('Rp','').trim()}</b></div>
${order.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Diskon:</span><span>-${fmt(order.discount).replace('Rp','').trim()}</span></div>` : ''}
<div style="border-top:1px solid #000;margin:2px 0"></div>
<div style="display:flex;justify-content:space-between;font-size:12px"><b>TOTAL:</b><b>${fmt(order.total).replace('Rp','').trim()}</b></div>
${order.paid > 0 ? `<div style="display:flex;justify-content:space-between"><span>Dibayar:</span><b>${fmt(order.paid).replace('Rp','').trim()}</b></div>` : ''}
${order.remaining > 0 ? `<div style="display:flex;justify-content:space-between"><span>Sisa Bon:</span><b>${fmt(order.remaining).replace('Rp','').trim()}</b></div>` : ''}
${debtHTML}
<div style="border-top:2px dashed #000;margin:2px 0"></div>
<div style="display:flex;justify-content:space-between;font-size:13px"><b>GRAND TOTAL:</b><b>${fmt(gTotal).replace('Rp','').trim()}</b></div>
<div style="font-size:8px;color:#666">(Pesanan ini + Sisa bon)</div>
<div style="border-top:1px dashed #000;margin:2px 0"></div>
<div style="text-align:center;font-size:9px"><b>Terima kasih!</b></div>
<div style="text-align:center;font-size:8px;color:#666">Simpan struk sebagai bukti pesanan</div>
</body></html>`;

    const win = window.open('', '', 'width=400,height=600');
    if (!win) { toast.error('Popup diblokir. Izinkan popup untuk mencetak.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); win.close(); } catch(e) { console.error(e); } }, 400);
  }, [order, storeSettings]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!order) return null;

  const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
  const grandTotal = previousDebt + order.total;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Action bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/admin/partner-orders')} data-testid="back-button">
            <ArrowLeft className="w-4 h-4 mr-2" />Kembali
          </Button>
          <Button onClick={handlePrint} data-testid="print-receipt-button">
            <Printer className="w-4 h-4 mr-2" />Print Struk
          </Button>
        </div>
      </div>

      {/* On-screen Receipt Preview */}
      <div className="max-w-md mx-auto p-4 sm:p-6">
        <div id="receipt-content" className="bg-white rounded-xl shadow-lg p-5 sm:p-6" data-testid="receipt-content">

          {/* Header */}
          <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-3">
            <h1 className="text-xl sm:text-2xl font-bold mb-1">{storeSettings?.store_name || 'UD. AQIN TANI'}</h1>
            <p className="text-gray-600 text-xs sm:text-sm">{storeSettings?.address || 'Toko Obat & Alat Pertanian'}</p>
            <p className="text-xs text-gray-500 mt-1">Telp: {storeSettings?.phone || '-'}</p>
          </div>

          {/* Order Info */}
          <div className="mb-3 text-sm space-y-1">
            <p className="font-bold text-sm mb-1">STRUK PESANAN KIOS MITRA</p>
            <div className="flex justify-between"><span className="text-gray-600">No:</span><span className="font-mono font-semibold">{order.order_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Tgl:</span><span className="font-semibold">{new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Kios:</span><span className="font-semibold">{order.partner_store_name}</span></div>
            {order.partner_phone && <div className="flex justify-between"><span className="text-gray-600">Telp Kios:</span><span>{order.partner_phone}</span></div>}
            {order.canvasser_name && <div className="flex justify-between"><span className="text-gray-600">Kanvaser:</span><span>{order.canvasser_name}</span></div>}
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3"></div>

          {/* Items */}
          <div className="mb-4">
            <table className="w-full text-sm">
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
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3"></div>

          {/* Totals */}
          <div className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">{fmt(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Diskon:</span><span>-{fmt(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
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

          {/* Outstanding Balance */}
          {(previousDebt > 0 || order.remaining > 0) && (
            <>
              <div className="border-t-2 border-dashed border-gray-400 mb-2"></div>
              <div className="mb-3 p-3 bg-orange-50 rounded-lg space-y-1 text-sm">
                <p className="font-bold text-orange-800 mb-1">REKAP BON / HUTANG</p>
                {previousDebt > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">Bon Sebelumnya:</span>
                    <span className="font-semibold text-orange-700">{fmt(previousDebt)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-700">Bon Pesanan Ini:</span>
                  <span className="font-semibold">{fmt(order.remaining)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-orange-300 pt-2 mt-1">
                  <span>TOTAL HUTANG:</span>
                  <span className="text-red-600">{fmt(order.partner_debt_total || 0)}</span>
                </div>
              </div>
            </>
          )}

          {/* Grand Total */}
          <div className="border-t-2 border-dashed border-gray-400 mb-2"></div>
          <div className="mb-3 text-sm">
            <div className="flex justify-between text-lg font-bold">
              <span>GRAND TOTAL:</span>
              <span className="text-primary">{fmt(grandTotal)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">(Pesanan ini + Sisa bon sebelumnya)</p>
          </div>

          <div className="border-t border-dashed border-gray-300 mb-2"></div>

          {/* Footer */}
          <div className="text-center text-sm">
            <p className="font-semibold mb-2">Terima kasih atas kepercayaan Anda!</p>
            <p className="text-gray-500 text-xs">Harap simpan struk ini sebagai bukti pesanan</p>
          </div>
        </div>
      </div>
    </div>
  );
};
