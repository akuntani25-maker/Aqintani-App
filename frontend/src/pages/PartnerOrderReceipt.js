import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { ArrowLeft, Bluetooth, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { thermalPrinter } from '../utils/ThermalPrinter';

const SEP = '================================';
const CHAR_W = 32;

function rightAlign(left, right) {
  const gap = Math.max(1, CHAR_W - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

function browserPrintFallback(lines, title = 'Struk') {
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) { toast.error('Pop-up diblokir. Izinkan pop-up untuk mencetak.'); return; }
  const body = lines.map(l => {
    if (l.startsWith('##')) return `<div style="text-align:center;font-weight:bold;font-size:13px">${l.slice(2)}</div>`;
    if (l.startsWith('#')) return `<div style="text-align:center;font-size:11px">${l.slice(1)}</div>`;
    if (l === SEP) return `<div style="border-top:1px dashed #000;margin:3px 0"></div>`;
    if (l.startsWith('**')) return `<div style="font-weight:bold">${l.slice(2)}</div>`;
    return `<div>${l}</div>`;
  }).join('');
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
@page{size:58mm auto;margin:0}*{margin:0;padding:0;box-sizing:border-box}
body{width:48mm;max-width:48mm;padding:2mm 1mm;font:12px/1.5 'Courier New',monospace;color:#000;-webkit-text-size-adjust:none}
@media print{body{width:48mm;max-width:48mm;padding:1mm 0.5mm;font-size:12px}@page{size:58mm auto;margin:0}}
div{white-space:pre-wrap;word-break:break-all}</style></head><body>${body}</body></html>`);
  win.document.close(); win.focus();
  setTimeout(() => { win.print(); setTimeout(() => win.close(), 500); }, 300);
}

export const PartnerOrderReceipt = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printStatus, setPrintStatus] = useState('idle');
  const [btStatus, setBtStatus] = useState('idle');
  const [serverAvailable, setServerAvailable] = useState(null);

  useEffect(() => {
    thermalPrinter.checkLocalServer().then(ok => setServerAvailable(ok));
  }, []);

  const handlePrint = async () => {
    if (!order) return;
    setPrintStatus('printing');
    try {
      const serverOk = await thermalPrinter.checkLocalServer();
      if (serverOk) {
        await thermalPrinter.printPartnerOrderViaServer(order, storeSettings);
        toast.success('Struk berhasil dicetak via Print Server!');
        setPrintStatus('idle');
        return;
      }
    } catch (err) { console.warn('Print server failed:', err); }

    // Fallback: browser print
    const fmtN = (v) => new Intl.NumberFormat('id-ID').format(v);
    const tgl = new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
    const gTotal = previousDebt + order.total;
    const lines = [];
    lines.push(`##${storeName}`);
    if (storeSettings?.address) lines.push(`#${storeSettings.address}`);
    if (storeSettings?.phone) lines.push(`#Telp: ${storeSettings.phone}`);
    lines.push(SEP);
    lines.push(`**STRUK PESANAN KIOS MITRA`);
    lines.push(`No   : ${order.order_number}`);
    lines.push(`Tgl  : ${tgl}`);
    lines.push(`Kios : ${order.partner_store_name}`);
    if (order.partner_phone) lines.push(`Telp : ${order.partner_phone}`);
    if (order.canvasser_name) lines.push(`Sales: ${order.canvasser_name}`);
    lines.push(SEP);
    order.items.forEach(item => {
      lines.push(`**${item.product_name}`);
      lines.push(rightAlign(`  ${item.quantity} x ${fmtN(item.price)}`, fmtN(item.subtotal)));
    });
    lines.push(SEP);
    lines.push(rightAlign('Subtotal', fmtN(order.subtotal)));
    if (order.discount > 0) lines.push(rightAlign('Diskon', '-' + fmtN(order.discount)));
    lines.push(SEP);
    lines.push(rightAlign('**TOTAL', fmtN(order.total)));
    if (order.paid > 0) lines.push(rightAlign('Dibayar', fmtN(order.paid)));
    if (order.remaining > 0) lines.push(rightAlign('Sisa Bon', fmtN(order.remaining)));
    if (previousDebt > 0 || order.remaining > 0) {
      lines.push(SEP);
      lines.push(`**REKAP BON / HUTANG`);
      if (previousDebt > 0) lines.push(rightAlign('Bon Sebelumnya', fmtN(previousDebt)));
      lines.push(rightAlign('Bon Pesanan Ini', fmtN(order.remaining)));
      lines.push(SEP);
      lines.push(rightAlign('**TOTAL HUTANG', fmtN(order.partner_debt_total || 0)));
    }
    lines.push(SEP);
    lines.push(rightAlign('**GRAND TOTAL', fmtN(gTotal)));
    lines.push(SEP);
    lines.push(`#Terima kasih!`);
    lines.push(`#Simpan struk sebagai bukti`);
    browserPrintFallback(lines, 'Struk Kios Mitra');
    setPrintStatus('idle');
  };

  const handleBluetoothPrint = async () => {
    if (!order) return;
    try {
      if (!thermalPrinter.isConnected()) {
        setBtStatus('connecting');
        const res = await thermalPrinter.connectBluetooth();
        if (!res.success) { toast.error(res.message); setBtStatus('idle'); return; }
        toast.success(res.message);
      }
      setBtStatus('printing');
      const ok = await thermalPrinter.printPartnerOrderReceipt(order, storeSettings);
      if (ok) toast.success('Struk berhasil dicetak via Bluetooth!');
      else toast.error('Gagal mencetak. Coba ulangi.');
    } catch (err) { toast.error('Error: ' + err.message); }
    finally { setBtStatus('idle'); }
  };

  useEffect(() => {
    const orderId = searchParams.get('id');
    if (orderId) fetchData(orderId);
    else { toast.error('Order ID tidak ditemukan'); navigate(searchParams.get('from') === 'canvasser' ? '/canvasser' : '/admin/partner-orders'); }
  }, [searchParams]);

  const fetchData = async (id) => {
    try {
      const [orderRes, settingsRes] = await Promise.all([api.get(`/partner-orders/${id}`), api.get('/store-settings')]);
      setOrder(orderRes.data);
      setStoreSettings(settingsRes.data);
    } catch { toast.error('Gagal memuat data pesanan'); navigate(searchParams.get('from') === 'canvasser' ? '/canvasser' : '/admin/partner-orders'); }
    finally { setLoading(false); }
  };

  const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  if (!order) return null;

  const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
  const grandTotal = previousDebt + order.total;
  const backUrl = searchParams.get('from') === 'canvasser' ? '/canvasser' : '/admin/partner-orders';

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(backUrl)} data-testid="back-button">
            <ArrowLeft className="w-4 h-4 mr-2" />Kembali
          </Button>
          <div className="flex gap-2">
            <Button onClick={handlePrint} disabled={printStatus !== 'idle'} data-testid="print-receipt-button">
              {printStatus !== 'idle' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
              {printStatus === 'printing' ? 'Mencetak...' : 'Cetak Struk'}
            </Button>
            <Button variant="outline" onClick={handleBluetoothPrint} disabled={btStatus !== 'idle'} data-testid="bluetooth-print-button">
              {btStatus !== 'idle' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bluetooth className="w-4 h-4 mr-2" />}
              {btStatus === 'connecting' ? 'Menghubungkan...' : btStatus === 'printing' ? 'Mencetak...' : 'Cetak Bluetooth'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-xl shadow-lg p-5 sm:p-6 text-sm" style={{fontFamily: "'Courier New', monospace"}} data-testid="receipt-content">
          <div className="text-center mb-3 pb-3 border-b border-gray-300">
            <h1 className="text-lg font-bold">{storeSettings?.store_name || 'UD. AQIN TANI'}</h1>
            <p className="text-xs text-gray-600">{storeSettings?.address || ''}</p>
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
              <div className="flex justify-between"><span>{item.quantity} x {fmt(item.price)}</span><span className="font-semibold">{fmt(item.subtotal)}</span></div>
            </div>
          ))}
          <div className="border-t border-gray-300 my-2"></div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-red-600"><span>Diskon</span><span>-{fmt(order.discount)}</span></div>}
          </div>
          <div className="border-t border-gray-800 my-2"></div>
          <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{fmt(order.total)}</span></div>
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
          <div className="flex justify-between font-bold text-sm"><span>GRAND TOTAL</span><span>{fmt(grandTotal)}</span></div>
          <div className="border-t border-gray-300 my-2"></div>
          <div className="text-center text-xs text-gray-600">
            <p className="font-semibold">Terima kasih!</p>
            <p>Simpan struk sebagai bukti pesanan</p>
          </div>
        </div>
        <div className={`mt-4 p-3 rounded-lg border text-sm ${serverAvailable ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`} data-testid="print-server-status">
          {serverAvailable ? (
            <p><strong>Print Server terdeteksi.</strong> Struk akan dicetak menggunakan font firmware printer (kualitas terbaik).</p>
          ) : (
            <div>
              <p><strong>Print Server tidak aktif.</strong> "Cetak Struk" akan menggunakan browser print.</p>
              <p className="mt-1">Untuk kualitas terbaik, <a href={`${process.env.REACT_APP_BACKEND_URL}/api/download/print-server`} download="print_server.py" className="underline font-semibold hover:text-amber-900">download print_server.py</a> dan jalankan di PC Anda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
