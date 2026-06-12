import React, { useState } from 'react';
import { ADMIN_PASSWORD } from '@/lib/equiprix-data';
import RankingsImport from '@/components/admin/RankingsImport';
import TeamsEditor from '@/components/admin/TeamsEditor';
import RidersEditor from '@/components/admin/RidersEditor';
import StartListEditor from '@/components/admin/StartListEditor';
import ResultsEditor from '@/components/admin/ResultsEditor';
import EventStatusEditor from '@/components/admin/EventStatusEditor';
import TeamStandingsEditor from '@/components/admin/TeamStandingsEditor';
import { Lock, BarChart3, Users, ListOrdered, Trophy, ShieldHalf, CalendarCog, TrendingUp } from 'lucide-react';

const TABS = [
  { id: 'status', label: 'Status', icon: CalendarCog },
  { id: 'rankings', label: 'Rankings', icon: BarChart3 },
  { id: 'standings', label: 'Standings', icon: TrendingUp },
  { id: 'teams', label: 'Teams', icon: ShieldHalf },
  { id: 'riders', label: 'Riders', icon: Users },
  { id: 'startlist', label: 'Start List', icon: ListOrdered },
  { id: 'results', label: 'Results', icon: Trophy },
];

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('status');

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      setError('Incorrect password');
    }
  };

  if (!authed) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6" style={{ background: 'var(--ink)' }}>
        <div className="w-full max-w-sm rounded-xl p-6" style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.25)' }}>
          <div className="flex items-center gap-2 mb-6">
            <Lock size={16} style={{ color: 'var(--gold)' }} />
            <span className="font-cinzel text-sm tracking-widest" style={{ color: 'var(--gold)' }}>ADMIN ACCESS</span>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded px-3 py-2 mb-3 text-sm outline-none"
              style={{ background: 'rgba(180,149,48,0.06)', border: '1px solid rgba(180,149,48,0.25)', color: 'var(--cream)' }}
            />
            {error && <p className="text-xs mb-3 font-cormorant italic" style={{ color: 'var(--crimson)' }}>{error}</p>}
            <button type="submit" className="w-full py-2.5 rounded font-cinzel text-xs tracking-widest" style={{ background: 'var(--gold)', color: 'var(--ink)' }}>
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ep-border)', background: '#0a0907' }}>
        <span className="font-cinzel text-sm tracking-widest" style={{ color: 'var(--gold)' }}>ADMIN PANEL</span>
        <button onClick={() => setAuthed(false)} className="text-xs font-cinzel tracking-widest" style={{ color: 'var(--mid)' }}>LOCK</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-3 py-2 rounded font-cinzel text-xs transition-all"
            style={{
              background: activeTab === id ? 'rgba(180,149,48,0.12)' : 'none',
              border: `1px solid ${activeTab === id ? 'rgba(180,149,48,0.4)' : 'transparent'}`,
              color: activeTab === id ? 'var(--gold)' : 'var(--mid)',
              letterSpacing: '0.08em',
            }}
          >
            <Icon size={13} />
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'status' && <EventStatusEditor />}
        {activeTab === 'rankings' && <RankingsImport />}
        {activeTab === 'standings' && <TeamStandingsEditor />}
        {activeTab === 'teams' && <TeamsEditor />}
        {activeTab === 'riders' && <RidersEditor />}
        {activeTab === 'startlist' && <StartListEditor />}
        {activeTab === 'results' && <ResultsEditor />}
      </div>
    </div>
  );
}