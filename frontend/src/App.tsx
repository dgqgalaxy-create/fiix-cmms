import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { syncOfflineQueue } from './utils/offlineSync';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const AssetsPage = lazy(() => import('./pages/AssetsPage').then((m) => ({ default: m.AssetsPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const KPIPage = lazy(() => import('./pages/KPIPage').then((m) => ({ default: m.KPIPage })));
const PermissionsPage = lazy(() =>
  import('./pages/PermissionsPage').then((m) => ({ default: m.PermissionsPage }))
);
const InventoryPage = lazy(() =>
  import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage }))
);
const MaintenancePlansPage = lazy(() =>
  import('./pages/MaintenancePlansPage').then((m) => ({ default: m.MaintenancePlansPage }))
);
const PurchaseOrdersPage = lazy(() =>
  import('./pages/PurchaseOrdersPage').then((m) => ({ default: m.PurchaseOrdersPage }))
);
const RCAPage = lazy(() => import('./pages/RCAPage').then((m) => ({ default: m.RCAPage })));
const RequestPortal = lazy(() =>
  import('./pages/RequestPortal').then((m) => ({ default: m.RequestPortal }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage }))
);
const UserManual = lazy(() => import('./pages/UserManual').then((m) => ({ default: m.UserManual })));
const DailyChecklistsPage = lazy(() => import('./pages/DailyChecklistsPage'));
const ChecklistFormPage = lazy(() => import('./pages/ChecklistFormPage'));
const RosterPage = lazy(() => import('./pages/RosterPage').then((m) => ({ default: m.RosterPage })));
const NotesPage = lazy(() => import('./pages/NotesPage'));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm font-medium text-slate-500">
      Cargando…
    </div>
  );
}

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

    // Sync en segundo plano: no bloquea el render ni las listas (GET nunca se encola).
    const handleOnline = () => {
      void syncOfflineQueue();
    };

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
          <Suspense fallback={<PageFallback />}>
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
            path="/notes"
            element={
              <ProtectedRoute>
                <Layout>
                  <NotesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/zones"
            element={<Navigate to="/assets?manageZones=1" replace />}
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
          </Suspense>
      </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
