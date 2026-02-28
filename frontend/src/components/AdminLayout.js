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
  Pill,
  Sprout,
  UserCog
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
    { to: '/admin/profile', icon: Settings, label: 'Profil' },
  ];

  return (
    <div className="min-h-screen flex" data-testid="admin-layout">
      <aside className="w-64 bg-primary text-white flex flex-col" data-testid="admin-sidebar">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <Pill className="w-6 h-6" />
            <Sprout className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold">AgriPharma POS</h1>
          <p className="text-xs text-white/70 mt-1">Admin Panel</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
              data-testid={`menu-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="mb-3 px-2">
            <p className="text-xs text-white/50 uppercase tracking-wider">Akun</p>
            <p className="text-sm font-medium mt-1">{user?.name}</p>
            <p className="text-xs text-white/70">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/5"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Keluar
          </Button>
        </div>
      </aside>

      <main className="flex-1 bg-background overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};