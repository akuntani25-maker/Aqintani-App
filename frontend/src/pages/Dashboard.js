import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingCart, Package, AlertTriangle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const statCards = [
    {
      title: 'Penjualan Hari Ini',
      value: formatCurrency(stats?.today_sales || 0),
      icon: DollarSign,
      color: 'bg-primary',
      testId: 'today-sales-card'
    },
    {
      title: 'Transaksi Hari Ini',
      value: stats?.today_transactions || 0,
      icon: ShoppingCart,
      color: 'bg-secondary',
      testId: 'today-transactions-card'
    },
    {
      title: 'Total Produk',
      value: stats?.total_products || 0,
      icon: Package,
      color: 'bg-blue-500',
      testId: 'total-products-card'
    },
    {
      title: 'Stok Menipis',
      value: stats?.low_stock_count || 0,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      testId: 'low-stock-card'
    }
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Selamat datang di UD. Aqin Tani</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <Card key={index} className="p-6 hover:shadow-md transition-shadow" data-testid={card.testId}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {card.title}
                </p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
              <div className={`${card.color} text-white p-3 rounded-lg`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 md:p-8" data-testid="sales-chart-card">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Penjualan 7 Hari Terakhir
          </h2>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={stats?.last_7_days || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <YAxis 
              tick={{ fill: '#6B7280', fontSize: 12 }}
              tickFormatter={(value) => `Rp ${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              formatter={(value) => formatCurrency(value)}
              contentStyle={{ 
                backgroundColor: '#ffffff', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Bar dataKey="sales" fill="#10403B" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {stats?.low_stock_count > 0 && (
        <Card className="p-6 bg-orange-50 border-orange-200" data-testid="low-stock-alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-1" />
            <div>
              <h3 className="font-semibold text-orange-900">Peringatan Stok</h3>
              <p className="text-sm text-orange-700 mt-1">
                Ada {stats.low_stock_count} produk dengan stok menipis. Segera lakukan restock.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};