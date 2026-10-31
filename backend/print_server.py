#!/usr/bin/env python3
"""
UD. AQIN TANI - Local Print Server
===================================
Server lokal untuk mencetak struk ke printer thermal USB
menggunakan perintah ESC/POS (font firmware printer).

=== Jalankan langsung ===
  python print_server.py

=== Auto-start saat Windows boot ===
  python print_server.py install     (sekali saja)
  python print_server.py remove      (untuk hapus auto-start)
  python print_server.py status      (cek apakah auto-start aktif)

Server berjalan di http://localhost:9100
"""

import sys
import os
import platform
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS

# ========== KONFIGURASI ==========
PORT = 9100
PRINTER_NAME = None  # None = auto-detect, atau isi nama printer manual
DOTMATRIX_PRINTER_NAME = None  # Nama printer dot matrix (Epson LX-310), None = auto-detect

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


def get_dotmatrix_printer():
    """Detect dot matrix printer (Epson LX-310 or similar)."""
    global DOTMATRIX_PRINTER_NAME
    if DOTMATRIX_PRINTER_NAME:
        return DOTMATRIX_PRINTER_NAME
    printers = get_printer_list()
    for p in printers:
        pl = p.lower()
        if any(k in pl for k in ['lx-310', 'lx310', 'lx-300', 'epson lx', 'dot matrix', 'lq-310', 'lq310']):
            return p
    return None


def send_to_dotmatrix(data):
    """Send raw ESC/P data to dot matrix printer."""
    printer = get_dotmatrix_printer()
    if not printer:
        printer = get_default_printer()
    if not printer:
        raise Exception("Tidak ada printer dot matrix terdeteksi. Set nama printer di konfigurasi atau pastikan Epson LX-310 terhubung.")
    system = platform.system()
    if system == 'Windows':
        import win32print
        hPrinter = win32print.OpenPrinter(printer)
        try:
            hJob = win32print.StartDocPrinter(hPrinter, 1, ("ESC/P Dot Matrix Invoice", None, "RAW"))
            try:
                win32print.StartPagePrinter(hPrinter)
                win32print.WritePrinter(hPrinter, data)
                win32print.EndPagePrinter(hPrinter)
            finally:
                win32print.EndDocPrinter(hPrinter)
        finally:
            win32print.ClosePrinter(hPrinter)
    else:
        send_to_printer_linux(data, printer)
    return printer


# ========== API ENDPOINTS ==========

