import React, { useState } from 'react';
import { ADMIN_PASSWORD } from '@/lib/equiprix-data';
import RankingsImport from '@/components/admin/RankingsImport';
import TeamsEditor from '@/components/admin/TeamsEditor';
import RidersEditor from '@/components/admin/RidersEditor';
import StartListEditor from '@/components/admin/StartListEditor';
import ResultsEditor from '@/components/admin/ResultsEditor';
import EventStatusEditor from '@/components/admin/EventStatusEditor';
import TeamStandingsEditor from '@/components/admin/TeamStandingsEditor';
import RoomsEditor from '@/components/admin/RoomsEditor';
import NotificationsEditor from '@/components/admin/NotificationsEditor';
import MlsjRankingsImport from '@/components/admin/MlsjRankingsImport';
import MlsjStartListEditor from '@/components/admin/MlsjStartListEditor';
import { MlsjResultsEditor } from '@/components/admin/MlsjResultsEditor';
import { Lock, BarChart3, Users, ListOrdered, Trophy, ShieldHalf, CalendarCog, TrendingUp, DoorOpen, Bell } from 'lucide-react';

// Tabs that exist per-league — rendered differently based on the league toggle.
// "Status", "Standings", legacy "Teams", and "Rooms" stay GCL-only for now
// since MLSJ has no equivalent yet. "Rankings", "Start List", and "Results"
// have real MLSJ twins below. MLSJ "Riders" was folded into Start List (trio
// declaration + GP field) since that's the actual data-entry surface.
const GCL_TABS = [
  { id: 'status', label: 'Status', icon: CalendarCog },
  { id: 'rankings', label: 'Rankings', icon: BarChart3 },
  { id: 'standings', label: 'Standings', icon: TrendingUp },
  { id: 'teams', label: 'Teams', icon: ShieldHalf },
  { id: 'riders', label: 'Riders', icon: Users },
  { id: 'startlist', label: 'Start List', icon: ListOrdered },
  { id: 'results', label: 'Results', icon: Trophy },
  { id: 'rooms', label: 'Rooms', icon: DoorOpen },
  { id: 'notifications', label: 'Notify', icon: Bell },
];

const MLSJ_TABS = [
  { id: 'rankings', label: 'Rankings', icon: BarChart3 },
  { id: 'startlist', label: 'Start List', icon: ListOrdered },
  { id: 'results', label: 'Results', icon: Trophy },
  { id: 'notifications', label: 'Notify', icon: Bell },
];

function LeagueToggle({ league, onChange }) {
  return (
    <div className="flex items-center rounded overflow-hidden" style={{ border: '1px solid rgba(180,149,48,0.3)' }}>
      {[{ id: 'gcl', label: 'GCL' }, { id: 'mlsj', label: 'MLSJ' }].map(l => (
        <button
          key={l.id}
          onClick={() => onChange(l.id)}
          className="font-cinzel text-xs px-3 py-1.5"
          style={{
            letterSpacing: '0.08em',
            background: league === l.id ? 'var(--gold)' : 'transparent',
            color: league === l.id ? 'var(--ink)' : 'var(--mid)',
            border: 'none',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [league, setLeague] = useState('gcl'); // 'gcl' | 'mlsj'
  const [activeTab, setActiveTab] = useState('status');

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      setError('Incorrect password');
    }
  };

  const handleLeagueChange = (next) => {
    setLeague(next);
    const validTabs = next === 'gcl' ? GCL_TABS : MLSJ_TABS;
    if (!validTabs.find(t => t.id === activeTab)) {
      setActiveTab(validTabs[0].id);
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
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" autoFocus
              className="w-full rounded px-3 py-2 mb-3 text-sm outline-none"
              style={{ background: 'rgba(180,149,48,0.06)', border: '1px solid rgba(180,149,48,0.25)', color: 'var(--cream)' }} />
            {error && <p className="text-xs mb-3 font-cormorant italic" style={{ color: 'var(--crimson)' }}>{error}</p>}
            <button type="submit" className="w-full py-2.5 rounded font-cinzel text-xs tracking-widest"
              style={{ background: 'var(--gold)', color: 'var(--ink)' }}>
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  const TABS = league === 'gcl' ? GCL_TABS : MLSJ_TABS;

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--ep-border)', background: '#0a0907' }}>
        <div className="flex items-center gap-3">
          <span className="font-cinzel text-sm tracking-widest" style={{ color: 'var(--gold)' }}>ADMIN PANEL</span>
          <LeagueToggle league={league} onChange={handleLeagueChange} />
        </div>
        <button onClick={() => setAuthed(false)} className="text-xs font-cinzel tracking-widest" style={{ color: 'var(--mid)' }}>LOCK</button>
      </div>

      <div className="flex gap-1 px-4 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-3 py-2 rounded font-cinzel text-xs transition-all"
            style={{
              background: activeTab === id ? 'rgba(180,149,48,0.12)' : 'none',
              border: `1px solid ${activeTab === id ? 'rgba(180,149,48,0.4)' : 'transparent'}`,
              color: activeTab === id ? 'var(--gold)' : 'var(--mid)',
              letterSpacing: '0.08em',
            }}>
            <Icon size={13} />
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="p-4">
        {league === 'gcl' && activeTab === 'status' && <EventStatusEditor />}
        {league === 'gcl' && activeTab === 'rankings' && <RankingsImport />}
        {league === 'gcl' && activeTab === 'standings' && <TeamStandingsEditor />}
        {league === 'gcl' && activeTab === 'teams' && <TeamsEditor />}
        {league === 'gcl' && activeTab === 'riders' && <RidersEditor />}
        {league === 'gcl' && activeTab === 'startlist' && <StartListEditor />}
        {league === 'gcl' && activeTab === 'results' && <ResultsEditor />}
        {league === 'gcl' && activeTab === 'rooms' && <RoomsEditor />}
        {league === 'gcl' && activeTab === 'notifications' && <NotificationsEditor />}

        {league === 'mlsj' && activeTab === 'rankings' && <MlsjRankingsImport />}
        {league === 'mlsj' && activeTab === 'startlist' && <MlsjStartListEditor />}
        {league === 'mlsj' && activeTab === 'results' && <MlsjResultsEditor />}
        {league === 'mlsj' && activeTab === 'notifications' && <NotificationsEditor />}
      </div>
    </div>
  );
}