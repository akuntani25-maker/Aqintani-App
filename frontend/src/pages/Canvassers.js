import React, { useState, useEffect } from 'react';
import { PageSkeleton } from '../components/PageSkeleton';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Truck, User, Key, MapPin, Search, Car } from '../components/icons';
import { Pagination } from '../components/Pagination';

export const Canvassers = () => {
  const [tab, setTab] = useState('canvassers');
  const [canvassers, setCanvassers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCanvasser, setEditingCanvasser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicle_number: '',
    vehicle_type: 'Mobil Box'
  });
  const [createLoginDialogOpen, setCreateLoginDialogOpen] = useState(false);
  const [selectedCanvasser, setSelectedCanvasser] = useState(null);
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Vehicle state
  const [vDialogOpen, setVDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vSearch, setVSearch] = useState('');
  const [vPage, setVPage] = useState(1);
  const vPerPage = 10;
  const [vForm, setVForm] = useState({ name: '', plate_number: '', area_route: '', driver_name: '' });

  useEffect(() => {
    fetchCanvassers();
    fetchVehicles();
  }, []);

  const fetchCanvassers = async () => {
    try {
      const response = await api.get('/canvassers');
      setCanvassers(response.data);
    } catch (error) {
      toast.error('Gagal memuat kanvaser');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await api.get('/vehicles');
      setVehicles(res.data);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCanvasser) {
        await api.put(`/canvassers/${editingCanvasser.id}`, formData);
        toast.success('Kanvaser berhasil diperbarui');
      } else {
        await api.post('/canvassers', formData);
        toast.success('Kanvaser berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchCanvassers();
    } catch (error) {
      toast.error('Gagal menyimpan kanvaser');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus kanvaser ini?')) return;
    try {
      await api.delete(`/canvassers/${id}`);
      toast.success('Kanvaser berhasil dihapus');
      fetchCanvassers();
    } catch (error) {
      toast.error('Gagal menghapus kanvaser');
    }
  };

  const handleEdit = (canvasser) => {
    setEditingCanvasser(canvasser);
    setFormData({
      name: canvasser.name,
      phone: canvasser.phone,
      vehicle_number: canvasser.vehicle_number,
      vehicle_type: canvasser.vehicle_type
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCanvasser(null);
    setFormData({
      name: '',
      phone: '',
      vehicle_number: '',
      vehicle_type: 'Mobil Box'
    });
  };

  const handleCreateLogin = (canvasser) => {
    setSelectedCanvasser(canvasser);
    setLoginData({
      email: `${canvasser.name.toLowerCase().replace(/\s/g, '')}@aqintani.com`,
      password: ''
    });
    setCreateLoginDialogOpen(true);
  };

  const submitCreateLogin = async () => {
    if (!loginData.email || !loginData.password) {
      toast.error('Email dan password harus diisi');
      return;
    }

    try {
      await api.post('/auth/register', {
        email: loginData.email,
        password: loginData.password,
        name: selectedCanvasser.name,
        role: 'canvasser',
        canvasser_id: selectedCanvasser.id
      });
      toast.success('Akun kanvaser berhasil dibuat');
      setCreateLoginDialogOpen(false);
      setLoginData({ email: '', password: '' });
      setSelectedCanvasser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal membuat akun');
    }
  };

  // Vehicle handlers
  const handleVSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await api.put(`/vehicles/${editingVehicle.id}`, vForm);
        toast.success('Armada berhasil diperbarui');
      } else {
        await api.post('/vehicles', vForm);
        toast.success('Armada berhasil ditambahkan');
      }
      setVDialogOpen(false);
      resetVForm();
      fetchVehicles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan armada');
    }
  };
  const handleVEdit = (v) => { setEditingVehicle(v); setVForm({ name: v.name, plate_number: v.plate_number, area_route: v.area_route || '', driver_name: v.driver_name || '' }); setVDialogOpen(true); };
  const handleVDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus armada ini?')) return;
    try { await api.delete(`/vehicles/${id}`); toast.success('Armada berhasil dihapus'); fetchVehicles(); } catch { toast.error('Gagal menghapus armada'); }
  };
  const resetVForm = () => { setEditingVehicle(null); setVForm({ name: '', plate_number: '', area_route: '', driver_name: '' }); };
  const filteredVehicles = vehicles.filter(v => !vSearch || v.name.toLowerCase().includes(vSearch.toLowerCase()) || v.plate_number?.toLowerCase().includes(vSearch.toLowerCase()) || v.area_route?.toLowerCase().includes(vSearch.toLowerCase()));
  useEffect(() => { setVPage(1); }, [vSearch]);
  const vTotalPages = Math.ceil(filteredVehicles.length / vPerPage);
  const paginatedVehicles = filteredVehicles.slice((vPage - 1) * vPerPage, vPage * vPerPage);


  if (loading) {
    return (
      <PageSkeleton variant="table" />
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="canvassers-page">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Kanvaser & Armada</h1>
        <p className="text-sm text-muted-foreground mt-2">Kelola data sales dan armada pengiriman</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'canvassers' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setTab('canvassers')} data-testid="tab-canvassers">
          <User className="w-4 h-4 inline mr-1.5" />Kanvaser ({canvassers.length})
        </button>
        <button className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'vehicles' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setTab('vehicles')} data-testid="tab-vehicles">
          <Car className="w-4 h-4 inline mr-1.5" />Armada ({vehicles.length})
        </button>
      </div>

      {tab === 'canvassers' && (<>
      <div className="flex justify-end">
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-canvasser-button">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Kanvaser
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCanvasser ? 'Edit Kanvaser' : 'Tambah Kanvaser Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Kanvaser *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="canvasser-name-input"
                  placeholder="Ahmad Rifai"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telepon *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  data-testid="canvasser-phone-input"
                  placeholder="0812-3456-7890"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Jenis Kendaraan *</Label>
                <Input
                  id="vehicle_type"
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  required
                  data-testid="vehicle-type-input"
                  placeholder="Mobil Box / Pick Up / Motor"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_number">Nomor Kendaraan *</Label>
                <Input
                  id="vehicle_number"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  required
                  data-testid="vehicle-number-input"
                  placeholder="B 1234 XYZ"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" data-testid="submit-canvasser-button">
                  {editingCanvasser ? 'Perbarui' : 'Simpan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Kanvaser</p>
              <p className="text-base md:text-xl lg:text-2xl font-bold truncate">{canvassers.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Aktif</p>
              <p className="text-base md:text-xl lg:text-2xl font-bold truncate">
                {canvassers.filter(c => c.is_active).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Mobil Box</p>
              <p className="text-base md:text-xl lg:text-2xl font-bold truncate">
                {canvassers.filter(c => c.vehicle_type.toLowerCase().includes('box')).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-6">
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Jenis Kendaraan</TableHead>
                <TableHead>Nomor Kendaraan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {canvassers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Belum ada kanvaser</p>
                  </TableCell>
                </TableRow>
              ) : (
                canvassers.map((canvasser) => (
                  <TableRow key={canvasser.id}>
                    <TableCell className="font-medium">{canvasser.name}</TableCell>
                    <TableCell>{canvasser.phone}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        {canvasser.vehicle_type}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{canvasser.vehicle_number}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        canvasser.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {canvasser.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateLogin(canvasser)}
                          data-testid={`create-login-${canvasser.id}`}
                          title="Buat Akun Login"
                          className="border-primary/30 hover:bg-primary/10"
                        >
                          <Key className="w-4 h-4 text-primary" />
                          <span className="ml-1 text-xs text-primary">Login</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(canvasser)}
                          data-testid={`edit-canvasser-${canvasser.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(canvasser.id)}
                          data-testid={`delete-canvasser-${canvasser.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Truck className="w-5 h-5 text-blue-600 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Info Kanvaser</h3>
            <p className="text-sm text-blue-800">
              Klik icon <Key className="w-3 h-3 inline" /> untuk membuat akun login kanvaser.
              Kelola armada di tab <b>Armada</b>.
            </p>
          </div>
        </div>
      </Card>
      </>)}

      {/* ARMADA TAB */}
      {tab === 'vehicles' && (<>
        <div className="flex justify-end">
          <Dialog open={vDialogOpen} onOpenChange={(open) => { setVDialogOpen(open); if (!open) resetVForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-vehicle-button"><Plus className="w-4 h-4 mr-2" />Tambah Armada</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingVehicle ? 'Edit Armada' : 'Tambah Armada Baru'}</DialogTitle></DialogHeader>
              <form onSubmit={handleVSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Nama Armada *</Label><Input value={vForm.name} onChange={(e) => setVForm({...vForm, name: e.target.value})} required placeholder="Mobil Box 1" data-testid="vehicle-name-input" /></div>
                  <div className="space-y-2"><Label>Plat Nomor *</Label><Input value={vForm.plate_number} onChange={(e) => setVForm({...vForm, plate_number: e.target.value})} required placeholder="B 1234 ABC" data-testid="vehicle-plate-input" /></div>
                </div>
                <div className="space-y-2"><Label>Area / Rute</Label><Input value={vForm.area_route} onChange={(e) => setVForm({...vForm, area_route: e.target.value})} placeholder="Rute Selatan, Kab. Bogor" data-testid="vehicle-route-input" /></div>
                <div className="space-y-2"><Label>Nama Driver</Label><Input value={vForm.driver_name} onChange={(e) => setVForm({...vForm, driver_name: e.target.value})} placeholder="Nama supir" data-testid="vehicle-driver-input" /></div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setVDialogOpen(false)}>Batal</Button>
                  <Button type="submit" data-testid="vehicle-submit-button">{editingVehicle ? 'Perbarui' : 'Simpan'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cari armada, plat nomor, rute..." value={vSearch} onChange={(e) => setVSearch(e.target.value)} className="pl-10" data-testid="search-vehicle-input" />
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
                {paginatedVehicles.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><Truck className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Belum ada armada</p></TableCell></TableRow>
                ) : paginatedVehicles.map(v => (
                  <TableRow key={v.id} data-testid={`vehicle-row-${v.id}`}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><Truck className="w-4 h-4 text-primary" />{v.name}</div></TableCell>
                    <TableCell className="font-mono text-sm">{v.plate_number}</TableCell>
                    <TableCell>{v.area_route ? <div className="flex items-center gap-1 text-sm"><MapPin className="w-3 h-3 text-muted-foreground" />{v.area_route}</div> : '-'}</TableCell>
                    <TableCell className="text-sm">{v.driver_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleVEdit(v)} data-testid={`edit-vehicle-${v.id}`}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleVDelete(v.id)} data-testid={`delete-vehicle-${v.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={vPage} totalPages={vTotalPages} total={filteredVehicles.length} perPage={vPerPage} onChange={setVPage} />
        </Card>
      </>)}

      {/* Create Login Dialog */}
      <Dialog open={createLoginDialogOpen} onOpenChange={setCreateLoginDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Akun Login Kanvaser</DialogTitle>
          </DialogHeader>
          {selectedCanvasser && (
            <div className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">Kanvaser</p>
                <p className="font-semibold">{selectedCanvasser.name}</p>
                <p className="text-sm text-muted-foreground">{selectedCanvasser.phone}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-email">Email Login</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  placeholder="kanvaser@aqintani.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  💡 Kanvaser dapat login di aplikasi untuk melihat pesanan yang diassign, 
                  update status delivery, dan catat pembayaran dari kios mitra.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCreateLoginDialogOpen(false)}>
                  Batal
                </Button>
                <Button onClick={submitCreateLogin}>
                  <Key className="w-4 h-4 mr-2" />
                  Buat Akun
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
