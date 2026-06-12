import React from 'react';
import { fmt } from '@/lib/equiprix-data';
import { Plus, Check } from 'lucide-react';

export default function RiderRow({ rider, band, inTeam, unaffordable, locked, onAdd }) {
  const bandColors = {
    'band-1': { bg: 'rgba(180,149,48,0.2)', color: 'var(--gold-lt)' },
    'band-2': { bg: 'rgba(61,90,76,0.2)', color: '#6aad8a' },
    'band-3': { bg: 'rgba(42,40,32,0.6)', color: 'var(--mid)' },
  };
  const bc = bandColors[band.cls] || bandColors['band-3'];

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 border-b transition-all"
      style={{
        borderColor: 'rgba(42,40,32,0.5)',
        background: inTeam ? 'rgba(180,149,48,0.06)' : 'transparent',
        opacity: (unaffordable || inTeam) ? (inTeam ? 0.45 : 0.3) : 1,
        cursor: inTeam ? 'default' : 'pointer',
      }}
      onClick={!inTeam && !unaffordable && !locked ? onAdd : undefined}
    >
      {/* Rank */}
      <div
        className="font-cormorant text-base font-bold w-7 text-center flex-shrink-0"
        style={{ color: rider.rank <= 3 ? 'var(--gold)' : 'var(--mid)' }}
      >
        {rider.rank}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="font-cormorant text-sm font-semibold" style={{ color: 'var(--cream)' }}>
          {rider.name}
        </div>
        <div className="text-xs" style={{ color: 'var(--mid)' }}>{rider.nat}</div>
        {rider.horse && (
          <div className="text-xs italic" style={{ color: 'var(--gold-lt)' }}>{rider.horse}</div>
        )}
        <span
          className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5"
          style={{ background: bc.bg, color: bc.color, fontSize: 9, letterSpacing: '0.04em' }}
        >
          {band.label}
        </span>
      </div>

      {/* Salary + add */}
      <div className="text-right flex-shrink-0">
        <div className="font-cormorant text-sm font-semibold" style={{ color: 'var(--ep-text)' }}>
          {fmt(rider.salary)}
        </div>
        {!inTeam && !locked && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="mt-1 w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{
              background: 'var(--ep-card)',
              border: '1px solid rgba(180,149,48,0.3)',
              color: 'var(--gold)',
            }}
          >
            <Plus size={12} />
          </button>
        )}
        {inTeam && (
          <div className="mt-1 w-6 h-6 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(180,149,48,0.15)', border: '1px solid rgba(180,149,48,0.3)' }}>
            <Check size={10} style={{ color: 'var(--gold)' }} />
          </div>
        )}
      </div>
    </div>
  );
}