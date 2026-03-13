"""
Test Iteration 25 - Testing 4 User-Requested Changes
1. Print server download endpoint (Windows service support)
2. DailyTransactions continuous numbering (code review - no data to test)
3. PDF export portrait orientation with showFoot: 'lastPage' (code review)
4. 'Hutang ke Supplier' label change (UI verified)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Test admin and cashier login"""
    
    def test_admin_login(self):
        """Admin login should succeed"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print("PASS: Admin login successful")
    
    def test_cashier_login(self):
        """Cashier login should succeed"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kasir@aqintani.com",
            "password": "kasir123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "cashier"
        print("PASS: Cashier login successful")


class TestPrintServerDownload:
    """Test Feature 1: Print server download endpoint with Windows service support"""
    
    def test_print_server_download_endpoint_exists(self):
        """GET /api/download/print-server should return the print_server.py file"""
        response = requests.get(f"{BASE_URL}/api/download/print-server")
        assert response.status_code == 200
        print(f"PASS: Print server download endpoint returned HTTP 200")
    
    def test_print_server_contains_windows_service_code(self):
        """Downloaded file should contain Windows service class"""
        response = requests.get(f"{BASE_URL}/api/download/print-server")
        assert response.status_code == 200
        content = response.text
        
        # Check for Windows service support code
        assert "win32serviceutil" in content
        assert "AqinTaniPrintService" in content
        assert "_svc_name_" in content
        assert "install" in content
        assert "start" in content
        assert "stop" in content
        assert "remove" in content
        print("PASS: Print server file contains Windows service code")
    
    def test_print_server_content_disposition_header(self):
        """Download should have correct content-disposition header"""
        response = requests.get(f"{BASE_URL}/api/download/print-server")
        assert response.status_code == 200
        content_disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disposition
        assert "print_server.py" in content_disposition
        print("PASS: Print server download has correct headers")


class TestDailyTransactionsAPI:
    """Test Feature 2: Daily transactions API endpoint"""
    
    @pytest.fixture
    def cashier_token(self):
        """Get cashier authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "kasir@aqintani.com",
            "password": "kasir123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Cashier authentication failed")
    
    def test_daily_transactions_endpoint(self, cashier_token):
        """GET /api/pos/daily-transactions should return transaction data"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        response = requests.get(f"{BASE_URL}/api/pos/daily-transactions?date=2026-03-13", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "transactions" in data
        assert "farmer_transactions" in data
        assert "count" in data
        assert "total_sales" in data
        assert "farmer_count" in data
        assert "grand_total" in data
        print(f"PASS: Daily transactions endpoint works, found {data['count']} cash transactions and {data['farmer_count']} farmer transactions")


class TestSupplierDebtsAPI:
    """Test Feature 4: Supplier debts API (label changed in UI)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_supplier_debts_overview(self, admin_token):
        """GET /api/supplier-debts/overview should return supplier list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/supplier-debts/overview", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Supplier debts overview returned {len(data)} suppliers")
    
    def test_supplier_debts_summary(self, admin_token):
        """GET /api/supplier-debts/summary should return summary stats"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/supplier-debts/summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_debt" in data
        assert "suppliers_with_debt" in data
        assert "total_paid_this_month" in data
        print(f"PASS: Supplier debts summary - Total debt: {data['total_debt']}, Suppliers with debt: {data['suppliers_with_debt']}")


class TestReportsAPI:
    """Test Feature 3: Reports API (PDF export uses portrait orientation)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@aqintani.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_sales_detail_report(self, admin_token):
        """GET /api/reports/sales-detail should return POS sales data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/sales-detail?date_from=2026-01-01&date_to=2026-03-13", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data
        assert "total_sales" in data
        assert "total_cost" in data
        assert "total_margin" in data
        print(f"PASS: Sales detail report returned {len(data['rows'])} rows")
    
    def test_partner_sales_report(self, admin_token):
        """GET /api/reports/partner-sales-detail should return partner sales data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/partner-sales-detail?date_from=2026-01-01&date_to=2026-03-13", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data
        print(f"PASS: Partner sales report returned {len(data['rows'])} rows")
    
    def test_best_sellers_report(self, admin_token):
        """GET /api/reports/best-sellers should return bestseller data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/best-sellers?date_from=2026-01-01&date_to=2026-03-13", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data
        print(f"PASS: Best sellers report returned {len(data['rows'])} products")
    
    def test_profit_loss_report(self, admin_token):
        """GET /api/reports/profit-loss should return profit/loss data"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/reports/profit-loss?date_from=2026-01-01&date_to=2026-03-13", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure for profit/loss report
        assert "pos_revenue" in data
        assert "partner_revenue" in data
        assert "total_revenue" in data
        assert "total_cogs" in data
        assert "gross_profit" in data
        assert "margin_percent" in data
        print(f"PASS: Profit/loss report - Total revenue: {data['total_revenue']}, Gross profit: {data['gross_profit']}")


