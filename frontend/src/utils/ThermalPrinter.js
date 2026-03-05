// Thermal Printer Utility - USB & Bluetooth
// Supports various thermal printers (58mm, 48mm)

class ThermalPrinter {
  constructor() {
    this.device = null;
    this.characteristic = null;
    this.connectionType = localStorage.getItem('printerType') || 'usb';
  }

  commands = {
    INIT: [0x1B, 0x40],
    LINE_FEED: [0x0A],
    CUT: [0x1D, 0x56, 0x00],
    ALIGN_LEFT: [0x1B, 0x61, 0x00],
    ALIGN_CENTER: [0x1B, 0x61, 0x01],
    ALIGN_RIGHT: [0x1B, 0x61, 0x02],
    BOLD_ON: [0x1B, 0x45, 0x01],
    BOLD_OFF: [0x1B, 0x45, 0x00],
    SIZE_NORMAL: [0x1D, 0x21, 0x00],
    SIZE_DOUBLE: [0x1D, 0x21, 0x11],
  };

  // Known Bluetooth service/characteristic UUIDs for thermal printers
  BLE_PROFILES = [
    { service: '000018f0-0000-1000-8000-00805f9b34fb', characteristic: '00002af1-0000-1000-8000-00805f9b34fb' },
    { service: '000018f0-0000-1000-8000-00805f9b34fb', characteristic: '0000ff02-0000-1000-8000-00805f9b34fb' },
    { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
    { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', characteristic: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
    { service: '0000ff00-0000-1000-8000-00805f9b34fb', characteristic: '0000ff02-0000-1000-8000-00805f9b34fb' },
    { service: '0000ffe0-0000-1000-8000-00805f9b34fb', characteristic: '0000ffe1-0000-1000-8000-00805f9b34fb' },
    // Common Chinese thermal printer profiles
    { service: '0000fee7-0000-1000-8000-00805f9b34fb', characteristic: '0000fee7-0000-1000-8000-00805f9b34fb' },
    { service: '00001101-0000-1000-8000-00805f9b34fb', characteristic: '00001101-0000-1000-8000-00805f9b34fb' },
    { service: '0000ae00-0000-1000-8000-00805f9b34fb', characteristic: '0000ae01-0000-1000-8000-00805f9b34fb' },
    { service: '0000ae30-0000-1000-8000-00805f9b34fb', characteristic: '0000ae31-0000-1000-8000-00805f9b34fb' },
  ];

  async connectUSB() {
    try {
      if (!navigator.usb) throw new Error('WebUSB tidak didukung di browser ini. Gunakan Chrome/Edge terbaru.');
      this.device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x04b8 }, { vendorId: 0x0416 }, { vendorId: 0x0483 },
          { vendorId: 0x1a86 }, { vendorId: 0x067b }, { vendorId: 0x1504 },
          { vendorId: 0x0fe6 }, { vendorId: 0x20d1 }, { vendorId: 0x0dd4 },
        ]
      });
      await this.device.open();
      if (this.device.configuration === null) await this.device.selectConfiguration(1);
      await this.device.claimInterface(0);
      this.connectionType = 'usb';
      localStorage.setItem('printerType', 'usb');
      return { success: true, message: 'Printer USB terhubung' };
    } catch (error) {
      console.error('USB error:', error);
      return { success: false, message: error.message || 'Gagal menghubungkan USB' };
    }
  }

  async connectBluetooth() {
    try {
      if (!navigator.bluetooth) throw new Error('Web Bluetooth tidak didukung. Gunakan Chrome di Android/Windows/macOS.');

      // Try with acceptAllDevices first (broader compatibility)
      let device;
      const allServiceUUIDs = [...new Set(this.BLE_PROFILES.map(p => p.service))];
      
      try {
        device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: allServiceUUIDs
        });
      } catch (e) {
        // Fallback: try with name filters for more restricted environments
        device = await navigator.bluetooth.requestDevice({
          filters: [
            { namePrefix: 'RPP' }, { namePrefix: 'POS' }, { namePrefix: 'Printer' },
            { namePrefix: 'EPSON' }, { namePrefix: 'D58' }, { namePrefix: 'TM-' },
            { namePrefix: 'BT' }, { namePrefix: 'MPT' }, { namePrefix: 'SPP' },
            { namePrefix: 'TP' }, { namePrefix: 'BlueTooth' }, { namePrefix: 'Xprinter' },
            { namePrefix: 'XP-' }, { namePrefix: 'QS-' }, { namePrefix: 'MTP' },
            { namePrefix: 'ZJ-' }, { namePrefix: 'PT-' }, { namePrefix: 'GP-' },
            { namePrefix: 'Inner' }, { namePrefix: 'Gprinter' }, { namePrefix: 'TSC' },
            { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          ],
          optionalServices: allServiceUUIDs
        });
      }

      this.device = device;
      console.log('BLE device:', device.name || device.id);

      // Small delay for GATT server stability on some devices
      await new Promise(r => setTimeout(r, 300));

      // Retry GATT connection up to 3 times
      let server;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          server = await device.gatt.connect();
          break;
        } catch (e) {
          console.warn(`GATT connect attempt ${attempt + 1} failed:`, e);
          if (attempt === 2) throw new Error('Gagal terhubung ke printer. Pastikan printer menyala dan dalam jarak dekat.');
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Auto-discover the right service/characteristic
      let foundCharacteristic = null;
      for (const profile of this.BLE_PROFILES) {
        try {
          const service = await server.getPrimaryService(profile.service);
          foundCharacteristic = await service.getCharacteristic(profile.characteristic);
          console.log('Found BLE profile:', profile.service, profile.characteristic);
          break;
        } catch {
          continue;
        }
      }

      // If no known profile, try discovering all services
      if (!foundCharacteristic) {
        try {
          const services = await server.getPrimaryServices();
          for (const service of services) {
            try {
              const chars = await service.getCharacteristics();
              for (const char of chars) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                  foundCharacteristic = char;
                  console.log('Discovered writable char:', char.uuid, 'on service:', service.uuid);
                  break;
                }
              }
              if (foundCharacteristic) break;
            } catch { continue; }
          }
        } catch (e) {
          console.error('Service discovery failed:', e);
        }
      }

      if (!foundCharacteristic) {
        await device.gatt.disconnect();
        throw new Error('Tidak dapat menemukan layanan cetak pada printer ini. Pastikan printer mendukung Bluetooth LE.');
      }

      this.characteristic = foundCharacteristic;
      this.connectionType = 'bluetooth';
      localStorage.setItem('printerType', 'bluetooth');
      return { success: true, message: `Printer "${device.name || 'BLE'}" terhubung via Bluetooth` };
    } catch (error) {
      console.error('Bluetooth error:', error);
      return { success: false, message: error.message || 'Gagal menghubungkan Bluetooth' };
    }
  }

  async sendData(data) {
    try {
      const buffer = new Uint8Array(data);
      if (this.connectionType === 'usb' && this.device) {
        // USB: find the right endpoint
        const iface = this.device.configuration.interfaces[0];
        const endpoint = iface.alternate.endpoints.find(e => e.direction === 'out');
        const epNum = endpoint ? endpoint.endpointNumber : 1;
        await this.device.transferOut(epNum, buffer);
      } else if (this.connectionType === 'bluetooth' && this.characteristic) {
        // BLE: chunk data with larger MTU-safe size for better throughput
        const useNoResponse = this.characteristic.properties.writeWithoutResponse;
        const chunkSize = useNoResponse ? 200 : 100;
        
        for (let i = 0; i < buffer.length; i += chunkSize) {
          const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.length));
          try {
            if (useNoResponse) {
              await this.characteristic.writeValueWithoutResponse(chunk);
            } else {
              await this.characteristic.writeValueWithResponse(chunk);
            }
          } catch (writeErr) {
            // Retry once with smaller chunk on failure
            console.warn('Write failed, retrying with smaller chunk:', writeErr);
            const smallChunk = 20;
            for (let j = 0; j < chunk.length; j += smallChunk) {
              const miniChunk = chunk.slice(j, Math.min(j + smallChunk, chunk.length));
              if (useNoResponse) {
                await this.characteristic.writeValueWithoutResponse(miniChunk);
              } else {
                await this.characteristic.writeValueWithResponse(miniChunk);
              }
              await new Promise(r => setTimeout(r, 50));
            }
          }
          await new Promise(r => setTimeout(r, 20));
        }
      } else {
        throw new Error('Printer tidak terhubung');
      }
      return true;
    } catch (error) {
      console.error('Send error:', error);
      return false;
    }
  }

  textToBytes(text) {
    return Array.from(new TextEncoder().encode(text));
  }

  getCharWidth() {
    const size = localStorage.getItem('paperSize') || '58mm';
    return size === '48mm' ? 24 : 32;
  }

  formatLine(label, value) {
    const w = this.getCharWidth();
    const gap = Math.max(1, w - label.length - value.length);
    return label + ' '.repeat(gap) + value;
  }

  formatCurrency(v) {
    return 'Rp ' + new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(v);
  }

  async printReceipt(transaction, storeSettings = {}) {
    const d = [];
    const w = this.getCharWidth();
    const sep = '-'.repeat(w);
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || 'Toko Obat & Alat Pertanian';
    const storePhone = storeSettings?.phone || '';

    d.push(...this.commands.INIT);
    d.push(...this.commands.ALIGN_CENTER);
    d.push(...this.commands.SIZE_DOUBLE);
    d.push(...this.commands.BOLD_ON);
    d.push(...this.textToBytes(storeName));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.SIZE_NORMAL);
    d.push(...this.commands.BOLD_OFF);
    d.push(...this.textToBytes(storeAddr));
    d.push(...this.commands.LINE_FEED);
    if (storePhone) {
      d.push(...this.textToBytes('Telp: ' + storePhone));
      d.push(...this.commands.LINE_FEED);
    }
    d.push(...this.commands.ALIGN_LEFT);
    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes(new Date(transaction.created_at).toLocaleString('id-ID')));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes(`No: ${transaction.transaction_number}`));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes(`Kasir: ${transaction.cashier_name}`));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);

    transaction.items.forEach(item => {
      d.push(...this.textToBytes(item.product_name));
      d.push(...this.commands.LINE_FEED);
      const left = `${item.quantity}x${this.formatCurrency(item.price)}`;
      const right = this.formatCurrency(item.subtotal);
      d.push(...this.textToBytes(this.formatLine(left, right)));
      d.push(...this.commands.LINE_FEED);
    });

    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes(this.formatLine('Subtotal:', this.formatCurrency(transaction.subtotal))));
    d.push(...this.commands.LINE_FEED);
    if (transaction.discount > 0) {
      d.push(...this.textToBytes(this.formatLine('Diskon:', '-' + this.formatCurrency(transaction.discount))));
      d.push(...this.commands.LINE_FEED);
    }
    d.push(...this.commands.BOLD_ON);
    d.push(...this.textToBytes(this.formatLine('TOTAL:', this.formatCurrency(transaction.total))));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.BOLD_OFF);
    d.push(...this.textToBytes(this.formatLine(`Bayar(${transaction.payment_method}):`, this.formatCurrency(transaction.payment_amount))));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes(this.formatLine('Kembali:', this.formatCurrency(transaction.change))));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.ALIGN_CENTER);
    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes('Barang yg sudah dibeli'));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes('tidak bisa dikembalikan'));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes('Terima kasih!'));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.CUT);

    return await this.sendData(d);
  }

  async printPartnerOrderReceipt(order, storeSettings = {}) {
    const d = [];
    const w = this.getCharWidth();
    const sep = '-'.repeat(w);
    const storeName = storeSettings?.store_name || 'UD. AQIN TANI';
    const storeAddr = storeSettings?.address || '';
    const storePhone = storeSettings?.phone || '';

    d.push(...this.commands.INIT);
    d.push(...this.commands.ALIGN_CENTER);
    d.push(...this.commands.SIZE_DOUBLE);
    d.push(...this.commands.BOLD_ON);
    d.push(...this.textToBytes(storeName));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.SIZE_NORMAL);
    d.push(...this.commands.BOLD_OFF);
    if (storeAddr) {
      d.push(...this.textToBytes(storeAddr));
      d.push(...this.commands.LINE_FEED);
    }
    if (storePhone) {
      d.push(...this.textToBytes('Telp: ' + storePhone));
      d.push(...this.commands.LINE_FEED);
    }

    d.push(...this.commands.ALIGN_LEFT);
    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.BOLD_ON);
    d.push(...this.textToBytes('STRUK PESANAN KIOS MITRA'));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.BOLD_OFF);
    const tgl = new Date(order.created_at).toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    d.push(...this.textToBytes('No   : ' + order.order_number));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes('Tgl  : ' + tgl));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes('Kios : ' + order.partner_store_name));
    d.push(...this.commands.LINE_FEED);
    if (order.partner_phone) {
      d.push(...this.textToBytes('Telp : ' + order.partner_phone));
      d.push(...this.commands.LINE_FEED);
    }
    if (order.canvasser_name) {
      d.push(...this.textToBytes('Sales: ' + order.canvasser_name));
      d.push(...this.commands.LINE_FEED);
    }
    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);

    order.items.forEach(item => {
      d.push(...this.textToBytes(item.product_name));
      d.push(...this.commands.LINE_FEED);
      const left = `${item.quantity}x${this.formatCurrency(item.price)}`;
      const right = this.formatCurrency(item.subtotal);
      d.push(...this.textToBytes(this.formatLine(left, right)));
      d.push(...this.commands.LINE_FEED);
    });

    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes(this.formatLine('Subtotal:', this.formatCurrency(order.subtotal))));
    d.push(...this.commands.LINE_FEED);
    if (order.discount > 0) {
      d.push(...this.textToBytes(this.formatLine('Diskon:', '-' + this.formatCurrency(order.discount))));
      d.push(...this.commands.LINE_FEED);
    }
    d.push(...this.commands.BOLD_ON);
    d.push(...this.textToBytes(this.formatLine('TOTAL:', this.formatCurrency(order.total))));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.BOLD_OFF);

    if (order.paid > 0) {
      d.push(...this.textToBytes(this.formatLine('Dibayar:', this.formatCurrency(order.paid))));
      d.push(...this.commands.LINE_FEED);
    }
    if (order.remaining > 0) {
      d.push(...this.textToBytes(this.formatLine('Sisa Bon:', this.formatCurrency(order.remaining))));
      d.push(...this.commands.LINE_FEED);
    }

    const previousDebt = Math.max(0, (order.partner_debt_total || 0) - (order.remaining || 0));
    if (previousDebt > 0 || order.remaining > 0) {
      d.push(...this.textToBytes(sep));
      d.push(...this.commands.LINE_FEED);
      d.push(...this.commands.BOLD_ON);
      d.push(...this.textToBytes('REKAP BON / HUTANG'));
      d.push(...this.commands.LINE_FEED);
      d.push(...this.commands.BOLD_OFF);
      if (previousDebt > 0) {
        d.push(...this.textToBytes(this.formatLine('Bon Lama:', this.formatCurrency(previousDebt))));
        d.push(...this.commands.LINE_FEED);
      }
      d.push(...this.textToBytes(this.formatLine('Bon Ini:', this.formatCurrency(order.remaining))));
      d.push(...this.commands.LINE_FEED);
      d.push(...this.commands.BOLD_ON);
      d.push(...this.textToBytes(this.formatLine('TTL HUTANG:', this.formatCurrency(order.partner_debt_total || 0))));
      d.push(...this.commands.LINE_FEED);
      d.push(...this.commands.BOLD_OFF);
    }

    const grandTotal = previousDebt + order.total;
    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.BOLD_ON);
    d.push(...this.textToBytes(this.formatLine('GRAND TOTAL:', this.formatCurrency(grandTotal))));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.BOLD_OFF);

    d.push(...this.commands.ALIGN_CENTER);
    d.push(...this.textToBytes(sep));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes('Terima kasih!'));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes('Simpan struk sebagai bukti'));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.CUT);

    return await this.sendData(d);
  }

  async testPrint() {
    const d = [];
    d.push(...this.commands.INIT);
    d.push(...this.commands.ALIGN_CENTER);
    d.push(...this.commands.SIZE_DOUBLE);
    d.push(...this.commands.BOLD_ON);
    d.push(...this.textToBytes('TEST PRINT'));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.SIZE_NORMAL);
    d.push(...this.commands.BOLD_OFF);
    d.push(...this.textToBytes('UD. AQIN TANI'));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.textToBytes('Printer OK'));
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.LINE_FEED);
    d.push(...this.commands.CUT);
    return await this.sendData(d);
  }

  async disconnect() {
    try {
      if (this.connectionType === 'usb' && this.device) await this.device.close();
      else if (this.connectionType === 'bluetooth' && this.device?.gatt) this.device.gatt.disconnect();
      this.device = null;
      this.characteristic = null;
    } catch (e) { console.error('Disconnect:', e); }
  }

  isConnected() {
    if (this.connectionType === 'usb') return !!(this.device && this.device.opened);
    if (this.connectionType === 'bluetooth') return !!(this.device && this.device.gatt?.connected);
    return false;
  }
}

export const thermalPrinter = new ThermalPrinter();
export default ThermalPrinter;
