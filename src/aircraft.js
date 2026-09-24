// ═══════════════════════════════════════════════════════════
//  GODS EYE — AIRCRAFT MODULE v5.2
//  OpenSky positions + AviationStack route enrichment
//  ADS-B Exchange military feed
//  Floating callsign labels, bracket reticle on selection
// ═══════════════════════════════════════════════════════════

const Aircraft = (() => {
  let aircraft      = [];
  let airMeshes     = [];
  let airLabels     = [];   // floating callsign labels
  let activeBracket = null; // bracket on selected aircraft

  const routeCache = {};
  let status = "connecting", error = "", lastUpdate = null;
  let pending = null;

  // ── Label zoom threshold ─────────────────────────────────
  const LABEL_ZOOM_THRESHOLD = 2.3;

  // ── Military callsign prefix detection ──────────────────
  // Covers USAF, USN, Army, NATO allies, known mil prefixes
  const MIL_PREFIXES = (CONFIG.militaryPrefixes || [
    'RCH','RRR','DUKE','FORTE','TOPCT','JAKE','POLAR','SWORD','VIPER',
    'VALOR','REACH','ZEUS','ATLAS','TITAN','COBRA','EAGLE','FALCON',
    'DRAGON','HAWK','GHOST','SHADOW','REAPER','SENTRY','VENUS','MARS',
    'HOMER','MAGMA','BISON','IRON','STEEL','CHROME','BRONZE','COPPER',
    'GOLD','SILVER','DIAMOND','RUBY','SAPPH','TOPAZ','AMBER','JADE',
    'ROCKY','STONE','SLATE','IRON','STEEL','RANGER','SHIELD','LANCE',
    'SPEAR','ARROW','KNIFE','BLADE','DAGGER','SWORD','AXE','MACE',
    'STORM','THUNDER','LIGHTNING','CYCLONE','TYPHOON','TEMPEST',
    'WOLF','BEAR','LION','TIGER','PANTHER','JAGUAR','PUMA','LYNX',
    'RAF','NATO','USAF','USN','ARMY','NAVY','ANGEL','MERCY',
    'MEDIC','HOSP','EVAC','MEDEVAC','CASEVAC','LOGAIR','SEALIFT',
  ]);

  function isMilitary(ac) {
    if (!ac) return false;
    const cs = (ac.callsign || '').trim().toUpperCase();
    // Callsigns are only hints. Country-wide ICAO prefixes cannot establish
    // whether a specific aircraft is military.
    return MIL_PREFIXES.some(p => cs.startsWith(p));
  }

  function freshPosition(timestamp, nowSeconds = Date.now() / 1000) {
    return Number.isFinite(timestamp) && timestamp > 0 &&
      timestamp <= nowSeconds + 30 && nowSeconds - timestamp <= CONFIG.aircraftMaxAgeSeconds;
  }

  // ── OpenSky Fetch ────────────────────────────────────────
  function fetch_data() {
    if(pending)return pending;
    pending=fetchSnapshot().finally(()=>{pending=null;});return pending;
  }
  async function fetchSnapshot() {
    try {
      status='connecting';
      const base = typeof window !== 'undefined' ? (window.GODS_EYE_FEEDS?.apiBase || '').replace(/\/$/,'') : '';
      const url = base ? base + '/api/aircraft' : CONFIG.opensky;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(res.status===429 ? 'Provider rate limit reached' : 'Flight provider HTTP ' + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.states)) throw new Error('Invalid OpenSky response');
      const nowSeconds = Date.now() / 1000;
      const next = data.states
        .filter(s => Array.isArray(s) && Number.isFinite(s[6]) && Number.isFinite(s[5]) &&
          Math.abs(s[6]) <= 90 && Math.abs(s[5]) <= 180 && freshPosition(s[3], nowSeconds))
        .slice(0, CONFIG.maxAircraft)
        .map(s => ({
          icao24: s[0], callsign: s[1]?.trim(), origin_country: s[2],
          lon: s[5], lat: s[6], baro_altitude: s[7], on_ground: s[8],
          velocity: s[9], true_track: s[10], vertical_rate: s[11],
          geo_altitude: s[13], squawk: s[14],
          time_position: s[3], last_contact: s[4],
          route: routeCache[s[1]?.trim()] || null,
          military: false,
          classification: 'unverified',
          source: 'opensky',
        }));

      next.forEach(ac => {
        if (isMilitary(ac)) { ac.military = true; ac.classification = 'callsign hint'; }
      });
      aircraft=next;status=next.length?'online':'empty';error='';lastUpdate=Date.now();
      return true;
    } catch (e) {
      // Never leave an old snapshot on screen as if it were live.
      aircraft=[];status='offline';error=e.message || 'Flight feed unavailable';
      return false;
    }
  }

  // ── ADS-B Exchange Military Feed ─────────────────────────
  async function fetchMilitary() {
    if (!CONFIG.adsbExchangeKey) return 0;
    try {
      // ADS-B Exchange v2 API — military endpoint
      const url = 'https://adsbexchange.com/api/aircraft/v2/mil/';
      // Do not forward an API key through an unrelated public CORS proxy.
      const res = await fetch(url, {
        headers: { 'api-auth': CONFIG.adsbExchangeKey },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('ADS-B ' + res.status);
      const data = await res.json();
      const milAircraft = (data.ac || [])
        .filter(a => a.lat != null && a.lon != null && a.seen_pos != null &&
          Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon)) &&
          Math.abs(Number(a.lat)) <= 90 && Math.abs(Number(a.lon)) <= 180 &&
          Number.isFinite(Number(a.seen_pos)) && Number(a.seen_pos) >= 0 &&
          Number(a.seen_pos) <= CONFIG.aircraftMaxAgeSeconds)
        .map(a => ({
          icao24: a.hex || '',
          callsign: (a.flight || a.r || '').trim(),
          origin_country: a.cou || '---',
          lon: parseFloat(a.lon), lat: parseFloat(a.lat),
          baro_altitude: a.alt_baro ? parseFloat(a.alt_baro) * 0.3048 : null,
          geo_altitude:  a.alt_geom ? parseFloat(a.alt_geom) * 0.3048 : null,
          velocity: a.gs ? parseFloat(a.gs) * 0.514444 : null, // kts→m/s
          true_track: a.track ? parseFloat(a.track) : null,
          vertical_rate: a.baro_rate ? parseFloat(a.baro_rate) * 0.00508 : null,
          squawk: a.squawk || '---',
          on_ground: a.alt_baro === 'ground',
          military: true,
          classification: 'provider military feed',
          time_position: Math.floor(Date.now() / 1000 - Number(a.seen_pos)),
          source: 'adsbx',
          aircraftType: a.t || '---',
          registration: a.r || '---',
          route: null,
        }));

      // Merge: add mil aircraft not already in opensky list
      const existingIcaos = new Set(aircraft.map(a => a.icao24));
      milAircraft.forEach(ma => {
        if (!existingIcaos.has(ma.icao24)) {
          aircraft.push(ma);
        } else {
          // Upgrade existing entry to military=true
          const idx = aircraft.findIndex(a => a.icao24 === ma.icao24);
          if (idx >= 0) {
            aircraft[idx].military = true;
            aircraft[idx].classification = 'provider military feed';
          }
        }
      });
      return milAircraft.length;
    } catch (e) {
      // ADS-B key missing or CORS — fall back to prefix detection only
      return 0;
    }
  }

  // ── AviationStack Route Fetch ────────────────────────────
  async function fetchRoute(callsign) {
    if (!callsign) return null;
    const cs = callsign.trim();
    if (routeCache[cs]) return routeCache[cs];
    if (!CONFIG.aviationstack.apiKey || CONFIG.aviationstack.apiKey.startsWith('PASTE_')) return null;
    try {
      const url = `${CONFIG.aviationstack.base}?access_key=${encodeURIComponent(CONFIG.aviationstack.apiKey)}&flight_iata=${encodeURIComponent(cs)}&limit=1`;
      // Optional browser key remains visible to site visitors; never send it to a public proxy.
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('AviationStack ' + res.status);
      const data = await res.json();
      const flight = data.data && data.data[0];
      if (!flight) return null;
      const route = {
        flightNumber: flight.flight?.iata || cs,
        airline:      flight.airline?.name || '---',
        aircraftType: flight.aircraft?.iata || '---',
        registration: flight.aircraft?.registration || '---',
        dep: {
          iata:      flight.departure?.iata || '???',
          airport:   flight.departure?.airport || '---',
          timezone:  flight.departure?.timezone || '---',
          scheduled: flight.departure?.scheduled || null,
          actual:    flight.departure?.actual || null,
        },
        arr: {
          iata:      flight.arrival?.iata || '???',
          airport:   flight.arrival?.airport || '---',
          timezone:  flight.arrival?.timezone || '---',
          scheduled: flight.arrival?.scheduled || null,
          estimated: flight.arrival?.estimated || null,
        },
        status: flight.flight_status || 'unknown',
      };
      routeCache[cs] = route;
      const idx = aircraft.findIndex(a => a.callsign === cs);
      if (idx >= 0) aircraft[idx].route = route;
      return route;
    } catch (e) { return null; }
  }

  function buildMeshes() {
    const previous=new Map(airMeshes.map(m=>[m.userData.obj.icao24,m.position.clone()]));
    Globe.airGroup.clear();airMeshes=[];airLabels=[];
    aircraft.forEach((ac,idx)=>{
      const anchor=new THREE.Object3D();anchor.userData={idx,type:'air',obj:ac};
      const r=1+(Math.max(0,ac.geo_altitude??ac.baro_altitude??0)/1000)/6371+.001;
      anchor.userData.target=Utils.ll2v3(ac.lat,ac.lon,r);
      anchor.position.copy(previous.get(ac.icao24)||anchor.userData.target);
      anchor.userData.start=anchor.position.clone();anchor.userData.started=performance.now();
      Globe.airGroup.add(anchor);airMeshes.push(anchor);
    });
  }
  function place(){animate();}
  function animate(){
    airMeshes.forEach(m=>{
      // A short visual transition between received observations, not extrapolation.
      const t=Math.min(1,(performance.now()-m.userData.started)/1400);
      m.position.lerpVectors(m.userData.start,m.userData.target,t*t*(3-2*t));
      m.visible=freshPosition(m.userData.obj.time_position);
    });
  }
  function recolor(){} function showBracket(){}
  return {
    get list(){return aircraft;},get meshes(){return airMeshes;},get labels(){return airLabels;},
    get status(){return status;},get error(){return error;},get lastUpdate(){return lastUpdate;},
    fetch:fetch_data,fetchMilitary,fetchRoute,freshPosition,buildMeshes,place,animate,recolor,showBracket,isMilitary,
  };
})();
