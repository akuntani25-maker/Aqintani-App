import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { AdminLayout } from './components/AdminLayout';
import { Toaster } from './components/ui/sonner';
import './App.css';

// Each page is its own chunk: the browser only downloads the page being opened,
// and heavy libraries (jsPDF, html2canvas, charts) load only with the pages that use them.
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Products = lazy(() => import('./pages/Products').then(m => ({ default: m.Products })));
const Categories = lazy(() => import('./pages/Categories').then(m => ({ default: m.Categories })));
const Suppliers = lazy(() => import('./pages/Suppliers').then(m => ({ default: m.Suppliers })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const StoreSettings = lazy(() => import('./pages/StoreSettings').then(m => ({ default: m.StoreSettings })));
const PartnerStores = lazy(() => import('./pages/PartnerStores').then(m => ({ default: m.PartnerStores })));
const PartnerStoreDetail = lazy(() => import('./pages/PartnerStoreDetail').then(m => ({ default: m.PartnerStoreDetail })));
const PartnerOrders = lazy(() => import('./pages/PartnerOrders').then(m => ({ default: m.PartnerOrders })));
const PartnerOrderReceipt = lazy(() => import('./pages/PartnerOrderReceipt').then(m => ({ default: m.PartnerOrderReceipt })));
const Canvassers = lazy(() => import('./pages/Canvassers').then(m => ({ default: m.Canvassers })));
const POS = lazy(() => import('./pages/POS').then(m => ({ default: m.POS })));
const ReceiptPreview = lazy(() => import('./pages/ReceiptPreview').then(m => ({ default: m.ReceiptPreview })));
const CanvasserDashboard = lazy(() => import('./pages/CanvasserDashboard').then(m => ({ default: m.CanvasserDashboard })));
const SupplierDebt = lazy(() => import('./pages/SupplierDebt').then(m => ({ default: m.SupplierDebt })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const ImportData = lazy(() => import('./pages/ImportData'));
const Vehicles = lazy(() => import('./pages/Vehicles').then(m => ({ default: m.Vehicles })));
const VehicleStock = lazy(() => import('./pages/VehicleStock').then(m => ({ default: m.VehicleStock })));
const AuditLog = lazy(() => import('./pages/AuditLog').then(m => ({ default: m.AuditLog })));
const PersonalLoans = lazy(() => import('./pages/PersonalLoans').then(m => ({ default: m.PersonalLoans })));
const FarmerDebts = lazy(() => import('./pages/FarmerDebts').then(m => ({ default: m.FarmerDebts })));
const DailyTransactions = lazy(() => import('./pages/DailyTransactions').then(m => ({ default: m.DailyTransactions })));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/admin" element={
            <PrivateRoute requireAdmin={true}>
              <AdminLayout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="categories" element={<Categories />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="supplier-debts" element={<SupplierDebt />} />
            <Route path="partner-stores" element={<PartnerStores />} />
            <Route path="partner-stores/:storeId" element={<PartnerStoreDetail />} />
            <Route path="partner-orders" element={<PartnerOrders />} />
            <Route path="canvassers" element={<Canvassers />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<Users />} />
            <Route path="store-settings" element={<StoreSettings />} />
            <Route path="settings" element={<Settings />} />
            <Route path="import-data" element={<ImportData />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="vehicle-stock" element={<VehicleStock />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="personal-loans" element={<PersonalLoans />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="/pos" element={
            <PrivateRoute>
              <POS />
            </PrivateRoute>
          } />

          <Route path="/pos/farmer-debts" element={
            <PrivateRoute>
              <FarmerDebts />
            </PrivateRoute>
          } />

          <Route path="/pos/daily-transactions" element={
            <PrivateRoute>
              <DailyTransactions />
            </PrivateRoute>
          } />

          <Route path="/canvasser" element={
            <PrivateRoute requireCanvasser={true}>
              <CanvasserDashboard />
            </PrivateRoute>
          } />

          <Route path="/receipt-preview" element={
            <PrivateRoute>
              <ReceiptPreview />
            </PrivateRoute>
          } />

          <Route path="/partner-receipt" element={
            <PrivateRoute>
              <PartnerOrderReceipt />
            </PrivateRoute>
          } />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;