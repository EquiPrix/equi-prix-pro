import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { EquiPrixProvider } from '@/lib/EquiPrixContext';
// Add page imports here
import EquiPrix from './pages/EquiPrix';
import Admin from './pages/Admin';
import Splash from './pages/Splash';
import AuthCallback from './pages/AuthCallback';


const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0f0e0a' }}>
        <div className="font-cinzel text-xl tracking-widest animate-pulse" style={{ color: '#b49530', letterSpacing: '0.3em', fontFamily: 'system-ui, sans-serif' }}>
          EQUIPRIX
        </div>
      </div>
    );
  }

  // Handle authentication errors
  /*
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }
*/
  return (
    <EquiPrixProvider>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/auth/callback" element={<AuthCallback />} /> 
        <Route path="/play" element={<EquiPrix />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </EquiPrixProvider>
  );
};


function App() {
    return (
    <AuthContext.Provider
      value={{
        // 1. Map properties to match your App.jsx naming style 👇
        user: currentUser,
        session: currentSession,
        loading: isAuthLoading,
        isLoadingAuth: isAuthLoading,             // 👈 ADD THIS MATCHING LINE
        authError: null,                          // 👈 ADD THIS MATCHING LINE
        navigateToLogin: () => window.location.href = '/', // 👈 ADD THIS MATCHING LINE
        
        signUp,
        signIn,
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        isAuthenticated: !!currentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );

}

export default App