# Code review verification tests
class TestCodeReview:
    """Verify code changes through analysis"""
    
    def test_daily_transactions_running_number_logic(self):
        """Verify DailyTransactions.js has continuous numbering logic"""
        frontend_file = "/app/frontend/src/pages/DailyTransactions.js"
        with open(frontend_file, "r") as f:
            content = f.read()
        
        # Check for running number logic
        assert "runningNo" in content, "Missing runningNo variable"
        assert "txnStartNos" in content, "Missing txnStartNos calculation"
        assert "farmerTxnStartNos" in content, "Missing farmerTxnStartNos calculation"
        assert "txnStartNos[txnIdx] + idx" in content, "Missing continuous numbering in cash transactions table"
        assert "farmerTxnStartNos[txnIdx] + idx" in content, "Missing continuous numbering in farmer transactions table"
        print("PASS: DailyTransactions.js has continuous numbering logic")
    
    def test_reports_pdf_portrait_orientation(self):
        """Verify Reports.js uses portrait orientation for PDF export"""
        frontend_file = "/app/frontend/src/pages/Reports.js"
        with open(frontend_file, "r") as f:
            content = f.read()
        
        # Check for portrait orientation
        assert "orientation: 'portrait'" in content, "PDF export should use portrait orientation"
        # Verify it's not landscape
        assert "orientation: 'landscape'" not in content, "PDF export should NOT use landscape orientation"
        print("PASS: Reports.js uses portrait orientation for PDF export")
    
    def test_reports_pdf_showfoot_lastpage(self):
        """Verify Reports.js uses showFoot: 'lastPage' for totals"""
        frontend_file = "/app/frontend/src/pages/Reports.js"
        with open(frontend_file, "r") as f:
            content = f.read()
        
        # Check for showFoot: 'lastPage'
        assert "showFoot: 'lastPage'" in content, "PDF export should use showFoot: 'lastPage'"
        print("PASS: Reports.js uses showFoot: 'lastPage' for totals on last page only")
    
    def test_supplier_debt_label_change(self):
        """Verify SupplierDebt.js has 'Hutang ke Supplier' label"""
        frontend_file = "/app/frontend/src/pages/SupplierDebt.js"
        with open(frontend_file, "r") as f:
            content = f.read()
        
        # Check for correct label
        assert "Hutang ke Supplier" in content, "Should have 'Hutang ke Supplier' label"
        # Verify old label is not present
        assert "Supplier Berhutang" not in content, "Should NOT have 'Supplier Berhutang' label"
        print("PASS: SupplierDebt.js has 'Hutang ke Supplier' label")
    
    def test_print_server_windows_service_support(self):
        """Verify print_server.py has Windows service support"""
        server_file = "/app/print_server.py"
        with open(server_file, "r") as f:
            content = f.read()
        
        # Check for Windows service code
        assert "win32serviceutil" in content, "Should import win32serviceutil"
        assert "AqinTaniPrintService" in content, "Should have AqinTaniPrintService class"
        assert "_svc_name_" in content, "Should have service name"
        assert "_svc_display_name_" in content, "Should have display name"
        assert "install" in content, "Should support install command"
        assert "start" in content, "Should support start command"
        assert "stop" in content, "Should support stop command"
        assert "remove" in content, "Should support remove command"
        print("PASS: print_server.py has Windows service support")
