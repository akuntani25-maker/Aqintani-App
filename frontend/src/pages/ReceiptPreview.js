import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Printer, ArrowLeft, Bluetooth, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { thermalPrinter } from '../utils/ThermalPrinter';

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

export const ReceiptPreview = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [btStatus, setBtStatus] = useState('idle');

  const handleBluetoothPrint = async () => {
    if (!transaction) return;
    try {
      if (!thermalPrinter.isConnected()) {
        setBtStatus('connecting');
        const res = await thermalPrinter.connectBluetooth();
        if (!res.success) {
          toast.error(res.message);
          setBtStatus('idle');
          return;
        }
        toast.success(res.message);
      }
      setBtStatus('printing');
      const ok = await thermalPrinter.printReceipt(transaction, storeSettings);
      if (ok) {
        toast.success('Struk berhasil dicetak via Bluetooth!');
      } else {
        toast.error('Gagal mencetak. Coba ulangi.');
      }
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setBtStatus('idle');
    }
  };

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
  const fmtShort = (v) => fmt(v).replace('Rp', '').trim();

  const handlePrint = useCallback(() => {
    if (!transaction) return;

    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || '';
    const storePhone = storeSettings?.phone || '';
    const tgl = new Date(transaction.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

    let lines = [];
    lines.push(`<center><b>${storeName}</b></center>`);
    if (storeAddr) lines.push(`<center>${storeAddr}</center>`);
    if (storePhone) lines.push(`<center>Telp: ${storePhone}</center>`);
    lines.push(SEP);
    lines.push(`No   : ${transaction.transaction_number}`);
    lines.push(`Tgl  : ${tgl}`);
    lines.push(`Kasir: ${transaction.cashier_name}`);
    lines.push(SEP);

    transaction.items.forEach(item => {
      lines.push(`<b>${item.product_name}</b>`);
      lines.push(`<r>${item.quantity} x ${fmtShort(item.price)}|${fmtShort(item.subtotal)}</r>`);
    });

    lines.push(SEP_THIN);
    lines.push(`<r>Subtotal|${fmtShort(transaction.subtotal)}</r>`);
    if (transaction.discount > 0) lines.push(`<r>Diskon|-${fmtShort(transaction.discount)}</r>`);
    if (transaction.tax > 0) lines.push(`<r>Pajak|${fmtShort(transaction.tax)}</r>`);
    lines.push(SEP);
    lines.push(`<r><b>TOTAL</b>|<b>${fmtShort(transaction.total)}</b></r>`);
    lines.push(SEP_THIN);
    lines.push(`<r>Bayar (${transaction.payment_method})|${fmtShort(transaction.payment_amount)}</r>`);
    lines.push(`<r><b>Kembali</b>|<b>${fmtShort(transaction.change)}</b></r>`);
    lines.push(SEP);
    lines.push(`<center>Terima kasih!</center>`);
    lines.push(`<center>Barang yg sudah dibeli</center>`);
    lines.push(`<center>tidak dapat ditukar</center>`);

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
  }, [transaction, storeSettings]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} data-testid="print-receipt-button">
              <Printer className="w-4 h-4 mr-2" />Print Struk
            </Button>
            <Button onClick={handleBluetoothPrint} disabled={btStatus !== 'idle'} data-testid="bluetooth-print-button">
              {btStatus !== 'idle' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bluetooth className="w-4 h-4 mr-2" />}
              {btStatus === 'connecting' ? 'Menghubungkan...' : btStatus === 'printing' ? 'Mencetak...' : 'Cetak via Bluetooth'}
            </Button>
          </div>
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
            <div className="flex justify-between"><span>No</span><span className="font-semibold">{transaction.transaction_number}</span></div>
            <div className="flex justify-between"><span>Tgl</span><span>{new Date(transaction.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
            <div className="flex justify-between"><span>Kasir</span><span>{transaction.cashier_name}</span></div>
          </div>

          <div className="border-t border-gray-300 my-2"></div>

          {transaction.items.map((item, i) => (
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
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(transaction.subtotal)}</span></div>
            {transaction.discount > 0 && <div className="flex justify-between text-red-600"><span>Diskon</span><span>-{fmt(transaction.discount)}</span></div>}
            {transaction.tax > 0 && <div className="flex justify-between"><span>Pajak</span><span>{fmt(transaction.tax)}</span></div>}
          </div>

          <div className="border-t border-gray-800 my-2"></div>
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span><span>{fmt(transaction.total)}</span>
          </div>

          <div className="border-t border-gray-300 my-2"></div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between"><span>Bayar ({transaction.payment_method})</span><span>{fmt(transaction.payment_amount)}</span></div>
            <div className="flex justify-between font-bold"><span>Kembali</span><span className="text-green-600">{fmt(transaction.change)}</span></div>
          </div>

          <div className="border-t border-gray-800 my-2"></div>
          <div className="text-center text-xs text-gray-600">
            <p className="font-semibold">Terima kasih!</p>
            <p>Penukaran atau retur barang hanya berlaku</p>
            <p>2 hari setelah pembelian barang</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Tips:</strong> Pastikan printer sudah terhubung dan aktif.
          </p>
        </div>
      </div>
    </div>
  );
};
