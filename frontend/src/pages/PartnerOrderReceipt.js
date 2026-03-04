import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const SEP = '================================';
const SEP_THIN = '--------------------------------';

function printViaIframe(html) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow.focus();
  setTimeout(() => {
    try { iframe.contentWindow.print(); } catch (e) { console.error(e); }
    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  }, 300);
}

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
  const fmtShort = (v) => fmt(v).replace('Rp', '').trim();

  const handlePrint = useCallback(() => {
    if (!order) return;

    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || '';
    const storePhone = storeSettings?.phone || '';

    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
    const gTotal = previousDebt + order.total;
    const tgl = new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

    let lines = [];
    lines.push(`<center><b>${storeName}</b></center>`);
    if (storeAddr) lines.push(`<center>${storeAddr}</center>`);
    if (storePhone) lines.push(`<center>Telp: ${storePhone}</center>`);
    lines.push(SEP);
    lines.push(`<b>STRUK PESANAN KIOS MITRA</b>`);
    lines.push(`No   : ${order.order_number}`);
    lines.push(`Tgl  : ${tgl}`);
    lines.push(`Kios : ${order.partner_store_name}`);
    if (order.partner_phone) lines.push(`Telp : ${order.partner_phone}`);
    if (order.canvasser_name) lines.push(`Sales: ${order.canvasser_name}`);
    lines.push(SEP);

    order.items.forEach(item => {
      lines.push(`<b>${item.product_name}</b>`);
      lines.push(`<r>${item.quantity} x ${fmtShort(item.price)}|${fmtShort(item.subtotal)}</r>`);
    });

    lines.push(SEP_THIN);
    lines.push(`<r>Subtotal|${fmtShort(order.subtotal)}</r>`);
    if (order.discount > 0) lines.push(`<r>Diskon|-${fmtShort(order.discount)}</r>`);
    lines.push(SEP);
    lines.push(`<r><b>TOTAL</b>|<b>${fmtShort(order.total)}</b></r>`);
    if (order.paid > 0) lines.push(`<r>Dibayar|${fmtShort(order.paid)}</r>`);
    if (order.remaining > 0) lines.push(`<r>Sisa Bon|${fmtShort(order.remaining)}</r>`);

    if (previousDebt > 0 || order.remaining > 0) {
      lines.push(SEP);
      lines.push(`<b>REKAP BON / HUTANG</b>`);
      if (previousDebt > 0) lines.push(`<r>Bon Sebelumnya|${fmtShort(previousDebt)}</r>`);
      lines.push(`<r>Bon Pesanan Ini|${fmtShort(order.remaining)}</r>`);
      lines.push(SEP_THIN);
      lines.push(`<r><b>TOTAL HUTANG</b>|<b>${fmtShort(order.partner_debt_total || 0)}</b></r>`);
    }

    lines.push(SEP);
    lines.push(`<r><b>GRAND TOTAL</b>|<b>${fmtShort(gTotal)}</b></r>`);
    lines.push(SEP_THIN);
    lines.push(`<center>Terima kasih!</center>`);
    lines.push(`<center>Simpan struk sebagai bukti</center>`);

    const bodyHTML = lines.map(line => {
      if (line === SEP || line === SEP_THIN) return `<div class="sep">${line}</div>`;
      if (line.startsWith('<center>')) return `<div class="c">${line.replace(/<\/?center>/g, '')}</div>`;
      if (line.startsWith('<r>')) {
        const content = line.replace(/<\/?r>/g, '');
        const [left, right] = content.split('|');
        return `<div class="row"><span>${left}</span><span>${right}</span></div>`;
      }
      return `<div>${line}</div>`;
    }).join('\n');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:48mm;max-width:48mm;padding:1mm 0.5mm;font:11px/1.4 'Merchant Copy',monospace;-webkit-text-size-adjust:100%;color:#000}
@font-face{font-family:'Merchant Copy';src:url('/fonts/MerchantCopy.ttf') format('truetype');font-display:swap}
@page{margin:0}
b{font-weight:900}
.sep{overflow:hidden;letter-spacing:-0.5px;font-size:9px;line-height:1}
.c{text-align:center}
.row{display:flex;justify-content:space-between}
</style></head><body>${bodyHTML}</body></html>`;

    printViaIframe(html);
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

      {/* On-screen Preview */}
      <div className="max-w-md mx-auto p-4 sm:p-6">
        <div id="receipt-content" className="bg-white rounded-xl shadow-lg p-5 sm:p-6 text-sm" style={{fontFamily: "'Merchant Copy', monospace"}} data-testid="receipt-content">
          <div className="text-center mb-3 pb-3 border-b border-gray-300">
            <h1 className="text-lg font-bold">{storeSettings?.store_name || 'UD. AQIN TANI'}</h1>
            <p className="text-xs text-gray-600">{storeSettings?.address || 'Toko Obat & Alat Pertanian'}</p>
            <p className="text-xs text-gray-500">Telp: {storeSettings?.phone || '-'}</p>
          </div>

          <div className="mb-3 text-xs space-y-0.5">
            <p className="font-bold text-sm">STRUK PESANAN KIOS MITRA</p>
            <div className="flex justify-between"><span>No</span><span className="font-semibold">{order.order_number}</span></div>
            <div className="flex justify-between"><span>Tgl</span><span>{new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
            <div className="flex justify-between"><span>Kios</span><span className="font-semibold">{order.partner_store_name}</span></div>
          </div>

          <div className="border-t border-gray-300 my-2"></div>

          {order.items.map((item, i) => (
            <div key={i} className="mb-1 text-xs">
              <div className="font-semibold">{item.product_name}</div>
              <div className="flex justify-between">
                <span>{item.quantity} x {fmt(item.price)}</span>
                <span className="font-semibold">{fmt(item.subtotal)}</span>
              </div>
            </div>
          ))}

          <div className="border-t border-gray-300 my-2"></div>

          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-red-600"><span>Diskon</span><span>-{fmt(order.discount)}</span></div>}
          </div>

          <div className="border-t border-gray-800 my-2"></div>
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span><span>{fmt(order.total)}</span>
          </div>
          {order.paid > 0 && <div className="flex justify-between text-xs"><span>Dibayar</span><span className="text-green-600">{fmt(order.paid)}</span></div>}
          {order.remaining > 0 && <div className="flex justify-between text-xs"><span>Sisa Bon</span><span className="text-orange-600">{fmt(order.remaining)}</span></div>}

          {(previousDebt > 0 || order.remaining > 0) && (
            <>
              <div className="border-t border-gray-800 my-2"></div>
              <p className="font-bold text-xs">REKAP BON / HUTANG</p>
              {previousDebt > 0 && <div className="flex justify-between text-xs"><span>Bon Sebelumnya</span><span>{fmt(previousDebt)}</span></div>}
              <div className="flex justify-between text-xs"><span>Bon Pesanan Ini</span><span>{fmt(order.remaining)}</span></div>
              <div className="border-t border-gray-300 my-1"></div>
              <div className="flex justify-between font-bold text-xs"><span>TOTAL HUTANG</span><span className="text-red-600">{fmt(order.partner_debt_total || 0)}</span></div>
            </>
          )}

          <div className="border-t border-gray-800 my-2"></div>
          <div className="flex justify-between font-bold text-sm">
            <span>GRAND TOTAL</span><span>{fmt(grandTotal)}</span>
          </div>

          <div className="border-t border-gray-300 my-2"></div>
          <div className="text-center text-xs text-gray-600">
            <p className="font-semibold">Terima kasih!</p>
            <p>Simpan struk sebagai bukti pesanan</p>
          </div>
        </div>
      </div>
    </div>
  );
};
