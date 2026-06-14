import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from './lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import EquiPrix from './pages/EquiPrix';
import Admin from './pages/Admin';
import Splash from './pages/Splash';
import AuthCallback from './pages/AuthCallback';

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError } = useAuth();
  const navigate = useNavigate();

  // Show loading spinner while checking auth status
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0f0e0a]">
        <div className="text-center">
          <div className="font-cinzel text-xl tracking-widest text-[#b49530] animate-pulse">
            EQUIPRIX
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/play" element={<EquiPrix />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}
