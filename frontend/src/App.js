import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import "@/App.css";

// Pages
import HomePage from "@/pages/HomePage";
import DemoPage from "@/pages/DemoPage";
import CustomerMenu from "@/pages/CustomerMenu";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminRegister from "@/pages/admin/AdminRegister";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import MenuManagement from "@/pages/admin/MenuManagement";
import TablesManagement from "@/pages/admin/TablesManagement";
import OrdersManagement from "@/pages/admin/OrdersManagement";
import PromotionManagement from "@/pages/admin/PromotionManagement";
import StoreSettings from "@/pages/admin/StoreSettings";
import PaymentSettings from "@/pages/admin/PaymentSettings";
import InventoryManagement from "@/pages/admin/InventoryManagement";
import StaffManagement from "@/pages/admin/StaffManagement";
import PricingPage from "@/pages/admin/PricingPage";
import SubscriptionManagement from "@/pages/admin/SubscriptionManagement";
import PaymentsManagement from "@/pages/admin/PaymentsManagement";
import SuperAdminDashboard from "@/pages/admin/SuperAdminDashboard";
import SuperAdminUsers from "@/pages/admin/SuperAdminUsers";
import SuperAdminStoreDetail from "@/pages/admin/SuperAdminStoreDetail";
import SuperAdminPayOS from "@/pages/admin/SuperAdminPayOS";
import AdminLayout from "@/components/AdminLayout";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { LoadingProvider } from "@/contexts/LoadingContext";

function App() {
  return (
    <LoadingProvider>
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Home Page */}
          <Route path="/" element={<HomePage />} />

          {/* Demo Page */}
          <Route path="/demo" element={<DemoPage />} />

          {/* Customer Routes */}
          <Route path="/menu/:storeSlug" element={<CustomerMenu />} />

          {/* Admin Auth Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/register" element={<AdminRegister />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="menu" element={<MenuManagement />} />
            <Route path="tables" element={<TablesManagement />} />
            <Route path="orders" element={<OrdersManagement />} />
            <Route path="inventory" element={<InventoryManagement />} />
            <Route path="staff" element={<StaffManagement />} />
            <Route path="promotions" element={<PromotionManagement />} />
            <Route path="payments" element={<PaymentSettings />} />
            <Route path="payment-history" element={<PaymentsManagement />} />
            <Route path="settings" element={<StoreSettings />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="subscription" element={<SubscriptionManagement />} />
          </Route>

          {/* Super Admin Routes */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute>
                <SuperAdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
            <Route path="dashboard" element={<SuperAdminDashboard />} />
            <Route path="users" element={<SuperAdminUsers />} />
            <Route path="payos" element={<SuperAdminPayOS />} />
            <Route path="stores/:storeId" element={<SuperAdminStoreDetail />} />
          </Route>
          <Route path="/super-admin/login" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
    </LoadingProvider>
  );
}

export default App;
