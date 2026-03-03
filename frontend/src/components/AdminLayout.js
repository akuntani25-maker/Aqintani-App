import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { 
  LayoutDashboard, Package, Users, Layers, FileText, Settings, LogOut,
  Sprout, UserCog, Printer, Store, ShoppingCart, Truck, TrendingUp,
  Menu, X, Banknote, PanelLeftClose, PanelLeft
} from 'lucide-react';

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
      {/* Top bar — always visible */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-primary text-white flex items-center justify-between px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} data-testid="menu-toggle" className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-secondary" />
            <span className="font-bold text-sm">UD. AQIN TANI</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/70 hidden sm:inline">{user?.name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-2"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 mt-12" onClick={closeSidebar} data-testid="sidebar-overlay" />
      )}

      {/* Sidebar — collapsible on all devices */}
      <aside className={`
        fixed top-12 left-0 bottom-0 z-50
        w-64 bg-gradient-to-b from-primary via-primary to-primary/95 text-white
        flex flex-col shadow-2xl
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} data-testid="admin-sidebar">
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${
                  isActive
                    ? 'bg-white/15 text-white font-medium shadow-lg backdrop-blur-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
              data-testid={`menu-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 bg-white/5 rounded-xl backdrop-blur-sm">
            <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mb-1">Akun</p>
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-white/60 truncate">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gradient-mesh overflow-auto w-full pt-12">
        <Outlet />
      </main>
    </div>
  );
};
