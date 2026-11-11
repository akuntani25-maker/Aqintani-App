import React from 'react';

/** Langkah singkat bila print server tidak terdeteksi oleh aplikasi. */
export default function PrintServerHelp() {
  return (
    <details className="mt-2 text-xs" data-testid="print-server-help">
      <summary className="cursor-pointer font-semibold underline">Sudah dijalankan tapi tetap tidak aktif?</summary>
      <ol className="mt-1 ml-4 list-decimal space-y-1">
        <li>Di PC ini, buka <a href="http://localhost:9100/status" target="_blank" rel="noreferrer" className="underline font-semibold">http://localhost:9100/status</a> di tab baru.</li>
        <li><strong>Muncul tulisan <code>"status":"ok"</code></strong>: server sudah jalan, browser yang memblokir. Klik ikon di kiri alamat situs aplikasi ini → <em>Setelan situs</em> → izinkan <em>Akses jaringan lokal</em> (Local network access), lalu muat ulang halaman ini.</li>
        <li><strong>Halaman tidak bisa dibuka</strong>: server belum jalan. Buka PowerShell di folder tempat file print_server.py, jalankan <code>python print_server.py status</code> untuk melihat penyebabnya.</li>
      </ol>
    </details>
  );
}
