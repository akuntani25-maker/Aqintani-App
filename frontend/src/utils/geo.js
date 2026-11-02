// Bantuan lokasi tanpa memuat pustaka peta (dipakai juga di halaman kanvaser)
export const hasLocation = (s) => !!s && s.latitude != null && s.longitude != null
  && !Number.isNaN(Number(s.latitude)) && !Number.isNaN(Number(s.longitude))
  && !(Number(s.latitude) === 0 && Number(s.longitude) === 0);

// Link petunjuk arah: membuka aplikasi Google Maps di HP (gratis, tanpa kunci API)
export const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Perangkat ini tidak mendukung GPS')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      (e) => reject(new Error(e.code === 1 ? 'Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini di browser.' : 'Lokasi tidak didapat. Coba lagi di luar ruangan.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
