import React, { useState, useEffect, useCallback } from 'react';
import { PageSkeleton } from '../components/PageSkeleton';
import { api } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Calendar } from '../components/ui/calendar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, AlertTriangle, DollarSign,
  Warehouse, CreditCard, Store, CalendarDays, Bell, ArrowDownToLine, ArrowUpFromLine, Landmark
} from '../components/icons';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#6366f1'];

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(new Date());
  const [calData, setCalData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => { fetchStats(); }, []);

  const fetchCalendar = useCallback(async (date) => {
    try {
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const res = await api.get(`/dashboard/due-calendar?year=${y}&month=${m}`);
      setCalData(res.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchCalendar(calMonth); }, [calMonth, fetchCalendar]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageSkeleton variant="dashboard" />
    );
  }

  const dueDates = calData.map(p => {
    const [y, m, d] = p.due_date.split('-').map(Number);
    return new Date(y, m - 1, d);
  });

  const fmtLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const selectedDayItems = selectedDate
    ? calData.filter(p => p.due_date === fmtLocalDate(selectedDate))
    : [];

  const statCards = [
    { title: 'Penjualan Hari Ini', value: fmt(stats?.today_sales || 0), icon: DollarSign, color: 'bg-primary', testId: 'today-sales-card' },
    { title: 'Transaksi Hari Ini', value: stats?.today_transactions || 0, icon: ShoppingCart, color: 'bg-secondary', testId: 'today-transactions-card' },
    { title: 'Total Barang', value: stats?.total_products || 0, icon: Package, color: 'bg-blue-500', testId: 'total-products-card' },
    { title: 'Stok Menipis', value: stats?.low_stock_count || 0, icon: AlertTriangle, color: 'bg-orange-500', testId: 'low-stock-card' },
  ];

  const financeCards = [
    { title: 'Bon Supplier Belum Bayar', value: fmt(stats?.total_supplier_debt || 0), icon: CreditCard, color: 'bg-red-500', testId: 'supplier-debt-card' },
    { title: 'Bon Kios Mitra', value: fmt(stats?.total_partner_debt || 0), icon: Store, color: 'bg-amber-500', testId: 'partner-debt-card' },
    { title: 'Barang Masuk Hari Ini', value: fmt(stats?.stock_in_today || 0), icon: ArrowDownToLine, color: 'bg-teal-500', testId: 'stock-in-card' },
    { title: 'Barang Keluar Hari Ini', value: fmt(stats?.stock_out_today || 0), icon: ArrowUpFromLine, color: 'bg-violet-500', testId: 'stock-out-card', sub: `POS: ${fmt(stats?.stock_out_today_pos || 0)} | Mitra: ${fmt(stats?.stock_out_today_partner || 0)}` },
  ];

  const dueThisMonth = stats?.due_this_month || [];
  const warehouseChart = stats?.warehouse_chart || [];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Selamat datang di UD. Aqin Tani</p>
      </div>

      {/* Total Assets - TOP */}
      <Card className="p-4 md:p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white" data-testid="total-assets-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Nilai Aset Bersih</p>
            <p className="text-xl md:text-2xl lg:text-3xl font-bold">{fmt(stats?.total_assets || 0)}</p>
            <p className="text-xs text-slate-400 mt-1">
              Gudang ({fmt(stats?.inventory_value || 0)}) + Stok Mobil ({fmt(stats?.total_vehicle_stock || 0)}) + Piutang ({fmt(stats?.total_personal_loans || 0)}) + Hutang Petani ({fmt(stats?.total_farmer_debt || 0)}) - Bon Supplier ({fmt(stats?.total_supplier_debt || 0)})
            </p>
            {/* Bon Mitra per Armada breakdown */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {stats?.partner_debt_vehicles?.length > 0 ? (
                stats.partner_debt_vehicles.map((v, i) => (
                  <span key={i} className="text-xs text-slate-300">
                    + Bon {v.vehicle} ({fmt(v.debt)})
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">+ Bon Mitra ({fmt(stats?.total_partner_debt || 0)})</span>
              )}
            </div>
          </div>
          <div className="bg-white/10 p-3 rounded-lg">
            <Landmark className="w-6 h-6" />
          </div>
        </div>
      </Card>

      {/* Stat Cards Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statCards.map((card, index) => (
          <Card key={index} className="p-3.5 md:p-6 hover:shadow-md transition-shadow" data-testid={card.testId}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 md:mb-2">{card.title}</p>
                <p className="text-[15px] sm:text-base md:text-lg xl:text-xl 2xl:text-2xl font-bold tabular-nums break-normal leading-tight">{card.value}</p>
              </div>
              <div className={`${card.color} text-white p-2 md:p-3 rounded-lg shrink-0 hidden 2xl:block`}>
                <card.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Finance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {financeCards.map((card, index) => (
          <Card key={index} className="p-3.5 md:p-6 hover:shadow-md transition-shadow" data-testid={card.testId}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 md:mb-2">{card.title}</p>
                <p className="text-[15px] sm:text-base md:text-lg xl:text-xl 2xl:text-2xl font-bold tabular-nums break-normal leading-tight">{card.value}</p>
                {card.sub && <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>}
              </div>
              <div className={`${card.color} text-white p-2 md:p-3 rounded-lg shrink-0 hidden 2xl:block`}>
                <card.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Row: Sales + Warehouse Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="p-6 md:p-8 lg:col-span-2" data-testid="sales-chart-card">
          <div className="mb-6">
            <h2 className="text-lg md:text-xl font-semibold tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Penjualan 7 Hari Terakhir
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.last_7_days || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(value) => `Rp ${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => fmt(value)} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Bar dataKey="sales" fill="#10403B" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6" data-testid="warehouse-pie-chart">
          <div className="mb-4">
            <h2 className="text-lg md:text-xl font-semibold tracking-tight flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-emerald-600" />
              Nilai Barang per Gudang
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Total: {fmt(stats?.inventory_value || 0)}</p>
          </div>
          {warehouseChart.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={warehouseChart} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {warehouseChart.map((entry, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(value)} contentStyle={{ borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {warehouseChart.map((w, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{w.name}</span>
                    </div>
                    <span className="font-medium">{fmt(w.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Tidak ada data gudang</div>
          )}
        </Card>
      </div>

      {/* Due Date Notifications + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card className="p-6" data-testid="due-notifications-card">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold">Jatuh Tempo Bulan Ini</h2>
            {dueThisMonth.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{dueThisMonth.length}</span>
            )}
          </div>
          {dueThisMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada hutang jatuh tempo bulan ini</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {dueThisMonth.map((p, i) => (
                <div key={p.id || i} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200" data-testid={`due-item-${i}`}>
                  <div>
                    <p className="font-medium text-sm">{p.supplier_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Invoice: {p.purchase_number || '-'} | Jatuh tempo: {new Date(p.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <p className="font-bold text-red-600 text-sm">{fmt(p.remaining)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6" data-testid="due-calendar-card">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Kalender Jatuh Tempo</h2>
          </div>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={calMonth}
              onMonthChange={setCalMonth}
              modifiers={{ due: dueDates }}
              modifiersStyles={{ due: { backgroundColor: '#fef3c7', borderRadius: '50%', fontWeight: 'bold', color: '#b45309' } }}
              className="rounded-md border"
            />
          </div>
          {selectedDate && selectedDayItems.length > 0 && (
            <div className="mt-4 space-y-2" data-testid="calendar-day-detail">
              <p className="text-sm font-semibold">
                {selectedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}:
              </p>
              {selectedDayItems.map((p, i) => (
                <div key={i} className="flex justify-between p-2 bg-muted rounded text-sm">
                  <div>
                    <span className="font-medium">{p.supplier_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({p.purchase_number || 'Invoice'})</span>
                  </div>
                  <span className="font-bold text-red-600">{fmt(p.remaining)}</span>
                </div>
              ))}
            </div>
          )}
          {selectedDate && selectedDayItems.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground text-center">Tidak ada jatuh tempo pada tanggal ini</p>
          )}
        </Card>
      </div>

      {/* Low Stock Alert - Enhanced */}
      {stats?.low_stock_count > 0 && (
        <Card className="p-6 bg-orange-50 border-orange-200" data-testid="low-stock-alert">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-1" />
            <div>
              <h3 className="font-semibold text-orange-900">Peringatan Stok Menipis</h3>
              <p className="text-sm text-orange-700 mt-1">Ada {stats.low_stock_count} produk dengan stok menipis. Segera lakukan restock.</p>
            </div>
          </div>
          {stats.low_stock_products?.length > 0 && (
            <div className="space-y-2">
              {stats.low_stock_products.map((p, i) => (
                <div key={p.id || i} className="flex items-center justify-between p-3 rounded-lg bg-white border border-orange-200" data-testid={`low-stock-item-${i}`}>
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Min: {p.min_stock_alert} satuan</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${p.stock <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {p.stock} satuan
                    </p>
                    {p.items_per_box > 1 && (
                      <p className="text-xs text-muted-foreground">
                        ({Math.floor(p.stock / p.items_per_box)} dus + {p.stock % p.items_per_box} pcs)
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
