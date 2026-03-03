import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { 
  LayoutDashboard, Package, Users, Layers, FileText, Settings, LogOut,
  Sprout, UserCog, Printer, Store, ShoppingCart, Truck, TrendingUp, ShoppingBag,
  Menu, X, Banknote
} from 'lucide-react';

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const menuItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/products', icon: Package, label: 'Produk' },
    { to: '/admin/categories', icon: Layers, label: 'Kategori' },
    { to: '/admin/suppliers', icon: Users, label: 'Supplier' },
    { to: '/admin/supplier-debts', icon: Banknote, label: 'Hutang Supplier' },
    { to: '/admin/partner-stores', icon: Store, label: 'Kios Mitra' },
    { to: '/admin/partner-orders', icon: ShoppingCart, label: 'Pesanan Kios' },
    { to: '/admin/canvassers', icon: Truck, label: 'Kanvaser' },
    { to: '/admin/analytics', icon: TrendingUp, label: 'Analytics' },
    { to: '/admin/reports', icon: FileText, label: 'Laporan' },
    { to: '/admin/users', icon: UserCog, label: 'Pengguna' },
    { to: '/admin/store-settings', icon: Settings, label: 'Toko' },
    { to: '/admin/settings', icon: Printer, label: 'Printer' },
    { to: '/admin/profile', icon: Settings, label: 'Profil' },
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen flex" data-testid="admin-layout">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-primary text-white flex items-center justify-between px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} data-testid="mobile-menu-toggle" className="p-1 rounded-lg hover:bg-white/10">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-secondary" />
            <span className="font-bold text-sm">UD. AQIN TANI</span>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen z-50
        w-64 lg:w-72
        bg-gradient-to-b from-primary via-primary to-primary/95 text-white
        flex flex-col shadow-2xl
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} data-testid="admin-sidebar">
        <div className="p-4 lg:p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-secondary/20 flex items-center justify-center backdrop-blur-sm border border-secondary/30">
              <Sprout className="w-5 h-5 lg:w-6 lg:h-6 text-secondary" />
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-bold">UD. AQIN TANI</h1>
              <p className="text-[10px] lg:text-xs text-white/60 font-medium">Management System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 lg:p-4 space-y-0.5 lg:space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-white/15 text-white font-medium shadow-lg backdrop-blur-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
              data-testid={`menu-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 lg:p-4 border-t border-white/10">
          <div className="mb-2 lg:mb-3 px-3 py-2 lg:py-3 bg-white/5 rounded-xl backdrop-blur-sm">
            <p className="text-[10px] lg:text-xs text-white/50 uppercase tracking-wider font-semibold mb-1">Akun</p>
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

      <main className="flex-1 bg-gradient-mesh overflow-auto w-full pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
};
