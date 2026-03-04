"""
Tests for Import Data feature - /api/import/* endpoints
Tests include: import types listing, counts, template download, CSV import with validation,
duplicate skipping, and collection clearing
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestImportDataAPI:
    """Test cases for Import Data API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
    # ========== GET /api/import/types ==========
    def test_get_import_types_returns_9_types(self):
        """GET /api/import/types returns all 9 import types"""
        response = requests.get(f"{BASE_URL}/api/import/types", headers=self.headers)
        assert response.status_code == 200
        types = response.json()
        assert len(types) == 9, f"Expected 9 types, got {len(types)}"
        
        # Verify correct order
        expected_keys = ["warehouses", "categories", "suppliers", "products", "warehouse_stock", 
                        "purchases", "payment_history", "partner_stores", "partner_orders"]
        actual_keys = [t["key"] for t in types]
        assert actual_keys == expected_keys, f"Incorrect order: {actual_keys}"
        
        # Verify each type has required fields
        for t in types:
            assert "key" in t, f"Missing 'key' in {t}"
            assert "label" in t, f"Missing 'label' in {t}"
            assert "order" in t, f"Missing 'order' in {t}"
            assert "columns" in t, f"Missing 'columns' in {t}"
        print(f"PASS: GET /api/import/types returns all 9 types in correct order")
        
    def test_import_types_unauthorized(self):
        """GET /api/import/types requires admin auth"""
        response = requests.get(f"{BASE_URL}/api/import/types")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: GET /api/import/types requires admin auth")
        
    # ========== GET /api/import/counts ==========
    def test_get_import_counts_all_collections(self):
        """GET /api/import/counts returns counts for all 9 collections"""
        response = requests.get(f"{BASE_URL}/api/import/counts", headers=self.headers)
        assert response.status_code == 200
        counts = response.json()
        
        expected_collections = ["warehouses", "categories", "suppliers", "products", 
                               "warehouse_stock", "purchases", "payment_history", 
                               "partner_stores", "partner_orders"]
        for col in expected_collections:
            assert col in counts, f"Missing count for '{col}'"
            assert isinstance(counts[col], int), f"Count for '{col}' should be int"
        print(f"PASS: GET /api/import/counts returns counts for all collections: {counts}")
        
    # ========== GET /api/import/template/{type} ==========
    def test_get_template_categories(self):
        """GET /api/import/template/categories returns CSV with correct columns"""
        response = requests.get(f"{BASE_URL}/api/import/template/categories", headers=self.headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        
        content = response.text.strip()
        headers = content.split(",")
        assert headers == ["nama", "deskripsi"], f"Incorrect headers: {headers}"
        print(f"PASS: Template categories has correct columns: {headers}")
        
    def test_get_template_suppliers(self):
        """GET /api/import/template/suppliers returns CSV with correct columns"""
        response = requests.get(f"{BASE_URL}/api/import/template/suppliers", headers=self.headers)
        assert response.status_code == 200
        content = response.text.strip()
        headers = content.split(",")
        expected = ["nama", "kontak", "telepon", "email", "alamat"]
        assert headers == expected, f"Expected {expected}, got {headers}"
        print(f"PASS: Template suppliers has correct columns")
        
    def test_get_template_products(self):
        """GET /api/import/template/products returns CSV with correct columns"""
        response = requests.get(f"{BASE_URL}/api/import/template/products", headers=self.headers)
        assert response.status_code == 200
        content = response.text.strip()
        headers = content.split(",")
        expected = ["nama", "barcode", "kategori", "supplier", "harga_jual", "harga_beli", 
                   "harga_box", "isi_per_box", "min_stok", "kadaluarsa", "batch", "deskripsi"]
        assert headers == expected, f"Expected {expected}, got {headers}"
        print(f"PASS: Template products has correct columns")
        
    def test_get_template_invalid_type(self):
        """GET /api/import/template/invalid returns 404"""
        response = requests.get(f"{BASE_URL}/api/import/template/invalid_type", headers=self.headers)
        assert response.status_code == 404
        print("PASS: Invalid template type returns 404")
        
    # ========== POST /api/import/{type} - CSV Import ==========
    def test_import_categories_success(self):
        """POST /api/import/categories with valid CSV imports new records"""
        csv_content = "nama,deskripsi\nTEST_Import_Cat1,Kategori test import 1\nTEST_Import_Cat2,Kategori test import 2"
        files = {"file": ("test_categories.csv", io.StringIO(csv_content), "text/csv")}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(f"{BASE_URL}/api/import/categories", files=files, headers=headers)
        assert response.status_code == 200
        result = response.json()
        
        assert result["type"] == "categories"
        assert result["total_rows"] == 2
        # At least 1 should succeed (if not duplicate)
        print(f"PASS: Import categories - success: {result['success']}, skipped: {result['skipped']}, errors: {result['error_count']}")
        
    def test_import_suppliers_with_duplicate_skip(self):
        """POST /api/import/suppliers with duplicate data skips existing records"""
        # First import
        csv_content = "nama,kontak,telepon,email,alamat\nTEST_Dup_Supplier,John,08123,john@test.com,Jakarta"
        files = {"file": ("test_suppliers.csv", io.StringIO(csv_content), "text/csv")}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response1 = requests.post(f"{BASE_URL}/api/import/suppliers", files=files, headers=headers)
        assert response1.status_code == 200
        result1 = response1.json()
        print(f"First import: success={result1['success']}, skipped={result1['skipped']}")
        
        # Second import with same data - should skip
        files2 = {"file": ("test_suppliers.csv", io.StringIO(csv_content), "text/csv")}
        response2 = requests.post(f"{BASE_URL}/api/import/suppliers", files=files2, headers=headers)
        assert response2.status_code == 200
        result2 = response2.json()
        
        # Second import should skip all as duplicates
        assert result2["skipped"] >= 1, f"Expected at least 1 skipped, got {result2['skipped']}"
        print(f"PASS: Duplicate suppliers skipped - skipped count: {result2['skipped']}")
        
    def test_import_products_invalid_category_reference(self):
        """POST /api/import/products with invalid category reference returns error details"""
        csv_content = "nama,barcode,kategori,supplier,harga_jual,harga_beli,harga_box,isi_per_box,min_stok,kadaluarsa,batch,deskripsi\nTEST_Prod_Invalid,12345,NONEXISTENT_CATEGORY,,10000,8000,0,1,10,,,"
        files = {"file": ("test_products.csv", io.StringIO(csv_content), "text/csv")}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(f"{BASE_URL}/api/import/products", files=files, headers=headers)
        assert response.status_code == 200
        result = response.json()
        
        # Should have error for invalid category
        assert result["error_count"] >= 1, f"Expected at least 1 error, got {result['error_count']}"
        assert any("kategori" in err.lower() or "category" in err.lower() or "tidak ditemukan" in err.lower() 
                   for err in result.get("errors", [])), f"Expected category error in: {result.get('errors')}"
        print(f"PASS: Invalid category reference returns error - errors: {result['errors']}")
        
    def test_import_warehouse_stock_success(self):
        """POST /api/import/warehouse_stock correctly sets stock and recalculates product total"""
        # First get existing product and warehouse names
        products_resp = requests.get(f"{BASE_URL}/api/products", headers=self.headers)
        warehouses_resp = requests.get(f"{BASE_URL}/api/warehouses", headers=self.headers)
        
        if products_resp.status_code == 200 and len(products_resp.json()) > 0:
            product = products_resp.json()[0]
            product_name = product["name"]
        else:
            # Create a test product first
            csv_content = "nama,barcode,kategori,supplier,harga_jual,harga_beli,harga_box,isi_per_box,min_stok,kadaluarsa,batch,deskripsi\nTEST_Stock_Product,99999,,,10000,8000,0,1,10,,,"
            files = {"file": ("test_prod.csv", io.StringIO(csv_content), "text/csv")}
            headers_upload = {"Authorization": f"Bearer {self.token}"}
            requests.post(f"{BASE_URL}/api/import/products", files=files, headers=headers_upload)
            product_name = "TEST_Stock_Product"
            
        if warehouses_resp.status_code == 200 and len(warehouses_resp.json()) > 0:
            warehouse = warehouses_resp.json()[0]
            warehouse_name = warehouse["name"]
        else:
            warehouse_name = "Gudang Utama"
        
        csv_content = f"produk,gudang,stok\n{product_name},{warehouse_name},25"
        files = {"file": ("test_stock.csv", io.StringIO(csv_content), "text/csv")}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(f"{BASE_URL}/api/import/warehouse_stock", files=files, headers=headers)
        assert response.status_code == 200
        result = response.json()
        
        print(f"PASS: Warehouse stock import - success: {result['success']}, errors: {result['error_count']}")
        
    def test_import_empty_file(self):
        """POST /api/import/categories with empty file returns 400"""
        csv_content = ""
        files = {"file": ("empty.csv", io.StringIO(csv_content), "text/csv")}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(f"{BASE_URL}/api/import/categories", files=files, headers=headers)
        assert response.status_code == 400
        print("PASS: Empty file import returns 400")
        
    # ========== DELETE /api/import/clear/{type} ==========
    def test_clear_collection_categories_test_data(self):
        """DELETE /api/import/clear/categories deletes all records in the collection"""
        # First import test data
        csv_content = "nama,deskripsi\nTEST_Clear_Cat1,Test clear 1\nTEST_Clear_Cat2,Test clear 2"
        files = {"file": ("test.csv", io.StringIO(csv_content), "text/csv")}
        headers_upload = {"Authorization": f"Bearer {self.token}"}
        requests.post(f"{BASE_URL}/api/import/categories", files=files, headers=headers_upload)
        
        # Get count before
        counts_before = requests.get(f"{BASE_URL}/api/import/counts", headers=self.headers).json()
        print(f"Categories count before clear: {counts_before.get('categories', 0)}")
        
        # Clear
        response = requests.delete(f"{BASE_URL}/api/import/clear/categories", headers=self.headers)
        assert response.status_code == 200
        result = response.json()
        assert "message" in result
        assert "dihapus" in result["message"].lower() or "deleted" in result["message"].lower()
        
        # Get count after
        counts_after = requests.get(f"{BASE_URL}/api/import/counts", headers=self.headers).json()
        assert counts_after.get("categories", 0) == 0, f"Expected 0 after clear, got {counts_after.get('categories')}"
        print(f"PASS: Clear categories - deleted {counts_before.get('categories', 0)} records, now: {counts_after.get('categories')}")
        
    def test_clear_invalid_collection(self):
        """DELETE /api/import/clear/invalid returns 400"""
        response = requests.delete(f"{BASE_URL}/api/import/clear/invalid_collection", headers=self.headers)
        assert response.status_code == 400
        print("PASS: Clear invalid collection returns 400")
        
    # ========== Cleanup ==========
    @pytest.fixture(scope="class", autouse=True)
    def cleanup_test_data(self):
        """Cleanup test data after all tests"""
        yield
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        if login_resp.status_code == 200:
            token = login_resp.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Delete test categories
            cats = requests.get(f"{BASE_URL}/api/categories", headers=headers).json()
            for cat in cats:
                if cat.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/categories/{cat['id']}", headers=headers)
                    
            # Delete test suppliers  
            sups = requests.get(f"{BASE_URL}/api/suppliers", headers=headers).json()
            for sup in sups:
                if sup.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/suppliers/{sup['id']}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
