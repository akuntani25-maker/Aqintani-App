"""
Test new features for iteration 16:
1. Vehicles (Armada Mobil Box) - CRUD operations
2. Role permissions - admin/manager/office_staff/cashier/canvasser
3. Audit log - activity trail
4. Partner stores vehicle assignment
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVehiclesCRUD:
    """Tests for /api/vehicles CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_get_vehicles_returns_list(self):
        """GET /api/vehicles returns vehicle list with existing 2 vehicles"""
        response = requests.get(f"{BASE_URL}/api/vehicles", headers=self.headers)
        assert response.status_code == 200
        vehicles = response.json()
        assert isinstance(vehicles, list)
        # Should have at least the 2 seed vehicles (Mobil Box 1, Mobil Box 2)
        assert len(vehicles) >= 2, f"Expected at least 2 vehicles, got {len(vehicles)}"
        # Check first vehicle has required fields
        if vehicles:
            v = vehicles[0]
            assert "id" in v
            assert "name" in v
            assert "plate_number" in v
        print(f"GET /api/vehicles: Found {len(vehicles)} vehicles - PASS")
    
    def test_create_vehicle(self):
        """POST /api/vehicles creates a new vehicle"""
        new_vehicle = {
            "name": "TEST_Vehicle_001",
            "plate_number": "T 1234 TEST",
            "area_route": "Rute Test Area",
            "driver_name": "Test Driver"
        }
        response = requests.post(f"{BASE_URL}/api/vehicles", json=new_vehicle, headers=self.headers)
        assert response.status_code == 200, f"Create failed: {response.text}"
        vehicle = response.json()
        assert vehicle["name"] == new_vehicle["name"]
        assert vehicle["plate_number"] == new_vehicle["plate_number"]
        assert vehicle["area_route"] == new_vehicle["area_route"]
        assert vehicle["driver_name"] == new_vehicle["driver_name"]
        assert "id" in vehicle
        
        # Verify it was persisted by fetching again
        get_response = requests.get(f"{BASE_URL}/api/vehicles", headers=self.headers)
        all_vehicles = get_response.json()
        found = [v for v in all_vehicles if v["name"] == "TEST_Vehicle_001"]
        assert len(found) == 1, "Created vehicle not found in list"
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/vehicles/{vehicle['id']}", headers=self.headers)
        assert delete_response.status_code == 200
        print("POST /api/vehicles: Create vehicle - PASS")
    
    def test_update_vehicle(self):
        """PUT /api/vehicles/{id} updates existing vehicle"""
        # First create a vehicle
        create_response = requests.post(f"{BASE_URL}/api/vehicles", json={
            "name": "TEST_Vehicle_Update",
            "plate_number": "U 5678 TEST",
            "area_route": "Original Route",
            "driver_name": "Original Driver"
        }, headers=self.headers)
        assert create_response.status_code == 200
        vehicle_id = create_response.json()["id"]
        
        # Update it
        update_data = {
            "name": "TEST_Vehicle_Updated",
            "plate_number": "U 9999 TEST",
            "area_route": "Updated Route",
            "driver_name": "Updated Driver"
        }
        update_response = requests.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", json=update_data, headers=self.headers)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated = update_response.json()
        assert updated["name"] == "TEST_Vehicle_Updated"
        assert updated["plate_number"] == "U 9999 TEST"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}", headers=self.headers)
        print("PUT /api/vehicles/{id}: Update vehicle - PASS")
    
    def test_delete_vehicle(self):
        """DELETE /api/vehicles/{id} deletes vehicle and unassigns partner stores"""
        # Create a vehicle
        create_response = requests.post(f"{BASE_URL}/api/vehicles", json={
            "name": "TEST_Vehicle_Delete",
            "plate_number": "D 1111 TEST"
        }, headers=self.headers)
        assert create_response.status_code == 200
        vehicle_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}", headers=self.headers)
        assert delete_response.status_code == 200
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/vehicles", headers=self.headers)
        all_vehicles = get_response.json()
        found = [v for v in all_vehicles if v["id"] == vehicle_id]
        assert len(found) == 0, "Deleted vehicle still exists"
        print("DELETE /api/vehicles/{id}: Delete vehicle - PASS")


