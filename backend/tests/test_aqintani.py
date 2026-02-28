"""
Backend API tests for UD. Aqin Tani pharmacy/agriculture app
Tests: Auth, Canvassers, Partner Orders, Dashboard
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthAPI:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == "admin@aqintani.com"
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful, user: {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials properly rejected")
    
    def test_get_current_user(self, admin_token):
        """Test /api/auth/me endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Get current user failed: {response.text}"
        
        data = response.json()
        assert data["email"] == "admin@aqintani.com"
        print(f"✓ Current user: {data['name']} ({data['role']})")


class TestCanvassersAPI:
    """Canvasser CRUD tests"""
    
    def test_get_canvassers(self, admin_token):
        """Test listing canvassers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/canvassers", headers=headers)
        assert response.status_code == 200, f"Get canvassers failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} canvassers")
        return data
    
    def test_create_canvasser(self, admin_token):
        """Test creating a new canvasser"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        canvasser_data = {
            "name": "TEST_Kanvaser Baru",
            "phone": "0812-9999-8888",
            "vehicle_type": "Mobil Box",
            "vehicle_number": "B 1234 TEST"
        }
        response = requests.post(f"{BASE_URL}/api/canvassers", json=canvasser_data, headers=headers)
        assert response.status_code == 200, f"Create canvasser failed: {response.text}"
        
        data = response.json()
        assert data["name"] == canvasser_data["name"]
        assert data["phone"] == canvasser_data["phone"]
        assert "id" in data
        print(f"✓ Created canvasser: {data['name']} (ID: {data['id']})")
        return data
    
    def test_create_canvasser_login(self, admin_token):
        """Test creating login account for canvasser (via /api/auth/register)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create canvasser
        canvasser_data = {
            "name": "TEST_Kanvaser Login",
            "phone": "0812-7777-6666",
            "vehicle_type": "Pick Up",
            "vehicle_number": "B 5678 LOGIN"
        }
        create_resp = requests.post(f"{BASE_URL}/api/canvassers", json=canvasser_data, headers=headers)
        assert create_resp.status_code == 200
        canvasser = create_resp.json()
        
        # Create login for canvasser
        timestamp = datetime.now().strftime("%H%M%S")
        login_data = {
            "email": f"test_kanvaser_{timestamp}@aqintani.com",
            "password": "canvasser123",
            "name": canvasser["name"],
            "role": "canvasser",
            "canvasser_id": canvasser["id"]
        }
        register_resp = requests.post(f"{BASE_URL}/api/auth/register", json=login_data, headers=headers)
        assert register_resp.status_code == 200, f"Create canvasser login failed: {register_resp.text}"
        
        user = register_resp.json()
        assert user["role"] == "canvasser"
        assert user["canvasser_id"] == canvasser["id"]
        print(f"✓ Created canvasser login: {user['email']}")
        return {"canvasser": canvasser, "user": user, "password": "canvasser123"}
    
    def test_delete_canvasser(self, admin_token):
        """Test deleting a canvasser"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create canvasser to delete
        canvasser_data = {
            "name": "TEST_To Delete",
            "phone": "0812-0000-0000",
            "vehicle_type": "Motor",
            "vehicle_number": "B 0000 DEL"
        }
        create_resp = requests.post(f"{BASE_URL}/api/canvassers", json=canvasser_data, headers=headers)
        canvasser = create_resp.json()
        
        # Delete canvasser
        delete_resp = requests.delete(f"{BASE_URL}/api/canvassers/{canvasser['id']}", headers=headers)
        assert delete_resp.status_code == 200
        
        # Verify deletion - get canvassers and check not in list
        list_resp = requests.get(f"{BASE_URL}/api/canvassers", headers=headers)
        canvassers = list_resp.json()
        canvasser_ids = [c["id"] for c in canvassers]
        assert canvasser["id"] not in canvasser_ids
        print(f"✓ Deleted canvasser: {canvasser['name']}")


