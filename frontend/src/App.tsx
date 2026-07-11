import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import axios from 'axios';
import { getOfflineRequests, removeOfflineRequest } from './utils/offlineQueue';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
import { RequestPortal } from './pages/RequestPortal';
import { SettingsPage } from './pages/SettingsPage';
import { CalendarPage } from './pages/CalendarPage';
import { UserManual } from './pages/UserManual';
import DailyChecklistsPage from './pages/DailyChecklistsPage';
import ChecklistFormPage from './pages/ChecklistFormPage';
import { RosterPage } from './pages/RosterPage';

function App() {
  useEffect(() => {
    // Verificamos si es una nueva sesión del navegador
    const isNewSession = !sessionStorage.getItem('session_initialized');
    if (isNewSession) {
      sessionStorage.setItem('session_initialized', 'true');
      const token = localStorage.getItem('token');
      // Si el usuario está autenticado, lo redirigimos al dashboard
      if (token && window.location.pathname !== '/dashboard') {
        window.location.href = '/dashboard';
      }
    }

    const handleOnline = async () => {
      // App is back online, syncing requests...
      const requests = await getOfflineRequests();
      for (const req of requests) {
        try {
          // If the request was multipart/form-data (like FormData), we can't easily rebuild it from IDB 
          // unless we serialized it correctly. For now, assuming simple JSON POST requests.
          await axios({
            url: req.url,
            method: req.method,
            headers: req.headers,
            data: req.body,
          });
          await removeOfflineRequest(req.id);
          // Synced offline request
        } catch (error) {
          console.error(`Failed to sync offline request ${req.id}`, error);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
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
            path="/calendar" 
            element={
              <ProtectedRoute>
                <Layout>
                  <CalendarPage />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/roster" 
            element={
              <ProtectedRoute>
                <Layout>
                  <RosterPage />
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
            path="/checklists" 
            element={
              <ProtectedRoute>
                <Layout>
                  <DailyChecklistsPage />
                </Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/checklists/:id" 
            element={
              <ProtectedRoute>
                <Layout>
                  <ChecklistFormPage />
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
          
          <Route path="/manual" element={<UserManual />} />

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

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
