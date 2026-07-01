import React, { useState, useEffect, useRef } from 'react';
import { EVENTS_2026, sbFetch } from '@/lib/equiprix-data';
import { MLSJ_EVENTS_2026_27 } from '@/lib/mlsj-data';
import { Copy, Check, Plus, Trash2, CheckCircle, XCircle, Clock, Mail, ChevronDown, ChevronUp, Send } from 'lucide-react';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Props ─────────────────────────────────────────────────────────────────────
// league: 'gcl' | 'mlsj' — passed from Admin.jsx to scope the event dropdown
// and tag newly created rooms with the correct league.
export default function RoomsEditor({ league = 'gcl' }) {
  const [rooms, setRooms]         = useState([]);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [saved, setSaved]         = useState(false);
  const [copied, setCopied]       = useState('');
  const [approvingId, setApprovingId] = useState(null);

  // Per-room invite panel state: { [roomId]: { open, search, results, sending, sentInvites, members } }
  const [inviteState, setInviteState] = useState({});
  const searchTimers = useRef({});

  const [form, setForm] = useState({
    name: '',
    event_id: '',
    manager_email: '',
    max_size: 20,
    prize_description: '',
    sponsor_name: '',
    sponsor_logo_url: '',
    is_sponsored: false,
  });

  const EVENT_LIST = league === 'mlsj' ? MLSJ_EVENTS_2026_27 : EVENTS_2026;

  useEffect(() => {
    setForm(p => ({ ...p, event_id: '' }));
  }, [league]);

  useEffect(() => {
    loadRooms();
    loadRequests();
  }, [league]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const rows = await sbFetch('rooms?league=eq.' + league + '&order=created_at.desc');
      setRooms(rows || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadRequests = async () => {
    try {
      const rows = await sbFetch('room_requests?status=eq.pending&order=created_at.desc');
      const filtered = (rows || []).filter(r =>
        league === 'gcl' ? (!r.league || r.league === 'gcl') : r.league === league
      );
      setRequests(filtered);
    } catch (e) { console.error(e); }
  };

  const createRoom = async (prefill = null) => {
    const data = prefill || form;
    if (!data.name && !data.room_name) return;
    setCreating(true);
    try {
      const join_code = generateCode();
      await sbFetch('rooms', {
        method: 'POST',
        body: JSON.stringify({
          name:              data.name || data.room_name,
          event_id:          data.event_id || '',
          manager_email:     data.manager_email || '',
          max_size:          data.max_size || data.max_members || 20,
          prize_description: data.prize_description || data.prize_idea || '',
          sponsor_name:      data.sponsor_name || '',
          sponsor_logo_url:  data.sponsor_logo_url || '',
          is_sponsored:      data.is_sponsored || false,
          league,
          join_code,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (!prefill) setForm({ name: '', event_id: '', manager_email: '', max_size: 20, prize_description: '', sponsor_name: '', sponsor_logo_url: '', is_sponsored: false });
      loadRooms();
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  const approveRequest = async (req) => {
    setApprovingId(req.id);
    try {
      const matchedEvent = EVENT_LIST.find(ev =>
        req.event_name?.toLowerCase().includes(ev.city?.toLowerCase()) ||
        req.event_name?.includes(ev.flag)
      );
      const join_code = generateCode();
      await sbFetch('rooms', {
        method: 'POST',
        body: JSON.stringify({
          name:              req.room_name || `${req.requestor_name}'s Room`,
          event_id:          matchedEvent?.id || '',
          manager_email:     req.requestor_email,
          max_size:          req.max_members || 20,
          prize_description: req.prize_idea || '',
          sponsor_name: '', sponsor_logo_url: '', is_sponsored: false,
          league,
          join_code,
        }),
      });
      await sbFetch('room_requests?id=eq.' + req.id, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      });
      await fetch('/api/send-room-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:            req.requestor_email,
          roomName:         req.room_name || `${req.requestor_name}'s Room`,
          prize:            req.prize_idea || null,
          eventName:        matchedEvent?.city || req.event_name,
          eventFlag:        matchedEvent?.flag || '🏇',
          joinUrl:          `${window.location.origin}/room/${join_code}`,
          managerName:      req.requestor_name || null,
          isApprovalNotice: true,
        }),
      });
      setRequests(prev => prev.filter(r => r.id !== req.id));
      loadRooms();
    } catch (e) { console.error(e); }
    finally { setApprovingId(null); }
  };

  const denyRequest = async (id) => {
    if (!confirm('Deny and dismiss this request?')) return;
    const req = requests.find(r => r.id === id);
    await sbFetch('room_requests?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'denied' }),
    });
    setRequests(prev => prev.filter(r => r.id !== id));
    if (req?.requestor_email) {
      try {
        await fetch('/api/send-room-denial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:         req.requestor_email,
            requestorName: req.requestor_name || null,
            roomName:      req.room_name || null,
            eventName:     req.event_name || null,
          }),
        });
      } catch (e) { console.warn('Denial email failed:', e.message); }
    }
  };

  const deleteRoom = async (id) => {
    if (!confirm('Delete this room? All members will be removed.')) return;
    try {
      await sbFetch('room_members?room_id=eq.' + id, { method: 'DELETE' });
      await sbFetch('rooms?id=eq.' + id, { method: 'DELETE' });
      // Clean up invite panel state for this room
      setInviteState(p => { const n = { ...p }; delete n[id]; return n; });
      loadRooms();
    } catch (e) {
      console.error('deleteRoom failed:', e);
      alert('Could not delete room: ' + e.message);
    }
  };

  const copyLink = (code) => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  // ── Invite panel ────────────────────────────────────────────────────────────

  const toggleInvitePanel = async (roomId) => {
    const current = inviteState[roomId];
    if (current?.open) {
      setInviteState(p => ({ ...p, [roomId]: { ...p[roomId], open: false } }));
      return;
    }
    // Load sent invites + current members in parallel when opening
    const [invites, members] = await Promise.all([
      sbFetch(`room_invites?room_id=eq.${roomId}&order=sent_at.desc`).catch(() => []),
      sbFetch(`room_members?room_id=eq.${roomId}&select=user_email`).catch(() => []),
    ]);
    setInviteState(p => ({
      ...p,
      [roomId]: {
        open:        true,
        search:      '',
        results:     [],
        sending:     false,
        sentInvites: invites  || [],
        members:     (members || []).map(m => m.user_email),
      },
    }));
  };

  const handleInviteSearch = (roomId, term) => {
    setInviteState(p => ({ ...p, [roomId]: { ...p[roomId], search: term, results: [] } }));

    // Debounce the Supabase query
    if (searchTimers.current[roomId]) clearTimeout(searchTimers.current[roomId]);
    if (term.length < 2) return;

    searchTimers.current[roomId] = setTimeout(async () => {
      try {
        // Query profiles table for all registered users matching the search term.
        // Adjust the select/filter if your user table is named differently
        // (e.g. user_mapping, auth_users_view, etc.).
        const rows = await sbFetch(
          `profiles?or=(email.ilike.*${encodeURIComponent(term)}*,username.ilike.*${encodeURIComponent(term)}*)&select=email,username&limit=12`
        );
        setInviteState(p => {
          const panel = p[roomId] || {};
          const blocked = new Set([
            ...(panel.sentInvites || []).map(i => i.email),
            ...(panel.members || []),
          ]);
          return {
            ...p,
            [roomId]: {
              ...panel,
              results: (rows || []).filter(u => !blocked.has(u.email)),
            },
          };
        });
      } catch (e) { console.error('invite search failed:', e); }
    }, 300);
  };

  const sendInvite = async (room, email) => {
    setInviteState(p => ({ ...p, [room.id]: { ...p[room.id], sending: email, results: [], search: '' } }));
    try {
      const event = EVENT_LIST.find(e => e.id === room.event_id);
      await fetch('/api/send-room-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          roomName:    room.name,
          prize:       room.prize_description || null,
          eventName:   event?.city || '',
          eventFlag:   event?.flag || '🏇',
          joinUrl:     `${window.location.origin}/room/${room.join_code}`,
          managerName: room.manager_email || 'EquiPrix',
        }),
      });
      // Record in room_invites so it shows up as sent
      await sbFetch('room_invites', {
        method: 'POST',
        body: JSON.stringify({ room_id: room.id, email }),
      });
      // Refresh sent invites list
      const invites = await sbFetch(`room_invites?room_id=eq.${room.id}&order=sent_at.desc`).catch(() => []);
      setInviteState(p => ({
        ...p,
        [room.id]: { ...p[room.id], sending: false, sentInvites: invites || [] },
      }));
    } catch (e) {
      console.error('sendInvite failed:', e);
      setInviteState(p => ({ ...p, [room.id]: { ...p[room.id], sending: false } }));
      alert('Invite failed: ' + e.message);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

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

  const labelStyle = {
    fontSize: 9,
    color: 'var(--gold-lt)',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-cinzel)',
    display: 'block',
    marginBottom: 4,
  };

  return (
    <div>
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
        {league.toUpperCase()} PRIVATE ROOMS
      </h2>
      <p className="font-cormorant text-base italic mb-6" style={{ color: 'var(--mid)' }}>
        Create and manage invite-only rooms for {league === 'gcl' ? 'GCL' : 'MLSJ'} events.
      </p>

      {/* ── Create form ── */}
      <div className="rounded-xl p-5 mb-6"
        style={{ border: '1px solid rgba(180,149,48,0.2)', background: 'rgba(180,149,48,0.03)' }}>
        <div className="font-cinzel text-xs tracking-widest mb-4"
          style={{ color: 'var(--gold)', fontSize: 10 }}>CREATE NEW ROOM</div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label style={labelStyle}>ROOM NAME</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. CWD VIP League" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>EVENT ({league.toUpperCase()})</label>
            <select value={form.event_id} onChange={e => setForm(p => ({ ...p, event_id: e.target.value }))}
              style={inputStyle}>
              <option value="">— Select Event —</option>
              {EVENT_LIST.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} · {ev.dates}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label style={labelStyle}>MANAGER EMAIL</label>
            <input type="email" value={form.manager_email}
              onChange={e => setForm(p => ({ ...p, manager_email: e.target.value }))}
              placeholder="manager@example.com"
              style={{ ...inputStyle, fontSize: '16px' }} />
          </div>
          <div>
            <label style={labelStyle}>MAX MEMBERS</label>
            <input type="number" value={form.max_size}
              onChange={e => setForm(p => ({ ...p, max_size: parseInt(e.target.value) }))}
              min={2} max={500} style={inputStyle} />
          </div>
        </div>

        <div className="mb-3">
          <label style={labelStyle}>PRIZE / DESCRIPTION</label>
          <input value={form.prize_description}
            onChange={e => setForm(p => ({ ...p, prize_description: e.target.value }))}
            placeholder="e.g. €500 CWD gift voucher" style={inputStyle} />
        </div>

        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setForm(p => ({ ...p, is_sponsored: !p.is_sponsored }))}
            className="flex items-center gap-2 font-cinzel text-xs px-3 py-1.5 rounded transition-all"
            style={{
              background: form.is_sponsored ? 'rgba(180,149,48,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${form.is_sponsored ? 'rgba(180,149,48,0.4)' : 'rgba(180,149,48,0.2)'}`,
              color: form.is_sponsored ? 'var(--gold)' : 'var(--mid)',
              fontSize: 9, letterSpacing: '0.1em',
            }}>
            {form.is_sponsored ? '★ SPONSORED' : 'MARK AS SPONSORED'}
          </button>
        </div>

        {form.is_sponsored && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label style={labelStyle}>SPONSOR NAME</label>
              <input value={form.sponsor_name}
                onChange={e => setForm(p => ({ ...p, sponsor_name: e.target.value }))}
                placeholder="e.g. CWD Sellerie" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>SPONSOR LOGO URL</label>
              <input value={form.sponsor_logo_url}
                onChange={e => setForm(p => ({ ...p, sponsor_logo_url: e.target.value }))}
                placeholder="https://..." style={inputStyle} />
            </div>
          </div>
        )}

        <button onClick={() => createRoom()} disabled={creating || !form.name}
          className="flex items-center gap-2 font-cinzel text-xs px-4 py-2.5 rounded mt-2 transition-all"
          style={{
            background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)',
            color:      saved ? '#4caf7d' : 'var(--ink)',
            border:     saved ? '1px solid #4caf7d' : 'none',
            letterSpacing: '0.1em',
            opacity: !form.name ? 0.4 : 1,
          }}>
          <Plus size={13} />
          {saved ? 'ROOM CREATED ✓' : creating ? 'CREATING…' : 'CREATE ROOM'}
        </button>
      </div>

      {/* ── Pending requests ── */}
      {requests.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} style={{ color: '#e0a030' }} />
            <div className="font-cinzel text-xs tracking-widest"
              style={{ color: '#e0a030', fontSize: 10 }}>
              PENDING REQUESTS ({requests.length})
            </div>
          </div>
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="rounded-xl p-4"
                style={{ border: '1px solid rgba(224,160,48,0.3)', background: 'rgba(224,160,48,0.04)' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>
                      {req.room_name || `${req.requestor_name}'s Room`}
                    </div>
                    <div className="font-cinzel text-xs mt-0.5" style={{ color: 'var(--mid)', fontSize: 9 }}>
                      {req.event_name} · Max {req.max_members}
                    </div>
                    <div className="font-cormorant text-xs mt-0.5 italic" style={{ color: 'var(--mid)' }}>
                      {req.requestor_name} · {req.requestor_email}
                    </div>
                    {req.prize_idea && (
                      <div className="font-cormorant italic text-xs mt-1" style={{ color: 'var(--gold-lt)' }}>
                        🏆 {req.prize_idea}
                      </div>
                    )}
                    {req.notes && (
                      <div className="font-cormorant text-xs mt-1" style={{ color: 'var(--mid)' }}>
                        📝 {req.notes}
                      </div>
                    )}
                    <div className="font-cormorant text-xs mt-1" style={{ color: 'var(--mid)', opacity: 0.5 }}>
                      {new Date(req.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveRequest(req)} disabled={approvingId === req.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded font-cinzel text-xs transition-all"
                    style={{ background: 'rgba(76,175,125,0.15)', border: '1px solid rgba(76,175,125,0.4)', color: '#4caf7d', letterSpacing: '0.08em', fontSize: 9 }}>
                    <CheckCircle size={12} />
                    {approvingId === req.id ? 'CREATING…' : 'APPROVE & CREATE'}
                  </button>
                  <button onClick={() => denyRequest(req.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded font-cinzel text-xs transition-all"
                    style={{ background: 'rgba(224,112,112,0.08)', border: '1px solid rgba(224,112,112,0.25)', color: '#e07070', letterSpacing: '0.08em', fontSize: 9 }}>
                    <XCircle size={12} />
                    DENY
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active rooms ── */}
      <div className="font-cinzel text-xs tracking-widest mb-3"
        style={{ color: 'var(--gold)', fontSize: 10 }}>
        {league.toUpperCase()} ROOMS ({rooms.length})
      </div>

      {loading ? (
        <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>Loading…</p>
      ) : rooms.length === 0 ? (
        <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>No {league.toUpperCase()} rooms yet.</p>
      ) : (
        <div className="space-y-3">
          {rooms.map(room => {
            const event  = EVENT_LIST.find(e => e.id === room.event_id);
            const panel  = inviteState[room.id] || {};

            return (
              <div key={room.id} className="rounded-lg p-4"
                style={{ border: '1px solid rgba(180,149,48,0.15)', background: '#0d0c09' }}>

                {/* Room header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>
                      {room.name}
                      {room.is_sponsored && (
                        <span className="ml-2 font-cinzel text-xs px-2 py-0.5 rounded"
                          style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)', fontSize: 8 }}>
                          SPONSORED
                        </span>
                      )}
                    </div>
                    <div className="font-cinzel text-xs mt-0.5" style={{ color: 'var(--mid)', fontSize: 9 }}>
                      {event ? `${event.flag} ${event.city} · ${event.dates}` : room.event_id} · Max {room.max_size}
                    </div>
                    {room.prize_description && (
                      <div className="font-cormorant italic text-xs mt-1" style={{ color: 'var(--gold-lt)' }}>
                        🏆 {room.prize_description}
                      </div>
                    )}
                    <div className="font-cormorant text-xs mt-1" style={{ color: 'var(--mid)' }}>
                      Manager: {room.manager_email}
                    </div>
                  </div>
                  <button onClick={() => deleteRoom(room.id)} style={{ color: 'var(--mid)', flexShrink: 0 }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Code + copy link */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)' }}>
                    <span className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>CODE</span>
                    <span className="font-cinzel text-sm font-bold" style={{ color: 'var(--gold)' }}>{room.join_code}</span>
                  </div>
                  <button onClick={() => copyLink(room.join_code)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded font-cinzel text-xs transition-all"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>
                    {copied === room.join_code ? <Check size={11} /> : <Copy size={11} />}
                    {copied === room.join_code ? 'COPIED!' : 'COPY INVITE LINK'}
                  </button>

                  {/* Toggle invite panel */}
                  <button onClick={() => toggleInvitePanel(room.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded font-cinzel text-xs transition-all"
                    style={{
                      background: panel.open ? 'rgba(100,149,237,0.12)' : 'rgba(100,149,237,0.06)',
                      border: '1px solid rgba(100,149,237,0.25)',
                      color: '#7ba4e8',
                      fontSize: 9, letterSpacing: '0.08em',
                    }}>
                    <Mail size={11} />
                    INVITE MEMBER
                    {panel.open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>
                </div>

                {/* ── Invite panel ── */}
                {panel.open && (
                  <div className="rounded-lg p-3 mt-1"
                    style={{ background: 'rgba(100,149,237,0.04)', border: '1px solid rgba(100,149,237,0.15)' }}>

                    {/* Search input */}
                    <div style={{ position: 'relative' }}>
                      <label style={{ ...labelStyle, color: '#7ba4e8' }}>SEARCH ALL USERS</label>
                      <input
                        value={panel.search || ''}
                        onChange={e => handleInviteSearch(room.id, e.target.value)}
                        placeholder="Type name or email…"
                        style={{
                          ...inputStyle,
                          border: '1px solid rgba(100,149,237,0.3)',
                          fontSize: '16px',
                        }}
                      />

                      {/* Dropdown results */}
                      {(panel.results || []).length > 0 && (
                        <div className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden"
                          style={{ background: '#131210', border: '1px solid rgba(100,149,237,0.25)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                          {panel.results.map(user => (
                            <button
                              key={user.email}
                              onClick={() => sendInvite(room, user.email)}
                              disabled={!!panel.sending}
                              className="w-full flex items-center justify-between px-4 py-2.5 transition-all text-left"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'transparent' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,149,237,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div>
                                <div className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>
                                  {user.username || user.email.split('@')[0]}
                                </div>
                                <div className="font-cinzel" style={{ color: 'var(--mid)', fontSize: 9 }}>
                                  {user.email}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 font-cinzel"
                                style={{ color: '#7ba4e8', fontSize: 9, letterSpacing: '0.08em' }}>
                                {panel.sending === user.email ? (
                                  <span style={{ color: 'var(--mid)' }}>SENDING…</span>
                                ) : (
                                  <><Send size={10} /> INVITE</>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sent invites list */}
                    {(panel.sentInvites || []).length > 0 && (
                      <div className="mt-3">
                        <div className="font-cinzel mb-2"
                          style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.08em' }}>
                          INVITES SENT ({panel.sentInvites.length})
                        </div>
                        <div className="space-y-1">
                          {panel.sentInvites.map(inv => (
                            <div key={inv.id}
                              className="flex items-center justify-between px-3 py-1.5 rounded"
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>
                                {inv.email}
                              </div>
                              <div className="font-cinzel" style={{ color: 'var(--mid)', fontSize: 9 }}>
                                {new Date(inv.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(panel.sentInvites || []).length === 0 && !panel.search && (
                      <p className="font-cormorant italic text-xs mt-2" style={{ color: 'var(--mid)', opacity: 0.6 }}>
                        No invites sent yet for this room.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}