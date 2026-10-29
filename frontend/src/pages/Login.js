import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { LogIn, Sprout, Eye, EyeOff } from '../components/icons';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success('Login berhasil!');
      if (['admin', 'manager', 'office_staff'].includes(user.role)) {
        navigate('/admin/dashboard');
      } else if (user.role === 'canvasser') {
        navigate('/canvasser');
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
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=85&w=1920&auto=format&fit=crop)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/90 to-primary/85"></div>
        <div className="relative z-10 p-12 flex flex-col justify-center text-white max-w-xl stagger">
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
            {[
              ['Manajemen Inventori Cerdas', 'Tracking stok real-time dengan alert otomatis'],
              ['Transaksi Super Cepat', 'POS dengan barcode scanner & multiple payment'],
              ['Laporan Komprehensif', 'Analisis penjualan harian & bulanan otomatis'],
            ].map(([title, desc], i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/30 transition-colors">
                  <div className="w-3 h-3 bg-secondary rounded-full"></div>
                </div>
                <div>
                  <p className="text-lg font-medium mb-1">{title}</p>
                  <p className="text-sm opacity-75">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 bg-gradient-mesh">
        <div className="w-full max-w-md space-y-8 bg-card rounded-[24px] shadow-soft-xl border border-border/50 p-8 sm:p-10 animate-fade-up stagger">
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
                id="email" type="email" placeholder="nama@contoh.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required
                data-testid="login-email-input" className="h-12 text-base rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                  data-testid="login-password-input" className="h-12 text-base rounded-xl pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base rounded-full shadow-glow"
              disabled={loading}
              data-testid="login-submit-button"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2"><LogIn className="w-5 h-5" /> Masuk</span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
