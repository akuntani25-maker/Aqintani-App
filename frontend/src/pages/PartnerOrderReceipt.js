import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { ArrowLeft, Bluetooth, Loader2, Usb } from 'lucide-react';
import { toast } from 'sonner';
import { thermalPrinter } from '../utils/ThermalPrinter';

export const PartnerOrderReceipt = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [btStatus, setBtStatus] = useState('idle');
  const [usbStatus, setUsbStatus] = useState('idle');

  const handleUSBPrint = async () => {
    if (!order) return;
    try {
      if (!thermalPrinter.isConnected() || thermalPrinter.connectionType !== 'usb') {
        setUsbStatus('connecting');
        const res = await thermalPrinter.connectUSB();
        if (!res.success) {
          toast.error(res.message);
          setUsbStatus('idle');
          return;
        }
        toast.success(res.message);
      }
      setUsbStatus('printing');
      const ok = await thermalPrinter.printPartnerOrderReceipt(order, storeSettings);
      if (ok) {
        toast.success('Struk berhasil dicetak via USB!');
      } else {
        toast.error('Gagal mencetak. Coba ulangi.');
      }
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setUsbStatus('idle');
    }
  };

  const handleBluetoothPrint = async () => {
    if (!order) return;
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
      const ok = await thermalPrinter.printPartnerOrderReceipt(order, storeSettings);
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
    const orderId = searchParams.get('id');
    if (orderId) {
      fetchData(orderId);
    } else {
      toast.error('Order ID tidak ditemukan');
      navigate(searchParams.get('from') === 'canvasser' ? '/canvasser' : '/admin/partner-orders');
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
      navigate(searchParams.get('from') === 'canvasser' ? '/canvasser' : '/admin/partner-orders');
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
  const backUrl = searchParams.get('from') === 'canvasser' ? '/canvasser' : '/admin/partner-orders';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Action bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(backUrl)} data-testid="back-button">
            <ArrowLeft className="w-4 h-4 mr-2" />Kembali
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleUSBPrint} disabled={usbStatus !== 'idle'} data-testid="usb-print-button">
              {usbStatus !== 'idle' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Usb className="w-4 h-4 mr-2" />}
              {usbStatus === 'connecting' ? 'Menghubungkan...' : usbStatus === 'printing' ? 'Mencetak...' : 'Cetak Struk USB'}
            </Button>
            <Button variant="outline" onClick={handleBluetoothPrint} disabled={btStatus !== 'idle'} data-testid="bluetooth-print-button">
              {btStatus !== 'idle' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bluetooth className="w-4 h-4 mr-2" />}
              {btStatus === 'connecting' ? 'Menghubungkan...' : btStatus === 'printing' ? 'Mencetak...' : 'Cetak Bluetooth'}
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
