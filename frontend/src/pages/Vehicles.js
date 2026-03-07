import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Truck, MapPin, Search } from 'lucide-react';
import { Pagination } from '../components/Pagination';

export const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 15;
  const [formData, setFormData] = useState({
    name: '', plate_number: '', area_route: '', driver_name: '', canvasser_id: ''
  });

  useEffect(() => { fetchVehicles(); }, []);

  const fetchVehicles = async () => {
    try {
      const res = await api.get('/vehicles');
      setVehicles(res.data);
    } catch { toast.error('Gagal memuat armada'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await api.put(`/vehicles/${editingVehicle.id}`, formData);
        toast.success('Armada berhasil diperbarui');
      } else {
        await api.post('/vehicles', formData);
        toast.success('Armada berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchVehicles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan armada');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus armada ini? Kios mitra yang terkait akan di-unassign.')) return;
    try {
      await api.delete(`/vehicles/${id}`);
      toast.success('Armada berhasil dihapus');
      fetchVehicles();
    } catch { toast.error('Gagal menghapus armada'); }
  };

  const handleEdit = (v) => {
    setEditingVehicle(v);
    setFormData({ name: v.name, plate_number: v.plate_number, area_route: v.area_route || '', driver_name: v.driver_name || '', canvasser_id: v.canvasser_id || '' });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingVehicle(null);
    setFormData({ name: '', plate_number: '', area_route: '', driver_name: '', canvasser_id: '' });
  };

  const filtered = vehicles.filter(v =>
    !searchTerm || v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.area_route?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => { setPage(1); }, [searchTerm]);
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="vehicles-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Armada Mobil Box</h1>
          <p className="text-sm text-muted-foreground mt-2">Kelola armada pengiriman kanvas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="add-vehicle-button">
              <Plus className="w-4 h-4 mr-2" />Tambah Armada
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingVehicle ? 'Edit Armada' : 'Tambah Armada Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Armada *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required placeholder="Mobil Box 1" data-testid="vehicle-name-input" />
                </div>
                <div className="space-y-2">
                  <Label>Plat Nomor *</Label>
                  <Input value={formData.plate_number} onChange={(e) => setFormData({...formData, plate_number: e.target.value})} required placeholder="B 1234 ABC" data-testid="vehicle-plate-input" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Area / Rute</Label>
                <Input value={formData.area_route} onChange={(e) => setFormData({...formData, area_route: e.target.value})} placeholder="Rute Selatan, Kab. Bogor" data-testid="vehicle-route-input" />
              </div>
              <div className="space-y-2">
                <Label>Nama Driver</Label>
                <Input value={formData.driver_name} onChange={(e) => setFormData({...formData, driver_name: e.target.value})} placeholder="Nama supir" data-testid="vehicle-driver-input" />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                <Button type="submit" data-testid="vehicle-submit-button">{editingVehicle ? 'Perbarui' : 'Simpan'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari armada, plat nomor, rute..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" data-testid="search-vehicle-input" />
        </div>
      </Card>

      <Card className="p-6">
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Armada</TableHead>
                <TableHead>Plat Nomor</TableHead>
                <TableHead>Area / Rute</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Belum ada armada</p>
                  </TableCell>
                </TableRow>
              ) : paginated.map((v) => (
                <TableRow key={v.id} data-testid={`vehicle-row-${v.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      {v.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{v.plate_number}</TableCell>
                  <TableCell>
                    {v.area_route ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="w-3 h-3 text-muted-foreground" />{v.area_route}
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-sm">{v.driver_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(v)} data-testid={`edit-vehicle-${v.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(v.id)} data-testid={`delete-vehicle-${v.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
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
