#!/usr/bin/env python3
"""
UD. AQIN TANI - Local Print Server
===================================
Server lokal untuk mencetak struk ke printer thermal USB
menggunakan perintah ESC/POS (font firmware printer).

=== MODE 1: Jalankan langsung ===
  python print_server.py

=== MODE 2: Install sebagai Windows Service (auto-start) ===
  python print_server.py install
  python print_server.py start

=== Perintah Service Lainnya ===
  python print_server.py stop       # Hentikan service
  python print_server.py remove     # Hapus service
  python print_server.py restart    # Restart service

Server berjalan di http://localhost:9100
"""

import sys
import os
import json
import platform
import threading
import socket
from flask import Flask, request, jsonify
from flask_cors import CORS

# ========== KONFIGURASI ==========
PORT = 9100
PRINTER_NAME = None  # None = auto-detect, atau isi nama printer manual

# ========== FLASK APP ==========
app = Flask(__name__)
CORS(app)

# ========== PRINTER HANDLER ==========

def get_printer_list():
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
        import glob
        printers = glob.glob('/dev/usb/lp*')
        if not printers:
            printers = glob.glob('/dev/ttyUSB*')
    return printers


def get_default_printer():
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
    with open(device_path, 'wb') as f:
        f.write(data)


def send_raw_to_printer(data):
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
    return jsonify({
        'printers': get_printer_list(),
        'default': get_default_printer()
    })


@app.route('/set-printer', methods=['POST'])
def set_printer():
    global PRINTER_NAME
    body = request.get_json()
    name = body.get('name', '')
    if not name:
        return jsonify({'error': 'Nama printer tidak boleh kosong'}), 400
    PRINTER_NAME = name
    return jsonify({'success': True, 'printer': PRINTER_NAME})


@app.route('/test', methods=['POST'])
def test_print():
    try:
        test_data = bytearray()
        test_data.extend([0x1B, 0x40])
        test_data.extend([0x1B, 0x61, 0x01])
        test_data.extend([0x1D, 0x21, 0x11])
        test_data.extend([0x1B, 0x45, 0x01])
        test_data.extend(b'UD. AQIN TANI')
        test_data.extend([0x0A])
        test_data.extend([0x1D, 0x21, 0x00])
        test_data.extend([0x1B, 0x45, 0x00])
        test_data.extend(b'Print Server Test')
        test_data.extend([0x0A])
        test_data.extend(b'================================')
        test_data.extend([0x0A])
        test_data.extend([0x1B, 0x61, 0x00])
        test_data.extend(b'Printer OK!')
        test_data.extend([0x0A])
        test_data.extend(b'Server berjalan dengan baik.')
        test_data.extend([0x0A])
        test_data.extend(b'================================')
        test_data.extend([0x0A, 0x0A, 0x0A])
        test_data.extend([0x1D, 0x56, 0x00])
        printer_used = send_raw_to_printer(bytes(test_data))
        return jsonify({'success': True, 'message': f'Test print berhasil ke: {printer_used}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def run_server():
    app.run(host='0.0.0.0', port=PORT, debug=False, use_reloader=False)


# ========== WINDOWS SERVICE ==========

if platform.system() == 'Windows':
    try:
        import win32serviceutil
        import win32service
        import win32event
        import servicemanager

        class AqinTaniPrintService(win32serviceutil.ServiceFramework):
            _svc_name_ = 'AqinTaniPrintServer'
            _svc_display_name_ = 'UD. AQIN TANI - Print Server'
            _svc_description_ = 'Server cetak struk thermal untuk aplikasi UD. AQIN TANI (port 9100)'

            def __init__(self, args):
                win32serviceutil.ServiceFramework.__init__(self, args)
                self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
                self.server_thread = None

            def SvcStop(self):
                self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
                win32event.SetEvent(self.hWaitStop)

            def SvcDoRun(self):
                servicemanager.LogMsg(
                    servicemanager.EVENTLOG_INFORMATION_TYPE,
                    servicemanager.PYS_SERVICE_STARTED,
                    (self._svc_name_, '')
                )
                self.server_thread = threading.Thread(target=run_server, daemon=True)
                self.server_thread.start()
                win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)

    except ImportError:
        AqinTaniPrintService = None
else:
    AqinTaniPrintService = None


# ========== MAIN ==========

def print_banner():
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
        print(f"  Semua   : {', '.join(printers)}")
    print("=" * 50)
    print(f"  Server siap di http://localhost:{PORT}")
    print("  Tekan Ctrl+C untuk menghentikan")
    print("=" * 50)


if __name__ == '__main__':
    # Cek apakah dijalankan sebagai Windows Service command
    if len(sys.argv) > 1 and sys.argv[1] in ('install', 'start', 'stop', 'remove', 'restart', 'update'):
        if platform.system() != 'Windows':
            print("ERROR: Windows Service hanya tersedia di Windows.")
            sys.exit(1)

        if AqinTaniPrintService is None:
            print("ERROR: pywin32 belum terinstall.")
            print("Jalankan: pip install pywin32")
            sys.exit(1)

        cmd = sys.argv[1]

        if cmd == 'install':
            # Install service dengan path ke script ini
            win32serviceutil.HandleCommandLine(AqinTaniPrintService)
            print("\nService berhasil diinstall!")
            print("Jalankan: python print_server.py start")
            print("Service akan otomatis jalan saat Windows start.")

        elif cmd == 'start':
            win32serviceutil.HandleCommandLine(AqinTaniPrintService)
            print("Service dimulai.")

        elif cmd == 'stop':
            win32serviceutil.HandleCommandLine(AqinTaniPrintService)
            print("Service dihentikan.")

        elif cmd == 'remove':
            win32serviceutil.HandleCommandLine(AqinTaniPrintService)
            print("Service dihapus.")

        elif cmd == 'restart':
            win32serviceutil.HandleCommandLine(AqinTaniPrintService)
            print("Service di-restart.")

        elif cmd == 'update':
            win32serviceutil.HandleCommandLine(AqinTaniPrintService)
            print("Service di-update.")

    else:
        # Mode biasa: jalankan langsung
        print_banner()
        run_server()
