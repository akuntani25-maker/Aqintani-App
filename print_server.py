#!/usr/bin/env python3
"""
UD. AQIN TANI - Local Print Server
===================================
Server lokal untuk mencetak struk ke printer thermal USB
menggunakan perintah ESC/POS (font firmware printer).

Cara pakai:
  1. Install: pip install flask flask-cors pywin32
  2. Jalankan: python print_server.py
  3. Buka aplikasi POS, tekan "Cetak Struk"

Server berjalan di http://localhost:9100
"""

import sys
import json
import platform
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ========== KONFIGURASI ==========
PORT = 9100
PRINTER_NAME = None  # None = auto-detect printer pertama, atau isi nama printer manual

# ========== PRINTER HANDLER ==========

def get_printer_list():
    """Daftar semua printer yang terinstall di sistem."""
    system = platform.system()
    printers = []
    if system == 'Windows':
        try:
            import win32print
            for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
                printers.append(p[2])
        except ImportError:
            pass
    else:
        # Linux/Mac - cek /dev/usb/lp*
        import glob
        printers = glob.glob('/dev/usb/lp*')
        if not printers:
            printers = glob.glob('/dev/ttyUSB*')
    return printers


def get_default_printer():
    """Ambil nama printer default atau printer pertama."""
    global PRINTER_NAME
    if PRINTER_NAME:
        return PRINTER_NAME
    system = platform.system()
    if system == 'Windows':
        try:
            import win32print
            name = win32print.GetDefaultPrinter()
            if name:
                return name
            printers = get_printer_list()
            return printers[0] if printers else None
        except ImportError:
            return None
    else:
        printers = get_printer_list()
        return printers[0] if printers else None


def send_to_printer_windows(data, printer_name):
    """Kirim raw data ke printer di Windows via win32print."""
    import win32print
    hPrinter = win32print.OpenPrinter(printer_name)
    try:
        hJob = win32print.StartDocPrinter(hPrinter, 1, ("ESC/POS Receipt", None, "RAW"))
        try:
            win32print.StartPagePrinter(hPrinter)
            win32print.WritePrinter(hPrinter, data)
            win32print.EndPagePrinter(hPrinter)
        finally:
            win32print.EndDocPrinter(hPrinter)
    finally:
        win32print.ClosePrinter(hPrinter)


def send_to_printer_linux(data, device_path):
    """Kirim raw data ke printer di Linux via device file."""
    with open(device_path, 'wb') as f:
        f.write(data)


def send_raw_to_printer(data):
    """Kirim raw ESC/POS bytes ke printer (auto-detect OS)."""
    printer = get_default_printer()
    if not printer:
        raise Exception("Tidak ada printer terdeteksi. Pastikan printer USB terhubung dan terinstall.")

    system = platform.system()
    if system == 'Windows':
        send_to_printer_windows(data, printer)
    else:
        send_to_printer_linux(data, printer)

    return printer


# ========== API ENDPOINTS ==========

@app.route('/status', methods=['GET'])
def status():
    """Cek apakah server aktif dan printer tersedia."""
    printer = get_default_printer()
    printers = get_printer_list()
    return jsonify({
        'status': 'ok',
        'printer': printer,
        'all_printers': printers,
        'os': platform.system()
    })


@app.route('/print', methods=['POST'])
def print_receipt():
    """Terima raw ESC/POS data dan kirim ke printer."""
    try:
        data = request.get_data()
        if not data:
            return jsonify({'error': 'Tidak ada data untuk dicetak'}), 400

        printer_used = send_raw_to_printer(data)
        return jsonify({
            'success': True,
            'message': f'Struk berhasil dicetak ke: {printer_used}',
            'printer': printer_used
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/printers', methods=['GET'])
def list_printers():
    """Daftar semua printer yang tersedia."""
    return jsonify({
        'printers': get_printer_list(),
        'default': get_default_printer()
    })


@app.route('/set-printer', methods=['POST'])
def set_printer():
    """Set printer yang digunakan secara manual."""
    global PRINTER_NAME
    body = request.get_json()
    name = body.get('name', '')
    if not name:
        return jsonify({'error': 'Nama printer tidak boleh kosong'}), 400
    PRINTER_NAME = name
    return jsonify({'success': True, 'printer': PRINTER_NAME})


@app.route('/test', methods=['POST'])
def test_print():
    """Cetak halaman test untuk memastikan printer berfungsi."""
    try:
        test_data = bytearray()
        # ESC @ (init)
        test_data.extend([0x1B, 0x40])
        # Center align
        test_data.extend([0x1B, 0x61, 0x01])
        # Bold on + Double size
        test_data.extend([0x1D, 0x21, 0x11])
        test_data.extend([0x1B, 0x45, 0x01])
        test_data.extend(b'UD. AQIN TANI')
        test_data.extend([0x0A])
        # Normal size
        test_data.extend([0x1D, 0x21, 0x00])
        test_data.extend([0x1B, 0x45, 0x00])
        test_data.extend(b'Print Server Test')
        test_data.extend([0x0A])
        test_data.extend(b'================================')
        test_data.extend([0x0A])
        # Left align
        test_data.extend([0x1B, 0x61, 0x00])
        test_data.extend(b'Printer OK!')
        test_data.extend([0x0A])
        test_data.extend(b'Server berjalan dengan baik.')
        test_data.extend([0x0A])
        test_data.extend(b'================================')
        test_data.extend([0x0A, 0x0A, 0x0A])
        # Cut
        test_data.extend([0x1D, 0x56, 0x00])

        printer_used = send_raw_to_printer(bytes(test_data))
        return jsonify({
            'success': True,
            'message': f'Test print berhasil ke: {printer_used}'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== MAIN ==========

if __name__ == '__main__':
    print("=" * 50)
    print("  UD. AQIN TANI - Local Print Server")
    print("=" * 50)
    print(f"  OS      : {platform.system()}")
    print(f"  Port    : {PORT}")

    printer = get_default_printer()
    printers = get_printer_list()
    if printer:
        print(f"  Printer : {printer}")
    else:
        print("  Printer : TIDAK TERDETEKSI")
        print("  ! Pastikan printer USB terhubung dan driver terinstall")

    if len(printers) > 1:
        print(f"  Semua printer: {', '.join(printers)}")

    print("=" * 50)
    print(f"  Server siap di http://localhost:{PORT}")
    print("  Tekan Ctrl+C untuk menghentikan")
    print("=" * 50)

    app.run(host='0.0.0.0', port=PORT, debug=False)
