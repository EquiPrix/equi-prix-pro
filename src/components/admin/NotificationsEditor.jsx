import React, { useState, useEffect } from 'react';
import { EVENTS_2026, sbFetch } from '@/lib/equiprix-data';
import { Send, Users, CheckCircle, AlertCircle } from 'lucide-react';

const NOTIFICATION_TYPES = [
  { id: 'draft_open', label: 'Draft Open', description: 'Announce picks are open + lock time', icon: '🟢' },
  { id: 'team_results', label: 'Team Results + GP Draft', description: 'Team results posted + GP draft open + lock time', icon: '🏆' },
  { id: 'final_results', label: 'Final Results', description: 'Event complete + final leaderboard', icon: '🎯' },
  { id: 'new_event', label: 'New Event', description: 'Announce upcoming event + sponsor', icon: '📣' },
];

export default function NotificationsEditor() {
  const [selectedType, setSelectedType] = useState('draft_open');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [lockTime, setLockTime] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [manualEmails, setManualEmails] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => { loadRecipients(); }, []);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const emails = new Set();

      // 1. From user_mapping (users who signed up via email)
      const mapping = await sbFetch('results?event=eq.user_mapping&limit=1');
      if (mapping?.[0]?.rider_results) {
        Object.keys(mapping[0].rider_results).forEach(email => {
          if (email.includes('@')) emails.add(email);
        });
      }

      // 2. From room_members (anyone who joined a room)
      const members = await sbFetch('room_members?select=user_email') || [];
      members.forEach(m => { if (m.user_email?.includes('@')) emails.add(m.user_email); });

      // 3. From picks table (legacy access codes that are emails)
      const picks = await sbFetch('picks?select=access_code') || [];
      picks.forEach(p => { if (p.access_code?.includes('@')) emails.add(p.access_code); });

      setRecipients([...emails]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const allRecipients = () => {
    const extra = manualEmails.split(/[\n,;]/).map(e => e.trim()).filter(e => e.includes('@'));
    return [...new Set([...recipients, ...extra])];
  };

  const selectedEvent = EVENTS_2026.find(e => e.id === selectedEventId);
  const notificationType = NOTIFICATION_TYPES.find(t => t.id === selectedType);

  const send = async () => {
    const to = allRecipients();
    if (!selectedEventId || !to.length) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          recipients: to,
          eventName: selectedEvent ? `${selectedEvent.city}` : '',
          eventFlag: selectedEvent?.flag || '🏇',
          eventDates: selectedEvent?.dates || '',
          lockTime: lockTime || null,
          customMessage: customMessage || null,
          sponsorName: sponsorName || null,
        }),
      });
      const data = await res.json();
      setResult(data);
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

  const total = allRecipients().length;

  return (
    <div>
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>NOTIFICATIONS</h2>
      <p className="font-cormorant text-base italic mb-6" style={{ color: 'var(--mid)' }}>
        Send event emails to registered users.
      </p>

      {/* Recipients */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg"
        style={{ background: 'rgba(180,149,48,0.06)', border: '1px solid rgba(180,149,48,0.15)' }}>
        <Users size={14} style={{ color: 'var(--gold)' }} />
        <span className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>
          {loadingRecipients ? 'Loading…' : `${recipients.length} registered users found`}
        </span>
        <button onClick={loadRecipients} className="ml-auto font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.08em' }}>
          REFRESH
        </button>
      </div>

      {/* Manual email override */}
      <div className="mb-5">
        <label style={labelStyle}>ADDITIONAL EMAILS (optional — comma or line separated)</label>
        <textarea
          value={manualEmails}
          onChange={e => setManualEmails(e.target.value)}
          placeholder="user@example.com, another@example.com"
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        {total > 0 && (
          <p className="font-cormorant italic text-xs mt-1" style={{ color: 'var(--gold-lt)' }}>
            Total recipients: {total}
          </p>
        )}
      </div>

      {/* Notification type */}
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

      {/* Event */}
      <div className="mb-4">
        <label style={labelStyle}>EVENT</label>
        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} style={inputStyle}>
          <option value="">— Select Event —</option>
          {EVENTS_2026.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} · {ev.dates}</option>
          ))}
        </select>
      </div>

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

      <div className="mb-6">
        <label style={labelStyle}>CUSTOM MESSAGE (optional)</label>
        <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)}
          placeholder="Add a personal note or extra details…"
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

      {preview && selectedEvent && (
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
                   `${selectedEvent.city} is coming.`}
                </p>
                <p style={{ fontSize: 12, color: '#b49530', lineHeight: 1.6, margin: '0 0 16px' }}>
                  {selectedType === 'draft_open' ? `Your picks for ${selectedEvent.city} are now open.${lockTime ? ` Picks lock: ${lockTime}.` : ''}` :
                   selectedType === 'team_results' ? `Team results for ${selectedEvent.city} are posted. Lock in your GP rider picks${lockTime ? ` before ${lockTime}` : ''}.` :
                   selectedType === 'final_results' ? `${selectedEvent.city} is complete. Check the final leaderboard.` :
                   `${selectedEvent.city} ${selectedEvent.dates} is coming to EquiPrix.`}
                  {customMessage && ` ${customMessage}`}
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

      <button onClick={send} disabled={sending || !selectedEventId || !total}
        className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
        style={{
          background: sending ? 'rgba(180,149,48,0.1)' : 'var(--gold)',
          color: sending ? 'var(--mid)' : 'var(--ink)',
          letterSpacing: '0.1em',
          opacity: (!selectedEventId || !total) ? 0.4 : 1,
        }}>
        <Send size={13} />
        {sending ? 'SENDING…' : `SEND TO ${total} USER${total !== 1 ? 'S' : ''}`}
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