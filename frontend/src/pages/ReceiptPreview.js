import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { ArrowLeft, Bluetooth, Loader2, Usb } from 'lucide-react';
import { toast } from 'sonner';
import { thermalPrinter } from '../utils/ThermalPrinter';

export const ReceiptPreview = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [btStatus, setBtStatus] = useState('idle');
  const [usbStatus, setUsbStatus] = useState('idle');

  const handleUSBPrint = async () => {
    if (!transaction) return;
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
      const ok = await thermalPrinter.printReceipt(transaction, storeSettings);
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
