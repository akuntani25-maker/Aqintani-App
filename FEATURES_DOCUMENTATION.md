# 📦 UD. AQIN TANI - Sistem Distribusi B2B
## Dokumentasi Lengkap Fitur

---

## 🎯 Fitur Utama yang Telah Diimplementasikan

### 1. **Store Settings (Pengaturan Toko)**
**Path:** `/admin/store-settings`

**Fitur:**
- Edit nama toko
- Edit alamat lengkap
- Edit nomor telepon
- Edit email
- URL logo (optional)

**Kegunaan:**
- Data ini akan muncul di struk transaksi
- Digunakan di invoice kios mitra
- Tampil di semua dokumen resmi

---

### 2. **Partner Stores (Kios Mitra)** ⭐
**Path:** `/admin/partner-stores`

**Fitur:**
- CRUD kios mitra lengkap
- **Google Maps Integration:**
  - View map dengan markers semua kios
  - Click map untuk set lokasi kios
  - Info window dengan detail kios
- Summary cards:
  - Total kios
  - Total piutang
  - Kios dengan lokasi GPS
- Tracking limit kredit
- Tracking piutang real-time

**Detail Kios:**
**Path:** `/admin/partner-stores/:id`
- Info lengkap kios (owner, phone, address, limit)
- Highlight current debt
- Riwayat pesanan lengkap
- Dialog pembayaran piutang
- Status tracking orders

---

### 3. **Partner Orders (Pesanan Kios Mitra)**
**Path:** `/admin/partner-orders`

**Fitur:**
- Buat pesanan baru untuk kios mitra
- Pilih kios mitra dari dropdown
- Add products ke cart
- Set discount
- Assign kanvaser untuk pengiriman
- Set tanggal kirim
- Update status order (pending/delivered/cancelled)
- Auto update piutang kios

**Flow:**
1. Pilih kios mitra
2. Pilih kanvaser (optional)
3. Set tanggal kirim
4. Add produk dari list
5. Cart system dengan quantity control
6. Apply discount
7. Submit order
8. Status tracking

---

### 4. **Canvassers (Kanvaser & Armada)**
**Path:** `/admin/canvassers`

**Fitur:**
- CRUD kanvaser/sales
- Data personal (nama, telepon)
- Jenis kendaraan (Mobil Box/Pick Up/Motor)
- Nomor kendaraan
- Status aktif/nonaktif
- Summary:
  - Total kanvaser
  - Kanvaser aktif
  - Jumlah mobil box

**Use Case:**
- 2 armada mobil box untuk pengiriman
- Assign kanvaser ke pesanan kios
- Tracking siapa yang deliver kemana

---

### 5. **Product Management Enhanced**
**Path:** `/admin/products`

**Fitur Existing:**
- CRUD produk lengkap
- Barcode support
- Expiry date (untuk obat)
- Batch number
- Stock tracking
- Min stock alert
- Category & supplier assignment

**Fitur Planned (Next):**
- Filter by kategori
- Filter by supplier
- Filter stok menipis
- Filter fast moving
- Filter slow moving

---

### 6. **Purchases Management** (Backend Ready)
**API:** `/api/purchases`

**Fitur Backend:**
- Record pembelian dari supplier
- Multi-item purchase
- Tracking total & paid
- Tracking remaining debt ke supplier
- Payment installment support

**Frontend:** Coming soon
- Daftar pembelian
- Filter by supplier
- Catat pembayaran hutang
- History lengkap

---

### 7. **Supplier Detail** (Planned)

**Fitur:**
- Info supplier lengkap
- Riwayat pembelian dari supplier
- Total hutang ke supplier
- Payment history
- Product list dari supplier

---

### 8. **Product Analytics** (Backend Ready)
**API:** `/api/analytics/products`

**Data Available:**
- Fast moving products (top 10 by sales qty - 30 days)
- Slow moving products (bottom 10)
- Revenue per product

**Frontend:** Coming soon
- Dashboard with charts
- Filter by date range
- Export to Excel

---

## 🗺️ Google Maps Integration

### Setup:

1. **Get API Key:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Create project
   - Enable "Maps JavaScript API"
   - Create API key

