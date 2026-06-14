import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { sbFetch, EVENTS_2026 } from '@/lib/equiprix-data';
import { useAuth } from '@/lib/AuthContext';
import EquiPrixLogo from '@/components/equiprix/EquiPrixLogo';

export default function RoomPage() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const isManager = searchParams.get('mgr') === '1';
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadRoom(); }, [code]);

  useEffect(() => {
    if (room && user) {
      checkAndAutoJoin();
    }
  }, [room, user]);

  const loadRoom = async () => {
    setLoading(true);
    try {
      const rows = await sbFetch('rooms?join_code=eq.' + code + '&limit=1');
      if (!rows?.length) { setError('Room not found.'); setLoading(false); return; }
      setRoom(rows[0]);
      const mRows = await sbFetch('room_members?room_id=eq.' + rows[0].id + '&order=joined_at.asc');
      setMembers(mRows || []);
    } catch (e) {
      setError('Could not load room.');
    } finally {
      setLoading(false);
    }
  };

  const checkAndAutoJoin = async () => {
    if (!user?.email) return;
    // Check if already a member
    const existing = await sbFetch('room_members?room_id=eq.' + room.id + '&user_email=eq.' + encodeURIComponent(user.email) + '&limit=1');
    if (existing?.length) { setIsMember(true); return; }
    // Auto-join if came from invite link
    await joinRoom(true);
  };

  const joinRoom = async (auto = false) => {
    if (!user) {
      navigate('/?redirect=/room/' + code);
      return;
    }
    if (members.length >= room.max_size) { setError('This room is full.'); return; }
    if (!auto) setJoining(true);
    setError('');
    try {
      await sbFetch('room_members', {
        method: 'POST',
        body: JSON.stringify({
          room_id: room.id,
          user_email: user.email,
          username: user.user_metadata?.username || user.email.split('@')[0],
        })
      });
      setJoined(true);
      setIsMember(true);
      loadRoom();
    } catch (e) {
      if (e.message?.includes('unique')) {
        setIsMember(true);
      } else if (!auto) {
        setError('Could not join room.');
      }
    } finally {
      if (!auto) setJoining(false);
    }
  };

  const event = room ? EVENTS_2026.find(e => e.id === room.event_id) : null;
  const spotsLeft = room ? room.max_size - members.length : 0;

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--ink)' }}>
      <div className="font-cinzel text-sm tracking-widest animate-pulse" style={{ color: 'var(--gold)' }}>Loading…</div>
    </div>
  );

  if (error && !room) return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ background: 'var(--ink)' }}>
      <div className="text-center">
        <EquiPrixLogo width={160} />
        <p className="font-cormorant italic text-lg mt-6" style={{ color: 'var(--mid)' }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: 'var(--ink)' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="max-w-md mx-auto">

        <div className="flex justify-center mb-8"><EquiPrixLogo width={160} /></div>

        <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(180,149,48,0.25)', background: '#14130e' }}>
          <div className="px-6 py-5 text-center" style={{ borderBottom: '1px solid rgba(180,149,48,0.15)' }}>
            {room.is_sponsored && room.sponsor_name && (
              <div className="font-cinzel text-xs tracking-widest mb-2" style={{ color: 'var(--gold)', fontSize: 9 }}>
                PRESENTED BY {room.sponsor_name.toUpperCase()}
              </div>
            )}
            {room.is_sponsored && room.sponsor_logo_url && (
              <img src={room.sponsor_logo_url} alt={room.sponsor_name}
                style={{ height: 40, margin: '0 auto 12px', objectFit: 'contain' }} />
            )}
            <div className="font-cormorant text-2xl font-semibold" style={{ color: 'var(--cream)' }}>{room.name}</div>
            {event && (
              <div className="font-cinzel text-xs mt-1" style={{ color: 'var(--mid)', fontSize: 10, letterSpacing: '0.1em' }}>
                {event.flag} {event.city} · {event.dates}
              </div>
            )}
          </div>

          <div className="px-6 py-5">
            {room.prize_description && (
              <div className="rounded-lg px-4 py-3 mb-4 text-center"
                style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)' }}>
                <div className="font-cinzel text-xs mb-1" style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>PRIZE</div>
                <div className="font-cormorant text-base italic" style={{ color: 'var(--gold-lt)' }}>🏆 {room.prize_description}</div>
              </div>
            )}

            <div className="flex justify-between items-center mb-5">
              <div className="text-center">
                <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.1em' }}>MEMBERS</div>
                <div className="font-cormorant text-xl font-bold mt-0.5" style={{ color: 'var(--cream)' }}>{members.length}</div>
              </div>
              <div className="text-center">
                <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.1em' }}>SPOTS LEFT</div>
                <div className="font-cormorant text-xl font-bold mt-0.5"
                  style={{ color: spotsLeft === 0 ? '#e07070' : 'var(--gold-lt)' }}>{spotsLeft}</div>
              </div>
              <div className="text-center">
                <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.1em' }}>MAX SIZE</div>
                <div className="font-cormorant text-xl font-bold mt-0.5" style={{ color: 'var(--cream)' }}>{room.max_size}</div>
              </div>
            </div>

            {!user ? (
              <div>
                <button onClick={() => navigate('/?redirect=/room/' + code)}
                  className="w-full py-3 rounded font-cinzel text-xs tracking-widest"
                  style={{ background: 'var(--gold)', color: 'var(--ink)', letterSpacing: '0.1em' }}>
                  SIGN IN TO JOIN
                </button>
                <p className="font-cormorant italic text-xs text-center mt-2" style={{ color: 'var(--mid)' }}>
                  You need an EquiPrix account to join this room
                </p>
              </div>
            ) : isMember || joined ? (
              <div className="text-center">
                <div className="font-cormorant italic text-base mb-3" style={{ color: '#4caf7d' }}>
                  ✓ You're in this room
                </div>
                <button onClick={() => navigate('/play')}
                  className="w-full py-3 rounded font-cinzel text-xs tracking-widest"
                  style={{ background: 'var(--gold)', color: 'var(--ink)', letterSpacing: '0.1em' }}>
                  GO TO APP →
                </button>
              </div>
            ) : spotsLeft === 0 ? (
              <div className="text-center font-cormorant italic text-base" style={{ color: '#e07070' }}>This room is full.</div>
            ) : (
              <button onClick={() => joinRoom(false)} disabled={joining}
                className="w-full py-3 rounded font-cinzel text-xs tracking-widest transition-all"
                style={{ background: joining ? 'rgba(180,149,48,0.1)' : 'var(--gold)', color: joining ? 'var(--mid)' : 'var(--ink)', letterSpacing: '0.1em' }}>
                {joining ? 'JOINING…' : 'JOIN ROOM'}
              </button>
            )}
            {error && <p className="font-cormorant italic text-sm text-center mt-3" style={{ color: '#e07070' }}>{error}</p>}
          </div>
        </div>

        {(isMember || joined || isManager) && members.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(180,149,48,0.15)', background: '#14130e' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(180,149,48,0.1)' }}>
              <div className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)', fontSize: 9 }}>
                MEMBERS · {members.length}/{room.max_size}
              </div>
            </div>
            {members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-2.5"
                style={{ borderBottom: i < members.length - 1 ? '1px solid rgba(42,40,32,0.4)' : 'none' }}>
                <span className="font-cinzel text-xs w-5 text-center" style={{ color: 'var(--mid)', fontSize: 9 }}>{i + 1}</span>
                <span className="font-cormorant text-sm flex-1" style={{ color: 'var(--cream)' }}>
                  {m.username || m.user_email.split('@')[0]}
                </span>
                {m.user_email === room.manager_email && (
                  <span className="font-cinzel text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(180,149,48,0.1)', color: 'var(--gold)', fontSize: 8 }}>MGR</span>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-center font-cormorant italic text-xs mt-6" style={{ color: 'var(--mid)' }}>
          Powered by <span style={{ color: 'var(--gold-lt)' }}>EquiPrix</span>
        </p>
      </motion.div>
    </div>
  );
}
