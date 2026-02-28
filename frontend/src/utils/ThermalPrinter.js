// Thermal Printer Utility for POS 58 RPP02N (58mm)
// Supports USB and Bluetooth connections

class ThermalPrinter {
  constructor() {
    this.device = null;
    this.connectionType = localStorage.getItem('printerType') || 'usb';
    this.characteristicUUID = '0000ff02-0000-1000-8000-00805f9b34fb'; // Common for thermal printers
  }

  // ESC/POS Commands
  commands = {
    INIT: [0x1B, 0x40], // Initialize printer
    LINE_FEED: [0x0A], // Line feed
    CUT: [0x1D, 0x56, 0x00], // Cut paper
    ALIGN_LEFT: [0x1B, 0x61, 0x00],
    ALIGN_CENTER: [0x1B, 0x61, 0x01],
    ALIGN_RIGHT: [0x1B, 0x61, 0x02],
    BOLD_ON: [0x1B, 0x45, 0x01],
    BOLD_OFF: [0x1B, 0x45, 0x00],
    SIZE_NORMAL: [0x1D, 0x21, 0x00],
    SIZE_DOUBLE: [0x1D, 0x21, 0x11], // Double width & height
    SIZE_LARGE: [0x1D, 0x21, 0x22],
  };

  // Connect to printer via USB
  async connectUSB() {
    try {
      if (!navigator.usb) {
        throw new Error('WebUSB tidak didukung di browser ini');
      }

      this.device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x04b8 }, // EPSON
          { vendorId: 0x0416 }, // Common thermal printer
          { vendorId: 0x0483 },
          { vendorId: 0x1a86 },
          { vendorId: 0x067b }, // Prolific
          { vendorId: 0x1504 }, // Other thermal printers
        ]
      });

      await this.device.open();
      
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }
      
      await this.device.claimInterface(0);
      
      this.connectionType = 'usb';
      localStorage.setItem('printerType', 'usb');
      
      return { success: true, message: 'Printer USB terhubung' };
    } catch (error) {
      console.error('USB connection error:', error);
      return { success: false, message: error.message };
    }
  }

  // Connect to printer via Bluetooth
  async connectBluetooth() {
    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth tidak didukung di browser ini');
      }

      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'RPP' },
          { namePrefix: 'POS' },
          { namePrefix: 'Printer' },
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
      });

      const server = await this.device.gatt.connect();
      
      // Try common service UUIDs for thermal printers
      let service;
      try {
        service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      } catch {
        service = await server.getPrimaryService('e7810a71-73ae-499d-8c15-faa9aef0c3f2');
      }
      
      this.characteristic = await service.getCharacteristic(this.characteristicUUID);
      
      this.connectionType = 'bluetooth';
      localStorage.setItem('printerType', 'bluetooth');
      
      return { success: true, message: 'Printer Bluetooth terhubung' };
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      return { success: false, message: error.message };
    }
  }

  // Send data to printer
  async sendData(data) {
    try {
      const buffer = new Uint8Array(data);
      
      if (this.connectionType === 'usb' && this.device) {
        await this.device.transferOut(1, buffer);
      } else if (this.connectionType === 'bluetooth' && this.characteristic) {
        // Split data into chunks (BLE has MTU limit)
        const chunkSize = 20;
        for (let i = 0; i < buffer.length; i += chunkSize) {
          const chunk = buffer.slice(i, i + chunkSize);
          await this.characteristic.writeValue(chunk);
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between chunks
        }
      } else {
        throw new Error('Printer tidak terhubung');
      }
      return true;
    } catch (error) {
      console.error('Print error:', error);
      return false;
    }
  }

  // Convert string to byte array (support Indonesian characters)
  textToBytes(text) {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
  }

  // Print receipt for transaction
  async printReceipt(transaction) {
    const data = [];

    // Initialize
    data.push(...this.commands.INIT);

    // Header - Store Name (Center, Large, Bold)
    data.push(...this.commands.ALIGN_CENTER);
    data.push(...this.commands.SIZE_DOUBLE);
    data.push(...this.commands.BOLD_ON);
    data.push(...this.textToBytes('UD. AQIN TANI'));
    data.push(...this.commands.LINE_FEED);
    
    // Subtitle
    data.push(...this.commands.SIZE_NORMAL);
    data.push(...this.commands.BOLD_OFF);
    data.push(...this.textToBytes('Toko Obat & Alat Pertanian'));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.commands.LINE_FEED);

    // Transaction Info
    data.push(...this.commands.ALIGN_LEFT);
    data.push(...this.textToBytes(new Date(transaction.created_at).toLocaleString('id-ID')));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.textToBytes(`No: ${transaction.transaction_number}`));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.textToBytes(`Kasir: ${transaction.cashier_name}`));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.textToBytes('--------------------------------'));
    data.push(...this.commands.LINE_FEED);

    // Items
    transaction.items.forEach(item => {
      data.push(...this.textToBytes(item.product_name));
      data.push(...this.commands.LINE_FEED);
      
      const itemLine = `${item.quantity} x ${this.formatCurrency(item.price)}`;
      const subtotalLine = this.formatCurrency(item.subtotal);
      const spacing = ' '.repeat(Math.max(0, 32 - itemLine.length - subtotalLine.length));
      
      data.push(...this.textToBytes(`${itemLine}${spacing}${subtotalLine}`));
      data.push(...this.commands.LINE_FEED);
    });

    data.push(...this.textToBytes('--------------------------------'));
    data.push(...this.commands.LINE_FEED);

    // Totals
    const subtotalLine = this.formatLine('Subtotal:', this.formatCurrency(transaction.subtotal));
    data.push(...this.textToBytes(subtotalLine));
    data.push(...this.commands.LINE_FEED);

    if (transaction.discount > 0) {
      const discountLine = this.formatLine('Diskon:', `-${this.formatCurrency(transaction.discount)}`);
      data.push(...this.textToBytes(discountLine));
      data.push(...this.commands.LINE_FEED);
    }

    if (transaction.tax > 0) {
      const taxLine = this.formatLine('Pajak:', this.formatCurrency(transaction.tax));
      data.push(...this.textToBytes(taxLine));
      data.push(...this.commands.LINE_FEED);
    }

    // Total (Bold)
    data.push(...this.commands.BOLD_ON);
    const totalLine = this.formatLine('TOTAL:', this.formatCurrency(transaction.total));
    data.push(...this.textToBytes(totalLine));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.commands.BOLD_OFF);

    // Payment
    const paymentLine = this.formatLine(`Bayar (${transaction.payment_method}):`, this.formatCurrency(transaction.payment_amount));
    data.push(...this.textToBytes(paymentLine));
    data.push(...this.commands.LINE_FEED);

    const changeLine = this.formatLine('Kembali:', this.formatCurrency(transaction.change));
    data.push(...this.textToBytes(changeLine));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.commands.LINE_FEED);

    // Footer
    data.push(...this.commands.ALIGN_CENTER);
    data.push(...this.textToBytes('Terima kasih atas kunjungan Anda!'));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.textToBytes('Barang yang sudah dibeli'));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.textToBytes('tidak dapat ditukar/dikembalikan'));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.commands.LINE_FEED);
    data.push(...this.commands.LINE_FEED);

    // Cut paper
    data.push(...this.commands.CUT);

    return await this.sendData(data);
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value).replace('Rp', 'Rp ');
  }

  formatLine(label, value) {
    const maxWidth = 32; // 58mm = ~32 characters
    const spacing = ' '.repeat(Math.max(0, maxWidth - label.length - value.length));
    return `${label}${spacing}${value}`;
  }

  // Test print
  async testPrint() {
    const data = [];
    data.push(...this.commands.INIT);
    data.push(...this.commands.ALIGN_CENTER);
    data.push(...this.commands.SIZE_DOUBLE);
    data.push(...this.commands.BOLD_ON);
    data.push(...this.textToBytes('TEST PRINT'));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.commands.SIZE_NORMAL);
    data.push(...this.commands.BOLD_OFF);
    data.push(...this.textToBytes('UD. AQIN TANI'));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.textToBytes('Printer terhubung dengan baik'));
    data.push(...this.commands.LINE_FEED);
    data.push(...this.commands.LINE_FEED);
    data.push(...this.commands.LINE_FEED);
    data.push(...this.commands.CUT);
    
    return await this.sendData(data);
  }

  // Disconnect
  async disconnect() {
    try {
      if (this.connectionType === 'usb' && this.device) {
        await this.device.close();
      } else if (this.connectionType === 'bluetooth' && this.device?.gatt) {
        await this.device.gatt.disconnect();
      }
      this.device = null;
      this.characteristic = null;
      return true;
    } catch (error) {
      console.error('Disconnect error:', error);
      return false;
    }
  }

  // Check if connected
  isConnected() {
    if (this.connectionType === 'usb') {
      return this.device && this.device.opened;
    } else if (this.connectionType === 'bluetooth') {
      return this.device && this.device.gatt?.connected;
    }
    return false;
  }
}

export default ThermalPrinter;