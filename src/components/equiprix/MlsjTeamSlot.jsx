import React from 'react';
import { fmt } from '@/lib/equiprix-data';
import { X } from 'lucide-react';

export default function MlsjTeamSlot({ entry, isCpt, onRemove, onMakeCpt, isLocked, className = '' }) {
  return (
    <div
      className={`flex items-center gap-2 p-2 mb-1 rounded ${className}`}
      style={{
        background: entry ? (isCpt ? 'rgba(180,149,48,0.05)' : 'var(--ep-card)') : 'transparent',
        border: `1px ${entry ? 'solid' : 'dashed'} ${isCpt ? 'rgba(180,149,48,0.35)' : 'var(--ep-border)'}`,
        minHeight: 40,
      }}
    >
      <span
        className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
        style={{
          background: isCpt ? 'var(--gold)' : 'rgba(180,149,48,0.15)',
          color: isCpt ? 'var(--ink)' : 'var(--gold-lt)',
          fontFamily: "'Cinzel', serif",
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.1em'
        }}
      >
        {isCpt ? 'CPT' : 'R'}
      </span>

      {entry ? (
        <>
          <span className="flex-1 text-xs font-semibold truncate" style={{ color: 'var(--cream)', fontFamily: "'Cormorant Garamond', serif", fontSize: 13 }}>
            {entry.rider.name}
          </span>
          <span className="text-xs flex-shrink-0" style={{ color: entry.isCpt ? 'var(--gold-lt)' : 'var(--mid)' }}>
            {fmt(entry.isCpt ? entry.rider.salary + 1000 : entry.rider.salary)}
          </span>
          {!isCpt && !isLocked && onMakeCpt && (
            <button
              onClick={() => onMakeCpt(entry.rider.id)}
              className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 transition-all"
              style={{
                background: 'none',
                border: '1px solid rgba(180,149,48,0.3)',
                color: 'var(--gold)',
                fontFamily: "'Cinzel', serif",
                fontSize: 8,
                letterSpacing: '0.06em',
              }}
            >
              ★
            </button>
          )}
          {!isLocked && (
            <button onClick={() => onRemove(entry.rider.id)} style={{ color: 'var(--mid)', flexShrink: 0 }}>
              <X size={12} />
            </button>
          )}
        </>
      ) : (
        <span className="text-xs italic" style={{ color: 'var(--mid)' }}>
          {isLocked ? (isCpt ? 'Captain locked' : 'Rider locked') : isCpt ? 'Select captain (1.5× pts, +$1K)' : 'Select rider'}
        </span>
      )}
    </div>
  );
}