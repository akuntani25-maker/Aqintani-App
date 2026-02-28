import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Layers, 
  FileText, 
  Settings, 
  LogOut,
  Sprout,
  UserCog,
  Printer,
  Store,
  ShoppingCart,
  Truck,
  TrendingUp,
  ShoppingBag
} from 'lucide-react';

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/products', icon: Package, label: 'Produk' },
    { to: '/admin/categories', icon: Layers, label: 'Kategori' },
    { to: '/admin/suppliers', icon: Users, label: 'Supplier' },
    { to: '/admin/reports', icon: FileText, label: 'Laporan' },
    { to: '/admin/users', icon: UserCog, label: 'Pengguna' },
    { to: '/admin/settings', icon: Printer, label: 'Printer' },
    { to: '/admin/profile', icon: Settings, label: 'Profil' },
  ];

  return (
    <div className="min-h-screen flex" data-testid="admin-layout">
      <aside className="w-72 bg-gradient-to-b from-primary via-primary to-primary/95 text-white flex flex-col shadow-2xl" data-testid="admin-sidebar">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center backdrop-blur-sm border border-secondary/30">
              <Sprout className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">UD. AQIN TANI</h1>
              <p className="text-xs text-white/60 font-medium">Management System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-white/15 text-white font-medium shadow-lg backdrop-blur-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
              data-testid={`menu-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="mb-3 px-3 py-3 bg-white/5 rounded-xl backdrop-blur-sm">
            <p className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-1">Akun</p>
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-white/60 truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10 rounded-xl"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Keluar
          </Button>
        </div>
      </aside>

      <main className="flex-1 bg-gradient-mesh overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
