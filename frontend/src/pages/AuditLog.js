import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { ClipboardList, User, Clock, Tag } from 'lucide-react';
import { Pagination } from '../components/Pagination';

const ACTION_LABELS = { create: 'Tambah', update: 'Edit', delete: 'Hapus' };
const ACTION_COLORS = { create: 'bg-emerald-100 text-emerald-700', update: 'bg-blue-100 text-blue-700', delete: 'bg-red-100 text-red-700' };
const ENTITY_LABELS = { product: 'Produk', vehicle: 'Armada', partner_store: 'Kios Mitra', partner_order: 'Pesanan Kios', stock_adjustment: 'Koreksi Stok', purchase: 'Pembelian', payment: 'Pembayaran' };

export const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/audit-log?limit=500');
      setLogs(res.data);
    } catch { toast.error('Gagal memuat log aktivitas'); }
    finally { setLoading(false); }
  };

  const filtered = logs.filter(l => filterEntity === 'all' || l.entity_type === filterEntity);

  useEffect(() => { setPage(1); }, [filterEntity]);
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const formatDate = (ts) => {
    try { return new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ts; }
  };

  const formatDetails = (details) => {
    if (!details || typeof details !== 'object') return '-';
    const entries = Object.entries(details).filter(([k]) => k !== '_id');
    if (entries.length === 0) return '-';
    return entries.slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="audit-log-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Log Aktivitas</h1>
        <p className="text-sm text-muted-foreground mt-2">Riwayat semua perubahan penting di sistem</p>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-52" data-testid="filter-entity">
              <SelectValue placeholder="Semua Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} entri</span>
        </div>
      </Card>

      <Card className="p-6">
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Belum ada log aktivitas</p>
                  </TableCell>
                </TableRow>
              ) : paginated.map((log) => (
                <TableRow key={log.id} data-testid={`audit-row-${log.id}`}>
                  <TableCell className="whitespace-nowrap text-sm">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      {formatDate(log.timestamp)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{log.user_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">({log.user_role})</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">{ENTITY_LABELS[log.entity_type] || log.entity_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{formatDetails(log.details)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={filtered.length} perPage={perPage} onChange={setPage} />
      </Card>
    </div>
  );
};