class TestRolePermissions:
    """Tests for /api/role-permissions endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_get_role_permissions_returns_all_roles(self):
        """GET /api/role-permissions returns permissions for all roles"""
        response = requests.get(f"{BASE_URL}/api/role-permissions", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "permissions" in data
        assert "current_role" in data
        assert "current_permissions" in data
        
        # Check all 5 roles exist
        permissions = data["permissions"]
        assert "admin" in permissions
        assert "manager" in permissions
        assert "office_staff" in permissions
        assert "cashier" in permissions
        assert "canvasser" in permissions
        
        # Verify admin has 'users' permission (manager shouldn't)
        assert "users" in permissions["admin"]
        assert "users" not in permissions["manager"]
        
        # Verify vehicles and audit_log permissions
        assert "vehicles" in permissions["admin"]
        assert "audit_log" in permissions["admin"]
        assert "vehicles" in permissions["manager"]
        assert "audit_log" in permissions["manager"]
        
        print(f"GET /api/role-permissions: Admin has {len(permissions['admin'])} permissions - PASS")
    
    def test_current_user_permissions_for_admin(self):
        """Admin user gets admin-level permissions"""
        response = requests.get(f"{BASE_URL}/api/role-permissions", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["current_role"] == "admin"
        assert "users" in data["current_permissions"]
        assert "vehicles" in data["current_permissions"]
        assert "audit_log" in data["current_permissions"]
        print("GET /api/role-permissions: Admin current_permissions correct - PASS")


class TestAuditLog:
    """Tests for /api/audit-log endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_get_audit_log_returns_entries(self):
        """GET /api/audit-log returns audit log entries"""
        response = requests.get(f"{BASE_URL}/api/audit-log", headers=self.headers)
        assert response.status_code == 200
        logs = response.json()
        assert isinstance(logs, list)
        
        # Should have at least some entries from vehicle creation
        if logs:
            log = logs[0]
            assert "id" in log
            assert "user_name" in log
            assert "action" in log
            assert "entity_type" in log
            assert "timestamp" in log
        print(f"GET /api/audit-log: Found {len(logs)} entries - PASS")
    
    def test_audit_log_filter_by_entity_type(self):
        """GET /api/audit-log?entity_type=vehicle filters correctly"""
        response = requests.get(f"{BASE_URL}/api/audit-log?entity_type=vehicle", headers=self.headers)
        assert response.status_code == 200
        logs = response.json()
        
        # All returned logs should be for vehicle entity
        for log in logs:
            assert log["entity_type"] == "vehicle", f"Expected vehicle, got {log['entity_type']}"
        print(f"GET /api/audit-log?entity_type=vehicle: {len(logs)} vehicle entries - PASS")
    
    def test_vehicle_crud_creates_audit_entries(self):
        """Vehicle CRUD operations create audit log entries"""
        # Create vehicle (should log 'create')
        create_response = requests.post(f"{BASE_URL}/api/vehicles", json={
            "name": "TEST_Audit_Vehicle",
            "plate_number": "A 1111 AUDIT"
        }, headers=self.headers)
        assert create_response.status_code == 200
        vehicle_id = create_response.json()["id"]
        
        # Check audit log for create entry
        audit_response = requests.get(f"{BASE_URL}/api/audit-log?entity_type=vehicle", headers=self.headers)
        logs = audit_response.json()
        create_logs = [l for l in logs if l["action"] == "create" and l["entity_id"] == vehicle_id]
        assert len(create_logs) >= 1, "No create audit entry found"
        
        # Update vehicle (should log 'update')
        requests.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", json={
            "name": "TEST_Audit_Vehicle_Updated",
            "plate_number": "A 2222 AUDIT"
        }, headers=self.headers)
        
        audit_response = requests.get(f"{BASE_URL}/api/audit-log?entity_type=vehicle", headers=self.headers)
        logs = audit_response.json()
        update_logs = [l for l in logs if l["action"] == "update" and l["entity_id"] == vehicle_id]
        assert len(update_logs) >= 1, "No update audit entry found"
        
        # Delete vehicle (should log 'delete')
        requests.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}", headers=self.headers)
        
        audit_response = requests.get(f"{BASE_URL}/api/audit-log?entity_type=vehicle", headers=self.headers)
        logs = audit_response.json()
        delete_logs = [l for l in logs if l["action"] == "delete" and l["entity_id"] == vehicle_id]
        assert len(delete_logs) >= 1, "No delete audit entry found"
        
        print("Vehicle CRUD creates audit entries - PASS")


