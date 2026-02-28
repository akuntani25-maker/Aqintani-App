import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { LogIn, Pill, Sprout } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(email, password);
      toast.success('Login berhasil!');
      
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/pos');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1758573467057-955f803660a9?q=85&w=1920&auto=format&fit=crop)'
        }}
      >
        <div className="absolute inset-0 bg-primary/80 backdrop-blur-sm"></div>
        <div className="relative z-10 p-12 flex flex-col justify-center text-white">
          <div className="flex items-center gap-3 mb-8">
            <Pill className="w-10 h-10" />
            <Sprout className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            AgriPharma POS
          </h1>
          <p className="text-lg leading-relaxed opacity-90">
            Sistem Manajemen Toko Obat & Alat Pertanian Modern
          </p>
          <div className="mt-12 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
              <p className="text-base">Kelola inventori dengan mudah</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
              <p className="text-base">Transaksi cepat dan akurat</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
              <p className="text-base">Laporan lengkap real-time</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Pill className="w-8 h-8 text-primary" />
              <Sprout className="w-8 h-8 text-secondary" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-primary">AgriPharma POS</h2>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Selamat Datang</h2>
            <p className="text-sm text-muted-foreground mt-2">Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@contoh.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={loading}
              data-testid="login-submit-button"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Masuk
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-accent rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Akun Demo:</p>
            <p className="text-sm text-foreground">Admin: admin@agripharma.com / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
};