import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { EVENTS_2026 } from '@/lib/equiprix-data';
import { X, Save, LogOut, Key, Bell, BellOff, DoorOpen } from 'lucide-react';

export default function AccountModal({ onClose }) {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [error, setError] = useState('');

  const [showRequest, setShowRequest] = useState(false);
  const [reqEvent, setReqEvent] = useState('');
  const [reqName, setReqName] = useState('');
  const [reqMax, setReqMax] = useState(20);
  const [reqPrize, setReqPrize] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqSending, setReqSending] = useState(false);
  const [reqResult, setReqResult] = useState(null);

  useEffect(() => {
    const meta = user?.user_metadata;
    setUsername(meta?.username || meta?.access_code || user?.email?.split('@')[0] || '');
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user?.email) return;
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('email_notifications')
        .eq('email', user.email)
        .single();
      if (data) setEmailNotifications(data.email_notifications ?? true);
    } catch (e) {
      // Profile may not exist yet — default to true
    }
  };

  const saveUsername = async () => {
    if (!username.trim()) return;
    setSaving(true);
    setError('');
    try {
      const trimmed = username.trim();
      const { error } = await supabase.auth.updateUser({
        data: { username: trimmed }
      });
      if (error) throw error;

      await supabase.from('user_profiles')
        .upsert({ email: user.email, username: trimmed, updated_at: new Date().toISOString() },
          { onConflict: 'email' });

      await supabase.from('picks')
        .update({ username: trimmed })
        .eq('user_email', user.email);

      await supabase.from('room_members')
        .update({ username: trimmed })
        .eq('user_email', user.email);

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveNotificationPref = async (value) => {
    setEmailNotifications(value);
    setSavingPrefs(true);
    try {
      await supabase.from('user_profiles')
        .upsert({
          email: user.email,
          email_notifications: value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  const sendPasswordReset = async () => {
    try {
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setResetSent(true);
    } catch (e) {
      setError(e.message);
    }
  };

  const submitRequest = async () => {
    if (!reqEvent) return;
    setReqSending(true);
    setReqResult(null);
    try {
      const res = await fetch('/api/send-room-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestorEmail: user?.email || '',
          requestorName: user?.user_metadata?.username || user?.email?.split('@')[0] || '',
          eventName: reqEvent,
          maxMembers: reqMax,
          roomName: reqName,
          prizeIdea: reqPrize || null,
          notes: reqNotes || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReqResult({ success: true });
        setReqEvent(''); setReqName(''); setReqMax(20); setReqPrize(''); setReqNotes('');
      } else {
        setReqResult({ success: false, msg: data.error || data.warn });
      }
    } catch (e) { setReqResult({ success: false, msg: e.message }); }
    finally { setReqSending(false); }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(180,149,48,0.2)',
    color: 'var(--cream)',
    borderRadius: 4,
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm rounded-xl p-6 overflow-y-auto"
          style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.25)', maxHeight: '90vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-cinzel text-sm tracking-widest" style={{ color: 'var(--gold)' }}>MY ACCOUNT</div>
              <div className="font-cormorant italic text-xs mt-0.5" style={{ color: 'var(--mid)' }}>{user?.email}</div>
            </div>
            <button onClick={onClose} style={{ color: 'var(--mid)' }}><X size={16} /></button>
          </div>

          <div className="mb-5">
            <label className="font-cinzel text-xs tracking-widest mb-2 block" style={{ color: 'var(--gold-lt)', fontSize: 9 }}>
              DISPLAY NAME
            </label>
            <div className="flex gap-2">
              <input value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveUsername()}
                placeholder="Your name on the leaderboard"
                className="flex-1 rounded px-3 py-2 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--cream)', fontSize: '16px' }} />
              <button onClick={saveUsername} disabled={saving}
                className="px-3 py-2 rounded font-cinzel text-xs flex items-center gap-1.5 transition-all"
                style={{ background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)', color: saved ? '#4caf7d' : 'var(--ink)', border: saved ? '1px solid #4caf7d' : 'none', minWidth: 64 }}>
                <Save size={12} />
                {saved ? '✓' : saving ? '…' : 'Save'}
              </button>
            </div>
            <p className="font-cormorant italic text-xs mt-1.5" style={{ color: 'var(--mid)' }}>
              This is how you appear on the leaderboard
            </p>
          </div>

          <div style={{ borderTop: '1px solid rgba(42,40,32,0.6)', margin: '20px 0' }} />

          <div className="mb-5">
            <label className="font-cinzel text-xs tracking-widest mb-3 block" style={{ color: 'var(--gold-lt)', fontSize: 9 }}>
              EMAIL NOTIFICATIONS
              {prefSaved && <span className="ml-2" style={{ color: '#4caf7d' }}>✓ Saved</span>}
            </label>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(180,149,48,0.15)' }}>
              <div className="flex items-center gap-2">
                {emailNotifications
                  ? <Bell size={14} style={{ color: 'var(--gold)' }} />
                  : <BellOff size={14} style={{ color: 'var(--mid)' }} />}
                <div>
                  <div className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>
                    {emailNotifications ? 'Notifications on' : 'Notifications off'}
                  </div>
                  <div className="font-cormorant italic text-xs" style={{ color: 'var(--mid)' }}>
                    {emailNotifications ? 'Receive event updates and results' : 'You won\'t receive event emails'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => saveNotificationPref(!emailNotifications)}
                disabled={savingPrefs}
                className="font-cinzel text-xs px-3 py-1.5 rounded transition-all"
                style={{
                  background: emailNotifications ? 'rgba(224,112,112,0.1)' : 'rgba(76,175,125,0.1)',
                  border: `1px solid ${emailNotifications ? 'rgba(224,112,112,0.3)' : 'rgba(76,175,125,0.3)'}`,
                  color: emailNotifications ? '#e07070' : '#4caf7d',
                  fontSize: 9, letterSpacing: '0.08em'
                }}>
                {savingPrefs ? '…' : emailNotifications ? 'UNSUBSCRIBE' : 'SUBSCRIBE'}
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(42,40,32,0.6)', margin: '20px 0' }} />

          {/* Request a Private Room — moved here from the Leaderboard
              tab's My Rooms section, since it's an account-level action
              rather than something tied to viewing a specific event's
              standings, and was confusing people sitting next to room
              leaderboards. */}
          <div className="mb-5">
            <button onClick={() => { setShowRequest(p => !p); setReqResult(null); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all"
              style={{ background: showRequest ? 'rgba(180,149,48,0.1)' : 'rgba(180,149,48,0.04)', border: '1px solid rgba(180,149,48,0.2)' }}>
              <div className="flex items-center gap-2">
                <DoorOpen size={14} style={{ color: 'var(--gold)' }} />
                <div>
                  <div className="font-cinzel text-xs text-left" style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>REQUEST A PRIVATE ROOM</div>
                  <div className="font-cormorant italic text-xs text-left mt-0.5" style={{ color: 'var(--mid)' }}>Ask EquiPrix to create a room for your group</div>
                </div>
              </div>
              <span className="font-cinzel text-xs" style={{ color: 'var(--gold)', fontSize: 12 }}>{showRequest ? '▲' : '+'}</span>
            </button>

            {showRequest && (
              <div className="mt-3 space-y-3">
                {reqResult?.success ? (
                  <div className="px-4 py-4 rounded-lg text-center" style={{ background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)' }}>
                    <div className="text-2xl mb-2">🏇</div>
                    <div className="font-cormorant text-base font-semibold mb-1" style={{ color: '#4caf7d' }}>Request sent!</div>
                    <div className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>We'll create your room and send you the invite link shortly.</div>
                    <button onClick={() => { setShowRequest(false); setReqResult(null); }}
                      className="mt-3 font-cinzel text-xs px-4 py-1.5 rounded"
                      style={{ background: 'rgba(76,175,125,0.15)', color: '#4caf7d', border: '1px solid rgba(76,175,125,0.3)', letterSpacing: '0.08em' }}>
                      CLOSE
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="font-cinzel text-xs block mb-1" style={{ color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>EVENT *</label>
                      <select value={reqEvent} onChange={e => setReqEvent(e.target.value)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,149,48,0.2)', color: reqEvent ? 'var(--cream)' : 'var(--mid)', borderRadius: 4, padding: '8px 12px', fontSize: 13, outline: 'none' }}>
                        <option value="">— Select Event —</option>
                        {EVENTS_2026.map(ev => <option key={ev.id} value={`${ev.flag} ${ev.city} · ${ev.dates}`}>{ev.flag} {ev.city} · {ev.dates}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="font-cinzel text-xs block mb-1" style={{ color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>ROOM NAME</label>
                      <input value={reqName} onChange={e => setReqName(e.target.value)}
                        placeholder="e.g. My Barn League"
                        style={{ ...inputStyle, fontSize: '16px' }} />
                    </div>
                    <div>
                      <label className="font-cinzel text-xs block mb-1" style={{ color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>MAX MEMBERS</label>
                      <div className="flex gap-2">
                        {[10, 25, 50, 100].map(n => (
                          <button key={n} onClick={() => setReqMax(n)}
                            className="flex-1 py-2 rounded font-cinzel text-xs transition-all"
                            style={{ background: reqMax === n ? 'var(--gold)' : 'rgba(255,255,255,0.04)', color: reqMax === n ? 'var(--ink)' : 'var(--mid)', border: `1px solid ${reqMax === n ? 'var(--gold)' : 'rgba(180,149,48,0.2)'}`, fontSize: 10 }}>
                            {n}
                          </button>
                        ))}
                        <button onClick={() => setReqMax(999)}
                          className="flex-1 py-2 rounded font-cinzel text-xs transition-all"
                          style={{ background: reqMax === 999 ? 'var(--gold)' : 'rgba(255,255,255,0.04)', color: reqMax === 999 ? 'var(--ink)' : 'var(--mid)', border: `1px solid ${reqMax === 999 ? 'var(--gold)' : 'rgba(180,149,48,0.2)'}`, fontSize: 10 }}>
                          100+
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="font-cinzel text-xs block mb-1" style={{ color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>PRIZE IDEA (optional)</label>
                      <input value={reqPrize} onChange={e => setReqPrize(e.target.value)}
                        placeholder="e.g. Bottle of wine for the winner"
                        style={{ ...inputStyle, fontSize: '16px' }} />
                    </div>
                    <div>
                      <label className="font-cinzel text-xs block mb-1" style={{ color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>NOTES (optional)</label>
                      <textarea value={reqNotes} onChange={e => setReqNotes(e.target.value)}
                        placeholder="Any other details…" rows={2}
                        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                    </div>
                    {reqResult?.success === false && (
                      <p className="font-cormorant italic text-sm" style={{ color: '#e07070' }}>{reqResult.msg || 'Failed to send request.'}</p>
                    )}
                    <button onClick={submitRequest} disabled={reqSending || !reqEvent}
                      className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
                      style={{ background: reqSending ? 'rgba(180,149,48,0.1)' : 'var(--gold)', color: reqSending ? 'var(--mid)' : 'var(--ink)', letterSpacing: '0.1em', opacity: !reqEvent ? 0.4 : 1 }}>
                      {reqSending ? 'SENDING…' : 'SUBMIT REQUEST'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(42,40,32,0.6)', margin: '20px 0' }} />

          <div className="mb-5">
            <label className="font-cinzel text-xs tracking-widest mb-2 block" style={{ color: 'var(--gold-lt)', fontSize: 9 }}>
              PASSWORD
            </label>
            {resetSent ? (
              <p className="font-cormorant italic text-sm" style={{ color: '#4caf7d' }}>✓ Reset link sent to {user?.email}</p>
            ) : (
              <button onClick={sendPasswordReset}
                className="flex items-center gap-2 font-cinzel text-xs px-3 py-2 rounded transition-all"
                style={{ border: '1px solid rgba(180,149,48,0.25)', color: 'var(--gold-lt)', background: 'rgba(180,149,48,0.06)', letterSpacing: '0.06em' }}>
                <Key size={12} />
                Send Password Reset Email
              </button>
            )}
          </div>

          {error && <p className="font-cormorant italic text-sm mb-4" style={{ color: '#e07070' }}>{error}</p>}

          <div style={{ borderTop: '1px solid rgba(42,40,32,0.6)', margin: '20px 0' }} />

          <button onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-cinzel text-xs tracking-widest transition-all"
            style={{ border: '1px solid rgba(180,149,48,0.15)', color: 'var(--mid)', background: 'none', letterSpacing: '0.08em' }}>
            <LogOut size={12} />
            SIGN OUT
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}