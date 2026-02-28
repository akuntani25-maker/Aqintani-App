import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, CreditCard, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#6366f1'];

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export const Analytics = () => {
  const [summary, setSummary] = useState(null);
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, productsRes] = await Promise.all([
          api.get('/analytics/summary'),
          api.get('/analytics/products')
        ]);
        setSummary(summaryRes.data);
        setProductData(productsRes.data);
      } catch (error) {
        toast.error('Gagal memuat analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border text-sm">
          <p className="font-semibold mb-1">{label}</p>
          {payload.map((entry, i) => (
            <p key={i} style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'transactions' ? entry.value : fmt(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="analytics-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-2">Ringkasan performa bisnis bulan ini</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6" data-testid="monthly-sales-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Penjualan Bulan Ini</p>
              <p className="text-2xl font-bold">{fmt(summary.monthly_sales)}</p>
              <p className="text-xs text-muted-foreground">{summary.monthly_transactions} transaksi</p>
            </div>
          </div>
        </Card>

        <Card className="p-6" data-testid="monthly-purchases-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Pembelian Bulan Ini</p>
              <p className="text-2xl font-bold">{fmt(summary.monthly_purchases)}</p>
              <p className="text-xs text-orange-600">Belum bayar: {fmt(summary.monthly_purchases_unpaid)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6" data-testid="partner-sales-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Penjualan Mitra</p>
              <p className="text-2xl font-bold">{fmt(summary.total_partner_sales)}</p>
              <p className="text-xs text-orange-600">Piutang: {fmt(summary.total_partner_unpaid)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6" data-testid="margin-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. Margin</p>
              <p className="text-2xl font-bold text-green-600">{fmt(summary.estimated_margin)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sales Chart */}
      <Card className="p-6" data-testid="sales-chart">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Penjualan 30 Hari Terakhir</h2>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={summary.chart_data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="sales" name="Penjualan" fill="#0d9488" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fast Moving */}
        <Card className="p-6" data-testid="fast-moving-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold">Produk Terlaris (30 Hari)</h2>
          </div>
          {productData?.fast_moving?.length > 0 ? (
            <div className="space-y-3">
              {productData.fast_moving.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} terjual</p>
                    </div>
                  </div>
                  <p className="font-semibold text-sm text-green-600">{fmt(p.revenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">Belum ada data penjualan</p>
          )}
        </Card>

        {/* Slow Moving */}
        <Card className="p-6" data-testid="slow-moving-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-bold">Produk Kurang Laku (30 Hari)</h2>
          </div>
          {productData?.slow_moving?.length > 0 ? (
            <div className="space-y-3">
              {productData.slow_moving.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} terjual</p>
                    </div>
                  </div>
                  <p className="font-semibold text-sm text-orange-600">{fmt(p.revenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">Belum ada data penjualan</p>
          )}
        </Card>
      </div>

      {/* Category Breakdown */}
      {summary.category_breakdown?.length > 0 && (
        <Card className="p-6" data-testid="category-breakdown-card">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Distribusi Kategori Produk</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={summary.category_breakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="count"
                  nameKey="name"
                  label={({ name, count }) => `${name} (${count})`}
                  labelLine={false}
                >
                  {summary.category_breakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v} produk`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {summary.category_breakdown.map((cat, i) => (
                <div key={cat.name} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{cat.count} produk</p>
                    <p className="text-xs text-muted-foreground">Nilai stok: {fmt(cat.stock_value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
