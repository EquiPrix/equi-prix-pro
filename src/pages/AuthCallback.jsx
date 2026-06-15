import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          // Save user profile on first login
          await registerUserProfile(session.user);
        }

        const redirectTo = searchParams.get('redirect') || '/play';
        navigate(redirectTo, { replace: true });
      } catch (e) {
        console.error('Auth callback error:', e);
        navigate('/', { replace: true });
      }
    };

    handleCallback();
  }, []);

  return null;
}

async function registerUserProfile(user) {
  try {
    const email = user.email;
    const username = user.user_metadata?.username ||
      user.user_metadata?.full_name ||
      email.split('@')[0];

    // Upsert — safe to call on every login, only inserts once
    await supabase.from('user_profiles').upsert({
      email,
      username,
      email_notifications: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email', ignoreDuplicates: false });
  } catch (e) {
    // Non-fatal — don't block login
    console.warn('Could not register user profile:', e);
  }
}