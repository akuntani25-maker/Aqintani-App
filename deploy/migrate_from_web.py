"""Pindahkan data dari aplikasi lama (Emergent) LEWAT WEB-NYA, memakai login admin.

Dipakai bila database Emergent tidak bisa diakses langsung (MongoDB Atlas milik Emergent).
Dijalankan oleh migrate-via-web.sh di dalam kontainer backend VPS.

- Aplikasi lama hanya DIBACA (semua permintaan GET), tidak ada yang diubah di sana.
- Password akun tidak bisa diambil dari web lama, jadi:
    * akun admin yang dipakai login di sini tetap memakai password yang sama;
    * akun lain diberi satu password sementara, yang harus segera diganti.
- Tidak tersedia lewat web lama: catatan biaya beli-luar kanvaser dan log retur/tukar kasir.
"""
import getpass
import os
import secrets
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import requests
from passlib.context import CryptContext
from pymongo import MongoClient

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
TARGET = MongoClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "aqintani")]
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/data/uploads")


def ask(prompt, default=""):
    v = input(f"{prompt}{f' [{default}]' if default else ''}: ").strip()
    return v or default


class Old:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.s = requests.Session()
        self.calls = 0

    def login(self, email, password):
        try:
            r = self.s.post(f"{self.base}/api/auth/login", json={"email": email, "password": password}, timeout=60)
        except requests.RequestException as e:
            sys.exit(f"Tidak bisa menghubungi {self.base}: {e.__class__.__name__}. Periksa alamatnya.")
        if r.status_code != 200:
            sys.exit(f"Login ke aplikasi lama gagal ({r.status_code}). Periksa email/password.")
        data = r.json()
        self.s.headers["Authorization"] = f"Bearer {data['token']}"
        return data["user"]

    def get(self, path, **params):
        for attempt in range(4):
            try:
                r = self.s.get(f"{self.base}/api{path}", params=params, timeout=120)
                self.calls += 1
                if r.status_code == 200:
                    return r.json()
                if r.status_code in (403, 404, 405, 422):
                    return None
            except requests.RequestException:
                pass
            time.sleep(2 * (attempt + 1))
        print(f"  ! gagal mengambil {path}")
        return None


def many(fn, items, workers=6):
    with ThreadPoolExecutor(workers) as ex:
        return list(ex.map(fn, items))


def uniq(docs, key="id"):
    out, seen = [], set()
    for d in docs:
        if not d:
            continue
        k = d.get(key)
        if k is None:
            out.append(d)
        elif k not in seen:
            seen.add(k)
            out.append(d)
    return out


