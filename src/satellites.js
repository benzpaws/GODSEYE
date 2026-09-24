// ═══════════════════════════════════════════════════════════
//  GODS EYE — SATELLITES MODULE v5.3
//  Crisp Point dots (no blurry sprite upscaling)
//  Labels only at zoom ≤ 2.3, adjust to zoom level
//  Isolate mode — hide all other sats when tracking one
//  Blinking bracket on selected
// ═══════════════════════════════════════════════════════════

const Satellites = (() => {
  let satellites   = [];
  let satMeshes    = [];   // THREE.Sprite per sat
  let satLabels    = [];   // label sprites
  let activeBracket = null;
  const trailHist  = {};

  let selectedIdx  = null;  // currently tracked sat index
  let isolateMode  = false; // hide all others when tracking

  // ── ISS ────────────────────────────────────────────────
  let issData = { crew: [], fetching: false };

  // ── Category filters ───────────────────────────────────
  const catFilter = {
    iss: true, starlink: true, weather: true, nav: true,
    science: true, iridium: true, debris: true, other: true,
  };

  // ── Label zoom threshold ───────────────────────────────
  const LABEL_ZOOM_THRESHOLD = 2.3;

  // ── Dot texture cache — uses NearestFilter to stay crisp ─
  const dotTexCache = {};

  function makeDotTex(color, pxSize = 16) {
    const key = color + pxSize;
    if (dotTexCache[key]) return dotTexCache[key];
    const cv = document.createElement('canvas');
    // Use larger canvas so filter doesn't blur it — 32px
    const sz = 32;
    cv.width = cv.height = sz;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, sz, sz);
    // Draw a clean square in the center at full size
    const pad = Math.floor(sz * 0.15);
    ctx.fillStyle = color;
    ctx.fillRect(pad, pad, sz - pad * 2, sz - pad * 2);
    const tex = new THREE.CanvasTexture(cv);
    // CRITICAL: NearestFilter prevents blurry upscaling
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    dotTexCache[key] = tex;
    return tex;
  }

  // ── TLE Parsing ────────────────────────────────────────
  function parseTLEs(raw, cat) {
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const sats  = [];
    for (let i = 0; i + 2 < lines.length; i++) {
      if (lines[i + 1].startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
        try {
          const sr    = satellite.twoline2satrec(lines[i + 1], lines[i + 2]);
          const rawId = parseInt(lines[i + 1].substring(2, 7).trim(), 10);
          sats.push({
            name: lines[i].trim(), tle1: lines[i + 1], tle2: lines[i + 2],
            satrec: sr, cat,
            id: isNaN(rawId) ? Math.floor(Math.random() * 99999) : rawId
          });
          i += 2;
        } catch (e) {}
      }
    }
    return sats;
  }

  // ── Category helpers ────────────────────────────────────
  function catMeta(cat) { return CONFIG.catMeta[cat] || CONFIG.catMeta.other; }
  function catColor(cat, god) { return god ? catMeta(cat).godColor : catMeta(cat).color; }
  function catLabel(cat) { return catMeta(cat).label; }
  function catClass(cat) { return catMeta(cat).cssClass; }
  function catIcon(cat)  { return catMeta(cat).icon; }

  function dotColorStr(cat, god) {
    const hex = catColor(cat, god);
    return '#' + hex.toString(16).padStart(6, '0');
  }

  function labelColor(cat, god) {
    if (god) return '#00ffcc';
    return { iss:'#ffb700', starlink:'#00f5ff', weather:'#88ffcc',
      nav:'#ffcc88', science:'#cc88ff', iridium:'#aaaaff',
      debris:'#666688', other:'#00ff88' }[cat] || '#ffb700';
  }

  // ── TLE Fetch ──────────────────────────────────────────
  async function fetchTLEGroup(group) {
    const base=typeof window!=='undefined'?(window.GODS_EYE_FEEDS?.apiBase||''):'';
    const urls=base?[base+'/api/satellites?group='+encodeURIComponent(new URL(group.url).searchParams.get('GROUP')),group.url]:[group.url,CONFIG.proxy+encodeURIComponent(group.url)];
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.includes('1 ') && text.length > 100) return parseTLEs(text, group.cat);
      } catch (e) {}
    }
    return [];
  }

  async function fetchAll(onProgress) {
    let allSats = [];
    const results = await Promise.allSettled(
      CONFIG.tleGroups.map((g, i) =>
        fetchTLEGroup(g).then(sats => {
          if (onProgress) onProgress(g.label, sats.length, i, CONFIG.tleGroups.length);
          return sats;
        })
      )
    );
    results.forEach(r => { if (r.status === 'fulfilled') allSats = allSats.concat(r.value); });

    // Deduplicate by NORAD ID — same satellite can appear in multiple TLE groups
    // (e.g. ISS appears in 'stations' AND 'active' groups)
    const seenIds = new Set();
    allSats = allSats.filter(s => {
      const key = String(s.id);
      if (seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    });

    if (allSats.length < 5) {
      // Bundled sample elements are years old and cannot represent today's positions.
      return { sats: [], fallback: true };
    }
    return { sats: allSats, fallback: false };
  }

  // ── ISS Crew ───────────────────────────────────────────
  async function fetchISSData() {
    if (issData.fetching) return;
    issData.fetching = true;
    try {
      const res = await fetch('http://api.open-notify.org/astros.json');
      if (res.ok) {
        const data = await res.json();
        issData.crew = (data.people || []).filter(p => p.craft === 'ISS');
      }
    } catch (e) { issData.crew = []; }
    issData.fetching = false;
  }

  function getISSIndex() {
    return satellites.findIndex(s => s.cat === 'iss' && (s.name.includes('ISS') || s.name.includes('ZARYA')));
  }

  function buildMeshes() {
    Globe.satGroup.clear(); satMeshes=[]; satLabels=[];
    satellites.forEach((sat,idx)=>{const anchor=new THREE.Object3D();anchor.userData={idx,type:'sat',obj:sat};Globe.satGroup.add(anchor);satMeshes.push(anchor);});
    applyCatFilter();
  }
  function applyCatFilter(){satellites.forEach((sat,i)=>{if(satMeshes[i])satMeshes[i].visible=catFilter[sat.cat]!==false && Number.isFinite(sat.lat);});}
  function setCatFilter(cat,val){catFilter[cat]=val;applyCatFilter();}
  function updateOne(sat,idx,now){
    try {
      const pv=satellite.propagate(sat.satrec,now);if(!pv.position)throw Error('invalid orbit');
      const geo=satellite.eciToGeodetic(pv.position,satellite.gstime(now));
      sat.lat=satellite.degreesLat(geo.latitude);sat.lon=satellite.degreesLong(geo.longitude);sat.alt=geo.height;
      if(!Number.isFinite(sat.lat)||!Number.isFinite(sat.lon)||!Number.isFinite(sat.alt)||sat.alt<0)throw Error('invalid position');
      sat.vel=pv.velocity?Math.hypot(pv.velocity.x,pv.velocity.y,pv.velocity.z):0;
      satMeshes[idx]?.position.copy(Utils.ll2v3(sat.lat,sat.lon,1+sat.alt/6371));
      if(satMeshes[idx])satMeshes[idx].visible=catFilter[sat.cat]!==false;
    }catch {if(satMeshes[idx])satMeshes[idx].visible=false;}
  }
  function propagate(){const now=new Date();satellites.forEach((s,i)=>updateOne(s,i,now));
    if(selectedIdx!==null){const s=satellites[selectedIdx];if(s&&Number.isFinite(s.lat)){const h=trailHist[selectedIdx]||=[];h.push({lat:s.lat,lon:s.lon,alt:s.alt});if(h.length>CONFIG.maxTrailPoints)h.shift();}}
  }
  function animate(){if(selectedIdx!==null&&satellites[selectedIdx])updateOne(satellites[selectedIdx],selectedIdx,new Date());}
  function select(idx){selectedIdx=idx;isolateMode=false;if(idx!==null&&satMeshes[idx])Globe.track(satMeshes[idx]);}
  function deselect(){selectedIdx=null;isolateMode=false;}
  function recolor(){} function drawTrail(){} function showBracket(){} function isolateSingle(){}

  // ── Threat counts ──────────────────────────────────────
  function getThreatCounts() {
    let leo = 0, meo = 0, geo = 0;
    satellites.forEach(s => {
      const a = s.alt || 400;
      if (a < 2000) leo++; else if (a < 35000) meo++; else geo++;
    });
    return { total: satellites.length, leo, meo, geo };
  }

  return {
    get list()       { return satellites; },
    set list(v)      { satellites = v; },
    get meshes()     { return satMeshes; },
    get labels()     { return satLabels; },
    get trails()     { return trailHist; },
    get issData()    { return issData; },
    get catFilter()  { return catFilter; },
    get selectedIdx(){ return selectedIdx; },
    get isolateMode(){ return isolateMode; },
    parseTLEs, fetchAll, fetchISSData, getISSIndex,
    buildMeshes, propagate, animate, recolor, drawTrail, showBracket,
    getThreatCounts, select, deselect, applyCatFilter, setCatFilter,
    isolateSingle,
    catColor, catLabel, catClass, catIcon, catMeta,
    get LABEL_ZOOM_THRESHOLD() { return LABEL_ZOOM_THRESHOLD; },
  };
})();
