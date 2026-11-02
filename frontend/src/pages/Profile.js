import React, { useState } from 'react';
import { api, useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import { User, Mail, Lock, Save } from '../components/icons';

export const Profile = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = {};
      
      if (formData.name !== user.name) {
        updateData.name = formData.name;
      }
      
      if (formData.email !== user.email) {
        updateData.email = formData.email;
      }
      
      if (formData.new_password) {
        if (formData.new_password !== formData.confirm_password) {
          toast.error('Password baru tidak cocok');
          setLoading(false);
          return;
        }
        if (!formData.current_password) {
          toast.error('Masukkan password saat ini');
          setLoading(false);
          return;
        }
        updateData.current_password = formData.current_password;
        updateData.new_password = formData.new_password;
      }

      if (Object.keys(updateData).length === 0) {
        toast.error('Tidak ada perubahan');
        setLoading(false);
        return;
      }

      await api.put('/auth/profile', updateData);
      toast.success('Profil berhasil diperbarui');
      
      if (updateData.new_password) {
        toast.success('Password berhasil diubah. Silakan login kembali.');
        setTimeout(() => {
          logout();
          window.location.href = '/login';
        }, 2000);
      } else {
        window.location.reload();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal memperbarui profil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="profile-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Profil Saya</h1>
        <p className="text-sm text-muted-foreground mt-2">Kelola informasi akun Anda</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1 h-fit">
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <User className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-xl font-bold">{user?.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
            <div className="mt-4 px-3 py-2 bg-primary/10 rounded-lg inline-flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-sm font-medium capitalize">{user?.role}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="text-xl font-semibold mb-6">Informasi Akun</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nama Lengkap
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="profile-name-input"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="profile-email-input"
                className="h-11"
              />
            </div>

            <div className="pt-6 border-t">
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Ubah Password
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password">Password Saat Ini</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={formData.current_password}
                    onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                    placeholder="Kosongkan jika tidak ingin ubah password"
                    data-testid="profile-current-password-input"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_password">Password Baru</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={formData.new_password}
                    onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                    placeholder="Minimal 6 karakter"
                    data-testid="profile-new-password-input"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Konfirmasi Password Baru</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    placeholder="Ketik ulang password baru"
                    data-testid="profile-confirm-password-input"
                    className="h-11"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                data-testid="profile-submit-button"
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan Perubahan
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
