import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../context/AuthContext';
import { Button } from './ui/button';
import { 
  LayoutDashboard, Package, Users, Layers, FileText, Settings, LogOut,
  Sprout, UserCog, Printer, Store, ShoppingCart, Truck, TrendingUp,
  Menu, X, Banknote, PanelLeftClose, PanelLeft, Database, ClipboardList, Car, HandCoins
} from 'lucide-react';

const ROLE_MENU_MAP = {
  dashboard: '/admin/dashboard',
  products: '/admin/products',
  categories: '/admin/categories',
  suppliers: '/admin/suppliers',
  supplier_debts: '/admin/supplier-debts',
  partner_stores: '/admin/partner-stores',
  partner_orders: '/admin/partner-orders',
  canvassers: '/admin/canvassers',
  vehicles: '/admin/vehicles',
  analytics: '/admin/analytics',
  reports: '/admin/reports',
  users: '/admin/users',
  store_settings: '/admin/store-settings',
  import_data: '/admin/import-data',
  printer: '/admin/settings',
  audit_log: '/admin/audit-log',
  personal_loans: '/admin/personal-loans',
  profile: '/admin/profile',
};

export const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    const fetchPerms = async () => {
      try {
        const res = await api.get('/role-permissions');
        setPermissions(res.data.current_permissions || []);
      } catch {
        setPermissions(['dashboard', 'profile']);
      }
    };
    fetchPerms();
  }, []);

  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const res = await api.get('/products/low-stock');
        setLowStockCount(Array.isArray(res.data) ? res.data.length : 0);
      } catch {}
    };
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const allMenuItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', perm: 'dashboard' },
    { to: '/admin/products', icon: Package, label: 'Barang', perm: 'products' },
    { to: '/admin/categories', icon: Layers, label: 'Kategori', perm: 'categories' },
    { to: '/admin/suppliers', icon: Users, label: 'Supplier', perm: 'suppliers' },
    { to: '/admin/supplier-debts', icon: Banknote, label: 'Hutang Supplier', perm: 'supplier_debts' },
    { to: '/admin/partner-stores', icon: Store, label: 'Kios Mitra', perm: 'partner_stores' },
    { to: '/admin/partner-orders', icon: ShoppingCart, label: 'Pesanan Kios', perm: 'partner_orders' },
    { to: '/admin/canvassers', icon: Truck, label: 'Kanvaser & Armada', perm: 'canvassers' },
    { to: '/admin/analytics', icon: TrendingUp, label: 'Analytics', perm: 'analytics' },
    { to: '/admin/reports', icon: FileText, label: 'Laporan', perm: 'reports' },
    { to: '/admin/audit-log', icon: ClipboardList, label: 'Log Aktivitas', perm: 'audit_log' },
    { to: '/admin/personal-loans', icon: HandCoins, label: 'Piutang Pribadi', perm: 'personal_loans' },
    { to: '/admin/users', icon: UserCog, label: 'Pengguna', perm: 'users' },
    { to: '/admin/store-settings', icon: Settings, label: 'Toko', perm: 'store_settings' },
    { to: '/admin/import-data', icon: Database, label: 'Import Data', perm: 'import_data' },
    { to: '/admin/settings', icon: Printer, label: 'Printer', perm: 'printer' },
    { to: '/admin/profile', icon: Settings, label: 'Profil', perm: 'profile' },
  ];

  const menuItems = allMenuItems.filter(item => permissions.includes(item.perm));

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
              <span className="flex-1">{item.label}</span>
              {item.perm === 'products' && lowStockCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center" data-testid="low-stock-badge">
                  {lowStockCount}
                </span>
              )}
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
