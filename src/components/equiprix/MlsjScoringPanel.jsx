import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import {
  MLSJ_GP_POS_PTS, MLSJ_GP_CLEAR_BONUS,
  MLSJ_TEAM_R1_ADVANCE, MLSJ_TEAM_R1_ELIM_PTS,
  MLSJ_TEAM_R2_GOLD_SIDE, MLSJ_TEAM_R2_BRONZE_SIDE,
  MLSJ_TEAM_FINAL_PTS, MLSJ_TEAM_RETIRED, MLSJ_TEAM_ELIMINATED,
} from '@/lib/mlsj-data';

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(42,40,32,0.4)' }}>
      <span className="font-cormorant text-sm" style={{ color: 'var(--mid)' }}>{label}</span>
      <span className="font-cormorant text-sm font-semibold" style={{ color: typeof value === 'string' && value.startsWith('-') ? '#e07070' : 'var(--gold-lt)' }}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div className="font-cinzel text-xs tracking-widest mt-4 mb-1" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
      {children}
    </div>
  );
}

export default function MlsjScoringPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg mt-2" style={{ border: '1px solid var(--ep-border)' }}>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5"
        style={{ background: 'rgba(180,149,48,0.04)' }}
      >
        <span className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)', letterSpacing: '0.1em' }}>
          SCORING RULES
        </span>
        {open ? <ChevronUp size={14} style={{ color: 'var(--gold)' }} /> : <ChevronDown size={14} style={{ color: 'var(--gold)' }} />}
      </button>

      {open && (
        <div className="px-3 pb-3" style={{ borderTop: '1px solid var(--ep-border)' }}>
          <SectionHeader>GRAND PRIX</SectionHeader>
          <Row label="Clear round" value={`+${MLSJ_GP_CLEAR_BONUS}`} />
          <Row label="1st place" value={`+${MLSJ_GP_POS_PTS[1]}`} />
          <Row label="2nd place" value={`+${MLSJ_GP_POS_PTS[2]}`} />
          <Row label="3rd place" value={`+${MLSJ_GP_POS_PTS[3]}`} />
          <Row label="4th–8th place" value={`+${MLSJ_GP_POS_PTS[8]}–+${MLSJ_GP_POS_PTS[4]}`} />
          <Row label="9th–12th place" value="+6" />
          <Row label="13th–20th place" value="+3" />
          <Row label="Captain multiplier" value="×1.5" />

          <SectionHeader>TEAM COMPETITION</SectionHeader>
          <Row label="Advance to Round 2 (top 4 of 8)" value={`+${MLSJ_TEAM_R1_ADVANCE}`} />
          <Row label="Eliminated Round 1 — 5th place" value={`+${MLSJ_TEAM_R1_ELIM_PTS[5]}`} />
          <Row label="Eliminated Round 1 — 6th place" value={`+${MLSJ_TEAM_R1_ELIM_PTS[6]}`} />
          <Row label="Eliminated Round 1 — 7th place" value={`+${MLSJ_TEAM_R1_ELIM_PTS[7]}`} />
          <Row label="Eliminated Round 1 — 8th place" value={`+${MLSJ_TEAM_R1_ELIM_PTS[8]}`} />
          <Row label="Advance to Gold/Silver match" value={`+${MLSJ_TEAM_R2_GOLD_SIDE}`} />
          <Row label="Drop to Bronze match" value={`+${MLSJ_TEAM_R2_BRONZE_SIDE}`} />
          <Row label="Gold (1st)" value={`+${MLSJ_TEAM_FINAL_PTS.gold}`} />
          <Row label="Silver (2nd)" value={`+${MLSJ_TEAM_FINAL_PTS.silver}`} />
          <Row label="Bronze (3rd)" value={`+${MLSJ_TEAM_FINAL_PTS.bronze}`} />
          <Row label="4th place" value={`+${MLSJ_TEAM_FINAL_PTS.fourth}`} />
          <Row label="Retired mid-round" value={MLSJ_TEAM_RETIRED} />
          <Row label="Eliminated for cause" value={MLSJ_TEAM_ELIMINATED} />

          <div className="mt-3 px-2 py-2 rounded text-xs font-cormorant italic" style={{ background: 'rgba(180,149,48,0.05)', color: 'var(--mid)' }}>
            Max path to Gold: {MLSJ_TEAM_R1_ADVANCE} (advance) + {MLSJ_TEAM_R2_GOLD_SIDE} (reach final) + {MLSJ_TEAM_FINAL_PTS.gold} (win) = {MLSJ_TEAM_R1_ADVANCE + MLSJ_TEAM_R2_GOLD_SIDE + MLSJ_TEAM_FINAL_PTS.gold} pts
          </div>
        </div>
      )}
    </div>
  );
}