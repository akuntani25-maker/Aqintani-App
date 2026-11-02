// Peta gratis: Leaflet + OpenStreetMap. Tidak butuh kunci API atau pendaftaran.
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { hasLocation, directionsUrl } from '../utils/geo';

// Titik awal: Lombok
export const DEFAULT_CENTER = [-8.65, 116.32];
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { hasLocation, directionsUrl };
const rupiah = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

// Penanda berupa HTML (bukan gambar), jadi tidak ada masalah ikon hilang saat build
const pin = (color = '#1b6a41', size = 30) => L.divIcon({
  className: '',
  iconSize: [size, size],
  iconAnchor: [size / 2, size],
  popupAnchor: [0, -size + 4],
  html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"><path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg>`,
});

function useLeaflet(ref, { center = DEFAULT_CENTER, zoom = 11 } = {}) {
  const mapRef = useRef(null);
  useEffect(() => {
    if (!ref.current || mapRef.current) return undefined;
    const map = L.map(ref.current, { center, zoom, scrollWheelZoom: false, tap: true });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    // aktifkan zoom dengan roda mouse setelah peta diklik (supaya halaman tetap bisa di-scroll)
    map.on('focus click', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());
    mapRef.current = map;
    // ukuran kontainer bisa berubah saat dialog/panel dibuka
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return mapRef;
}

/** Peta semua kios. stores: daftar kios (yang tanpa koordinat dilewati). */
export function StoreMap({ stores = [], height = 460, vehicleName = () => '' }) {
  const el = useRef(null);
  const mapRef = useLeaflet(el);
  const layerRef = useRef(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) layerRef.current.remove();
    const group = L.featureGroup();
    stores.filter(hasLocation).forEach((s) => {
      const lat = Number(s.latitude), lng = Number(s.longitude);
      const debt = Number(s.current_debt || 0);
      const color = debt > 0 && s.credit_limit > 0 && debt > s.credit_limit ? '#c2410c' : debt > 0 ? '#b7791f' : '#1b6a41';
      L.marker([lat, lng], { icon: pin(color), title: s.name })
        .bindPopup(`
          <div style="min-width:190px;font-family:inherit">
            <div style="font-weight:700;font-size:14px">${esc(s.name)}</div>
            ${s.owner_name ? `<div>${esc(s.owner_name)}</div>` : ''}
            ${s.phone ? `<div>${esc(s.phone)}</div>` : ''}
            ${vehicleName(s.vehicle_id) ? `<div style="color:#666">${esc(vehicleName(s.vehicle_id))}</div>` : ''}
            ${s.address ? `<div style="color:#666;font-size:12px;margin-top:2px">${esc(s.address)}</div>` : ''}
            <div style="margin-top:6px">Piutang: <b>${esc(rupiah(debt))}</b></div>
            <a href="${directionsUrl(lat, lng)}" target="_blank" rel="noreferrer" style="display:inline-block;margin-top:8px;font-weight:600">Petunjuk arah &rarr;</a>
          </div>`)
        .addTo(group);
    });
    group.addTo(map);
    layerRef.current = group;
    const b = group.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [36, 36], maxZoom: 15 });
  }, [stores, mapRef, vehicleName]);

  return <div ref={el} style={{ height, width: '100%', borderRadius: 12, zIndex: 0 }} data-testid="store-map" />;
}

/** Peta kecil satu kios (halaman detail). */
export function SingleStoreMap({ store, height = 220 }) {
  const el = useRef(null);
  const ok = hasLocation(store);
  const mapRef = useLeaflet(el, { center: ok ? [Number(store.latitude), Number(store.longitude)] : DEFAULT_CENTER, zoom: ok ? 16 : 10 });
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ok) return undefined;
    const m = L.marker([Number(store.latitude), Number(store.longitude)], { icon: pin() }).addTo(map);
    map.setView([Number(store.latitude), Number(store.longitude)], 16);
    return () => m.remove();
  }, [mapRef, ok, store]);
  return <div ref={el} style={{ height, width: '100%', borderRadius: 12, zIndex: 0 }} data-testid="single-store-map" />;
}

/** Pemilih lokasi untuk formulir kios: klik peta, geser penanda, cari tempat, atau pakai GPS. */
export function LocationPicker({ latitude, longitude, onChange, height = 280 }) {
  const el = useRef(null);
  const ok = hasLocation({ latitude, longitude });
  const mapRef = useLeaflet(el, { center: ok ? [latitude, longitude] : DEFAULT_CENTER, zoom: ok ? 16 : 10 });
  const markerRef = useRef(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const setPoint = (lat, lng) => changeRef.current({ latitude: Math.round(lat * 1e6) / 1e6, longitude: Math.round(lng * 1e6) / 1e6 });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const onClick = (e) => setPoint(e.latlng.lat, e.latlng.lng);
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!ok) { if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; } return; }
    if (!markerRef.current) {
      markerRef.current = L.marker([latitude, longitude], { icon: pin(), draggable: true }).addTo(map);
      markerRef.current.on('dragend', (e) => { const p = e.target.getLatLng(); setPoint(p.lat, p.lng); });
    } else {
      markerRef.current.setLatLng([latitude, longitude]);
    }
    if (!map.getBounds().contains([latitude, longitude])) map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
  }, [latitude, longitude, ok, mapRef]);

  const useGps = () => {
    if (!navigator.geolocation) { setMsg('Perangkat ini tidak mendukung GPS.'); return; }
    setBusy('gps'); setMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBusy(''); setPoint(pos.coords.latitude, pos.coords.longitude); mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 17); setMsg(`Akurasi ±${Math.round(pos.coords.accuracy)} m`); },
      (err) => { setBusy(''); setMsg(err.code === 1 ? 'Izin lokasi ditolak. Izinkan lokasi di browser, atau klik di peta.' : 'Lokasi tidak didapat. Coba lagi di luar ruangan, atau klik di peta.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setBusy('search'); setMsg('');
    try {
      // Nominatim (OpenStreetMap), gratis; dibatasi ke Indonesia
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`);
      const [hit] = await r.json();
      if (!hit) { setMsg('Tempat tidak ditemukan. Coba nama desa/kecamatan, lalu klik titik tepatnya di peta.'); return; }
      mapRef.current?.setView([Number(hit.lat), Number(hit.lon)], 15);
      setMsg('Peta dipindah ke hasil pencarian. Klik titik kios yang tepat.');
    } catch { setMsg('Pencarian gagal. Periksa koneksi internet.'); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 gap-2">
          <input
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            placeholder="Cari desa/tempat, mis. Praya" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(e); }}
            data-testid="map-search-input"
          />
          <button type="button" onClick={search} disabled={busy === 'search'} className="h-9 px-3 rounded-md border text-sm font-medium whitespace-nowrap">{busy === 'search' ? 'Mencari…' : 'Cari'}</button>
        </div>
        <button type="button" onClick={useGps} disabled={busy === 'gps'} className="h-9 px-3 rounded-md border text-sm font-medium whitespace-nowrap" data-testid="map-gps-button">{busy === 'gps' ? 'Mencari lokasi…' : 'Pakai lokasi saya'}</button>
      </div>
      <div ref={el} style={{ height, width: '100%', borderRadius: 12, zIndex: 0 }} data-testid="location-picker" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{ok ? `Koordinat: ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}` : 'Klik di peta untuk menandai lokasi kios.'}</span>
        {ok && <button type="button" className="text-red-600 font-medium" onClick={() => changeRef.current({ latitude: null, longitude: null })}>Hapus lokasi</button>}
      </div>
      {msg && <p className="text-xs text-amber-700">{msg}</p>}
    </div>
  );
}