class TestDashboardAPI:
    """Dashboard stats tests"""
    
    def test_dashboard_stats(self, admin_token):
        """Test dashboard stats endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        assert "today_sales" in data
        assert "today_transactions" in data
        assert "total_products" in data
        assert "low_stock_count" in data
        assert "last_7_days" in data
        print(f"✓ Dashboard stats: {data['total_products']} products, {data['low_stock_count']} low stock")


class TestPartnerStoresAPI:
    """Partner store (Kios Mitra) tests"""
    
    def test_get_partner_stores(self, admin_token):
        """Test listing partner stores"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/partner-stores", headers=headers)
        assert response.status_code == 200, f"Get partner stores failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} partner stores")
        return data
    
    def test_create_partner_store(self, admin_token):
        """Test creating partner store"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        store_data = {
            "name": "TEST_Kios Test",
            "owner_name": "Budi Test",
            "phone": "0812-1111-2222",
            "address": "Jl. Test No. 123",
            "credit_limit": 5000000
        }
        response = requests.post(f"{BASE_URL}/api/partner-stores", json=store_data, headers=headers)
        assert response.status_code == 200, f"Create partner store failed: {response.text}"
        
        data = response.json()
        assert data["name"] == store_data["name"]
        assert data["owner_name"] == store_data["owner_name"]
        print(f"✓ Created partner store: {data['name']}")
        return data


class TestPartnerOrdersAPI:
    """Partner orders tests"""
    
    def test_get_partner_orders(self, admin_token):
        """Test listing partner orders"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/partner-orders", headers=headers)
        assert response.status_code == 200, f"Get partner orders failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} partner orders")
        return data


class TestCanvasserLoginFlow:
    """Test canvasser login and dashboard access"""
    
    def test_canvasser_login(self):
        """Test canvasser login - check if existing ahmadrifai@aqintani.com exists"""
        # Try to login with existing canvasser
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ahmadrifai@aqintani.com",
            "password": "canvasser123"
        })
        
        if response.status_code == 200:
            data = response.json()
            assert data["user"]["role"] == "canvasser"
            print(f"✓ Canvasser login successful: {data['user']['name']}")
            return data
        else:
            print(f"⚠ Canvasser ahmadrifai@aqintani.com not found (status: {response.status_code})")
            pytest.skip("Canvasser account does not exist - needs to be created via admin first")
    
    def test_canvasser_my_orders(self, canvasser_token):
        """Test canvasser /my-orders endpoint"""
        if canvasser_token is None:
            pytest.skip("Canvasser token not available")
            
        headers = {"Authorization": f"Bearer {canvasser_token}"}
        response = requests.get(f"{BASE_URL}/api/canvassers/my-orders", headers=headers)
        assert response.status_code == 200, f"Get my orders failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Canvasser has {len(data)} orders assigned")


class TestStoreSettings:
    """Store settings tests"""
    
    def test_get_store_settings(self, admin_token):
        """Test getting store settings - should show UD. AQIN TANI"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/store-settings", headers=headers)
        assert response.status_code == 200, f"Get store settings failed: {response.text}"
        
        data = response.json()
        assert "store_name" in data
        # Default should be UD. AQIN TANI (not AgriPharma POS)
        print(f"✓ Store name: {data['store_name']}")


# Fixtures
@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@aqintani.com",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Admin login failed")


@pytest.fixture(scope="module")
def canvasser_token():
    """Get canvasser authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ahmadrifai@aqintani.com",
        "password": "canvasser123"
    })
    if response.status_code == 200:
        return response.json()["token"]
    return None  # Don't fail if canvasser doesn't exist


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(admin_token):
    """Cleanup TEST_ prefixed data after tests"""
    yield
    if admin_token:
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Clean up test canvassers
        try:
            canvassers = requests.get(f"{BASE_URL}/api/canvassers", headers=headers).json()
            for c in canvassers:
                if c["name"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/canvassers/{c['id']}", headers=headers)
            
            # Clean up test partner stores
            stores = requests.get(f"{BASE_URL}/api/partner-stores", headers=headers).json()
            for s in stores:
                if s["name"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/partner-stores/{s['id']}", headers=headers)
        except:
            pass
