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
import HorseDBEditor from '@/components/admin/HorseDBEditor';
import MlsjEventStatusEditor from '@/components/admin/MlsjEventStatusEditor';
import MlsjTeamStandingsEditor from '@/components/admin/MlsjTeamStandingsEditor';
import MlsjStartListEditor from '@/components/admin/MlsjStartListEditor';
import { MlsjResultsEditor } from '@/components/admin/MlsjResultsEditor';
import MlsjTeamsEditor from '@/components/admin/MlsjTeamsEditor';
import {
  Lock, BarChart3, Users, ListOrdered, Trophy, ShieldHalf,
  CalendarCog, TrendingUp, DoorOpen, Bell, Database,
} from 'lucide-react';

// ── Tab definitions ───────────────────────────────────────────────────────────
// League-specific tabs: different components render per league toggle.
// Shared tabs: always visible regardless of league — they manage global data.

const GCL_TABS = [
  { id: 'status',    label: 'Status',     icon: CalendarCog },
  { id: 'standings', label: 'Standings',  icon: TrendingUp  },
  { id: 'teams',     label: 'Teams',      icon: ShieldHalf  },
  { id: 'startlist', label: 'Start List', icon: ListOrdered },
  { id: 'results',   label: 'Results',    icon: Trophy      },
  { id: 'rooms',     label: 'Rooms',      icon: DoorOpen    },
];

const MLSJ_TABS = [
  { id: 'status',    label: 'Status',     icon: CalendarCog },
  { id: 'standings', label: 'Standings',  icon: TrendingUp  },
  { id: 'teams',     label: 'Teams',      icon: ShieldHalf  },
  { id: 'startlist', label: 'Start List', icon: ListOrdered },
  { id: 'results',   label: 'Results',    icon: Trophy      },
  { id: 'rooms',     label: 'Rooms',      icon: DoorOpen    },
];

// Shared tabs apply to both leagues — shown in a separate row.
// Rankings: one FEI upload updates all riders in both leagues.
// Riders: single rider DB used by both leagues.
// Horses: shared horse registry.
// Notify: sends to users, not tied to a league.
const SHARED_TABS = [
  { id: 'rankings',      label: 'Rankings', icon: BarChart3 },
  { id: 'riders',        label: 'Riders',   icon: Users     },
  { id: 'horses',        label: 'Horses',   icon: Database  },
  { id: 'notifications', label: 'Notify',   icon: Bell      },
];

