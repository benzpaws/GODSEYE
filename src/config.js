// ═══════════════════════════════════════════════════════════
//  GODS EYE — CONFIG v5.2 (PUBLIC — SAFE TO COMMIT)
//  Sensitive credentials live in src/config.local.js (gitignored)
// ═══════════════════════════════════════════════════════════

const _LOCAL = window.GODS_EYE_LOCAL || {};

const CONFIG = {
  version: '5.2.0',
  name: 'GODS EYE',
  subtitle: 'WORLDVIEW OPERATIONS CENTER',

  // ── API & DATA SOURCES ───────────────────────────────────
  proxy:   'https://corsproxy.io/?',
  opensky: 'https://opensky-network.org/api/states/all',

  aviationstack: {
    base:   'https://api.aviationstack.com/v1/flights',
    apiKey: (_LOCAL.aviationstack && _LOCAL.aviationstack.apiKey) || '',
  },

  // ADS-B Exchange v2 API key (optional — falls back to prefix detection)
  get adsbExchangeKey() {
    return (_LOCAL.adsbexchange && _LOCAL.adsbexchange.apiKey) || '';
  },

  // NASA Earth textures — high resolution
  textures: {
    // NASA Blue Marble 8K — best available resolution
    day:    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    night:  'https://unpkg.com/three-globe/example/img/earth-night.jpg',
    topo:   'https://unpkg.com/three-globe/example/img/earth-topology.png',
    clouds: 'https://unpkg.com/three-globe/example/img/earth-clouds.png',
    // High-res fallbacks — loaded progressively if CDN supports
    dayHR:  'https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74518/world.200410.3x5400x2700.jpg',
    nightHR:'https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg',
  },

  // ── TLE GROUPS ───────────────────────────────────────────
  tleGroups: [
    { label: 'STATIONS', cat: 'iss',      url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle' },
    { label: 'STARLINK', cat: 'starlink',  url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle' },
    { label: 'WEATHER',  cat: 'weather',   url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle' },
    { label: 'GPS',      cat: 'nav',       url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle' },
    { label: 'GALILEO',  cat: 'nav',       url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle' },
    { label: 'GLONASS',  cat: 'nav',       url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=glonass-operational&FORMAT=tle' },
    { label: 'SCIENCE',  cat: 'science',   url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=science&FORMAT=tle' },
    { label: 'IRIDIUM',  cat: 'iridium',   url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-NEXT&FORMAT=tle' },
    { label: 'ACTIVE',   cat: 'other',     url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle' },
    { label: 'DEBRIS',   cat: 'debris',    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=tle' },
  ],

  // ── SATELLITE CATEGORY META ──────────────────────────────
  catMeta: {
    iss:      { icon: '🛰️',  label: 'ISS',    color: 0xffb700, godColor: 0x00ffcc, purpose: 'Crewed Space Station',       cssClass: 'cs'  },
    starlink: { icon: '📡',  label: 'STRLNK', color: 0x00f5ff, godColor: 0x00ffcc, purpose: 'Communications (Starlink)',  cssClass: 'cst' },
    weather:  { icon: '🌍',  label: 'WTHR',   color: 0x88ffcc, godColor: 0x00ffcc, purpose: 'Earth Observation / Weather',cssClass: 'cw'  },
    nav:      { icon: '🧭',  label: 'NAV',    color: 0xffcc88, godColor: 0x00ffcc, purpose: 'Navigation / GPS',            cssClass: 'cn'  },
    science:  { icon: '🔭',  label: 'SCI',    color: 0xcc88ff, godColor: 0x00ffcc, purpose: 'Scientific Research',         cssClass: 'css' },
    iridium:  { icon: '📡',  label: 'IRDM',   color: 0xaaaaff, godColor: 0x00ffcc, purpose: 'Communications (Iridium)',   cssClass: 'co'  },
    debris:   { icon: '🗑️',  label: 'DBRS',   color: 0x555577, godColor: 0x00ffcc, purpose: 'Space Debris',                cssClass: 'cd'  },
    other:    { icon: '🛰️',  label: 'OBJ',    color: 0x00ff88, godColor: 0x00ffcc, purpose: 'Other / Unclassified',        cssClass: 'co'  },
    aircraft: { icon: '✈️',  label: 'ACFT',   color: 0x00f5ff, godColor: 0x00ffcc, purpose: 'Aircraft',                   cssClass: 'ca'  },
  },

  // ── POSSIBLE MILITARY CALLSIGN HINTS ─────────────────────
  // Hints are never verified classifications and can match civilian flights.
  militaryPrefixes: ['RCH', 'RRR', 'FORTE'],

  // ── PERFORMANCE ──────────────────────────────────────────
  maxAircraft:    2000,   // raised from 1000
  aircraftMaxAgeSeconds: 120, // position observation age, not time since fetch
  maxTrailPoints: 80,
  satUpdateFrames:45,
  listRenderCap:  600,

  // ── RADAR ────────────────────────────────────────────────
  radar: {
    radiusKm:     50,
    sweepDuration:4000,
    maxBlips:     200,
  },

  // ── TIMEZONES (GOD CLOCK) ─────────────────────────────
  timezones: [
    { city: 'TORONTO',     tz: 'America/Toronto',    flag: '🇨🇦', personal: true },
    { city: 'TBILISI',     tz: 'Asia/Tbilisi',       flag: '🇬🇪', personal: true },
    { city: 'TALLINN',     tz: 'Europe/Tallinn',      flag: '🇪🇪', personal: true },
    { city: 'NEW YORK',    tz: 'America/New_York',    flag: '🇺🇸' },
    { city: 'LOS ANGELES', tz: 'America/Los_Angeles', flag: '🇺🇸' },
    { city: 'CHICAGO',     tz: 'America/Chicago',     flag: '🇺🇸' },
    { city: 'LONDON',      tz: 'Europe/London',       flag: '🇬🇧' },
    { city: 'PARIS',       tz: 'Europe/Paris',        flag: '🇫🇷' },
    { city: 'ISTANBUL',    tz: 'Europe/Istanbul',     flag: '🇹🇷' },
    { city: 'CAIRO',       tz: 'Africa/Cairo',        flag: '🇪🇬' },
    { city: 'NAIROBI',     tz: 'Africa/Nairobi',      flag: '🇰🇪' },
    { city: 'MOSCOW',      tz: 'Europe/Moscow',       flag: '🇷🇺' },
    { city: 'DUBAI',       tz: 'Asia/Dubai',          flag: '🇦🇪' },
    { city: 'KARACHI',     tz: 'Asia/Karachi',        flag: '🇵🇰' },
    { city: 'DELHI',       tz: 'Asia/Kolkata',        flag: '🇮🇳' },
    { city: 'DHAKA',       tz: 'Asia/Dhaka',          flag: '🇧🇩' },
    { city: 'BANGKOK',     tz: 'Asia/Bangkok',        flag: '🇹🇭' },
    { city: 'BEIJING',     tz: 'Asia/Shanghai',       flag: '🇨🇳' },
    { city: 'TOKYO',       tz: 'Asia/Tokyo',          flag: '🇯🇵' },
    { city: 'SYDNEY',      tz: 'Australia/Sydney',    flag: '🇦🇺' },
    { city: 'AUCKLAND',    tz: 'Pacific/Auckland',    flag: '🇳🇿' },
    { city: 'SAO PAULO',   tz: 'America/Sao_Paulo',  flag: '🇧🇷' },
  ],

  // ── AUTH ─────────────────────────────────────────────────
  auth: {
    enabled:         true,
    sessionKey:      'godseye_session',
    sessionDuration: 24 * 60 * 60 * 1000,
    get credentials() {
      if (_LOCAL.auth && /^[a-f0-9]{64}$/i.test(_LOCAL.auth.usernameHash) &&
          /^[a-f0-9]{64}$/i.test(_LOCAL.auth.passwordHash)) {
        return { usernameHash: _LOCAL.auth.usernameHash, passwordHash: _LOCAL.auth.passwordHash };
      }
      // Public demo UI gate. These hashes are not server-side access control.
      return { usernameHash: '0d07289b67c604a19878cfb8076cbdb7247dd3528b0aa9e509069a83192fd492', passwordHash: 'cfdf73abb0dfecd12f5aac088e1bcc382ce4e38323ac54b50742478f77a8ee64' };
    }
  }

};
