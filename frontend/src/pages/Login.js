import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
          backgroundImage: 'url(https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=85&w=1920&auto=format&fit=crop)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/90 to-primary/85"></div>
        <div className="relative z-10 p-12 flex flex-col justify-center text-white max-w-xl">
          <div className="mb-8">
            <div className="inline-flex items-center gap-3 mb-6 bg-white/10 backdrop-blur-sm px-5 py-3 rounded-2xl border border-white/20">
              <Sprout className="w-8 h-8 text-secondary" />
              <span className="text-2xl font-bold tracking-tight">UD. AQIN TANI</span>
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Sistem Manajemen<br />Toko Modern
          </h1>
          <p className="text-xl leading-relaxed opacity-90 mb-12">
            Kelola toko obat & alat pertanian Anda dengan mudah, cepat, dan profesional
          </p>
          <div className="space-y-5">
            <div className="flex items-start gap-4 group">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/30 transition-colors">
                <div className="w-3 h-3 bg-secondary rounded-full"></div>
              </div>
              <div>
                <p className="text-lg font-medium mb-1">Manajemen Inventori Cerdas</p>
                <p className="text-sm opacity-75">Tracking stok real-time dengan alert otomatis</p>
              </div>
            </div>
            <div className="flex items-start gap-4 group">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/30 transition-colors">
                <div className="w-3 h-3 bg-secondary rounded-full"></div>
              </div>
              <div>
                <p className="text-lg font-medium mb-1">Transaksi Super Cepat</p>
                <p className="text-sm opacity-75">POS dengan barcode scanner & multiple payment</p>
              </div>
            </div>
            <div className="flex items-start gap-4 group">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/30 transition-colors">
                <div className="w-3 h-3 bg-secondary rounded-full"></div>
              </div>
              <div>
                <p className="text-lg font-medium mb-1">Laporan Komprehensif</p>
                <p className="text-sm opacity-75">Analisis penjualan harian & bulanan otomatis</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-mesh">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden mb-8">
            <div className="inline-flex items-center gap-2 mb-4 bg-primary/10 px-4 py-2 rounded-xl">
              <Sprout className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold text-primary">UD. AQIN TANI</span>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Selamat Datang</h2>
            <p className="text-base text-muted-foreground mt-2">Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@contoh.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="h-12 text-base rounded-xl border-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                className="h-12 text-base rounded-xl border-2"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
              disabled={loading}
              data-testid="login-submit-button"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-5 h-5" />
                  Masuk
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 p-5 bg-gradient-to-br from-accent to-accent/50 rounded-2xl border-2 border-primary/10">
            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">Akun Demo:</p>
            <p className="text-sm text-foreground font-medium">admin@agripharma.com / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
};