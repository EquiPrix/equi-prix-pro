import React, { useState, useEffect } from 'react';
import { EVENTS_2026, sbFetch } from '@/lib/equiprix-data';
import { supabase } from '@/lib/supabaseClient';
import { Send, Users, CheckCircle, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';

const NOTIFICATION_TYPES = [
  { id: 'draft_open', label: 'Draft Open', description: 'Announce picks are open + lock time', icon: '🟢' },
  { id: 'team_results', label: 'Team Results + GP Draft', description: 'Team results posted + GP draft open + lock time', icon: '🏆' },
  { id: 'final_results', label: 'Final Results', description: 'Event complete + final leaderboard', icon: '🎯' },
  { id: 'new_event', label: 'New Event', description: 'Announce upcoming event + sponsor', icon: '📣' },
  { id: 'custom', label: 'Custom', description: 'Write your own message', icon: '✉️' },
];

export default function NotificationsEditor() {
  const [selectedType, setSelectedType] = useState('draft_open');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [lockTime, setLockTime] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [sponsorName, setSponsorName] = useState('');

  // Recipients
  const [allUsers, setAllUsers] = useState([]);           // { email, username, email_notifications }
  const [rooms, setRooms] = useState([]);                  // all rooms
  const [selectedRoomIds, setSelectedRoomIds] = useState([]); // rooms to target
  const [manualEmails, setManualEmails] = useState('');
  const [recipientMode, setRecipientMode] = useState('all'); // 'all' | 'rooms' | 'manual'
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // UI state
  const [showUserList, setShowUserList] = useState(false);
  const [showUnsubscribed, setShowUnsubscribed] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoadingRecipients(true);
    try {
      // Load user profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('email, username, email_notifications')
        .order('username');

      // Also pull from legacy sources
      const legacyEmails = new Set();
      const mapping = await sbFetch('results?event=eq.user_mapping&limit=1');
      if (mapping?.[0]?.rider_results) {
        Object.entries(mapping[0].rider_results).forEach(([email, data]) => {
          if (email.includes('@')) legacyEmails.add({ email, username: data.username || email.split('@')[0] });
        });
      }
      const members = await sbFetch('room_members?select=user_email,username') || [];
      members.forEach(m => { if (m.user_email?.includes('@')) legacyEmails.add({ email: m.user_email, username: m.username }) });

      // Merge — profiles take precedence
      const profileEmails = new Set((profiles || []).map(p => p.email));
      const merged = [...(profiles || [])];
      legacyEmails.forEach(({ email, username }) => {
        if (!profileEmails.has(email)) merged.push({ email, username, email_notifications: true });
      });

      setAllUsers(merged);

      // Load rooms
      const roomList = await sbFetch('rooms?order=name.asc&select=id,name,join_code,event_id') || [];
      setRooms(roomList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const subscribedUsers = allUsers.filter(u => u.email_notifications !== false);
  const unsubscribedUsers = allUsers.filter(u => u.email_notifications === false);

  const getRecipients = async () => {
    if (recipientMode === 'manual') {
      return manualEmails.split(/[\n,;]/).map(e => e.trim()).filter(e => e.includes('@'));
    }
    if (recipientMode === 'rooms') {
      if (!selectedRoomIds.length) return [];
      const roomMembers = await Promise.all(
        selectedRoomIds.map(id => sbFetch('room_members?room_id=eq.' + id + '&select=user_email'))
      );
      const emails = new Set();
      roomMembers.flat().forEach(m => { if (m?.user_email?.includes('@')) emails.add(m.user_email); });
      // Filter unsubscribed
      const unsub = new Set(unsubscribedUsers.map(u => u.email));
      return [...emails].filter(e => !unsub.has(e));
    }
    // 'all' — subscribed users only
    const extras = manualEmails.split(/[\n,;]/).map(e => e.trim()).filter(e => e.includes('@'));
    return [...new Set([...subscribedUsers.map(u => u.email), ...extras])];
  };

  const selectedEvent = EVENTS_2026.find(e => e.id === selectedEventId);
  const notificationType = NOTIFICATION_TYPES.find(t => t.id === selectedType);

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      const to = await getRecipients();
      if (!to.length) { setResult({ error: 'No recipients selected.' }); setSending(false); return; }

      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          recipients: to,
          eventName: selectedEvent?.city || '',
          eventFlag: selectedEvent?.flag || '🏇',
          eventDates: selectedEvent?.dates || '',
          lockTime: lockTime || null,
          customMessage: customMessage || null,
          customSubject: customSubject || null,
          sponsorName: sponsorName || null,
        }),
      });
      const data = await res.json();
      setResult({ ...data, recipientCount: to.length });
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setSending(false);
    }
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
    display: 'block',
    marginBottom: 4,
  };

  return (
    <div>
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>NOTIFICATIONS</h2>
      <p className="font-cormorant text-base italic mb-6" style={{ color: 'var(--mid)' }}>
        Send event emails to users, rooms, or custom lists.
      </p>

      {/* ── RECIPIENTS ─────────────────────────────────────────────── */}
      <div className="mb-5 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(180,149,48,0.2)' }}>
        
        {/* Summary bar */}
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: 'rgba(180,149,48,0.06)' }}>
          <Users size={13} style={{ color: 'var(--gold)' }} />
          <span className="font-cormorant text-sm flex-1" style={{ color: 'var(--cream)' }}>
            {loadingRecipients ? 'Loading…' : `${allUsers.length} total · ${subscribedUsers.length} subscribed · ${unsubscribedUsers.length} unsubscribed`}
          </span>
          <button onClick={loadAll} className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.08em' }}>REFRESH</button>
        </div>

        {/* Recipient mode tabs */}
        <div className="flex" style={{ borderTop: '1px solid rgba(180,149,48,0.1)' }}>
          {[
            { id: 'all', label: 'All Users' },
            { id: 'rooms', label: 'By Room' },
            { id: 'manual', label: 'Manual' },
          ].map(m => (
            <button key={m.id} onClick={() => setRecipientMode(m.id)}
              className="flex-1 py-2 font-cinzel text-xs transition-all"
              style={{
                background: recipientMode === m.id ? 'rgba(180,149,48,0.1)' : 'transparent',
                borderBottom: `2px solid ${recipientMode === m.id ? 'var(--gold)' : 'transparent'}`,
                color: recipientMode === m.id ? 'var(--gold)' : 'var(--mid)',
                fontSize: 9, letterSpacing: '0.08em',
              }}>
              {m.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Mode content */}
        <div className="p-3">
          {recipientMode === 'all' && (
            <>
              {/* Subscribed users dropdown */}
              <button onClick={() => setShowUserList(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 rounded mb-2 transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(180,149,48,0.15)' }}>
                <span className="font-cinzel text-xs" style={{ color: 'var(--gold-lt)', fontSize: 9, letterSpacing: '0.08em' }}>
                  SUBSCRIBED ({subscribedUsers.length})
                </span>
                {showUserList ? <ChevronUp size={12} style={{ color: 'var(--mid)' }} /> : <ChevronDown size={12} style={{ color: 'var(--mid)' }} />}
              </button>
              {showUserList && (
                <div className="rounded overflow-hidden mb-2" style={{ border: '1px solid rgba(42,40,32,0.4)', maxHeight: 200, overflowY: 'auto' }}>
                  {subscribedUsers.map((u, i) => (
                    <div key={u.email} className="flex items-center gap-2 px-3 py-2"
                      style={{ borderBottom: i < subscribedUsers.length - 1 ? '1px solid rgba(42,40,32,0.3)' : 'none' }}>
                      <div className="flex-1 min-w-0">
                        <div className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>{u.username || '—'}</div>
                        <div className="font-cormorant text-xs italic" style={{ color: 'var(--mid)' }}>{u.email}</div>
                      </div>
                      <span className="font-cinzel text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(76,175,125,0.1)', color: '#4caf7d', fontSize: 7 }}>✓</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Unsubscribed */}
              <button onClick={() => setShowUnsubscribed(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 rounded transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(180,149,48,0.1)' }}>
                <span className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.08em' }}>
                  UNSUBSCRIBED ({unsubscribedUsers.length})
                </span>
                {showUnsubscribed ? <ChevronUp size={12} style={{ color: 'var(--mid)' }} /> : <ChevronDown size={12} style={{ color: 'var(--mid)' }} />}
              </button>
              {showUnsubscribed && unsubscribedUsers.length > 0 && (
                <div className="rounded overflow-hidden mt-2" style={{ border: '1px solid rgba(42,40,32,0.4)', maxHeight: 150, overflowY: 'auto' }}>
                  {unsubscribedUsers.map((u, i) => (
                    <div key={u.email} className="flex items-center gap-2 px-3 py-2"
                      style={{ borderBottom: i < unsubscribedUsers.length - 1 ? '1px solid rgba(42,40,32,0.3)' : 'none', opacity: 0.6 }}>
                      <div className="flex-1 min-w-0">
                        <div className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>{u.username || '—'}</div>
                        <div className="font-cormorant text-xs italic" style={{ color: 'var(--mid)' }}>{u.email}</div>
                      </div>
                      <span className="font-cinzel text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(224,112,112,0.1)', color: '#e07070', fontSize: 7 }}>OFF</span>
                    </div>
                  ))}
                </div>
              )}
              {showUnsubscribed && unsubscribedUsers.length === 0 && (
                <p className="font-cormorant italic text-xs mt-2 text-center" style={{ color: 'var(--mid)' }}>No unsubscribed users</p>
              )}

              {/* Additional emails */}
              <div className="mt-3">
                <label style={{ ...labelStyle, marginBottom: 4 }}>ALSO SEND TO (optional)</label>
                <textarea value={manualEmails} onChange={e => setManualEmails(e.target.value)}
                  placeholder="extra@example.com" rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
            </>
          )}

          {recipientMode === 'rooms' && (
            <>
              <p className="font-cormorant italic text-xs mb-3" style={{ color: 'var(--mid)' }}>
                Select one or more rooms — all members will receive the email (excluding unsubscribed).
              </p>
              {rooms.length === 0 ? (
                <p className="font-cormorant italic text-sm text-center py-2" style={{ color: 'var(--mid)' }}>No rooms created yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {rooms.map(room => {
                    const ev = EVENTS_2026.find(e => e.id === room.event_id);
                    const selected = selectedRoomIds.includes(room.id);
                    return (
                      <button key={room.id}
                        onClick={() => setSelectedRoomIds(prev =>
                          selected ? prev.filter(id => id !== room.id) : [...prev, room.id]
                        )}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                        style={{
                          background: selected ? 'rgba(180,149,48,0.12)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${selected ? 'rgba(180,149,48,0.4)' : 'rgba(180,149,48,0.1)'}`,
                        }}>
                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: selected ? 'var(--gold)' : 'transparent', border: `1px solid ${selected ? 'var(--gold)' : 'rgba(180,149,48,0.3)'}` }}>
                          {selected && <span style={{ color: 'var(--ink)', fontSize: 8 }}>✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-cormorant text-sm" style={{ color: selected ? 'var(--gold-lt)' : 'var(--cream)' }}>{room.name}</div>
                          <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 8 }}>
                            {ev ? `${ev.flag} ${ev.city}` : room.event_id} · #{room.join_code}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedRoomIds.length > 0 && (
                <p className="font-cormorant italic text-xs mt-2" style={{ color: 'var(--gold-lt)' }}>
                  {selectedRoomIds.length} room{selectedRoomIds.length > 1 ? 's' : ''} selected
                </p>
              )}
            </>
          )}

          {recipientMode === 'manual' && (
            <div>
              <label style={labelStyle}>EMAIL ADDRESSES (comma, semicolon, or line separated)</label>
              <textarea value={manualEmails} onChange={e => setManualEmails(e.target.value)}
                placeholder="user@example.com&#10;another@example.com"
                rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
              <p className="font-cormorant italic text-xs mt-1" style={{ color: 'var(--mid)' }}>
                {manualEmails.split(/[\n,;]/).filter(e => e.trim().includes('@')).length} valid emails
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── NOTIFICATION TYPE ───────────────────────────────────────── */}
      <div className="mb-5">
        <label style={labelStyle}>NOTIFICATION TYPE</label>
        <div className="grid grid-cols-2 gap-2">
          {NOTIFICATION_TYPES.map(t => (
            <button key={t.id} onClick={() => setSelectedType(t.id)}
              className="text-left px-3 py-2.5 rounded-lg transition-all"
              style={{
                background: selectedType === t.id ? 'rgba(180,149,48,0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedType === t.id ? 'rgba(180,149,48,0.4)' : 'rgba(180,149,48,0.1)'}`,
              }}>
              <div className="text-base mb-0.5">{t.icon}</div>
              <div className="font-cinzel text-xs" style={{ color: selectedType === t.id ? 'var(--gold)' : 'var(--cream)', fontSize: 9, letterSpacing: '0.08em' }}>{t.label}</div>
              <div className="font-cormorant text-xs italic mt-0.5" style={{ color: 'var(--mid)' }}>{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── EVENT (not needed for custom) ──────────────────────────── */}
      {selectedType !== 'custom' && (
        <div className="mb-4">
          <label style={labelStyle}>EVENT</label>
          <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} style={inputStyle}>
            <option value="">— Select Event —</option>
            {EVENTS_2026.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} · {ev.dates}</option>
            ))}
          </select>
        </div>
      )}

      {(selectedType === 'draft_open' || selectedType === 'team_results') && (
        <div className="mb-4">
          <label style={labelStyle}>LOCK TIME</label>
          <input value={lockTime} onChange={e => setLockTime(e.target.value)}
            placeholder="e.g. Saturday June 21 at 2:00 PM CET" style={inputStyle} />
        </div>
      )}

      {selectedType === 'new_event' && (
        <div className="mb-4">
          <label style={labelStyle}>SPONSOR NAME (optional)</label>
          <input value={sponsorName} onChange={e => setSponsorName(e.target.value)}
            placeholder="e.g. Longines" style={inputStyle} />
        </div>
      )}

      {selectedType === 'custom' && (
        <div className="mb-4">
          <label style={labelStyle}>EMAIL SUBJECT</label>
          <input value={customSubject} onChange={e => setCustomSubject(e.target.value)}
            placeholder="e.g. Important update from EquiPrix" style={{ ...inputStyle, marginBottom: 8 }} />
        </div>
      )}

      <div className="mb-6">
        <label style={labelStyle}>{selectedType === 'custom' ? 'MESSAGE BODY' : 'CUSTOM MESSAGE (optional)'}</label>
        <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)}
          placeholder={selectedType === 'custom' ? 'Write your message here…' : 'Add a personal note or extra details…'}
          rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
      </div>

      {/* Preview */}
      <button onClick={() => setPreview(p => !p)}
        className="font-cinzel text-xs mb-4 px-3 py-1.5 rounded transition-all"
        style={{
          background: preview ? 'rgba(180,149,48,0.12)' : 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(180,149,48,0.2)',
          color: preview ? 'var(--gold)' : 'var(--mid)',
          letterSpacing: '0.08em', fontSize: 9,
        }}>
        {preview ? 'HIDE PREVIEW' : 'PREVIEW EMAIL'}
      </button>

      {preview && (
        <div className="mb-6 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(180,149,48,0.2)' }}>
          <div style={{ background: '#0f0e0a', padding: '16px' }}>
            <div style={{ maxWidth: 360, margin: '0 auto', background: '#14130e', border: '1px solid rgba(180,149,48,0.25)', borderRadius: 6, overflow: 'hidden', fontFamily: 'Georgia,serif' }}>
              <div style={{ padding: '20px 20px 14px', textAlign: 'center', borderBottom: '1px solid rgba(180,149,48,0.15)' }}>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#b49530', letterSpacing: '0.2em' }}>EQUIPRIX</div>
                <div style={{ fontSize: 9, color: '#8a7a4a', letterSpacing: '0.2em', marginTop: 3 }}>ELITE SHOW JUMPING FANTASY</div>
              </div>
              <div style={{ padding: '20px' }}>
                <p style={{ fontSize: 16, color: '#e8e0cc', margin: '0 0 10px', fontStyle: 'italic', textAlign: 'center' }}>
                  {selectedType === 'draft_open' ? 'The draft is open.' :
                   selectedType === 'team_results' ? 'Team results are in.' :
                   selectedType === 'final_results' ? 'Final results are in.' :
                   selectedType === 'custom' ? (customSubject || 'Custom message.') :
                   selectedEvent ? `${selectedEvent.city} is coming.` : 'New event.'}
                </p>
                <p style={{ fontSize: 12, color: '#b49530', lineHeight: 1.6, margin: '0 0 16px' }}>
                  {selectedType === 'draft_open' && selectedEvent ? `Your picks for ${selectedEvent.city} are now open.${lockTime ? ` Picks lock: ${lockTime}.` : ''}` :
                   selectedType === 'team_results' && selectedEvent ? `Team results for ${selectedEvent.city} are posted.${lockTime ? ` GP picks lock: ${lockTime}.` : ''}` :
                   selectedType === 'final_results' && selectedEvent ? `${selectedEvent.city} is complete. Check the final leaderboard.` :
                   selectedType === 'custom' ? customMessage || 'Your message here…' :
                   selectedEvent ? `${selectedEvent.city} ${selectedEvent.dates} is coming to EquiPrix.` : ''}
                  {selectedType !== 'custom' && customMessage ? ` ${customMessage}` : ''}
                </p>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', background: '#b49530', color: '#0f0e0a', padding: '10px 24px', borderRadius: 3, fontSize: 10, fontWeight: 'bold', letterSpacing: '0.12em' }}>
                    {selectedType === 'draft_open' ? 'MAKE YOUR PICKS' :
                     selectedType === 'team_results' ? 'VIEW RESULTS & PICK RIDERS' :
                     selectedType === 'final_results' ? 'VIEW FINAL LEADERBOARD' :
                     selectedType === 'custom' ? 'OPEN EQUIPRIX' : 'OPEN EQUIPRIX'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send button */}
      <button onClick={send} disabled={sending}
        className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
        style={{
          background: sending ? 'rgba(180,149,48,0.1)' : 'var(--gold)',
          color: sending ? 'var(--mid)' : 'var(--ink)',
          letterSpacing: '0.1em',
        }}>
        <Send size={13} />
        {sending ? 'SENDING…' : 'SEND NOTIFICATION'}
      </button>

      {result && (
        <div className="mt-4 px-4 py-3 rounded-lg flex items-start gap-3"
          style={{
            background: result.error || result.failed > 0 ? 'rgba(224,112,112,0.08)' : 'rgba(76,175,125,0.08)',
            border: `1px solid ${result.error || result.failed > 0 ? 'rgba(224,112,112,0.3)' : 'rgba(76,175,125,0.3)'}`,
          }}>
          {result.error || result.failed > 0
            ? <AlertCircle size={16} style={{ color: '#e07070', flexShrink: 0, marginTop: 1 }} />
            : <CheckCircle size={16} style={{ color: '#4caf7d', flexShrink: 0, marginTop: 1 }} />}
          <div>
            {result.error
              ? <p className="font-cormorant text-sm" style={{ color: '#e07070' }}>{result.error}</p>
              : <>
                  <p className="font-cormorant text-sm font-semibold" style={{ color: '#4caf7d' }}>✓ {result.sent} emails sent</p>
                  {result.failed > 0 && <p className="font-cormorant text-sm" style={{ color: '#e07070' }}>{result.failed} failed</p>}
                </>}
          </div>
        </div>
      )}
    </div>
  );
}