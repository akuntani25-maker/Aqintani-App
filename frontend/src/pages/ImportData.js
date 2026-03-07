import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Upload, Download, CheckCircle, AlertCircle, Loader2, Trash2,
  Database, Warehouse, Tags, Users, Package, Box, Receipt, Store, ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';

const ICONS = {
  warehouses: Warehouse, categories: Tags, suppliers: Users,
  products: Package, warehouse_stock: Box, purchases: Receipt,
  payment_history: Receipt, partner_stores: Store, partner_orders: ShoppingCart,
};

const DESCRIPTIONS = {
  warehouses: "Kolom: nama, unit (dus/satuan), urutan",
  categories: "Kolom: nama, deskripsi",
  suppliers: "Kolom: nama, kontak, telepon, email, alamat",
  products: "Kolom: nama, barcode, kategori*, supplier*, harga_jual, harga_beli, harga_box, isi_per_box, min_stok (* harus sudah diimport)",
  warehouse_stock: "Kolom: produk*, gudang*, stok (* harus sudah diimport)",
  purchases: "Kolom: no_pembelian, supplier*, tanggal, produk*, jumlah, harga_satuan, total_pembelian, dibayar, sisa, gudang, catatan. Baris dengan no_pembelian sama = 1 pembelian",
  payment_history: "Kolom: supplier*, tanggal, jumlah, catatan",
  partner_stores: "Kolom: nama, pemilik, telepon, alamat, limit_kredit, hutang_saat_ini",
  partner_orders: "Kolom: no_pesanan, kios_mitra*, tanggal, produk*, jumlah, harga, gudang, diskon, total_pesanan, dibayar, sisa, sales, status. Baris dengan no_pesanan sama = 1 pesanan",
};

export default function ImportData() {
  const [types, setTypes] = useState([]);
  const [importing, setImporting] = useState({});
  const [results, setResults] = useState({});
  const [counts, setCounts] = useState({});

  useEffect(() => { fetchTypes(); fetchCounts(); }, []);

  const fetchTypes = async () => {
    try { const res = await api.get('/import/types'); setTypes(res.data); }
    catch { toast.error('Gagal memuat tipe import'); }
  };

  const fetchCounts = async () => {
    try { const res = await api.get('/import/counts'); setCounts(res.data); }
    catch {}
  };

  const downloadTemplate = async (type) => {
    try {
      const res = await api.get(`/import/template/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${type}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Gagal download template'); }
  };

  const handleImport = async (type, file) => {
    if (!file) return;
    setImporting(prev => ({ ...prev, [type]: true }));
    setResults(prev => ({ ...prev, [type]: null }));
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/import/${type}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResults(prev => ({ ...prev, [type]: res.data }));
      if (res.data.success > 0) toast.success(`${res.data.success} data berhasil diimport`);
      if (res.data.error_count > 0) toast.error(`${res.data.error_count} error ditemukan`);
      fetchCounts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal import data');
      setResults(prev => ({ ...prev, [type]: { error: err.response?.data?.detail || 'Error' } }));
    } finally {
      setImporting(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleClear = async (type, label) => {
    if (!window.confirm(`Yakin ingin menghapus SEMUA data ${label}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await api.delete(`/import/clear/${type}`);
      toast.success(res.data.message);
      fetchCounts();
      setResults(prev => ({ ...prev, [type]: null }));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="import-data-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Import Data</h1>
        <p className="text-sm text-muted-foreground mt-2">Import data dari file CSV atau Excel (.xlsx). Ikuti urutan agar relasi data benar.</p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <div className="flex gap-2 items-start">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Penting:</p>
              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                <li>Import <b>mengabaikan logika bisnis</b> (tidak auto-create purchase, tidak kurangi stok)</li>
                <li>Ikuti urutan: Gudang &rarr; Kategori &rarr; Supplier &rarr; Barang &rarr; Stok &rarr; dst</li>
                <li>Data duplikat (nama sama) akan dilewati otomatis</li>
                <li>Header kolom harus sesuai template (case-insensitive)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {types.map((type, idx) => {
          const Icon = ICONS[type.key] || Database;
          const result = results[type.key];
          const isLoading = importing[type.key];
          const count = counts[type.key] || 0;

          return (
            <Card key={type.key} data-testid={`import-card-${type.key}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">{idx + 1}</div>
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{type.label}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{DESCRIPTIONS[type.key]}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded-full" data-testid={`count-${type.key}`}>{count} data</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2 items-center">
                  <Button variant="outline" size="sm" onClick={() => downloadTemplate(type.key)} data-testid={`download-template-${type.key}`}>
                    <Download className="w-4 h-4 mr-1" />Template CSV
                  </Button>

                  <label className="cursor-pointer">
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" disabled={isLoading}
                      onChange={(e) => { handleImport(type.key, e.target.files[0]); e.target.value = ''; }}
                      data-testid={`file-input-${type.key}`} />
                    <span className={`inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 ${isLoading ? 'bg-primary/70' : 'bg-primary'} text-primary-foreground hover:bg-primary/90 cursor-pointer`}>
                      {isLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                      {isLoading ? 'Mengimport...' : 'Upload & Import'}
                    </span>
                  </label>

                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleClear(type.key, type.label)} data-testid={`clear-${type.key}`}>
                    <Trash2 className="w-4 h-4 mr-1" />Hapus Semua
                  </Button>
                </div>

                {result && !result.error && (
                  <div className="mt-3 p-3 rounded-lg bg-muted text-sm space-y-1" data-testid={`result-${type.key}`}>
                    <div className="flex gap-4 flex-wrap">
                      {result.success > 0 && <span className="flex items-center gap-1 text-green-700"><CheckCircle className="w-4 h-4" />{result.success} berhasil</span>}
                      {result.skipped > 0 && <span className="text-amber-600">{result.skipped} dilewati (duplikat)</span>}
                      {result.error_count > 0 && <span className="flex items-center gap-1 text-red-600"><AlertCircle className="w-4 h-4" />{result.error_count} error</span>}
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto text-xs text-red-600 space-y-0.5">
                        {result.errors.map((err, i) => <div key={i}>{err}</div>)}
                      </div>
                    )}
                  </div>
                )}
                {result && result.error && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 text-sm text-red-700">{result.error}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
