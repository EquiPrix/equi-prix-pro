import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { EquiPrixProvider } from '@/lib/EquiPrixContext';
import EquiPrix from './pages/EquiPrix';
import Admin from './pages/Admin';
import Splash from './pages/Splash';
import AuthCallback from './pages/AuthCallback';
import ResetPassword from './pages/ResetPassword';
import Terms from './pages/Terms';
import RoomPage from './pages/RoomPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

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
    <EquiPrixProvider>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="/play" element={<EquiPrix />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </EquiPrixProvider>
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