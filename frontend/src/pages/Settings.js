import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Printer, Usb, Bluetooth, CheckCircle, XCircle, Settings as SettingsIcon } from 'lucide-react';
import ThermalPrinter from '../utils/ThermalPrinter';

export const Settings = () => {
  const [printer] = useState(() => new ThermalPrinter());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState(localStorage.getItem('printerType') || 'usb');
  const [loading, setLoading] = useState(false);
  const [autoPrint, setAutoPrint] = useState(localStorage.getItem('autoPrint') === 'true');

  useEffect(() => {
    setIsConnected(printer.isConnected());
  }, [printer]);

  const handleConnectUSB = async () => {
    setLoading(true);
    try {
      const result = await printer.connectUSB();
      if (result.success) {
        setIsConnected(true);
        setConnectionType('usb');
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Gagal menghubungkan printer USB');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectBluetooth = async () => {
    setLoading(true);
    try {
      const result = await printer.connectBluetooth();
      if (result.success) {
        setIsConnected(true);
        setConnectionType('bluetooth');
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Gagal menghubungkan printer Bluetooth');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await printer.disconnect();
      setIsConnected(false);
      toast.success('Printer diputus');
    } catch (error) {
      toast.error('Gagal memutus printer');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    if (!isConnected) {
      toast.error('Printer belum terhubung');
      return;
    }
    
    setLoading(true);
    try {
      const success = await printer.testPrint();
      if (success) {
        toast.success('Test print berhasil! Cek printer Anda');
      } else {
        toast.error('Test print gagal');
      }
    } catch (error) {
      toast.error('Gagal melakukan test print');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoPrint = () => {
    const newValue = !autoPrint;
    setAutoPrint(newValue);
    localStorage.setItem('autoPrint', newValue.toString());
    toast.success(newValue ? 'Auto print diaktifkan' : 'Auto print dinonaktifkan');
  };

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pengaturan Printer</h1>
        <p className="text-sm text-muted-foreground mt-2">Konfigurasi printer thermal POS 58 RPP02N</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isConnected ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Printer className={`w-6 h-6 ${isConnected ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Status Printer</h2>
              <div className="flex items-center gap-2 mt-1">
                {isConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Terhubung via {connectionType.toUpperCase()}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Tidak terhubung</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {isConnected && (
            <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                ✓ Printer siap digunakan untuk cetak struk
              </p>
            </div>
          )}

          <div className="space-y-3">
            {isConnected ? (
              <>
                <Button
                  onClick={handleTestPrint}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                  data-testid="test-print-button"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {loading ? 'Mencetak...' : 'Test Print'}
                </Button>
                <Button
                  onClick={handleDisconnect}
                  disabled={loading}
                  variant="destructive"
                  className="w-full"
                  data-testid="disconnect-button"
                >
                  Putuskan Koneksi
                </Button>
              </>
            ) : null}
          </div>
        </Card>

        {/* Connection Card */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Koneksi Printer
          </h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
              <p className="text-xs text-blue-800 mb-2 font-medium">💡 Tips Koneksi:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• USB: Pastikan printer sudah dinyalakan dan terhubung ke komputer</li>
                <li>• Bluetooth: Aktifkan Bluetooth di printer dan perangkat Anda</li>
                <li>• Browser yang didukung: Chrome, Edge (terbaru)</li>
              </ul>
            </div>

            <Button
              onClick={handleConnectUSB}
              disabled={loading || isConnected}
              className="w-full h-14 text-base"
              data-testid="connect-usb-button"
            >
              <Usb className="w-5 h-5 mr-3" />
              <div className="text-left flex-1">
                <div className="font-semibold">Hubungkan via USB</div>
                <div className="text-xs opacity-80">Koneksi kabel langsung</div>
              </div>
            </Button>

            <Button
              onClick={handleConnectBluetooth}
              disabled={loading || isConnected}
              variant="outline"
              className="w-full h-14 text-base"
              data-testid="connect-bluetooth-button"
            >
              <Bluetooth className="w-5 h-5 mr-3" />
              <div className="text-left flex-1">
                <div className="font-semibold">Hubungkan via Bluetooth</div>
                <div className="text-xs opacity-80">Koneksi wireless</div>
              </div>
            </Button>
          </div>
        </Card>

        {/* Auto Print Settings */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-6">Pengaturan Auto Print</h2>
          
          <div className="flex items-start justify-between">
            <div>
              <Label className="text-base font-medium">Cetak Otomatis Setelah Transaksi</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Struk akan dicetak secara otomatis setelah transaksi berhasil
              </p>
            </div>
            <Button
              onClick={handleToggleAutoPrint}
              variant={autoPrint ? "default" : "outline"}
              data-testid="auto-print-toggle"
            >
              {autoPrint ? 'Aktif' : 'Nonaktif'}
            </Button>
          </div>
        </Card>

        {/* Printer Info */}
        <Card className="p-6 lg:col-span-2 bg-gradient-to-br from-accent to-accent/50">
          <h3 className="font-semibold mb-3">Informasi Printer</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Model</p>
              <p className="font-medium">POS 58 RPP02N</p>
            </div>
            <div>
              <p className="text-muted-foreground">Lebar Kertas</p>
              <p className="font-medium">58mm (32 karakter)</p>
            </div>
            <div>
              <p className="text-muted-foreground">Format</p>
              <p className="font-medium">ESC/POS</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