2. **Add to Environment:**
   ```bash
   # /app/frontend/.env
   REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

3. **Restart Frontend:**
   ```bash
   sudo supervisorctl restart frontend
   ```

### Features:
- Interactive map view
- Multiple markers for all kios
- Click map to set location
- Info windows with kios details
- Responsive map sizing

---

## 📊 Database Models

### Partner Stores
```javascript
{
  id: uuid,
  name: string,
  owner_name: string,
  phone: string,
  address: string,
  latitude: float,
  longitude: float,
  credit_limit: float,
  current_debt: float,
  created_at: datetime
}
```

### Partner Orders
```javascript
{
  id: uuid,
  order_number: string,
  partner_store_id: uuid,
  partner_store_name: string,
  items: [{
    product_id: uuid,
    product_name: string,
    quantity: int,
    price: float,
    subtotal: float
  }],
  subtotal: float,
  discount: float,
  total: float,
  paid: float,
  remaining: float,
  delivery_date: date,
  canvasser_id: uuid,
  canvasser_name: string,
  status: enum(pending|delivered|cancelled),
  created_at: datetime,
  date: date
}
```

### Canvassers
```javascript
{
  id: uuid,
  name: string,
  phone: string,
  vehicle_number: string,
  vehicle_type: string,
  is_active: boolean,
  created_at: datetime
}
```

### Purchases
```javascript
{
  id: uuid,
  supplier_id: uuid,
  supplier_name: string,
  items: array,
  total: float,
  paid: float,
  remaining: float,
  notes: string,
  created_at: datetime,
  date: date
}
```

### Store Settings
```javascript
{
  store_name: string,
  address: string,
  phone: string,
  email: string,
  logo_url: string
}
```

---

## 🔄 Business Flow

### Flow 1: Pembelian dari Supplier
1. Admin catat pembelian dari supplier
2. Input items + total
3. Catat pembayaran (bisa partial)
4. Track sisa hutang ke supplier

### Flow 2: Penjualan ke Kios Mitra
1. Kios order via telepon/WhatsApp
2. Admin input order di sistem
3. Assign kanvaser untuk delivery
4. Update status (pending → delivered)
5. Kios bayar (bisa tempo)
6. Track piutang dari kios

### Flow 3: Pengiriman dengan Kanvaser
1. Order dibuat dengan delivery date
2. Assign ke kanvaser (armada)
3. Kanvaser deliver ke kios
4. Update status delivered
5. Collect payment (optional)

---

## 🎨 UI/UX Highlights

### Design System:
- **Colors:** Teal/Cyan primary, Yellow secondary
- **Typography:** Manrope (headings), Public Sans (body)
- **Layout:** Sidebar navigation, card-based content
- **Responsive:** Mobile, tablet, desktop optimized

### Key Features:
- Google Maps integration
- Real-time debt tracking
- Status badges
- Summary cards with icons
- Interactive tables
- Modal dialogs for forms
- Toast notifications

---

## 📱 Access Control

### Admin Role:
- ✅ Full access ke semua menu
- ✅ Store Settings
- ✅ Partner Stores & Orders
- ✅ Canvassers
- ✅ Purchases
- ✅ Analytics
- ✅ Reports
- ✅ User Management

### Cashier Role:
- ✅ POS only
- ❌ No admin access

---

## 🚀 Next Steps

### High Priority:
1. ✅ Complete frontend for Purchases page
2. ✅ Complete frontend for Supplier Detail
3. ✅ Complete frontend for Product Analytics
4. ✅ Add filters to Products page
5. ✅ Testing all flows end-to-end

### Medium Priority:
- Export reports to Excel
- WhatsApp integration for orders
- Print invoice for kios orders
- Delivery tracking map
- Stock projection analytics

### Future Enhancements:
- Mobile app for kanvaser
- Real-time GPS tracking
- Auto reorder suggestions
- Customer portal for kios
- Integration with accounting software

---

## 🔧 Technical Stack

**Backend:**
- FastAPI
- MongoDB
- JWT Authentication

**Frontend:**
- React
- Tailwind CSS
- Shadcn/UI
- React Router
- @react-google-maps/api
- Recharts (for charts)

---

## 📞 Support

For questions or issues:
- Check console logs (F12)
- Check backend logs: `tail -f /var/log/supervisor/backend.*.log`
- Check frontend logs: `tail -f /var/log/supervisor/frontend.*.log`