function LeagueToggle({ league, onChange }) {
  return (
    <div className="flex items-center rounded overflow-hidden"
      style={{ border: '1px solid rgba(180,149,48,0.3)' }}>
      {[{ id: 'gcl', label: 'GCL' }, { id: 'mlsj', label: 'MLSJ' }].map(l => (
        <button key={l.id} onClick={() => onChange(l.id)}
          className="font-cinzel text-xs px-3 py-1.5"
          style={{
            letterSpacing: '0.08em',
            background: league === l.id ? 'var(--gold)' : 'transparent',
            color:      league === l.id ? 'var(--ink)'  : 'var(--mid)',
            border: 'none',
          }}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function TabBar({ tabs, activeTab, onSelect, dim = false }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onSelect(id)}
          className="flex items-center gap-2 px-3 py-2 rounded font-cinzel text-xs transition-all"
          style={{
            background: activeTab === id ? 'rgba(180,149,48,0.12)' : 'none',
            border: `1px solid ${activeTab === id ? 'rgba(180,149,48,0.4)' : 'transparent'}`,
            color: activeTab === id ? 'var(--gold)' : dim ? 'rgba(255,255,255,0.35)' : 'var(--mid)',
            letterSpacing: '0.08em',
          }}>
          <Icon size={13} />
          {label.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed]     = useState(false);
  const [error, setError]       = useState('');
  const [league, setLeague]     = useState('gcl');
  const [activeTab, setActiveTab] = useState('status');
  const [activeSharedTab, setActiveSharedTab] = useState(null); // null = no shared tab active

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) { setAuthed(true); }
    else { setError('Incorrect password'); }
  };

  const handleLeagueChange = (next) => {
    setLeague(next);
    setActiveSharedTab(null); // clear shared tab when switching league
    const validTabs = next === 'gcl' ? GCL_TABS : MLSJ_TABS;
    if (!validTabs.find(t => t.id === activeTab)) {
      setActiveTab(validTabs[0].id);
    }
  };

  const handleLeagueTabSelect = (id) => {
    setActiveTab(id);
    setActiveSharedTab(null);
  };

  const handleSharedTabSelect = (id) => {
    setActiveSharedTab(id);
    setActiveTab(''); // deselect league tab
  };

  if (!authed) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6" style={{ background: 'var(--ink)' }}>
        <div className="w-full max-w-sm rounded-xl p-6"
          style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.25)' }}>
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

  const LEAGUE_TABS = league === 'gcl' ? GCL_TABS : MLSJ_TABS;

  return (
    <div className="min-h-screen" style={{ background: 'var(--ink)' }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--ep-border)', background: '#0a0907' }}>
        <div className="flex items-center gap-3">
          <span className="font-cinzel text-sm tracking-widest" style={{ color: 'var(--gold)' }}>ADMIN PANEL</span>
          <LeagueToggle league={league} onChange={handleLeagueChange} />
        </div>
        <button onClick={() => setAuthed(false)}
          className="text-xs font-cinzel tracking-widest" style={{ color: 'var(--mid)' }}>
          LOCK
        </button>
      </div>

      {/* League-specific tabs */}
      <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--ep-border)', background: '#0a0907' }}>
        <div className="font-cinzel text-xs mb-2" style={{ color: 'var(--mid)', fontSize: 8, letterSpacing: '0.12em', opacity: 0.6 }}>
          {league.toUpperCase()} TABS
        </div>
        <TabBar tabs={LEAGUE_TABS} activeTab={activeSharedTab ? '' : activeTab} onSelect={handleLeagueTabSelect} />
      </div>

      {/* Shared tabs */}
      <div className="px-4 pt-2 pb-3" style={{ borderBottom: '1px solid var(--ep-border)', background: '#080806' }}>
        <div className="font-cinzel text-xs mb-2" style={{ color: 'var(--mid)', fontSize: 8, letterSpacing: '0.12em', opacity: 0.6 }}>
          SHARED
        </div>
        <TabBar tabs={SHARED_TABS} activeTab={activeSharedTab || ''} onSelect={handleSharedTabSelect} dim />
      </div>

      {/* Content */}
      <div className="p-4">

        {/* ── League: GCL ── */}
        {!activeSharedTab && league === 'gcl' && activeTab === 'status'    && <EventStatusEditor />}
        {!activeSharedTab && league === 'gcl' && activeTab === 'standings' && <TeamStandingsEditor />}
        {!activeSharedTab && league === 'gcl' && activeTab === 'teams'     && <TeamsEditor />}
        {!activeSharedTab && league === 'gcl' && activeTab === 'startlist' && <StartListEditor />}
        {!activeSharedTab && league === 'gcl' && activeTab === 'results'   && <ResultsEditor />}
        {!activeSharedTab && league === 'gcl' && activeTab === 'rooms'     && <RoomsEditor league="gcl" />}

        {/* ── League: MLSJ ── */}
        {!activeSharedTab && league === 'mlsj' && activeTab === 'status'    && <MlsjEventStatusEditor />}
        {!activeSharedTab && league === 'mlsj' && activeTab === 'standings' && <MlsjTeamStandingsEditor />}
        {!activeSharedTab && league === 'mlsj' && activeTab === 'teams'     && <MlsjTeamsEditor />}
        {!activeSharedTab && league === 'mlsj' && activeTab === 'startlist' && <MlsjStartListEditor />}
        {!activeSharedTab && league === 'mlsj' && activeTab === 'results'   && <MlsjResultsEditor />}
        {!activeSharedTab && league === 'mlsj' && activeTab === 'rooms'     && <RoomsEditor league="mlsj" />}

        {/* ── Shared ── */}
        {activeSharedTab === 'rankings'      && <RankingsImport />}
        {activeSharedTab === 'riders'        && <RidersEditor />}
        {activeSharedTab === 'horses'        && <HorseDBEditor />}
        {activeSharedTab === 'notifications' && <NotificationsEditor />}
      </div>
    </div>
  );
}