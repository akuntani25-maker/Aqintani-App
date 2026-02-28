import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Truck, User, Key } from 'lucide-react';

export const Canvassers = () => {
  const [canvassers, setCanvassers] = useState([]);
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

  useEffect(() => {
    fetchCanvassers();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6" data-testid="canvassers-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Kanvaser & Armada</h1>
          <p className="text-sm text-muted-foreground mt-2">Kelola data sales dan armada pengiriman</p>
        </div>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Kanvaser</p>
              <p className="text-2xl font-bold">{canvassers.length}</p>
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
              <p className="text-2xl font-bold">
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
              <p className="text-2xl font-bold">
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
                          variant="ghost"
                          onClick={() => handleCreateLogin(canvasser)}
                          data-testid={`create-login-${canvasser.id}`}
                          title="Buat Akun Login"
                        >
                          <Key className="w-4 h-4 text-primary" />
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
            <h3 className="font-semibold text-blue-900 mb-1">Info Armada</h3>
            <p className="text-sm text-blue-800">
              Kelola data kanvaser dan armada untuk pengiriman ke kios mitra. 
              Setiap pesanan dapat diassign ke kanvaser tertentu untuk tracking pengiriman.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
