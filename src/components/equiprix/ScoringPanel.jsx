import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const rows = [
  { section: 'Grand Prix' },
  { label: 'Clear round', pts: '+20' },
  { label: '1st place', pts: '+50' },
  { label: '2nd place', pts: '+38' },
  { label: '3rd place', pts: '+30' },
  { label: '4th–8th place', pts: '+24–+10' },
  { label: '9th–12th place', pts: '+6' },
  { label: '13th–20th place', pts: '+3' },
  { label: 'Rail down', pts: '−4' },
  { label: 'Refusal', pts: '−6' },
  { label: 'Retirement', pts: '−8' },
  { label: 'Elimination', pts: '−15' },
  { section: 'GCL Team Event' },
  { label: 'Advance to Round 2', pts: '+15' },
  { label: '1st place', pts: '+40' },
  { label: '2nd place', pts: '+30' },
  { label: '3rd place', pts: '+22' },
  { label: '4th–6th place', pts: '+15' },
  { label: '7th–10th place', pts: '+8' },
  { label: 'Did not advance', pts: '+3' },
  { section: 'Bonuses' },
  { label: 'Picked GP winner', pts: '+30' },
  { label: 'Captain wins GP', pts: '+50' },
  { label: 'Captain multiplier', pts: '1.5×' },
];

export default function ScoringPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 rounded overflow-hidden" style={{ background: 'rgba(180,149,48,0.04)', border: '1px solid rgba(180,149,48,0.15)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5"
        style={{ background: 'none', border: 'none' }}
      >
        <span className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)', letterSpacing: '0.14em' }}>
          SCORING RULES
        </span>
        {open ? <ChevronUp size={12} style={{ color: 'var(--gold)' }} /> : <ChevronDown size={12} style={{ color: 'var(--gold)' }} />}
      </button>
      {open && (
        <div className="px-3 pb-2">
          {rows.map((row, i) =>
            row.section ? (
              <div key={i} className="font-cinzel text-xs mt-2 mb-1" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
                {row.section.toUpperCase()}
              </div>
            ) : (
              <div key={i} className="flex justify-between text-xs py-1" style={{ borderBottom: '1px solid rgba(42,40,32,0.4)', color: 'var(--mid)' }}>
                <span>{row.label}</span>
                <span className="font-cormorant text-sm" style={{ color: 'var(--gold-lt)' }}>{row.pts}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}