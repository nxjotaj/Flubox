import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./lib/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductsPage } from "./pages/ProductsPage";
import { SellersPage } from "./pages/SellersPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  DomainPage,
  NewOrderPage,
  NotificationsPage,
  ReportsPage,
  SearchPage,
} from "./pages/UtilityPages";
function Protected() {
  const { user } = useAuth();
  return user ? <AppShell /> : <Navigate to="/login" replace />;
}
function Admin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.role === "SELLER" ? (
    <Navigate to="/dashboard" replace />
  ) : (
    children
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Protected />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="catalog/products" element={<ProductsPage />} />
            <Route
              path="catalog/products/new"
              element={
                <Admin>
                  <ProductFormPage />
                </Admin>
              }
            />
            <Route
              path="catalog/products/:id"
              element={
                <Admin>
                  <ProductFormPage />
                </Admin>
              }
            />
            <Route
              path="catalog/inventory"
              element={<ProductsPage inventory />}
            />
            <Route
              path="catalog/exports"
              element={<ProductsPage exportsPage />}
            />
            <Route path="orders/new" element={<NewOrderPage />} />
            <Route path="operations/orders" element={<OrdersPage />} />
            <Route path="operations/orders/:id" element={<OrderDetailPage />} />
            <Route
              path="operations/payments"
              element={<OrdersPage mode="payments" />}
            />
            <Route
              path="operations/documents"
              element={<OrdersPage mode="documents" />}
            />
            <Route
              path="operations/shipping"
              element={
                <Admin>
                  <OrdersPage mode="shipping" />
                </Admin>
              }
            />
            <Route
              path="operations/cases"
              element={<DomainPage kind="cases" />}
            />
            <Route
              path="sellers"
              element={
                <Admin>
                  <SellersPage />
                </Admin>
              }
            />
            <Route path="messages" element={<DomainPage kind="messages" />} />
            <Route path="data/metrics" element={<ReportsPage />} />
            <Route path="data/reports" element={<ReportsPage />} />
            <Route
              path="data/audit"
              element={
                <Admin>
                  <DomainPage kind="audit" />
                </Admin>
              }
            />
            <Route
              path="settings/company"
              element={
                <Admin>
                  <SettingsPage section="company" />
                </Admin>
              }
            />
            <Route
              path="settings/addresses"
              element={<Navigate to="/settings/company" replace />}
            />
            <Route
              path="settings/pix"
              element={
                <Admin>
                  <SettingsPage section="pix" />
                </Admin>
              }
            />
            <Route
              path="settings/team"
              element={
                <Admin>
                  <SettingsPage section="team" />
                </Admin>
              }
            />
            <Route
              path="settings/security"
              element={
                <Admin>
                  <SettingsPage section="security" />
                </Admin>
              }
            />
            <Route
              path="settings/profile"
              element={<SettingsPage section="profile" />}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
