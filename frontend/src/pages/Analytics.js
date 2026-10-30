import React, { useState, useEffect } from 'react';
import { PageSkeleton } from '../components/PageSkeleton';
import { api } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { TrendingUp, Package, DollarSign, ShoppingCart, Star, CloudSun, Loader2, RefreshCw, Leaf, Droplets, Wind, Thermometer, Bug, FlaskConical, AlertTriangle, Sprout, CloudRain, Newspaper, TrendingDown, ArrowUpRight, ExternalLink, BarChart3 } from '../components/icons';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const fmtNum = (v) => new Intl.NumberFormat('id-ID').format(v);
const COLORS = ['#10403B', '#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#10b981'];

const PRIORITY_COLORS = { tinggi: 'bg-red-100 text-red-700 border-red-200', sedang: 'bg-amber-100 text-amber-700 border-amber-200', rendah: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
const KATEGORI_ICONS = { pupuk: FlaskConical, pestisida: Bug, fungisida: Bug, herbisida: Leaf };

const WeatherIcon = ({ code, className = "w-8 h-8" }) => {
  if (code <= 1) return <CloudSun className={`${className} text-amber-500`} />;
  if (code <= 3) return <CloudSun className={`${className} text-gray-500`} />;
  if (code <= 48) return <CloudSun className={`${className} text-gray-400`} />;
  if (code <= 55) return <CloudRain className={`${className} text-blue-400`} />;
  if (code <= 65) return <CloudRain className={`${className} text-blue-600`} />;
  return <CloudRain className={`${className} text-blue-800`} />;
};

export const Analytics = () => {
  const [tab, setTab] = useState('overview');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agriData, setAgriData] = useState(null);
  const [agriLoading, setAgriLoading] = useState(false);

  useEffect(() => { fetchAnalytics(); }, []);

  // Auto-fetch agriculture data when tab switches to 'agri'
  useEffect(() => {
    if (tab === 'agri' && !agriData && !agriLoading) {
      fetchAgriInfo();
    }
  }, [tab]);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/analytics/summary');
      setAnalyticsData(response.data);
    } catch (error) {
      toast.error('Gagal memuat data analytics');
    } finally { setLoading(false); }
  };

  const fetchAgriInfo = async () => {
    setAgriLoading(true);
    try {
      const response = await api.post('/agriculture/lombok-info');
      setAgriData(response.data);
      if (response.data.status === 'fallback') {
        toast.warning('AI tidak tersedia, hanya menampilkan data cuaca');
      } else {
        toast.success('Info pertanian Lombok berhasil dimuat');
      }
    } catch (error) {
      toast.error('Gagal memuat info pertanian');
    } finally { setAgriLoading(false); }
  };

  if (loading) {
    return (
      <PageSkeleton variant="dashboard" />
    );
  }

  const data = analyticsData || {};
  const categoryData = data.category_breakdown || [];
  const topProducts = data.top_products || [];
  const dailyTrend = data.daily_trend || [];

  const weather = agriData?.weather || [];
  const ai = agriData?.ai || {};
  const newsArticles = agriData?.news || [];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="analytics-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-2">Wawasan penjualan & informasi pertanian Lombok</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'overview' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setTab('overview')} data-testid="tab-overview">
          <TrendingUp className="w-4 h-4 inline mr-1.5" />Ringkasan
        </button>
        <button className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'agri' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setTab('agri')} data-testid="tab-agri">
          <Sprout className="w-4 h-4 inline mr-1.5" />Info Pertanian Lombok
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

      {/* AGRICULTURE TAB */}
      {tab === 'agri' && (
        <div className="space-y-6" data-testid="agri-tab">
          {/* Header */}
          <Card className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200" data-testid="agri-header">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sprout className="w-6 h-6 text-emerald-600" />
                  Info Pertanian Lombok
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Cuaca real-time, rekomendasi tanaman, dan kebutuhan pupuk/obat untuk petani Lombok
                </p>
                {agriData?.bulan && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">Periode: {agriData.bulan}</p>
                )}
              </div>
              <Button onClick={fetchAgriInfo} disabled={agriLoading} variant="outline" data-testid="refresh-agri-btn">
                {agriLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {agriLoading ? 'Memuat...' : 'Refresh'}
              </Button>
            </div>
          </Card>

          {agriLoading && (
            <Card className="p-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto text-emerald-500 animate-spin mb-4" />
              <p className="text-lg font-medium">Mengambil data cuaca & menganalisis rekomendasi pertanian...</p>
              <p className="text-sm text-muted-foreground mt-1">Ini mungkin memakan waktu beberapa detik</p>
            </Card>
          )}

          {agriData && !agriLoading && (
            <>
              {/* Weather Cards */}
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <CloudSun className="w-5 h-5 text-amber-500" />Cuaca Saat Ini
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {weather.map((w, i) => (
                    <Card key={i} className="p-4 hover:shadow-md transition-shadow" data-testid={`weather-card-${i}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm">{w.region}</p>
                          <p className="text-xs text-muted-foreground">{w.city}</p>
                        </div>
                        <WeatherIcon code={w.weather_code} />
                      </div>
                      <p className="text-xs font-medium text-blue-600 mb-2">{w.weather_desc}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Thermometer className="w-3.5 h-3.5 text-red-500" />
                          <span>{w.temperature !== null ? `${w.temperature}°C` : '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-blue-500" />
                          <span>{w.humidity !== null ? `${w.humidity}%` : '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CloudRain className="w-3.5 h-3.5 text-blue-600" />
                          <span>{w.rain}mm</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Wind className="w-3.5 h-3.5 text-gray-500" />
                          <span>{w.wind_speed !== null ? `${w.wind_speed}km/h` : '-'}</span>
                        </div>
                      </div>
                      {/* 7-day mini forecast */}
                      {w.forecast_7d?.dates?.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Prediksi 7 Hari</p>
                          <div className="flex gap-1">
                            {w.forecast_7d.dates.map((d, di) => {
                              const rainSum = w.forecast_7d.rain_sum?.[di] || 0;
                              const maxT = w.forecast_7d.temp_max?.[di];
                              return (
                                <div key={di} className="flex-1 text-center" title={`${d}: ${maxT}°C, Hujan ${rainSum}mm`}>
                                  <p className="text-[9px] text-muted-foreground">{d.slice(5)}</p>
                                  <div className={`h-1.5 rounded-full mt-0.5 ${rainSum > 10 ? 'bg-blue-600' : rainSum > 2 ? 'bg-blue-300' : 'bg-amber-300'}`} />
                                  <p className="text-[9px] mt-0.5">{rainSum > 0 ? `${rainSum}mm` : ''}</p>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />Cerah</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-300 inline-block" />Hujan</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />Hujan Lebat</span>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>

              {/* AI Summary */}
              {ai.ringkasan_cuaca && (
                <Card className="p-5 bg-emerald-50/50 border-emerald-200" data-testid="agri-summary">
                  <div className="flex items-start gap-3">
                    <Sprout className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm leading-relaxed">{ai.ringkasan_cuaca}</p>
                      {ai.musim && (
                        <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${
                          ai.musim === 'hujan' ? 'bg-blue-100 text-blue-700' :
                          ai.musim === 'kemarau' ? 'bg-amber-100 text-amber-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          Musim {ai.musim.charAt(0).toUpperCase() + ai.musim.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Warnings */}
              {ai.peringatan?.length > 0 && (
                <div className="space-y-2">
                  {ai.peringatan.map((p, i) => (
                    <Card key={i} className="p-4 bg-red-50 border-red-200" data-testid={`warning-${i}`}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-800">{p}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Recommended Crops - now labeled as based on real data */}
              {ai.aktivitas_pertanian_terkini?.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Sprout className="w-5 h-5 text-emerald-600" />Aktivitas Pertanian Terkini di Lombok
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3 -mt-1">Berdasarkan data real dari berita dan laporan terkini</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ai.aktivitas_pertanian_terkini.map((a, i) => (
                      <Card key={i} className="p-4 bg-green-50/50 border-green-200 hover:shadow-md transition-shadow" data-testid={`aktiv-${i}`}>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm">{a.tanaman}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            a.status?.includes('panen') ? 'bg-amber-100 text-amber-700' :
                            a.status?.includes('tanam') ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{a.status}</span>
                        </div>
                        {a.wilayah && <p className="text-xs text-emerald-700 mb-1"><span className="font-medium">Wilayah:</span> {a.wilayah}</p>}
                        <p className="text-xs text-muted-foreground leading-relaxed">{a.detail}</p>
                        {a.sumber_info && (
                          <p className="text-[10px] text-blue-600 mt-2 italic">Sumber: {a.sumber_info}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Market Conditions */}
              {ai.kondisi_pasar?.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />Kondisi Pasar Terkini
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {ai.kondisi_pasar.map((k, i) => (
                      <Card key={i} className="p-4 hover:shadow-md transition-shadow" data-testid={`market-${i}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="font-semibold text-sm">{k.komoditas}</h4>
                          <span className={`text-xs font-bold flex items-center gap-0.5 ${
                            k.tren === 'naik' ? 'text-red-600' :
                            k.tren === 'turun' ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {k.tren === 'naik' ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                             k.tren === 'turun' ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                            {k.tren}
                          </span>
                        </div>
                        {k.harga && <p className="text-sm font-bold text-primary mb-1">{k.harga}</p>}
                        <p className="text-xs text-muted-foreground">{k.keterangan}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* News Sources */}
              {newsArticles.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-gray-600" />Berita Pertanian Lombok ({newsArticles.length} artikel)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {newsArticles.map((n, i) => (
                      <Card key={i} className="p-3 hover:shadow-md transition-shadow group" data-testid={`news-${i}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <a href={n.link} target="_blank" rel="noopener noreferrer"
                              className="text-sm font-medium hover:text-primary transition-colors line-clamp-2 flex items-start gap-1">
                              {n.title}
                              <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                            {n.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              {n.source && (
                                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{n.source}</span>
                              )}
                              {n.date && (
                                <span className="text-[10px] text-muted-foreground">{new Date(n.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Crops */}
              {ai.tanaman_rekomendasi?.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-green-600" />Rekomendasi Tanaman
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ai.tanaman_rekomendasi.map((t, i) => (
                      <Card key={i} className="p-4 hover:shadow-md transition-shadow" data-testid={`crop-${i}`}>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-sm">{t.nama}</h4>
                          {t.jenis && (
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                              {t.jenis}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{t.keterangan}</p>
                        <div className="space-y-1 text-xs">
                          {t.wilayah_ideal && (
                            <p className="text-emerald-700"><span className="font-medium">Wilayah:</span> {t.wilayah_ideal}</p>
                          )}
                          {t.masa_tanam && (
                            <p className="text-blue-700"><span className="font-medium">Masa tanam:</span> {t.masa_tanam}</p>
                          )}
                          {t.tips && (
                            <p className="text-amber-700 italic mt-1">{t.tips}</p>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Fertilizer & Pesticide Needs */}
              {ai.kebutuhan_pupuk_obat?.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-indigo-600" />Kebutuhan Pupuk & Obat Pertanian
                  </h3>
                  <div className="space-y-3">
                    {ai.kebutuhan_pupuk_obat.map((p, i) => {
                      const Icon = KATEGORI_ICONS[p.kategori] || FlaskConical;
                      return (
                        <Card key={i} className={`p-4 border ${PRIORITY_COLORS[p.prioritas] || 'bg-gray-50'}`} data-testid={`fertilizer-${i}`}>
                          <div className="flex items-start gap-3">
                            <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold text-sm">{p.nama}</h4>
                                <div className="flex items-center gap-2">
                                  {p.kategori && (
                                    <span className="text-[10px] px-2 py-0.5 bg-white/60 rounded-full font-medium capitalize">{p.kategori}</span>
                                  )}
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[p.prioritas]}`}>
                                    {p.prioritas?.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs leading-relaxed">{p.kegunaan}</p>
                              {p.dosis && <p className="text-xs mt-1 font-medium">Dosis: {p.dosis}</p>}
                              {p.alasan_prioritas && <p className="text-xs mt-1 italic opacity-80">{p.alasan_prioritas}</p>}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pest & Disease Alerts */}
              {ai.hama_penyakit_waspada?.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Bug className="w-5 h-5 text-red-600" />Waspada Hama & Penyakit
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ai.hama_penyakit_waspada.map((h, i) => (
                      <Card key={i} className="p-4 bg-orange-50/50 border-orange-200 hover:shadow-md transition-shadow" data-testid={`pest-${i}`}>
                        <h4 className="font-semibold text-sm text-orange-900 flex items-center gap-1.5 mb-2">
                          <Bug className="w-4 h-4" />{h.nama}
                        </h4>
                        {h.tanaman_target && (
                          <p className="text-xs mb-1"><span className="font-medium text-orange-800">Target:</span> {h.tanaman_target}</p>
                        )}
                        {h.tanda && (
                          <p className="text-xs mb-1"><span className="font-medium text-orange-800">Tanda:</span> {h.tanda}</p>
                        )}
                        {h.pencegahan && (
                          <p className="text-xs text-emerald-700"><span className="font-medium">Pencegahan:</span> {h.pencegahan}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Seasonal Tips */}
              {ai.tips_musiman?.length > 0 && (
                <Card className="p-5" data-testid="seasonal-tips">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Sprout className="w-5 h-5 text-emerald-600" />Tips Musiman
                  </h3>
                  <ul className="space-y-2">
                    {ai.tips_musiman.map((tip, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5 font-bold">{i + 1}.</span>
                        <span>{tip}</span>
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
