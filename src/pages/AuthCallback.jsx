import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase automatically picks up the token parameters from the URL
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Logged in! Redirect straight to your leaderboard game page
        navigate('/play'); 
      } else {
        // If something fails, send them back to the splash page
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
