import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { TrendingUp, Package, DollarSign, ShoppingCart, Star, BrainCircuit, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const fmtNum = (v) => new Intl.NumberFormat('id-ID').format(v);
const COLORS = ['#10403B', '#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#10b981'];

const RISK_COLORS = { critical: 'bg-red-100 text-red-700 border-red-200', warning: 'bg-amber-100 text-amber-700 border-amber-200', safe: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
const RISK_ICONS = { critical: AlertTriangle, warning: AlertTriangle, safe: CheckCircle };
const RISK_LABELS = { critical: 'Kritis', warning: 'Perhatian', safe: 'Aman' };

export const Analytics = () => {
  const [tab, setTab] = useState('overview');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/analytics/summary');
      setAnalyticsData(response.data);
    } catch (error) {
      toast.error('Gagal memuat data analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchForecast = async () => {
    setForecastLoading(true);
    try {
      const response = await api.post('/forecast/stock');
      setForecastData(response.data);
      if (response.data.status === 'fallback') {
        toast.warning('AI tidak tersedia, menampilkan prediksi statistik dasar');
      } else {
        toast.success('Prediksi stok berhasil dianalisis AI');
      }
    } catch (error) {
      toast.error('Gagal menganalisis prediksi stok');
    } finally {
      setForecastLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const data = analyticsData || {};
  const categoryData = data.category_breakdown || [];
  const topProducts = data.top_products || [];
  const dailyTrend = data.daily_trend || [];

  const forecast = forecastData?.data || {};
  const forecasts = forecast.forecasts || [];
  const criticalCount = forecasts.filter(f => f.risk_level === 'critical').length;
  const warningCount = forecasts.filter(f => f.risk_level === 'warning').length;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="analytics-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-2">Wawasan penjualan dan prediksi stok</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'overview' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setTab('overview')} data-testid="tab-overview">
          <TrendingUp className="w-4 h-4 inline mr-1.5" />Ringkasan
        </button>
        <button className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'forecast' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setTab('forecast')} data-testid="tab-forecast">
          <BrainCircuit className="w-4 h-4 inline mr-1.5" />Prediksi Stok AI
        </button>
      </div>

      {tab === 'overview' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6" data-testid="total-revenue-card">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Total Revenue (30h)</p>
                  <p className="text-lg md:text-2xl font-bold truncate">{fmt(data.total_revenue || 0)}</p>
                </div>
                <div className="bg-primary text-white p-2 rounded-lg shrink-0"><DollarSign className="w-5 h-5" /></div>
              </div>
            </Card>
            <Card className="p-6" data-testid="total-orders-card">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Total Transaksi (30h)</p>
                  <p className="text-lg md:text-2xl font-bold">{fmtNum(data.total_orders || 0)}</p>
                </div>
                <div className="bg-secondary text-white p-2 rounded-lg shrink-0"><ShoppingCart className="w-5 h-5" /></div>
              </div>
            </Card>
            <Card className="p-6" data-testid="total-products-sold-card">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Barang Terjual (30h)</p>
                  <p className="text-lg md:text-2xl font-bold">{fmtNum(data.total_products_sold || 0)}</p>
                </div>
                <div className="bg-blue-500 text-white p-2 rounded-lg shrink-0"><Package className="w-5 h-5" /></div>
              </div>
            </Card>
            <Card className="p-6" data-testid="avg-order-card">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Rata-rata / Transaksi</p>
                  <p className="text-lg md:text-2xl font-bold truncate">{fmt(data.avg_order_value || 0)}</p>
                </div>
                <div className="bg-amber-500 text-white p-2 rounded-lg shrink-0"><Star className="w-5 h-5" /></div>
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6" data-testid="daily-trend-chart">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />Tren Penjualan Harian
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Line type="monotone" dataKey="revenue" stroke="#10403B" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6" data-testid="category-chart">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />Penjualan per Kategori
              </h2>
              {categoryData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {categoryData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1">
                    {categoryData.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span>{c.name}</span>
                        </div>
                        <span className="font-medium">{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Tidak ada data</div>
              )}
            </Card>
          </div>

          {/* Top Products */}
          {topProducts.length > 0 && (
            <Card className="p-6" data-testid="top-products-card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />10 Barang Terlaris
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tickFormatter={(v) => fmtNum(v)} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtNum(v)} />
                  <Bar dataKey="quantity" fill="#10403B" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      {/* FORECAST TAB */}
      {tab === 'forecast' && (
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200" data-testid="forecast-header">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BrainCircuit className="w-6 h-6 text-indigo-600" />
                  Prediksi Stok AI (GPT-5.2)
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Analisis pola penjualan 30 hari terakhir untuk prediksi kebutuhan restock
                </p>
                {forecastData?.period && (
                  <p className="text-xs text-indigo-600 mt-1">Periode data: {forecastData.period}</p>
                )}
              </div>
              <Button onClick={fetchForecast} disabled={forecastLoading} data-testid="run-forecast-btn">
                {forecastLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {forecastLoading ? 'Menganalisis...' : (forecastData ? 'Analisis Ulang' : 'Jalankan Analisis')}
              </Button>
            </div>
          </Card>

          {!forecastData && !forecastLoading && (
            <Card className="p-12 text-center">
              <BrainCircuit className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Klik "Jalankan Analisis" untuk memulai prediksi stok AI</p>
              <p className="text-sm text-muted-foreground mt-1">AI akan menganalisis data penjualan dan memberikan rekomendasi restock</p>
            </Card>
          )}

          {forecastLoading && (
            <Card className="p-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-indigo-500 animate-spin mb-4" />
              <p className="text-lg font-medium">AI sedang menganalisis data penjualan...</p>
              <p className="text-sm text-muted-foreground mt-1">Ini mungkin memakan waktu beberapa detik</p>
            </Card>
          )}

          {forecastData && !forecastLoading && (
            <>
              {/* Summary */}
              <Card className="p-6" data-testid="forecast-summary">
                <p className="text-sm leading-relaxed">{forecast.summary}</p>
              </Card>

              {/* Risk Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-red-50 border-red-200" data-testid="critical-count">
                  <p className="text-xs font-bold uppercase text-red-700">Kritis</p>
                  <p className="text-2xl font-bold text-red-800">{criticalCount}</p>
                </Card>
                <Card className="p-4 bg-amber-50 border-amber-200" data-testid="warning-count">
                  <p className="text-xs font-bold uppercase text-amber-700">Perhatian</p>
                  <p className="text-2xl font-bold text-amber-800">{warningCount}</p>
                </Card>
                <Card className="p-4 bg-emerald-50 border-emerald-200" data-testid="safe-count">
                  <p className="text-xs font-bold uppercase text-emerald-700">Aman</p>
                  <p className="text-2xl font-bold text-emerald-800">{forecasts.length - criticalCount - warningCount}</p>
                </Card>
              </div>

              {/* Forecast Items */}
              <div className="space-y-3">
                {forecasts.map((f, i) => {
                  const RiskIcon = RISK_ICONS[f.risk_level] || CheckCircle;
                  return (
                    <Card key={i} className={`p-4 border ${RISK_COLORS[f.risk_level] || 'bg-gray-50'}`} data-testid={`forecast-item-${i}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <RiskIcon className="w-5 h-5 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold">{f.product_name}</p>
                            <p className="text-sm mt-1">{f.recommendation}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs">
                              <span>Stok: <b>{fmtNum(f.current_stock)}</b></span>
                              <span>Rata-rata/hari: <b>{f.avg_daily_sales}</b></span>
                              <span>Habis dalam: <b>{f.days_until_empty === 999 ? '~' : f.days_until_empty + ' hari'}</b></span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${RISK_COLORS[f.risk_level]}`}>
                            {RISK_LABELS[f.risk_level]}
                          </span>
                          {f.suggested_restock_qty > 0 && (
                            <div className="mt-2 text-xs text-right">
                              <p>Restock: <b>{fmtNum(f.suggested_restock_qty)} unit</b></p>
                              {f.suggested_restock_boxes > 0 && <p>({fmtNum(f.suggested_restock_boxes)} dus)</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* AI Insights */}
              {forecast.insights && forecast.insights.length > 0 && (
                <Card className="p-6" data-testid="forecast-insights">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-indigo-600" />Insight AI
                  </h3>
                  <ul className="space-y-2">
                    {forecast.insights.map((insight, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-indigo-500 mt-0.5">&#8226;</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
