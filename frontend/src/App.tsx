import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AssetsPage } from './pages/AssetsPage';
import { UsersPage } from './pages/UsersPage';
import { KPIPage } from './pages/KPIPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { ZonesPage } from './pages/ZonesPage';
import { InventoryPage } from './pages/InventoryPage';
import { MaintenancePlansPage } from './pages/MaintenancePlansPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { RCAPage } from './pages/RCAPage';
import { DeveloperOptions } from './pages/DeveloperOptions';
import { RequestPortal } from './pages/RequestPortal';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/request" element={<RequestPortal />} />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/assets" 
            element={
              <ProtectedRoute>
                <Layout>
                  <AssetsPage />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/inventory" 
            element={
              <ProtectedRoute>
                <Layout>
                  <InventoryPage />
                </Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/maintenance-plans" 
            element={
              <ProtectedRoute>
                <Layout>
                  <MaintenancePlansPage />
                </Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/purchase-orders" 
            element={
              <ProtectedRoute>
                <Layout>
                  <PurchaseOrdersPage />
                </Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/users" 
            element={
              <ProtectedRoute>
                <Layout>
                  <UsersPage />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/kpis" 
            element={
              <ProtectedRoute>
                <Layout>
                  <KPIPage />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/zones" 
            element={
              <ProtectedRoute>
                <Layout>
                  <ZonesPage />
                </Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/permissions" 
            element={
              <ProtectedRoute>
                <Layout>
                  <PermissionsPage />
                </Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/rca" 
            element={
              <ProtectedRoute>
                <Layout>
                  <RCAPage />
                </Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Layout>
                  <SettingsPage />
                </Layout>
              </ProtectedRoute>
            } 
          />

          <Route path="/developer-options" element={<DeveloperOptions />} />
          
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
