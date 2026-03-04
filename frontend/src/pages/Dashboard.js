import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle, DollarSign,
  Warehouse, CreditCard, Store, CalendarDays, ChevronLeft, ChevronRight, Bell
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

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
    } catch {}
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const dueDates = calData.map(p => new Date(p.due_date + 'T00:00:00'));
  const selectedDayItems = selectedDate
    ? calData.filter(p => p.due_date === selectedDate.toISOString().slice(0, 10))
    : [];

  const statCards = [
    { title: 'Penjualan Hari Ini', value: fmt(stats?.today_sales || 0), icon: DollarSign, color: 'bg-primary', testId: 'today-sales-card' },
    { title: 'Transaksi Hari Ini', value: stats?.today_transactions || 0, icon: ShoppingCart, color: 'bg-secondary', testId: 'today-transactions-card' },
    { title: 'Total Produk', value: stats?.total_products || 0, icon: Package, color: 'bg-blue-500', testId: 'total-products-card' },
    { title: 'Stok Menipis', value: stats?.low_stock_count || 0, icon: AlertTriangle, color: 'bg-orange-500', testId: 'low-stock-card' },
  ];

  const financeCards = [
    { title: 'Nilai Barang Gudang', value: fmt(stats?.inventory_value || 0), icon: Warehouse, color: 'bg-emerald-600', testId: 'inventory-value-card' },
    { title: 'Bon Supplier Belum Bayar', value: fmt(stats?.total_supplier_debt || 0), icon: CreditCard, color: 'bg-red-500', testId: 'supplier-debt-card' },
    { title: 'Bon Kios Mitra Belum Bayar', value: fmt(stats?.total_partner_debt || 0), icon: Store, color: 'bg-amber-500', testId: 'partner-debt-card' },
  ];

  const dueThisMonth = stats?.due_this_month || [];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Selamat datang di UD. Aqin Tani</p>
      </div>

      {/* Stat Cards Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statCards.map((card, index) => (
          <Card key={index} className="p-4 md:p-6 hover:shadow-md transition-shadow" data-testid={card.testId}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 md:mb-2">{card.title}</p>
                <p className="text-base md:text-xl lg:text-2xl font-bold truncate">{card.value}</p>
              </div>
              <div className={`${card.color} text-white p-2 md:p-3 rounded-lg shrink-0`}>
                <card.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Finance Cards Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {financeCards.map((card, index) => (
          <Card key={index} className="p-4 md:p-6 hover:shadow-md transition-shadow" data-testid={card.testId}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 md:mb-2">{card.title}</p>
                <p className="text-base md:text-xl lg:text-2xl font-bold truncate">{card.value}</p>
              </div>
              <div className={`${card.color} text-white p-2 md:p-3 rounded-lg shrink-0`}>
                <card.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Sales Chart */}
      <Card className="p-6 md:p-8" data-testid="sales-chart-card">
        <div className="mb-6">
          <h2 className="text-lg md:text-2xl font-semibold tracking-tight flex items-center gap-2">
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

      {/* Due Date Notifications + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Notifications */}
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
                    <p className="text-xs text-muted-foreground">Jatuh tempo: {new Date(p.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <p className="font-bold text-red-600 text-sm">{fmt(p.remaining)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Calendar */}
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
                  <span>{p.supplier_name}</span>
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

      {/* Low Stock Alert */}
      {stats?.low_stock_count > 0 && (
        <Card className="p-6 bg-orange-50 border-orange-200" data-testid="low-stock-alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-1" />
            <div>
              <h3 className="font-semibold text-orange-900">Peringatan Stok</h3>
              <p className="text-sm text-orange-700 mt-1">Ada {stats.low_stock_count} produk dengan stok menipis. Segera lakukan restock.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
