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
import { POS } from './pages/POS';
import { ReceiptPreview } from './pages/ReceiptPreview';
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
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="/pos" element={
            <PrivateRoute>
              <POS />
            </PrivateRoute>
          } />

          <Route path="/receipt-preview" element={
            <PrivateRoute>
              <ReceiptPreview />
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