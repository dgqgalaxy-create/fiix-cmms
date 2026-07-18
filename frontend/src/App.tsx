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
import { HomePage } from './pages/HomePage';
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
    // Nueva sesión del navegador (cierres de todas las pestañas / apertura en frío):
    // aterrizar siempre en Inicio, salvo portal público o deep links (OT, activo, ítem).
    const isNewSession = !sessionStorage.getItem('session_initialized');
    if (isNewSession) {
      sessionStorage.setItem('session_initialized', 'true');
      const token = localStorage.getItem('token');
      const path = window.location.pathname;
      const search = window.location.search;
      const isPublic = path === '/request' || path === '/manual';
      const isDeepLink =
        /[?&](wo|folio|asset|item)=/.test(search);
      if (token && !isPublic && !isDeepLink && path !== '/home') {
        window.location.replace('/home');
      }
    }

    const handleOnline = async () => {
      const requests = await getOfflineRequests();
      for (const req of requests) {
        try {
          // axios "crudo" (sin interceptor offline de `api`) para no re-encolar.
          const headers: Record<string, string> = { ...(req.headers || {}) };
          if (req.body && typeof req.body === 'object' && !(req.body instanceof FormData)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
          }
          await axios({
            url: req.url,
            method: req.method,
            headers,
            data: req.body,
          });
          await removeOfflineRequest(req.id);
        } catch (error) {
          console.error(`Failed to sync offline request ${req.id}`, error);
        }
      }
      window.dispatchEvent(new Event('fiix-offline-sync-done'));
    };

    // Si ya hay red al montar y hay cola pendiente, sincronizar.
    if (navigator.onLine) {
      handleOnline();
    }

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
            path="/home"
            element={
              <ProtectedRoute>
                <Layout>
                  <HomePage />
                </Layout>
              </ProtectedRoute>
            }
          />

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

          <Route path="/" element={<Navigate to="/home" replace />} />
          
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
