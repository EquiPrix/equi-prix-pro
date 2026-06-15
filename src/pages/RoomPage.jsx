import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { sbFetch, EVENTS_2026 } from '@/lib/equiprix-data';
import { useAuth } from '@/lib/AuthContext';
import EquiPrixLogo from '@/components/equiprix/EquiPrixLogo';
import { Send, Edit2, Check, X, Trash2, Users, Copy } from 'lucide-react';

export default function RoomPage() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [error, setError] = useState('');

  // Manager state
  const [isManager, setIsManager] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingPrize, setEditingPrize] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [prizeVal, setPrizeVal] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Notification state
  const [notifType, setNotifType] = useState('team_results');
  const [eventStartTime, setEventStartTime] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [notifResult, setNotifResult] = useState(null);
  const [copied, setCopied] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  useEffect(() => { loadRoom(); }, [code]);

  useEffect(() => {
    if (room && user) {
      const mgr = user.email === room.manager_email;
      setIsManager(mgr);
      setNameVal(room.name);
      setPrizeVal(room.prize_description || '');
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
    } catch (e) { setError('Could not load room.'); }
    finally { setLoading(false); }
  };

  const checkAndAutoJoin = async () => {
    if (!user?.email) return;
    const existing = await sbFetch('room_members?room_id=eq.' + room.id + '&user_email=eq.' + encodeURIComponent(user.email) + '&limit=1');
    if (existing?.length) { setIsMember(true); return; }
    await joinRoom(true);
  };

  const joinRoom = async (auto = false) => {
    if (!user) { navigate('/?redirect=/room/' + code); return; }
    if (members.length >= room.max_size) { setError('This room is full.'); return; }
    if (!auto) setJoining(true);
    try {
      await sbFetch('room_members', {
        method: 'POST',
        body: JSON.stringify({
          room_id: room.id,
          user_email: user.email,
          username: user.user_metadata?.username || user.email.split('@')[0],
        })
      });
      setJoined(true); setIsMember(true);
      loadRoom();
    } catch (e) {
      if (e.message?.includes('unique')) setIsMember(true);
      else if (!auto) setError('Could not join room.');
    } finally { if (!auto) setJoining(false); }
  };

  const saveField = async (field, value) => {
    setSavingEdit(true);
    try {
      await sbFetch('rooms?id=eq.' + room.id, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value })
      });
      setRoom(prev => ({ ...prev, [field]: value }));
      if (field === 'name') setEditingName(false);
      if (field === 'prize_description') setEditingPrize(false);
    } catch (e) { console.error(e); }
    finally { setSavingEdit(false); }
  };

  const removeMember = async (memberId, email) => {
    if (!confirm(`Remove ${email} from this room?`)) return;
    await sbFetch('room_members?id=eq.' + memberId, { method: 'DELETE' });
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const sendNotification = async () => {
    const memberEmails = members.map(m => m.user_email).filter(e => e !== room.manager_email || true);
    if (!memberEmails.length) return;
    setSending(true);
    setNotifResult(null);

    const event = EVENTS_2026.find(e => e.id === room.event_id);
    const lockTimeStr = eventStartTime
      ? `${eventStartTime} (picks lock 5 minutes before start)`
      : null;

    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: notifType,
          recipients: memberEmails,
          eventName: event?.city || room.name,
          eventFlag: event?.flag || '🏇',
          eventDates: event?.dates || '',
          lockTime: lockTimeStr,
          customMessage: customMsg || null,
          customSubject: notifType === 'custom' ? customMsg.split('\n')[0] : null,
        }),
      });
      const data = await res.json();
      setNotifResult(data);
    } catch (e) { setNotifResult({ error: e.message }); }
    finally { setSending(false); }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) return;
    setInviting(true);
    setInviteResult(null);
    const event = EVENTS_2026.find(e => e.id === room.event_id);
    try {
      const res = await fetch('/api/send-room-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          roomName: room.name,
          prize: room.prize_description || null,
          eventName: event?.city || null,
          eventFlag: event?.flag || null,
          joinUrl: `${window.location.origin}/room/${room.join_code}`,
          managerName: user?.user_metadata?.username || user?.email?.split('@')[0] || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteResult({ success: true, msg: `✓ Invite sent to ${inviteEmail.trim()}` });
        setInviteEmail('');
      } else {
        setInviteResult({ success: false, msg: data.error || 'Failed to send invite' });
      }
    } catch (e) {
      setInviteResult({ success: false, msg: e.message });
    } finally {
      setInviting(false);
    }
  };

  const copyLink = (type) => {
    const url = type === 'member'
      ? `${window.location.origin}/room/${code}`
      : `${window.location.origin}/room/${code}?mgr=1`;
    navigator.clipboard.writeText(url);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  };

  const event = room ? EVENTS_2026.find(e => e.id === room.event_id) : null;
  const spotsLeft = room ? room.max_size - members.length : 0;

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(180,149,48,0.2)',
    color: 'var(--cream)',
    borderRadius: 4,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
  };

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--ink)' }}>
      <div className="font-cinzel text-sm tracking-widest animate-pulse" style={{ color: 'var(--gold)' }}>Loading…</div>
    </div>
  );

  if (error && !room) return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ background: 'var(--ink)' }}>
      <div className="text-center"><EquiPrixLogo width={160} />
        <p className="font-cormorant italic text-lg mt-6" style={{ color: 'var(--mid)' }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: 'var(--ink)' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="max-w-md mx-auto">

        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate('/play')}
            className="font-cinzel text-xs px-3 py-1.5 rounded transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,149,48,0.15)', color: 'var(--mid)', letterSpacing: '0.08em' }}>
            ← BACK
          </button>
          <EquiPrixLogo width={140} />
          <div style={{ width: 60 }} />
        </div>

        {/* Room card */}
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(180,149,48,0.25)', background: '#14130e' }}>
          <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(180,149,48,0.15)' }}>

            {/* Room name — editable for manager */}
            {isManager && editingName ? (
              <div className="flex items-center gap-2 mb-1">
                <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                  onBlur={() => saveField('name', nameVal)}
                  onKeyDown={e => { if (e.key === 'Enter') saveField('name', nameVal); if (e.key === 'Escape') { setEditingName(false); setNameVal(room.name); }}}
                  style={{ ...inputStyle, flex: 1, fontSize: 16 }} autoFocus />
                <button onClick={() => saveField('name', nameVal)} disabled={savingEdit}
                  style={{ color: '#4caf7d' }}><Check size={16} /></button>
                <button onClick={() => { setEditingName(false); setNameVal(room.name); }}
                  style={{ color: 'var(--mid)' }}><X size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <div className="font-cormorant text-2xl font-semibold" style={{ color: 'var(--cream)' }}>{room.name}</div>
                {isManager && (
                  <button onClick={() => setEditingName(true)} style={{ color: 'var(--mid)', flexShrink: 0 }}>
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            )}

            {event && (
              <div className="font-cinzel text-xs mt-1" style={{ color: 'var(--mid)', fontSize: 10, letterSpacing: '0.1em' }}>
                {event.flag} {event.city} · {event.dates}
              </div>
            )}

            {isManager && (
              <div className="mt-1">
                <span className="font-cinzel text-xs px-2 py-0.5 rounded"
                  style={{ background: 'rgba(180,149,48,0.12)', color: 'var(--gold)', fontSize: 8, letterSpacing: '0.08em' }}>
                  ROOM MANAGER
                </span>
              </div>
            )}
          </div>

          <div className="px-6 py-5">
            {/* Prize — editable for manager */}
            <div className="rounded-lg px-4 py-3 mb-4"
              style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)' }}>
              <div className="font-cinzel text-xs mb-1.5 flex items-center justify-between"
                style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>
                PRIZE
                {isManager && !editingPrize && (
                  <button onClick={() => setEditingPrize(true)} style={{ color: 'var(--mid)' }}>
                    <Edit2 size={11} />
                  </button>
                )}
              </div>
              {isManager && editingPrize ? (
                <div className="flex items-center gap-2">
                  <input value={prizeVal} onChange={e => setPrizeVal(e.target.value)}
                    onBlur={() => saveField('prize_description', prizeVal)}
                    onKeyDown={e => { if (e.key === 'Enter') saveField('prize_description', prizeVal); if (e.key === 'Escape') { setEditingPrize(false); setPrizeVal(room.prize_description || ''); }}}
                    style={{ ...inputStyle, flex: 1 }} autoFocus
                    placeholder="e.g. €500 gift voucher" />
                  <button onClick={() => saveField('prize_description', prizeVal)} disabled={savingEdit}
                    style={{ color: '#4caf7d' }}><Check size={14} /></button>
                  <button onClick={() => { setEditingPrize(false); setPrizeVal(room.prize_description || ''); }}
                    style={{ color: 'var(--mid)' }}><X size={14} /></button>
                </div>
              ) : (
                <div className="font-cormorant text-base italic" style={{ color: 'var(--gold-lt)' }}>
                  🏆 {room.prize_description || <span style={{ color: 'var(--mid)', fontStyle: 'normal' }}>No prize set</span>}
                </div>
              )}
            </div>

            {/* Stats */}
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
                <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.1em' }}>MAX</div>
                <div className="font-cormorant text-xl font-bold mt-0.5" style={{ color: 'var(--cream)' }}>{room.max_size}</div>
              </div>
            </div>

            {/* Join / status for non-managers */}
            {!isManager && (
              !user ? (
                <button onClick={() => navigate('/?redirect=/room/' + code)}
                  className="w-full py-3 rounded font-cinzel text-xs tracking-widest"
                  style={{ background: 'var(--gold)', color: 'var(--ink)', letterSpacing: '0.1em' }}>
                  SIGN IN TO JOIN
                </button>
              ) : isMember || joined ? (
                <div className="text-center">
                  <div className="font-cormorant italic text-base mb-3" style={{ color: '#4caf7d' }}>✓ You're in this room</div>
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
              )
            )}

            {isManager && (
              <button onClick={() => navigate('/play')}
                className="w-full py-3 rounded font-cinzel text-xs tracking-widest"
                style={{ background: 'var(--gold)', color: 'var(--ink)', letterSpacing: '0.1em' }}>
                GO TO APP →
              </button>
            )}

            {error && <p className="font-cormorant italic text-sm text-center mt-3" style={{ color: '#e07070' }}>{error}</p>}
          </div>
        </div>

        {/* Manager share links */}
        {isManager && (
          <div className="rounded-xl mb-4 overflow-hidden" style={{ border: '1px solid rgba(180,149,48,0.15)', background: '#14130e' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(180,149,48,0.1)' }}>
              <div className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)', fontSize: 9 }}>SHARE LINKS</div>
            </div>
            <div className="px-5 py-4 flex flex-col gap-2">
              <button onClick={() => copyLink('member')}
                className="flex items-center gap-2 px-3 py-2.5 rounded font-cinzel text-xs transition-all"
                style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold-lt)', letterSpacing: '0.08em' }}>
                <Copy size={12} />
                {copied === 'member' ? '✓ COPIED!' : 'COPY MEMBER INVITE LINK'}
              </button>

            </div>
          </div>
        )}

        {/* Member list */}
        {(isMember || joined || isManager) && members.length > 0 && (
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(180,149,48,0.15)', background: '#14130e' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(180,149,48,0.1)' }}>
              <div className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)', fontSize: 9 }}>
                MEMBERS · {members.length}/{room.max_size}
              </div>
              <Users size={13} style={{ color: 'var(--mid)' }} />
            </div>
            {members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-2.5"
                style={{ borderBottom: i < members.length - 1 ? '1px solid rgba(42,40,32,0.4)' : 'none' }}>
                <span className="font-cinzel text-xs w-5 text-center" style={{ color: 'var(--mid)', fontSize: 9 }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>
                    {m.username || m.user_email.split('@')[0]}
                  </div>
                  {isManager && (
                    <div className="font-cormorant text-xs italic" style={{ color: 'var(--mid)' }}>{m.user_email}</div>
                  )}
                </div>
                {m.user_email === room.manager_email && (
                  <span className="font-cinzel text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(180,149,48,0.1)', color: 'var(--gold)', fontSize: 8 }}>MGR</span>
                )}
                {isManager && m.user_email !== room.manager_email && (
                  <button onClick={() => removeMember(m.id, m.user_email)}
                    style={{ color: 'var(--mid)', flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Manager invite panel */}
        {isManager && (
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(180,149,48,0.2)', background: '#14130e' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(180,149,48,0.1)', background: 'rgba(180,149,48,0.04)' }}>
              <div className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)', fontSize: 9 }}>INVITE A MEMBER</div>
              <div className="font-cormorant italic text-xs mt-0.5" style={{ color: 'var(--mid)' }}>
                Send a branded invite email with the room link
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendInvite()}
                  placeholder="member@example.com"
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(180,149,48,0.2)',
                    color: 'var(--cream)',
                    borderRadius: 4,
                    padding: '8px 12px',
                    fontSize: '16px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={sendInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 rounded font-cinzel text-xs tracking-widest flex items-center gap-1.5 transition-all flex-shrink-0"
                  style={{
                    background: inviting ? 'rgba(180,149,48,0.1)' : 'var(--gold)',
                    color: inviting ? 'var(--mid)' : 'var(--ink)',
                    letterSpacing: '0.08em',
                    opacity: !inviteEmail.trim() ? 0.4 : 1,
                  }}>
                  <Send size={12} />
                  {inviting ? '…' : 'SEND'}
                </button>
              </div>
              {inviteResult && (
                <p className="font-cormorant italic text-sm mt-2"
                  style={{ color: inviteResult.success ? '#4caf7d' : '#e07070' }}>
                  {inviteResult.msg}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Manager notification panel */}}
        {isManager && (
          <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(180,149,48,0.2)', background: '#14130e' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(180,149,48,0.1)', background: 'rgba(180,149,48,0.04)' }}>
              <div className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)', fontSize: 9 }}>NOTIFY MEMBERS</div>
              <div className="font-cormorant italic text-xs mt-0.5" style={{ color: 'var(--mid)' }}>
                Send an email to all {members.length} room members
              </div>
            </div>
            <div className="px-5 py-4">

              {/* Notification type */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { id: 'draft_open', label: 'Draft Open', icon: '🟢' },
                  { id: 'team_results', label: 'Team Results + GP', icon: '🏆' },
                  { id: 'final_results', label: 'Final Results', icon: '🎯' },
                  { id: 'custom', label: 'Custom', icon: '✉️' },
                ].map(t => (
                  <button key={t.id} onClick={() => setNotifType(t.id)}
                    className="text-left px-3 py-2 rounded-lg transition-all"
                    style={{
                      background: notifType === t.id ? 'rgba(180,149,48,0.12)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${notifType === t.id ? 'rgba(180,149,48,0.4)' : 'rgba(180,149,48,0.1)'}`,
                    }}>
                    <span className="text-sm">{t.icon}</span>
                    <div className="font-cinzel text-xs mt-0.5" style={{ color: notifType === t.id ? 'var(--gold)' : 'var(--mid)', fontSize: 8, letterSpacing: '0.08em' }}>
                      {t.label}
                    </div>
                  </button>
                ))}
              </div>

              {/* Event start time */}
              {(notifType === 'draft_open' || notifType === 'team_results') && (
                <div className="mb-3">
                  <label className="font-cinzel text-xs block mb-1" style={{ color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>
                    EVENT START TIME (CET)
                  </label>
                  <input value={eventStartTime} onChange={e => setEventStartTime(e.target.value)}
                    placeholder="e.g. Saturday June 21 at 8:00 PM CET"
                    style={{ ...inputStyle, width: '100%', fontSize: '16px' }} />
                  {eventStartTime && (
                    <p className="font-cormorant italic text-xs mt-1" style={{ color: 'var(--gold-lt)' }}>
                      Picks lock 5 minutes before {eventStartTime}
                    </p>
                  )}
                </div>
              )}

              {/* Custom message */}
              <div className="mb-4">
                <label className="font-cinzel text-xs block mb-1" style={{ color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>
                  {notifType === 'custom' ? 'MESSAGE' : 'CUSTOM NOTE (optional)'}
                </label>
                <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)}
                  placeholder={notifType === 'custom' ? 'Write your message…' : 'Add a personal note…'}
                  rows={2}
                  style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              <button onClick={sendNotification} disabled={sending || !members.length}
                className="w-full py-2.5 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
                style={{ background: sending ? 'rgba(180,149,48,0.1)' : 'var(--gold)', color: sending ? 'var(--mid)' : 'var(--ink)', letterSpacing: '0.1em' }}>
                <Send size={12} />
                {sending ? 'SENDING…' : `SEND TO ${members.length} MEMBERS`}
              </button>

              {notifResult && (
                <div className="mt-3 px-3 py-2 rounded" style={{
                  background: notifResult.error ? 'rgba(224,112,112,0.08)' : 'rgba(76,175,125,0.08)',
                  border: `1px solid ${notifResult.error ? 'rgba(224,112,112,0.3)' : 'rgba(76,175,125,0.3)'}`,
                }}>
                  <p className="font-cormorant text-sm" style={{ color: notifResult.error ? '#e07070' : '#4caf7d' }}>
                    {notifResult.error ? notifResult.error : `✓ ${notifResult.sent} emails sent`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-center font-cormorant italic text-xs mt-2" style={{ color: 'var(--mid)' }}>
          Powered by <span style={{ color: 'var(--gold-lt)' }}>EquiPrix</span>
        </p>
      </motion.div>
    </div>
  );
}