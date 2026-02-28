import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import { Store, Save } from 'lucide-react';

export const StoreSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    store_name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/store-settings');
      setSettings(response.data);
    } catch (error) {
      toast.error('Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/store-settings', settings);
      toast.success('Pengaturan toko berhasil disimpan');
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="store-settings-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pengaturan Toko</h1>
        <p className="text-sm text-muted-foreground mt-2">Kelola informasi toko untuk struk dan dokumen</p>
      </div>

      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Informasi Toko</h2>
            <p className="text-sm text-muted-foreground">Data ini akan muncul di struk dan laporan</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="store_name">Nama Toko *</Label>
              <Input
                id="store_name"
                value={settings.store_name}
                onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                required
                data-testid="store-name-input"
                placeholder="UD. AQIN TANI"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telepon *</Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                required
                data-testid="store-phone-input"
                placeholder="(021) 1234-5678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Alamat Lengkap *</Label>
            <Input
              id="address"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              required
              data-testid="store-address-input"
              placeholder="Jl. Contoh No. 123, Kelurahan, Kecamatan, Kota"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              data-testid="store-email-input"
              placeholder="info@aqintani.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo_url">URL Logo (Optional)</Label>
            <Input
              id="logo_url"
              value={settings.logo_url}
              onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
              data-testid="store-logo-input"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted-foreground">
              Upload logo ke cloud storage dan masukkan URL-nya di sini
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={saving}
              data-testid="save-settings-button"
              className="flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Pengaturan
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            💡 <strong>Info:</strong> Pengaturan ini akan digunakan pada struk transaksi, invoice kios mitra, dan semua dokumen resmi toko.
          </p>
        </div>
      </Card>
    </div>
  );
};
