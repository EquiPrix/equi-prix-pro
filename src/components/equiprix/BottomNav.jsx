import React from 'react';
import { Calendar, Users, Trophy, BarChart3 } from 'lucide-react';

const tabs = [
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'draft', label: 'My Team', icon: Users },
  { id: 'results', label: 'Results', icon: Trophy },
  { id: 'leaderboard', label: 'Standings', icon: BarChart3 },
];

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch bottom-nav"
      style={{
        background: '#0a0907',
        borderTop: '1px solid var(--ep-border)',
      }}
    >
      {tabs.map(({ id, label, icon: IconComponent }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all active:scale-95 relative"
            style={{
              background: 'none',
              border: 'none',
              color: active ? 'var(--gold)' : 'var(--mid)',
            }}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2"
                style={{
                  height: '2px',
                  width: '32px',
                  background: 'var(--gold)',
                  borderRadius: '0 0 2px 2px',
                }}
              />
            )}
            <IconComponent size={20} strokeWidth={active ? 2 : 1.5} />
            <span
              className="font-cinzel"
              style={{
                fontSize: '8px',
                letterSpacing: '0.08em',
                fontWeight: active ? '600' : '400',
              }}
            >
              {label.toUpperCase()}
            </span>
          </button>
        );
      })}
    </nav>
  );
}