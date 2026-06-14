import React, { useState, useEffect } from 'react';
import { EVENTS_2026, sbFetch } from '@/lib/equiprix-data';
import { Copy, Check, Plus, Trash2 } from 'lucide-react';

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function RoomsEditor() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState('');

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

  useEffect(() => { loadRooms(); }, []);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const rows = await sbFetch('rooms?order=created_at.desc');
      setRooms(rows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!form.name || !form.event_id || !form.manager_email) return;
    setCreating(true);
    try {
      const join_code = generateCode();
      await sbFetch('rooms', {
        method: 'POST',
        body: JSON.stringify({ ...form, join_code })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setForm({ name: '', event_id: '', manager_email: '', max_size: 20, prize_description: '', sponsor_name: '', sponsor_logo_url: '', is_sponsored: false });
      loadRooms();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const deleteRoom = async (id) => {
    if (!confirm('Delete this room? All members will be removed.')) return;
    await sbFetch('rooms?id=eq.' + id, { method: 'DELETE' });
    loadRooms();
  };

  const copyLink = (code, type) => {
    const url = type === 'manager'
      ? `${window.location.origin}/room/${code}?mgr=1`
      : `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(code + type);
    setTimeout(() => setCopied(''), 2000);
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
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>PRIVATE ROOMS</h2>
      <p className="font-cormorant text-base italic mb-6" style={{ color: 'var(--mid)' }}>
        Create invite-only rooms for sponsors, partners or VIP groups.
      </p>

      {/* Create form */}
      <div className="rounded-xl p-5 mb-8" style={{ border: '1px solid rgba(180,149,48,0.2)', background: 'rgba(180,149,48,0.03)' }}>
        <div className="font-cinzel text-xs tracking-widest mb-4" style={{ color: 'var(--gold)', fontSize: 10 }}>CREATE NEW ROOM</div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label style={labelStyle}>ROOM NAME</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. CWD VIP League" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>EVENT</label>
            <select value={form.event_id} onChange={e => setForm(p => ({ ...p, event_id: e.target.value }))}
              style={{ ...inputStyle }}>
              <option value="">— Select Event —</option>
              {EVENTS_2026.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} · {ev.dates}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label style={labelStyle}>MANAGER EMAIL</label>
            <input type="email" value={form.manager_email} onChange={e => setForm(p => ({ ...p, manager_email: e.target.value }))}
              placeholder="manager@example.com" style={{ ...inputStyle, fontSize: '16px' }} />
          </div>
          <div>
            <label style={labelStyle}>MAX MEMBERS</label>
            <input type="number" value={form.max_size} onChange={e => setForm(p => ({ ...p, max_size: parseInt(e.target.value) }))}
              min={2} max={500} style={inputStyle} />
          </div>
        </div>

        <div className="mb-3">
          <label style={labelStyle}>PRIZE / DESCRIPTION</label>
          <input value={form.prize_description} onChange={e => setForm(p => ({ ...p, prize_description: e.target.value }))}
            placeholder="e.g. €500 CWD gift voucher for the winner" style={inputStyle} />
        </div>

        {/* Sponsored toggle */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setForm(p => ({ ...p, is_sponsored: !p.is_sponsored }))}
            className="flex items-center gap-2 font-cinzel text-xs px-3 py-1.5 rounded transition-all"
            style={{
              background: form.is_sponsored ? 'rgba(180,149,48,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${form.is_sponsored ? 'rgba(180,149,48,0.4)' : 'rgba(180,149,48,0.2)'}`,
              color: form.is_sponsored ? 'var(--gold)' : 'var(--mid)',
              fontSize: 9, letterSpacing: '0.1em'
            }}>
            {form.is_sponsored ? '★ SPONSORED' : 'MARK AS SPONSORED'}
          </button>
          <span className="font-cormorant italic text-xs" style={{ color: 'var(--mid)' }}>
            Sponsored rooms can show custom branding
          </span>
        </div>

        {form.is_sponsored && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label style={labelStyle}>SPONSOR NAME</label>
              <input value={form.sponsor_name} onChange={e => setForm(p => ({ ...p, sponsor_name: e.target.value }))}
                placeholder="e.g. CWD Sellerie" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>SPONSOR LOGO URL</label>
              <input value={form.sponsor_logo_url} onChange={e => setForm(p => ({ ...p, sponsor_logo_url: e.target.value }))}
                placeholder="https://..." style={inputStyle} />
            </div>
          </div>
        )}

        <button onClick={createRoom} disabled={creating || !form.name || !form.event_id || !form.manager_email}
          className="flex items-center gap-2 font-cinzel text-xs px-4 py-2.5 rounded mt-2 transition-all"
          style={{
            background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)',
            color: saved ? '#4caf7d' : 'var(--ink)',
            border: saved ? '1px solid #4caf7d' : 'none',
            letterSpacing: '0.1em', opacity: (!form.name || !form.event_id || !form.manager_email) ? 0.4 : 1
          }}>
          <Plus size={13} />
          {saved ? 'ROOM CREATED ✓' : creating ? 'CREATING…' : 'CREATE ROOM'}
        </button>
      </div>

      {/* Rooms list */}
      <div className="font-cinzel text-xs tracking-widest mb-3" style={{ color: 'var(--gold)', fontSize: 10 }}>
        ACTIVE ROOMS ({rooms.length})
      </div>

      {loading ? (
        <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>Loading…</p>
      ) : rooms.length === 0 ? (
        <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>No rooms yet.</p>
      ) : (
        <div className="space-y-3">
          {rooms.map(room => {
            const event = EVENTS_2026.find(e => e.id === room.event_id);
            return (
              <div key={room.id} className="rounded-lg p-4" style={{ border: '1px solid rgba(180,149,48,0.15)', background: '#0d0c09' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>
                      {room.name}
                      {room.is_sponsored && (
                        <span className="ml-2 font-cinzel text-xs px-2 py-0.5 rounded"
                          style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)', fontSize: 8 }}>SPONSORED</span>
                      )}
                    </div>
                    <div className="font-cinzel text-xs mt-0.5" style={{ color: 'var(--mid)', fontSize: 9 }}>
                      {event ? `${event.flag} ${event.city} · ${event.dates}` : room.event_id} · Max {room.max_size} members
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

                {/* Join code + links */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)' }}>
                    <span className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>CODE</span>
                    <span className="font-cinzel text-sm font-bold" style={{ color: 'var(--gold)' }}>{room.join_code}</span>
                  </div>

                  <button onClick={() => copyLink(room.join_code, 'mgr')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded font-cinzel text-xs transition-all"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>
                    {copied === room.join_code + 'mgr' ? <Check size={11} /> : <Copy size={11} />}
                    MANAGER LINK
                  </button>

                  <button onClick={() => copyLink(room.join_code, 'join')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded font-cinzel text-xs transition-all"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>
                    {copied === room.join_code + 'join' ? <Check size={11} /> : <Copy size={11} />}
                    MEMBER LINK
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}