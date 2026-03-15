import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import OrderPage from './pages/Order';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import type React from 'react';
import { initializeSuggestions } from '@/db/localDb';

const queryClient = new QueryClient();

// ── Route Guards ──────────────────────────────────────────────────────────────

const RequireAuth = ({ children }: { children: React.ReactElement }) => {
  const auth = localStorage.getItem('vdw_auth');
  return auth === 'true' ? children : <Navigate to="/login" replace />;
};

const RequireAdmin = ({ children }: { children: React.ReactElement }) => {
  const role = localStorage.getItem('vdw_role');
  return role === 'admin' ? children : <Navigate to="/order" replace />;
};

// ─────────────────────────────────────────────────────────────────────────────

const App = () => {
  useEffect(() => {
    initializeSuggestions();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* Auth required — both roles */}
          <Route
            path="/order"
            element={
              <RequireAuth>
                <OrderPage />
              </RequireAuth>
            }
          />


          {/* Admin only */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <Dashboard />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <Settings />
                </RequireAdmin>
              </RequireAuth>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
