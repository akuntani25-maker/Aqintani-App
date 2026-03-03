import React, { useEffect, useState, useCallback } from 'react';
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

  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

  const handlePrint = useCallback(() => {
    if (!transaction) return;

    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || 'Toko Obat & Alat Pertanian';
    const storePhone = storeSettings?.phone || '-';
    const storeEmail = storeSettings?.email || '';

    const itemsHTML = transaction.items.map(item => `
      <div style="margin-bottom:1px"><b>${item.product_name}</b></div>
      <div style="display:flex;justify-content:space-between"><span>${item.quantity} x ${fmt(item.price).replace('Rp','').trim()}</span><b>${fmt(item.subtotal).replace('Rp','').trim()}</b></div>
    `).join('');

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
<div style="font-size:8px">Telp: ${storePhone}${storeEmail ? ' | ' + storeEmail : ''}</div>
</div>
<div style="display:flex;justify-content:space-between"><span>No:</span><b>${transaction.transaction_number}</b></div>
<div style="display:flex;justify-content:space-between"><span>Tgl:</span><b>${new Date(transaction.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</b></div>
<div style="display:flex;justify-content:space-between"><span>Kasir:</span><b>${transaction.cashier_name}</b></div>
<div style="border-top:1px dashed #000;margin:2px 0"></div>
${itemsHTML}
<div style="border-top:1px dashed #000;margin:2px 0"></div>
<div style="display:flex;justify-content:space-between"><span>Subtotal:</span><b>${fmt(transaction.subtotal).replace('Rp','').trim()}</b></div>
${transaction.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Diskon:</span><span>-${fmt(transaction.discount).replace('Rp','').trim()}</span></div>` : ''}
${transaction.tax > 0 ? `<div style="display:flex;justify-content:space-between"><span>Pajak:</span><b>${fmt(transaction.tax).replace('Rp','').trim()}</b></div>` : ''}
<div style="border-top:1px solid #000;margin:2px 0"></div>
<div style="display:flex;justify-content:space-between;font-size:12px"><b>TOTAL:</b><b>${fmt(transaction.total).replace('Rp','').trim()}</b></div>
<div style="border-top:1px dashed #000;margin:2px 0"></div>
<div style="display:flex;justify-content:space-between"><span>Bayar (${transaction.payment_method}):</span><b>${fmt(transaction.payment_amount).replace('Rp','').trim()}</b></div>
<div style="display:flex;justify-content:space-between;font-size:11px"><b>Kembali:</b><b>${fmt(transaction.change).replace('Rp','').trim()}</b></div>
<div style="border-top:1px dashed #000;margin:2px 0"></div>
<div style="text-align:center;font-size:9px"><b>Terima kasih!</b></div>
<div style="text-align:center;font-size:8px;color:#666">Barang yg sudah dibeli tidak dapat ditukar</div>
</body></html>`;

    const win = window.open('', '', 'width=400,height=600');
    if (!win) { toast.error('Popup diblokir. Izinkan popup untuk mencetak.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); win.close(); } catch(e) { console.error(e); } }, 400);
  }, [transaction, storeSettings]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!transaction) return null;

  return (
    <div className="min-h-screen bg-gradient-mesh">
      {/* Action Buttons */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/pos')} data-testid="back-to-pos-button">
            <ArrowLeft className="w-4 h-4 mr-2" />Kembali ke POS
          </Button>
          <Button variant="default" onClick={handlePrint} className="shadow-lg" data-testid="print-receipt-button">
            <Printer className="w-4 h-4 mr-2" />Print Struk
          </Button>
        </div>
      </div>

      {/* On-screen Receipt Preview */}
      <div className="max-w-md mx-auto p-4 sm:p-6">
        <div id="receipt-content" className="bg-white rounded-xl shadow-lg p-5 sm:p-6" data-testid="receipt-content">

          {/* Header */}
          <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-3">
            <h1 className="text-xl sm:text-2xl font-bold mb-1">
              {storeSettings?.store_name || 'UD. AQIN TANI'}
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm">
              {storeSettings?.address || 'Toko Obat & Alat Pertanian'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Telp: {storeSettings?.phone || '(021) 1234-5678'}
              {storeSettings?.email && (<><br />Email: {storeSettings.email}</>)}
            </p>
          </div>

          {/* Transaction Info */}
          <div className="mb-4 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">No:</span>
                <span className="font-mono font-semibold">{transaction.transaction_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tgl:</span>
                <span className="font-semibold">
                  {new Date(transaction.created_at).toLocaleString('id-ID', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit'
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
                {transaction.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
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
          <div className="mb-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{fmt(transaction.subtotal)}</span>
              </div>
              {transaction.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Diskon:</span><span className="font-semibold">-{fmt(transaction.discount)}</span>
                </div>
              )}
              {transaction.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Pajak:</span>
                  <span className="font-semibold">{fmt(transaction.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t-2 border-gray-300 pt-2 mt-2">
                <span>TOTAL:</span>
                <span className="text-primary">{fmt(transaction.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bayar ({transaction.payment_method}):</span>
                <span className="font-semibold">{fmt(transaction.payment_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-600">
                <span>Kembali:</span><span>{fmt(transaction.change)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3"></div>

          {/* Footer */}
          <div className="text-center text-sm">
            <p className="font-semibold mb-2">Terima kasih!</p>
            <p className="text-gray-600 text-xs mb-1">Barang yang sudah dibeli tidak dapat ditukar</p>
            <p className="text-gray-500 text-xs">Simpan struk sebagai bukti pembelian</p>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Tips:</strong> Pastikan printer sudah terhubung dan aktif. Anda bisa memilih printer mana yang akan digunakan di dialog print.
          </p>
        </div>
      </div>
    </div>
  );
};
