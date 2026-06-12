import React from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/6a2b0536fbfbf4f70f04b020/6724260c5_FinalLogo.png';

export default function EquiPrixLogo({ width = 220, compact = false }) {
  // compact mode: show a smaller version cropped to just the wordmark area
  return (
    <img
      src={LOGO_URL}
      alt="EquiPrix"
      style={{
        width,
        height: 'auto',
        display: 'block',
      }}
    />
  );
}