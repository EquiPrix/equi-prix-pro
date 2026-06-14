import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();

    useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      // Detects when the user clicks the confirmation link token safely
      if (event === 'SIGNED_IN' || session) {
        // Forward them directly to your password setup page! 👇
        navigate('/reset-password'); 
      } else {
        navigate('/');
      }
    });
  }, [navigate]);


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0e0a]">
      <div className="font-cinzel text-xl tracking-widest text-[#b49530] animate-pulse">
        AUTHENTICATING ENTRY...
      </div>
    </div>
  );
}