class TestPartnerStoresVehicleAssignment:
    """Tests for partner stores vehicle_id assignment"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_partner_store_accepts_vehicle_id(self):
        """Partner store creation/update accepts vehicle_id field"""
        # Get an existing vehicle
        vehicles_response = requests.get(f"{BASE_URL}/api/vehicles", headers=self.headers)
        vehicles = vehicles_response.json()
        assert len(vehicles) > 0, "No vehicles found"
        vehicle_id = vehicles[0]["id"]
        
        # Create partner store with vehicle_id
        store_data = {
            "name": "TEST_Store_With_Vehicle",
            "owner_name": "Test Owner",
            "phone": "08123456789",
            "address": "Test Address",
            "credit_limit": 1000000,
            "vehicle_id": vehicle_id
        }
        create_response = requests.post(f"{BASE_URL}/api/partner-stores", json=store_data, headers=self.headers)
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        store = create_response.json()
        assert store["vehicle_id"] == vehicle_id, f"vehicle_id not saved: {store.get('vehicle_id')}"
        store_id = store["id"]
        
        # Verify by fetching all stores
        stores_response = requests.get(f"{BASE_URL}/api/partner-stores", headers=self.headers)
        stores = stores_response.json()
        found = [s for s in stores if s["id"] == store_id]
        assert len(found) == 1
        assert found[0]["vehicle_id"] == vehicle_id
        
        # Update to different/no vehicle
        update_response = requests.put(f"{BASE_URL}/api/partner-stores/{store_id}", json={
            "name": "TEST_Store_With_Vehicle",
            "owner_name": "Test Owner",
            "phone": "08123456789",
            "address": "Test Address",
            "credit_limit": 1000000,
            "vehicle_id": ""  # Remove vehicle assignment
        }, headers=self.headers)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["vehicle_id"] == ""
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/partner-stores/{store_id}", headers=self.headers)
        print("Partner store vehicle_id assignment - PASS")


class TestUsersRoleOptions:
    """Tests for users endpoint with expanded role options"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for admin"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield
    
    def test_register_user_with_new_roles(self):
        """POST /api/auth/register accepts new role types"""
        roles_to_test = ["manager", "office_staff", "cashier", "canvasser"]
        created_users = []
        
        for role in roles_to_test:
            user_data = {
                "name": f"TEST_{role}_User",
                "email": f"test_{role}@test.com",
                "password": "test123",
                "role": role
            }
            response = requests.post(f"{BASE_URL}/api/auth/register", json=user_data, headers=self.headers)
            if response.status_code == 200:
                user = response.json()
                assert user["role"] == role, f"Role not set correctly: expected {role}, got {user['role']}"
                created_users.append(user["id"])
            elif response.status_code == 400 and "already registered" in response.text:
                # User might already exist from previous test
                pass
            else:
                pytest.fail(f"Failed to create user with role {role}: {response.text}")
        
        # Cleanup
        for user_id in created_users:
            requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
        
        print(f"Register user with roles {roles_to_test} - PASS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