@app.route('/status', methods=['GET'])
def status():
    printer = get_default_printer()
    dotmatrix = get_dotmatrix_printer()
    printers = get_printer_list()
    return jsonify({
        'status': 'ok',
        'printer': printer,
        'dotmatrix_printer': dotmatrix,
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


@app.route('/print-dotmatrix', methods=['POST'])
def print_dotmatrix():
    """Cetak faktur ke printer dot matrix (Epson LX-310)."""
    try:
        data = request.get_data()
        if not data:
            return jsonify({'error': 'Tidak ada data untuk dicetak'}), 400
        printer_used = send_to_dotmatrix(data)
        return jsonify({
            'success': True,
            'message': f'Faktur berhasil dicetak ke: {printer_used}',
            'printer': printer_used
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/set-dotmatrix-printer', methods=['POST'])
def set_dotmatrix_printer():
    """Set nama printer dot matrix manual."""
    global DOTMATRIX_PRINTER_NAME
    body = request.get_json()
    name = body.get('name', '')
    if not name:
        return jsonify({'error': 'Nama printer tidak boleh kosong'}), 400
    DOTMATRIX_PRINTER_NAME = name
    return jsonify({'success': True, 'printer': DOTMATRIX_PRINTER_NAME})


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


# ========== AUTO-START SETUP (Windows Startup Folder) ==========

def get_startup_folder():
    """Path ke folder Startup Windows."""
    return os.path.join(os.environ.get('APPDATA', ''), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')


def get_vbs_path():
    """Path file VBS di folder Startup."""
    return os.path.join(get_startup_folder(), 'AqinTaniPrintServer.vbs')


def get_pythonw_path():
    """Cari pythonw.exe (Python tanpa console window)."""
    python_dir = os.path.dirname(sys.executable)
    pythonw = os.path.join(python_dir, 'pythonw.exe')
    if os.path.exists(pythonw):
        return pythonw
    # Fallback: coba di Scripts
    pythonw2 = os.path.join(python_dir, 'Scripts', 'pythonw.exe')
    if os.path.exists(pythonw2):
        return pythonw2
    return None


def install_autostart():
    """Install auto-start: buat file VBS di folder Startup Windows."""
    if platform.system() != 'Windows':
        print("ERROR: Fitur ini hanya untuk Windows.")
        return False

    script_path = os.path.abspath(__file__)
    pythonw = get_pythonw_path()
    startup_folder = get_startup_folder()
    vbs_path = get_vbs_path()

    if not os.path.exists(startup_folder):
        print(f"ERROR: Folder Startup tidak ditemukan: {startup_folder}")
        return False

    exe_path = pythonw if pythonw else sys.executable
    if not pythonw:
        print("PERINGATAN: pythonw.exe tidak ditemukan, akan menggunakan python.exe")
        print("  (console window akan terlihat saat startup)")

    # Buat file VBS yang menjalankan print server secara tersembunyi
    # VBScript: "" = escaped double quote dalam string literal
    # Gunakan \n saja, Python text mode di Windows akan konversi ke \r\n
    vbs_content = 'Set WshShell = CreateObject("WScript.Shell")\n'
    vbs_content += 'WshShell.CurrentDirectory = "' + os.path.dirname(script_path) + '"\n'
    vbs_content += 'WshShell.Run """' + exe_path + '"" ""' + script_path + '""", 0, False\n'

    try:
        with open(vbs_path, 'w') as f:
            f.write(vbs_content)
        print("=" * 55)
        print("  AUTO-START BERHASIL DIINSTALL!")
        print("=" * 55)
        print(f"  File : {vbs_path}")
        print(f"  Server akan otomatis jalan saat Windows start")
        print(f"  (berjalan tersembunyi tanpa console window)")
        print("")
        print(f"  Untuk test, restart PC atau jalankan manual:")
        print(f"    python print_server.py")
        print("")
        print(f"  Untuk hapus auto-start:")
        print(f"    python print_server.py remove")
        print("=" * 55)
        return True
    except Exception as e:
        print(f"ERROR: Gagal menulis file: {e}")
        return False


def remove_autostart():
    """Hapus auto-start dari folder Startup."""
    vbs_path = get_vbs_path()
    if os.path.exists(vbs_path):
        try:
            os.remove(vbs_path)
            print("=" * 55)
            print("  AUTO-START BERHASIL DIHAPUS!")
            print("=" * 55)
            print(f"  File dihapus: {vbs_path}")
            print(f"  Print server tidak akan jalan otomatis lagi.")
            print("=" * 55)
            return True
        except Exception as e:
            print(f"ERROR: Gagal menghapus file: {e}")
            return False
    else:
        print("Auto-start belum diinstall (file tidak ditemukan).")
        return False


def check_autostart_status():
    """Cek apakah auto-start sudah aktif."""
    vbs_path = get_vbs_path()
    if os.path.exists(vbs_path):
        print("=" * 55)
        print("  STATUS: AUTO-START AKTIF")
        print("=" * 55)
        print(f"  File: {vbs_path}")
        print(f"  Print server akan otomatis jalan saat Windows start.")
        print("")
        print(f"  Untuk hapus: python print_server.py remove")
        print("=" * 55)
    else:
        print("=" * 55)
        print("  STATUS: AUTO-START TIDAK AKTIF")
        print("=" * 55)
        print(f"  Print server tidak akan jalan otomatis.")
        print("")
        print(f"  Untuk install: python print_server.py install")
        print("=" * 55)


# ========== MAIN ==========

def print_banner():
    print("=" * 55)
    print("  UD. AQIN TANI - Local Print Server")
    print("=" * 55)
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
    print("=" * 55)
    print(f"  Server siap di http://localhost:{PORT}")
    print(f"  Tekan Ctrl+C untuk menghentikan")
    print("=" * 55)


if __name__ == '__main__':
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()

        if cmd == 'install':
            install_autostart()

        elif cmd == 'remove' or cmd == 'uninstall':
            remove_autostart()

        elif cmd == 'status':
            check_autostart_status()

        else:
            print(f"Perintah tidak dikenal: {cmd}")
            print("")
            print("Perintah yang tersedia:")
            print("  python print_server.py           Jalankan server")
            print("  python print_server.py install   Install auto-start")
            print("  python print_server.py remove    Hapus auto-start")
            print("  python print_server.py status    Cek status auto-start")
    else:
        # Mode biasa: jalankan server langsung
        print_banner()
        run_server()