def main():
    print("\n=== Pindah data dari aplikasi lama lewat web ===\n")
    base = ask("Alamat aplikasi lama", "https://aqintani.online")
    email = ask("Email admin aplikasi lama")
    password = getpass.getpass("Password admin aplikasi lama (tidak tampil): ")
    old = Old(base)
    me = old.login(email, password)
    if me.get("role") != "admin":
        sys.exit("Akun ini bukan admin. Pakai akun admin.")
    temp_pw = ask("Password sementara untuk akun karyawan lain", secrets.token_urlsafe(8))
    print("\nMengambil data (beberapa menit, aplikasi lama hanya dibaca)...")

    col = {}
    get = old.get

    # --- data dasar ---
    col["warehouses"] = get("/warehouses") or []
    col["categories"] = get("/categories") or []
    col["suppliers"] = get("/suppliers") or []
    col["products"] = get("/products") or []
    col["warehouse_stock"] = get("/warehouse-stock") or []
    col["partner_stores"] = get("/partner-stores") or []
    col["canvassers"] = get("/canvassers") or []
    col["vehicles"] = get("/vehicles") or []
    col["vehicle_stock"] = get("/vehicle-stock") or []
    col["partner_prices"] = get("/partner-prices") or []
    col["stock_transfers"] = get("/stock-transfers") or []
    col["stock_adjustments"] = get("/stock-adjustments") or []
    col["returns"] = get("/returns") or []
    col["audit_log"] = get("/audit-log", limit=1000000) or []
    col["shifts"] = get("/shifts/history", limit=1000000) or []
    s = get("/store-settings")
    col["store_settings"] = [s] if s else []
    print(f"  barang {len(col['products'])}, supplier {len(col['suppliers'])}, kios {len(col['partner_stores'])}")

    # --- pembelian supplier (per supplier agar tidak terpotong 1000) ---
    purch = sum((r or [] for r in many(lambda sp: get(f"/supplier-debts/{sp['id']}/purchases", show_all="true"), col["suppliers"])), [])
    col["purchases"] = uniq(purch + (get("/purchases") or []))

    # --- riwayat pembayaran ---
    pays = sum((r or [] for r in many(lambda sp: get(f"/suppliers/{sp['id']}/payments"), col["suppliers"])), [])
    pays += sum((r or [] for r in many(lambda st: get(f"/partner-stores/{st['id']}/payments"), col["partner_stores"])), [])
    for t in ("supplier", "supplier_return", "partner_store", "partner_store_cash"):
        pays += get("/payment-history", type=t) or []
    col["payment_history"] = uniq(pays)
    print(f"  pembelian {len(col['purchases'])}, pembayaran {len(col['payment_history'])}")

    # --- pesanan kios: ambil detail tiap pesanan (daftar memotong data settlement) ---
    listed = {}
    for r in many(lambda st: get("/partner-orders", partner_store_id=st["id"]), col["partner_stores"]):
        listed.update({o["id"]: o for o in (r or [])})
    listed.update({o["id"]: o for o in (get("/partner-orders") or [])})
    orders = many(lambda oid: get(f"/partner-orders/{oid}"), sorted(listed))
    for o in orders:
        if not o:
            continue
        # buang kolom tampilan yang ditambahkan endpoint detail; sell_unit asli ada di endpoint daftar
        for k in ("partner_debt_total", "partner_phone", "partner_address"):
            o.pop(k, None)
        raw_items = (listed.get(o["id"]) or {}).get("items") or []
        for i, it in enumerate(o.get("items", [])):
            it.pop("items_per_box", None)
            if i < len(raw_items) and "sell_unit" in raw_items[i]:
                it["sell_unit"] = raw_items[i]["sell_unit"]
    col["partner_orders"] = [o for o in orders if o]
    print(f"  pesanan kios {len(col['partner_orders'])}")

    # --- transaksi kasir & hutang petani per hari (data lengkap, tidak terpotong) ---
    start = date(2025, 1, 1)
    end = (datetime.now(timezone(timedelta(hours=8))) + timedelta(days=1)).date()
    days = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]
    tx, ftx = [], []
    for r in many(lambda d: get("/pos/daily-transactions", date=d), days, workers=8):
        if r:
            tx += r.get("transactions", [])
            ftx += r.get("farmer_transactions", [])
    col["transactions"] = uniq(tx)
    print(f"  transaksi kasir {len(col['transactions'])}")

    # --- petani & piutang pribadi ---
    col["farmers"] = get("/farmers") or []
    ftx += sum((r or [] for r in many(lambda f: get(f"/farmer-debts/{f['id']}/transactions"), col["farmers"])), [])
    col["farmer_transactions"] = uniq(ftx)
    col["farmer_payments"] = uniq(sum((r or [] for r in many(lambda f: get(f"/farmer-debts/{f['id']}/payments"), col["farmers"])), []))
    lo = get("/personal-loans/overview") or {}
    col["personal_loans"] = lo.get("loans", [])
    col["loan_payments"] = uniq(sum((r or [] for r in many(lambda ln: get(f"/personal-loans/{ln['id']}/payments"), col["personal_loans"])), []))

    # --- riwayat harga per barang ---
    col["price_history"] = uniq(sum((r or [] for r in many(lambda p: get(f"/products/{p['id']}/price-history"), col["products"])), []))

    # --- pengguna (password tidak bisa diambil: admin tetap, lainnya sementara) ---
    users = get("/users") or []
    my_hash, temp_hash = pwd.hash(password), pwd.hash(temp_pw)
    for u in users:
        u["password"] = my_hash if u.get("email", "").lower() == email.lower() else temp_hash
    col["users"] = users

    if not col["products"] or not users:
        sys.exit("Data penting kosong; pemindahan dibatalkan tanpa mengubah VPS.")

    # --- tulis ke database VPS ---
    print("\nMenyimpan ke database VPS...")
    for name, docs in col.items():
        TARGET[name].delete_many({})
        docs = [{k: v for k, v in d.items() if k != "_id"} for d in docs if isinstance(d, dict)]
        if docs:
            TARGET[name].insert_many(docs)
    TARGET.migrations.update_one({"name": "product_warehouse_stock_init_v1"}, {"$set": {"completed": True}}, upsert=True)

    # --- foto produk ---
    root = os.path.join(UPLOAD_DIR, "aqintani", "products")
    os.makedirs(root, exist_ok=True)
    ok = fail = 0

    def fetch(p):
        url = p.get("image_url") or ""
        if not url.startswith("/api/products/image-file/"):
            return None
        dest = os.path.join(root, url.rsplit("/", 1)[-1])
        if os.path.exists(dest):
            return True
        try:
            r = requests.get(base.rstrip("/") + url, timeout=60)
            r.raise_for_status()
            with open(dest, "wb") as f:
                f.write(r.content)
            return True
        except Exception:
            return False
    for res in many(fetch, col["products"]):
        if res is True:
            ok += 1
        elif res is False:
            fail += 1

    print("\n=== Selesai ===")
    for name in ("products", "transactions", "partner_orders", "purchases", "partner_stores", "suppliers", "users"):
        print(f"  {name:16s} {len(col[name])}")
    print(f"  foto produk      {ok} berhasil, {fail} gagal")
    print(f"  ({old.calls} permintaan ke aplikasi lama)\n")
    print(f"Login admin  : {email} (password sama seperti di aplikasi lama)")
    others = [u for u in users if u.get("email", "").lower() != email.lower()]
    if others:
        print(f"Akun lain    : password sementara  {temp_pw}")
        for u in others:
            print(f"   - {u.get('email')} ({u.get('role')})")
        print("Minta setiap karyawan login lalu ganti password di menu Profil.")
    print("\nTidak ikut pindah (tidak tersedia lewat web lama): catatan biaya beli-luar kanvaser, log retur/tukar kasir.")


if __name__ == "__main__":
    main()
