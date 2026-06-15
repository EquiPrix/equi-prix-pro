import React, { useState, useEffect } from 'react';
import { EVENTS_2026, sbFetch } from '@/lib/equiprix-data';
import { supabase } from '@/lib/supabaseClient';
import { Send, Users, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const NOTIFICATION_TYPES = [
  { id: 'draft_open', label: 'Draft Open', description: 'Team picks are open', icon: '🟢' },
  { id: 'team_results', label: 'Team Results + GP Draft', description: 'Team results + GP draft open', icon: '🏆' },
  { id: 'final_results', label: 'Final Results', description: 'Event complete + leaderboard', icon: '🎯' },
  { id: 'new_event', label: 'New Event', description: 'Announce upcoming event', icon: '📣' },
  { id: 'custom', label: 'Custom', description: 'Write your own message', icon: '✉️' },
];

export default function NotificationsEditor() {
  const [selectedType, setSelectedType] = useState('draft_open');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventStartTime, setEventStartTime] = useState(''); // e.g. "Saturday June 21 at 8:00 PM CET"
  const [customMessage, setCustomMessage] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [sponsorName, setSponsorName] = useState('');

  const [allUsers, setAllUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [manualEmails, setManualEmails] = useState('');
  const [recipientMode, setRecipientMode] = useState('all');
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const [showUserList, setShowUserList] = useState(false);
  const [showUnsubscribed, setShowUnsubscribed] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoadingRecipients(true);
    try {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('email, username, email_notifications')
        .order('username');

      const legacyEmails = new Map();
      const mapping = await sbFetch('results?event=eq.user_mapping&limit=1');
      if (mapping?.[0]?.rider_results) {
        Object.entries(mapping[0].rider_results).forEach(([email, data]) => {
          if (email.includes('@')) legacyEmails.set(email, data.username || email.split('@')[0]);
        });
      }
      const members = await sbFetch('room_members?select=user_email,username') || [];
      members.forEach(m => { if (m.user_email?.includes('@')) legacyEmails.set(m.user_email, m.username); });

      const profileEmails = new Set((profiles || []).map(p => p.email));
      const merged = [...(profiles || [])];
      legacyEmails.forEach((username, email) => {
        if (!profileEmails.has(email)) merged.push({ email, username, email_notifications: true });
      });

      setAllUsers(merged);

      const roomList = await sbFetch('rooms?order=name.asc&select=id,name,join_code,event_id') || [];
      setRooms(roomList);
    } catch (e) { console.error(e); }
    finally { setLoadingRecipients(false); }
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
      const unsub = new Set(unsubscribedUsers.map(u => u.email));
      const emails = new Set();
      roomMembers.flat().forEach(m => { if (m?.user_email?.includes('@') && !unsub.has(m.user_email)) emails.add(m.user_email); });
      return [...emails];
    }
    const extras = manualEmails.split(/[\n,;]/).map(e => e.trim()).filter(e => e.includes('@'));
    return [...new Set([...subscribedUsers.map(u => u.email), ...extras])];
  };

  const selectedEvent = EVENTS_2026.find(e => e.id === selectedEventId);

  // Build lock time string for email
  const lockTimeStr = eventStartTime
    ? `${eventStartTime} (picks lock 5 minutes before start)`
    : null;

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
          lockTime: lockTimeStr,
          customMessage: customMessage || null,
          customSubject: customSubject || null,
          sponsorName: sponsorName || null,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) { setResult({ error: e.message }); }
    finally { setSending(false); }
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
    fontSize: 9, color: 'var(--gold-lt)', letterSpacing: '0.1em', display: 'block', marginBottom: 4,
  };

  return (
    <div>
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>NOTIFICATIONS</h2>
      <p className="font-cormorant text-base italic mb-6" style={{ color: 'var(--mid)' }}>
        Send event emails to users, rooms, or custom lists.
      </p>

      {/* Recipients */}
      <div className="mb-5 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(180,149,48,0.2)' }}>
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: 'rgba(180,149,48,0.06)' }}>
          <Users size={13} style={{ color: 'var(--gold)' }} />
          <span className="font-cormorant text-sm flex-1" style={{ color: 'var(--cream)' }}>
            {loadingRecipients ? 'Loading…' : `${allUsers.length} total · ${subscribedUsers.length} subscribed · ${unsubscribedUsers.length} unsubscribed`}
          </span>
          <button onClick={loadAll} className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.08em' }}>REFRESH</button>
        </div>

        {/* Mode tabs */}
        <div className="flex" style={{ borderTop: '1px solid rgba(180,149,48,0.1)' }}>
          {[{ id: 'all', label: 'All Users' }, { id: 'rooms', label: 'By Room' }, { id: 'manual', label: 'Manual' }].map(m => (
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

        <div className="p-3">
          {recipientMode === 'all' && (
            <>
              {/* Subscribed */}
              <button onClick={() => setShowUserList(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 rounded mb-2"
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
                      <span className="font-cinzel px-1.5 py-0.5 rounded" style={{ background: 'rgba(76,175,125,0.1)', color: '#4caf7d', fontSize: 7 }}>✓</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Unsubscribed */}
              <button onClick={() => setShowUnsubscribed(p => !p)}
                className="w-full flex items-center justify-between px-3 py-2 rounded"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(180,149,48,0.1)' }}>
                <span className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.08em' }}>
                  UNSUBSCRIBED ({unsubscribedUsers.length})
                </span>
                {showUnsubscribed ? <ChevronUp size={12} style={{ color: 'var(--mid)' }} /> : <ChevronDown size={12} style={{ color: 'var(--mid)' }} />}
              </button>
              {showUnsubscribed && (
                <div className="rounded overflow-hidden mt-2" style={{ border: '1px solid rgba(42,40,32,0.4)', maxHeight: 150, overflowY: 'auto' }}>
                  {unsubscribedUsers.length === 0 ? (
                    <div className="px-3 py-3 font-cormorant italic text-sm text-center" style={{ color: 'var(--mid)' }}>None</div>
                  ) : unsubscribedUsers.map((u, i) => (
                    <div key={u.email} className="flex items-center gap-2 px-3 py-2"
                      style={{ borderBottom: i < unsubscribedUsers.length - 1 ? '1px solid rgba(42,40,32,0.3)' : 'none', opacity: 0.6 }}>
                      <div className="flex-1 min-w-0">
                        <div className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>{u.username || '—'}</div>
                        <div className="font-cormorant text-xs italic" style={{ color: 'var(--mid)' }}>{u.email}</div>
                      </div>
                      <span className="font-cinzel px-1.5 py-0.5 rounded" style={{ background: 'rgba(224,112,112,0.1)', color: '#e07070', fontSize: 7 }}>OFF</span>
                    </div>
                  ))}
                </div>
              )}

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
                Select rooms — all subscribed members will receive the email.
              </p>
              {rooms.length === 0 ? (
                <p className="font-cormorant italic text-sm text-center py-2" style={{ color: 'var(--mid)' }}>No rooms yet.</p>
              ) : rooms.map(room => {
                const ev = EVENTS_2026.find(e => e.id === room.event_id);
                const sel = selectedRoomIds.includes(room.id);
                return (
                  <button key={room.id}
                    onClick={() => setSelectedRoomIds(prev => sel ? prev.filter(id => id !== room.id) : [...prev, room.id])}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left mb-1.5 transition-all"
                    style={{ background: sel ? 'rgba(180,149,48,0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${sel ? 'rgba(180,149,48,0.4)' : 'rgba(180,149,48,0.1)'}` }}>
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: sel ? 'var(--gold)' : 'transparent', border: `1px solid ${sel ? 'var(--gold)' : 'rgba(180,149,48,0.3)'}` }}>
                      {sel && <span style={{ color: 'var(--ink)', fontSize: 8 }}>✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-cormorant text-sm" style={{ color: sel ? 'var(--gold-lt)' : 'var(--cream)' }}>{room.name}</div>
                      <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 8 }}>
                        {ev ? `${ev.flag} ${ev.city}` : room.event_id} · #{room.join_code}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {recipientMode === 'manual' && (
            <div>
              <label style={labelStyle}>EMAIL ADDRESSES</label>
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

      {/* Notification type */}
      <div className="mb-5">
        <label style={labelStyle}>NOTIFICATION TYPE</label>
        <div className="grid grid-cols-2 gap-2">
          {NOTIFICATION_TYPES.map(t => (
            <button key={t.id} onClick={() => setSelectedType(t.id)}
              className="text-left px-3 py-2.5 rounded-lg transition-all"
              style={{ background: selectedType === t.id ? 'rgba(180,149,48,0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedType === t.id ? 'rgba(180,149,48,0.4)' : 'rgba(180,149,48,0.1)'}` }}>
              <div className="text-base mb-0.5">{t.icon}</div>
              <div className="font-cinzel text-xs" style={{ color: selectedType === t.id ? 'var(--gold)' : 'var(--cream)', fontSize: 9, letterSpacing: '0.08em' }}>{t.label}</div>
              <div className="font-cormorant text-xs italic mt-0.5" style={{ color: 'var(--mid)' }}>{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Event */}
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

      {/* Event start time — shown for draft_open and team_results */}
      {(selectedType === 'draft_open' || selectedType === 'team_results') && (
        <div className="mb-4 rounded-lg p-3" style={{ background: 'rgba(180,149,48,0.04)', border: '1px solid rgba(180,149,48,0.15)' }}>
          <label style={labelStyle}>EVENT START TIME (CET)</label>
          <input
            value={eventStartTime}
            onChange={e => setEventStartTime(e.target.value)}
            placeholder="e.g. Saturday June 21 at 8:00 PM CET"
            style={inputStyle}
          />
          {eventStartTime && (
            <p className="font-cormorant italic text-xs mt-2" style={{ color: 'var(--gold-lt)' }}>
              Email will say: picks lock 5 minutes before <strong>{eventStartTime}</strong>
            </p>
          )}
          {!eventStartTime && (
            <p className="font-cormorant italic text-xs mt-2" style={{ color: 'var(--mid)' }}>
              Leave blank to omit lock time from email
            </p>
          )}
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
            placeholder="e.g. Important update from EquiPrix"
            style={{ ...inputStyle, marginBottom: 8 }} />
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
        style={{ background: preview ? 'rgba(180,149,48,0.12)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(180,149,48,0.2)', color: preview ? 'var(--gold)' : 'var(--mid)', letterSpacing: '0.08em', fontSize: 9 }}>
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
                  {selectedType === 'draft_open' && selectedEvent
                    ? `Your picks for ${selectedEvent.city} are now open.${lockTimeStr ? ` The GP starts ${eventStartTime}. Picks lock 5 minutes before start.` : ''}`
                    : selectedType === 'team_results' && selectedEvent
                    ? `Team results for ${selectedEvent.city} are posted. GP draft is open.${lockTimeStr ? ` The GP starts ${eventStartTime}. Picks lock 5 minutes before start.` : ''}`
                    : selectedType === 'final_results' && selectedEvent
                    ? `${selectedEvent.city} is complete. Check the final leaderboard.`
                    : selectedType === 'custom' ? customMessage || 'Your message here…'
                    : selectedEvent ? `${selectedEvent.city} ${selectedEvent.dates} is coming to EquiPrix.` : ''}
                  {selectedType !== 'custom' && customMessage ? ` ${customMessage}` : ''}
                </p>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', background: '#b49530', color: '#0f0e0a', padding: '10px 24px', borderRadius: 3, fontSize: 10, fontWeight: 'bold', letterSpacing: '0.12em' }}>
                    {selectedType === 'draft_open' ? 'MAKE YOUR PICKS' :
                     selectedType === 'team_results' ? 'VIEW RESULTS & PICK RIDERS' :
                     selectedType === 'final_results' ? 'VIEW FINAL LEADERBOARD' : 'OPEN EQUIPRIX'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <button onClick={send} disabled={sending}
        className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
        style={{ background: sending ? 'rgba(180,149,48,0.1)' : 'var(--gold)', color: sending ? 'var(--mid)' : 'var(--ink)', letterSpacing: '0.1em' }}>
        <Send size={13} />
        {sending ? 'SENDING…' : 'SEND NOTIFICATION'}
      </button>

      {result && (
        <div className="mt-4 px-4 py-3 rounded-lg flex items-start gap-3"
          style={{ background: result.error || result.failed > 0 ? 'rgba(224,112,112,0.08)' : 'rgba(76,175,125,0.08)', border: `1px solid ${result.error || result.failed > 0 ? 'rgba(224,112,112,0.3)' : 'rgba(76,175,125,0.3)'}` }}>
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