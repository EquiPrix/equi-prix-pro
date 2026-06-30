// ── countryFlags.js ──────────────────────────────────────────────────────────
// Converts FEI/IOC-style 3-letter country codes (FRA, GBR, USA, MON...) into
// flag emoji, programmatically — no more manually typing 🇫🇷 into a text field.
//
// Flag emoji are built from Unicode Regional Indicator Symbols: each letter
// A-Z maps to U+1F1E6–U+1F1FF, and two of them combined render as a flag.
// So "FR" -> 🇫🇷. We only need a lookup from FEI's 3-letter codes to the
// correct 2-letter ISO 3166-1 alpha-2 code, since FEI codes are mostly but
// not always derivable from the first two letters (e.g. GER -> DE, not GE).

const FEI_TO_ISO2 = {
  AFG: 'AF', ALB: 'AL', ALG: 'DZ', AND: 'AD', ANG: 'AO', ANT: 'AG', ARG: 'AR',
  ARM: 'AM', ARU: 'AW', ASA: 'AS', AUS: 'AU', AUT: 'AT', AZE: 'AZ',
  BAH: 'BS', BAN: 'BD', BAR: 'BB', BDI: 'BI', BEL: 'BE', BEN: 'BJ', BER: 'BM',
  BHU: 'BT', BIH: 'BA', BIZ: 'BZ', BLR: 'BY', BOL: 'BO', BOT: 'BW', BRA: 'BR',
  BRN: 'BH', BRU: 'BN', BUL: 'BG', BUR: 'BF',
  CAF: 'CF', CAM: 'KH', CAN: 'CA', CAY: 'KY', CGO: 'CG', CHA: 'TD', CHI: 'CL',
  CHN: 'CN', CIV: 'CI', CMR: 'CM', COD: 'CD', COK: 'CK', COL: 'CO', COM: 'KM',
  CPV: 'CV', CRC: 'CR', CRO: 'HR', CUB: 'CU', CYP: 'CY', CZE: 'CZ',
  DEN: 'DK', DJI: 'DJ', DMA: 'DM', DOM: 'DO',
  ECU: 'EC', EGY: 'EG', ERI: 'ER', ESA: 'SV', ESP: 'ES', EST: 'EE', ETH: 'ET',
  FIJ: 'FJ', FIN: 'FI', FRA: 'FR', FSM: 'FM',
  GAB: 'GA', GAM: 'GM', GBR: 'GB', GBS: 'GW', GEO: 'GE', GER: 'DE', GHA: 'GH',
  GRE: 'GR', GRN: 'GD', GUA: 'GT', GUI: 'GN', GUM: 'GU', GUY: 'GY',
  HAI: 'HT', HKG: 'HK', HON: 'HN', HUN: 'HU',
  INA: 'ID', IND: 'IN', IRI: 'IR', IRL: 'IE', IRQ: 'IQ', ISL: 'IS', ISR: 'IL',
  ISV: 'VI', ITA: 'IT', IVB: 'VG',
  JAM: 'JM', JOR: 'JO', JPN: 'JP',
  KAZ: 'KZ', KEN: 'KE', KGZ: 'KG', KIR: 'KI', KOR: 'KR', KOS: 'XK', KSA: 'SA',
  KUW: 'KW',
  LAO: 'LA', LAT: 'LV', LBA: 'LY', LBR: 'LR', LCA: 'LC', LES: 'LS', LBN: 'LB',
  LIE: 'LI', LTU: 'LT', LUX: 'LU',
  MAC: 'MO', MAD: 'MG', MAR: 'MA', MAS: 'MY', MAW: 'MW', MDA: 'MD', MDV: 'MV',
  MEX: 'MX', MGL: 'MN', MHL: 'MH', MKD: 'MK', MLI: 'ML', MLT: 'MT', MNE: 'ME',
  MON: 'MC', MOZ: 'MZ', MRI: 'MU', MTN: 'MR', MYA: 'MM',
  NAM: 'NA', NCA: 'NI', NED: 'NL', NEP: 'NP', NGR: 'NE', NGU: 'PG', NIG: 'NG',
  NOR: 'NO', NRU: 'NR', NZL: 'NZ',
  OMA: 'OM',
  PAK: 'PK', PAN: 'PA', PAR: 'PY', PER: 'PE', PHI: 'PH', PLE: 'PS', PLW: 'PW',
  PNG: 'PG', POL: 'PL', POR: 'PT', PRK: 'KP', PUR: 'PR',
  QAT: 'QA',
  ROU: 'RO', RSA: 'ZA', RUS: 'RU', RWA: 'RW',
  SAM: 'WS', SEN: 'SN', SEY: 'SC', SIN: 'SG', SKN: 'KN', SLE: 'SL', SLO: 'SI',
  SMR: 'SM', SOL: 'SB', SOM: 'SO', SRB: 'RS', SRI: 'LK', SSD: 'SS', STP: 'ST',
  SUD: 'SD', SUI: 'CH', SUR: 'SR', SVK: 'SK', SWE: 'SE', SWZ: 'SZ', SYR: 'SY',
  TAN: 'TZ', TCH: 'TD', TGA: 'TO', THA: 'TH', TJK: 'TJ', TKM: 'TM', TLS: 'TL',
  TOG: 'TG', TPE: 'TW', TTO: 'TT', TUN: 'TN', TUR: 'TR', TUV: 'TV',
  UAE: 'AE', UGA: 'UG', UKR: 'UA', URU: 'UY', USA: 'US', UZB: 'UZ',
  VAN: 'VU', VEN: 'VE', VIE: 'VN', VIN: 'VC',
  YEM: 'YE',
  ZAM: 'ZM', ZIM: 'ZW',
};

