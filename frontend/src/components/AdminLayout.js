import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../context/AuthContext';
import { Button } from './ui/button';
import { 
  LayoutDashboard, Package, Users, Layers, FileText, Settings, LogOut,
  Sprout, UserCog, Printer, Store, ShoppingCart, Truck, TrendingUp,
  Menu, X, Banknote, PanelLeftClose, PanelLeft, Database, ClipboardList, Car, HandCoins, Moon, Sun
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
  vehicle_stock: '/admin/vehicle-stock',
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
  const [collapsed, setCollapsed] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') === 'dark';
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
      } catch (e) { console.error(e); }
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
    { to: '/admin/vehicle-stock', icon: Truck, label: 'Stok Mobil Box', perm: 'vehicle_stock' },
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
  const location = useLocation();
  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) setCollapsed(!collapsed);
    else setSidebarOpen(!sidebarOpen);
  };
  const initials = (user?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const currentLabel = allMenuItems.find(i => location.pathname.startsWith(i.to))?.label || 'Dashboard';

  return (
    <div className="min-h-screen flex bg-background" data-testid="admin-layout">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 lg:hidden animate-in fade-in-0 duration-200" onClick={closeSidebar} data-testid="sidebar-overlay" />
      )}

      <aside className={`
        fixed top-0 left-0 bottom-0 z-50 w-[264px]
        bg-card border-r border-border/60 flex flex-col
        shadow-soft-xl lg:shadow-none
        transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${collapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}
      `} data-testid="admin-sidebar">
        <div className="h-16 shrink-0 flex items-center gap-3 px-6">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-glow">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-extrabold text-[15px] tracking-tight text-foreground">AQIN TANI</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Obat & Alat Tani</p>
          </div>
          <button onClick={closeSidebar} className="ml-auto p-1.5 rounded-full text-muted-foreground hover:bg-lightprimary hover:text-primary transition-colors lg:hidden" data-testid="sidebar-close-button">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-4 pb-4 pt-2 overflow-y-auto">
          <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Menu</p>
          <div className="space-y-1">
            {menuItems.map((item, idx) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeSidebar}
                style={{ animationDelay: `${Math.min(idx, 14) * 25}ms` }}
                className={({ isActive }) =>
                  `nav-item-enter group relative flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-[background-color,color,box-shadow] duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-glow'
                      : 'text-foreground/75 font-medium hover:bg-lightprimary hover:text-primary'
                  }`
                }
                data-testid={`menu-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.perm === 'products' && lowStockCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center" data-testid="low-stock-badge">
                    {lowStockCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="p-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-lightprimary">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-primary/80 uppercase tracking-wider font-bold">Akun</p>
              <p className="text-sm font-semibold truncate text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className={`flex-1 min-w-0 flex flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? 'lg:pl-0' : 'lg:pl-[264px]'}`}>
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-3 px-4 md:px-6 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={toggleSidebar} data-testid="menu-toggle" className="w-10 h-10 flex items-center justify-center rounded-full text-foreground/70 hover:bg-lightprimary hover:text-primary transition-colors">
              {sidebarOpen || !collapsed ? <PanelLeftClose className="w-5 h-5 hidden lg:block" /> : <PanelLeft className="w-5 h-5 hidden lg:block" />}
              {sidebarOpen ? <X className="w-5 h-5 lg:hidden" /> : <Menu className="w-5 h-5 lg:hidden" />}
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Sprout className="w-5 h-5 text-primary" />
              <span className="font-extrabold text-sm tracking-tight">UD. AQIN TANI</span>
            </div>
            <p className="hidden lg:block text-sm font-semibold text-muted-foreground truncate" data-testid="header-page-title">
              <span className="text-foreground/50">UD. AQIN TANI</span>
              <span className="mx-2 text-foreground/30">/</span>
              <span className="text-foreground">{currentLabel}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-10 h-10 flex items-center justify-center rounded-full text-foreground/70 hover:bg-lightprimary hover:text-primary transition-colors"
              data-testid="dark-mode-toggle"
              title={darkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <div className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-card border border-border/60 shadow-soft">
              <div className="w-8 h-8 rounded-full bg-lightprimary text-primary flex items-center justify-center text-xs font-bold">{initials}</div>
              <span className="text-xs font-semibold text-foreground max-w-[140px] truncate">{user?.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 text-foreground/70 hover:text-red-600 hover:bg-red-50"
              onClick={handleLogout}
              data-testid="logout-button"
              title="Keluar"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </Button>
          </div>
        </header>

        <main className="flex-1 w-full min-w-0">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
