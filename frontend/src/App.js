import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { AdminLayout } from './components/AdminLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Categories } from './pages/Categories';
import { Suppliers } from './pages/Suppliers';
import { Reports } from './pages/Reports';
import { Users } from './pages/Users';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { StoreSettings } from './pages/StoreSettings';
import { PartnerStores } from './pages/PartnerStores';
import { PartnerStoreDetail } from './pages/PartnerStoreDetail';
import { PartnerOrders } from './pages/PartnerOrders';
import { PartnerOrderReceipt } from './pages/PartnerOrderReceipt';
import { Canvassers } from './pages/Canvassers';
import { POS } from './pages/POS';
import { ReceiptPreview } from './pages/ReceiptPreview';
import { CanvasserDashboard } from './pages/CanvasserDashboard';
import { Purchases } from './pages/Purchases';
import { Analytics } from './pages/Analytics';
import { Toaster } from './components/ui/sonner';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            <Route path="purchases" element={<Purchases />} />
            <Route path="partner-stores" element={<PartnerStores />} />
            <Route path="partner-stores/:storeId" element={<PartnerStoreDetail />} />
            <Route path="partner-orders" element={<PartnerOrders />} />
            <Route path="canvassers" element={<Canvassers />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<Users />} />
            <Route path="store-settings" element={<StoreSettings />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="/pos" element={
            <PrivateRoute>
              <POS />
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
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;