// Country names (for the admin dropdown) keyed by FEI code, sorted-friendly.
export const FEI_COUNTRIES = [
  ['ARG', 'Argentina'], ['AUS', 'Australia'], ['AUT', 'Austria'], ['BEL', 'Belgium'],
  ['BRA', 'Brazil'], ['CAN', 'Canada'], ['CHI', 'Chile'], ['CHN', 'China'],
  ['COL', 'Colombia'], ['CRO', 'Croatia'], ['CYP', 'Cyprus'], ['CZE', 'Czech Republic'],
  ['DEN', 'Denmark'], ['EGY', 'Egypt'], ['ESP', 'Spain'], ['EST', 'Estonia'],
  ['FIN', 'Finland'], ['FRA', 'France'], ['GBR', 'Great Britain'], ['GER', 'Germany'],
  ['GRE', 'Greece'], ['HUN', 'Hungary'], ['IND', 'India'], ['IRL', 'Ireland'],
  ['ISR', 'Israel'], ['ITA', 'Italy'], ['JPN', 'Japan'], ['JOR', 'Jordan'],
  ['KSA', 'Saudi Arabia'], ['KUW', 'Kuwait'], ['LAT', 'Latvia'], ['LIE', 'Liechtenstein'],
  ['LTU', 'Lithuania'], ['LUX', 'Luxembourg'], ['MAR', 'Morocco'], ['MEX', 'Mexico'],
  ['MON', 'Monaco'], ['NED', 'Netherlands'], ['NOR', 'Norway'], ['NZL', 'New Zealand'],
  ['OMA', 'Oman'], ['POL', 'Poland'], ['POR', 'Portugal'], ['QAT', 'Qatar'],
  ['ROU', 'Romania'], ['RSA', 'South Africa'], ['RUS', 'Russia'], ['SRB', 'Serbia'],
  ['SUI', 'Switzerland'], ['SVK', 'Slovakia'], ['SWE', 'Sweden'], ['THA', 'Thailand'],
  ['TUR', 'Turkey'], ['UAE', 'United Arab Emirates'], ['UKR', 'Ukraine'],
  ['URU', 'Uruguay'], ['USA', 'United States'], ['VEN', 'Venezuela'],
].sort((a, b) => a[1].localeCompare(b[1]));

// Build the flag emoji from a 2-letter ISO code via Regional Indicator Symbols.
function iso2ToFlagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '';
  const codePoints = [...iso2.toUpperCase()].map(c => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

// Main export: FEI 3-letter code -> flag emoji. Falls back to '' if unknown.
export function feiCodeToFlag(feiCode) {
  if (!feiCode) return '';
  const code = feiCode.trim().toUpperCase();
  const iso2 = FEI_TO_ISO2[code];
  return iso2 ? iso2ToFlagEmoji(iso2) : '';
}

// Country display name for a FEI code, if known.
export function feiCodeToCountryName(feiCode) {
  if (!feiCode) return '';
  const code = feiCode.trim().toUpperCase();
  const found = FEI_COUNTRIES.find(([c]) => c === code);
  return found ? found[1] : feiCode;
}

// Parses whatever is currently stored in a rider's `nat` field and returns
// { code, flag, label } for display. Handles three legacy shapes:
//   1. Already has a flag + text, e.g. "🇫🇷 France"  -> reuse as-is
//   2. Plain country name, e.g. "Monaco"             -> look up code, derive flag
//   3. 3-letter FEI code, e.g. "MON"                 -> derive flag + name
// This lets existing rows render correctly without a data migration, while
// new entries (via the dropdown) always store the clean "CODE" form going
// forward — see AddRiderForm.
export function parseNatDisplay(nat) {
  if (!nat) return { code: '', flag: '', label: '' };
  const trimmed = nat.trim();

  // Shape 1: starts with an emoji flag already (two Regional Indicator chars)
  const flagMatch = trimmed.match(/^(\p{Regional_Indicator}{2})\s*(.*)$/u);
  if (flagMatch) {
    return { code: '', flag: flagMatch[1], label: flagMatch[2] || trimmed };
  }

  // Shape 3: exact 3-letter FEI code
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    const flag = feiCodeToFlag(code);
    if (flag) return { code, flag, label: feiCodeToCountryName(code) };
  }

  // Shape 2: plain country name — reverse-lookup against FEI_COUNTRIES
  const byName = FEI_COUNTRIES.find(([, name]) => name.toLowerCase() === trimmed.toLowerCase());
  if (byName) {
    const [code, name] = byName;
    return { code, flag: feiCodeToFlag(code), label: name };
  }

  // Unknown — no flag available, just show the raw text
  return { code: '', flag: '', label: trimmed };
}