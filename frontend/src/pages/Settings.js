import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Printer, Usb, Bluetooth, CheckCircle, XCircle, Settings as SettingsIcon } from '../components/icons';
import ThermalPrinter from '../utils/ThermalPrinter';

export const Settings = () => {
  const [printer] = useState(() => new ThermalPrinter());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState(localStorage.getItem('printerType') || 'usb');
  const [loading, setLoading] = useState(false);
  const [autoPrint, setAutoPrint] = useState(localStorage.getItem('autoPrint') === 'true');
  const [paperSize, setPaperSize] = useState(localStorage.getItem('paperSize') || '58mm');

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

  const handlePaperSizeChange = (size) => {
    setPaperSize(size);
    localStorage.setItem('paperSize', size);
    toast.success(`Ukuran kertas diubah ke ${size}`);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Pengaturan Printer</h1>
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
          <h2 className="text-xl font-semibold mb-6">Pengaturan Cetak</h2>
          
          <div className="space-y-6">
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

            <div className="border-t pt-6">
              <Label className="text-base font-medium mb-3 block">Ukuran Kertas Printer</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Pilih ukuran kertas sesuai dengan printer Anda untuk hasil print optimal
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  variant={paperSize === '48mm' ? 'default' : 'outline'}
                  onClick={() => handlePaperSizeChange('48mm')}
                  className="h-auto py-4 flex flex-col items-start"
                  data-testid="paper-size-48mm"
                >
                  <span className="font-bold text-lg">48mm</span>
                  <span className="text-xs opacity-80">Thermal Mini (48x210mm)</span>
                  <span className="text-xs opacity-60 mt-1">~18-20 karakter</span>
                </Button>
                <Button
                  variant={paperSize === '58mm' ? 'default' : 'outline'}
                  onClick={() => handlePaperSizeChange('58mm')}
                  className="h-auto py-4 flex flex-col items-start"
                  data-testid="paper-size-58mm"
                >
                  <span className="font-bold text-lg">58mm</span>
                  <span className="text-xs opacity-80">Thermal Standard (58mm)</span>
                  <span className="text-xs opacity-60 mt-1">~32 karakter</span>
                </Button>
                <Button
                  variant={paperSize === 'a4' ? 'default' : 'outline'}
                  onClick={() => handlePaperSizeChange('a4')}
                  className="h-auto py-4 flex flex-col items-start"
                  data-testid="paper-size-a4"
                >
                  <span className="font-bold text-lg">A4</span>
                  <span className="text-xs opacity-80">Laser/Inkjet (210x297mm)</span>
                  <span className="text-xs opacity-60 mt-1">Full page</span>
                </Button>
              </div>
              
              {paperSize === '48mm' && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Tips 48mm:</strong> Layout sangat compact. Font size 7-9px. Cocok untuk EPSON D58UBT-S dan thermal mini lainnya.
                  </p>
                </div>
              )}
              
              {paperSize === '58mm' && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-green-800">
                    <strong>Tips 58mm:</strong> Ukuran thermal standard. Font size 9-10px. Paling umum digunakan di POS retail.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Printer Info */}
        <Card className="p-6 lg:col-span-2 bg-gradient-to-br from-accent to-accent/50">
          <h3 className="font-semibold mb-3">Informasi Printer</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Model</p>
              <p className="font-medium">EPSON D58UBT-S</p>
            </div>
            <div>
              <p className="text-muted-foreground">Koneksi</p>
              <p className="font-medium">USB + Bluetooth</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ukuran Dipilih</p>
              <p className="font-medium">{paperSize.toUpperCase()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Format</p>
              <p className="font-medium">ESC/POS</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-primary/20">
            <p className="text-xs text-muted-foreground mb-2">
              <strong>Catatan:</strong> Untuk printer thermal 48mm, pastikan di printer settings Windows sudah diset ke custom size 48mm x 210mm
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
