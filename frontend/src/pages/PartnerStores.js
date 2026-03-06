import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, MapPin, DollarSign, Eye, Search } from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

export const PartnerStores = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 15;
  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    phone: '',
    address: '',
    latitude: null,
    longitude: null,
    credit_limit: 0
  });

  const mapContainerStyle = {
    width: '100%',
    height: '500px'
  };

  const defaultCenter = {
    lat: -6.2088,
    lng: 106.8456
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await api.get('/partner-stores');
      setStores(response.data);
    } catch (error) {
      toast.error('Gagal memuat kios mitra');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStore) {
        await api.put(`/partner-stores/${editingStore.id}`, formData);
        toast.success('Kios mitra berhasil diperbarui');
      } else {
        await api.post('/partner-stores', formData);
        toast.success('Kios mitra berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchStores();
    } catch (error) {
      toast.error('Gagal menyimpan kios mitra');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus kios mitra ini?')) return;
    try {
      await api.delete(`/partner-stores/${id}`);
      toast.success('Kios mitra berhasil dihapus');
      fetchStores();
    } catch (error) {
      toast.error('Gagal menghapus kios mitra');
    }
  };

  const handleEdit = (store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      owner_name: store.owner_name,
      phone: store.phone,
      address: store.address,
      latitude: store.latitude,
      longitude: store.longitude,
      credit_limit: store.credit_limit
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingStore(null);
    setFormData({
      name: '',
      owner_name: '',
      phone: '',
      address: '',
      latitude: null,
      longitude: null,
      credit_limit: 0
    });
  };

  const handleMapClick = useCallback((e) => {
    setFormData(prev => ({
      ...prev,
      latitude: e.latLng.lat(),
      longitude: e.latLng.lng()
    }));
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const viewStoreDetail = (storeId) => {
    navigate(`/admin/partner-stores/${storeId}`);
  };

  const filteredStores = stores.filter(s =>
    !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => { setPage(1); }, [searchTerm]);

  const totalPages = Math.ceil(filteredStores.length / perPage);
  const paginatedStores = filteredStores.slice((page - 1) * perPage, page * perPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" data-testid="partner-stores-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Kios Mitra</h1>
          <p className="text-sm text-muted-foreground mt-2">Kelola data kios mitra dan tracking piutang</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowMap(!showMap)}
            data-testid="toggle-map-button"
          >
            <MapPin className="w-4 h-4 mr-2" />
            {showMap ? 'Sembunyikan' : 'Lihat'} Peta
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-partner-store-button">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Kios Mitra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStore ? 'Edit Kios Mitra' : 'Tambah Kios Mitra Baru'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Kios *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="store-name-input"
                      placeholder="Toko Berkah Jaya"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner_name">Nama Pemilik *</Label>
                    <Input
                      id="owner_name"
                      value={formData.owner_name}
                      onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                      required
                      data-testid="owner-name-input"
                      placeholder="Bapak Ahmad"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telepon *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    data-testid="store-phone-input"
                    placeholder="0812-3456-7890"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Alamat Lengkap *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    data-testid="store-address-input"
                    placeholder="Jl. Raya Desa No. 45, Kecamatan..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="credit_limit">Limit Kredit</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                    data-testid="credit-limit-input"
                    placeholder="5000000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lokasi pada Peta (Optional)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Klik pada peta untuk menandai lokasi kios mitra
                  </p>
                  {GOOGLE_MAPS_API_KEY ? (
                    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '300px' }}
                        center={
                          formData.latitude && formData.longitude
                            ? { lat: formData.latitude, lng: formData.longitude }
                            : defaultCenter
                        }
                        zoom={13}
                        onClick={handleMapClick}
                      >
                        {formData.latitude && formData.longitude && (
                          <Marker
                            position={{ lat: formData.latitude, lng: formData.longitude }}
                          />
                        )}
                      </GoogleMap>
                    </LoadScript>
                  ) : (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        Google Maps API key belum dikonfigurasi. Tambahkan REACT_APP_GOOGLE_MAPS_API_KEY di .env
                      </p>
                    </div>
                  )}
                  {formData.latitude && formData.longitude && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Koordinat: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" data-testid="submit-partner-store-button">
                    {editingStore ? 'Perbarui' : 'Simpan'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari kios mitra, pemilik, telepon..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" data-testid="search-store-input" />
        </div>
      </Card>

      {/* Map View */}
      {showMap && GOOGLE_MAPS_API_KEY && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Peta Lokasi Kios Mitra</h2>
          <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={defaultCenter}
              zoom={11}
            >
              {stores.filter(s => s.latitude && s.longitude).map((store) => (
                <Marker
                  key={store.id}
                  position={{ lat: store.latitude, lng: store.longitude }}
                  onClick={() => setSelectedStore(store)}
                />
              ))}
              
              {selectedStore && (
                <InfoWindow
                  position={{ lat: selectedStore.latitude, lng: selectedStore.longitude }}
                  onCloseClick={() => setSelectedStore(null)}
                >
                  <div className="p-2">
                    <h3 className="font-semibold">{selectedStore.name}</h3>
                    <p className="text-sm">{selectedStore.owner_name}</p>
                    <p className="text-sm">{selectedStore.phone}</p>
                    <p className="text-xs text-gray-600 mt-1">{selectedStore.address}</p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Kios</p>
              <p className="text-base md:text-xl lg:text-2xl font-bold truncate">{stores.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Piutang</p>
              <p className="text-base md:text-xl lg:text-2xl font-bold truncate">
                {formatCurrency(stores.reduce((sum, s) => sum + (s.current_debt || 0), 0))}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Dengan Lokasi</p>
              <p className="text-base md:text-xl lg:text-2xl font-bold truncate">
                {stores.filter(s => s.latitude && s.longitude).length}
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
                <TableHead>Nama Kios</TableHead>
                <TableHead>Pemilik</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead className="text-right">Limit Kredit</TableHead>
                <TableHead className="text-right">Piutang</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Belum ada kios mitra
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {store.name}
                        {store.latitude && store.longitude && (
                          <MapPin className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{store.owner_name}</TableCell>
                    <TableCell>{store.phone}</TableCell>
                    <TableCell className="max-w-xs truncate">{store.address}</TableCell>
                    <TableCell className="text-right">{formatCurrency(store.credit_limit)}</TableCell>
                    <TableCell className="text-right">
                      <span className={store.current_debt > 0 ? 'text-orange-600 font-semibold' : ''}>
                        {formatCurrency(store.current_debt || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => viewStoreDetail(store.id)}
                          data-testid={`view-store-${store.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(store)}
                          data-testid={`edit-store-${store.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(store.id)}
                          data-testid={`delete-store-${store.id}`}
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
        <Pagination page={page} totalPages={totalPages} total={filteredStores.length} perPage={perPage} onChange={setPage} />
      </Card>
    </div>
  );
};
