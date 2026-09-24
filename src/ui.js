const UI = (() => {
  let selection=null,index=null,search='',filter='all',view='natural',panel='detail';
  const layers={sat:true,air:true,ship:true};
  const esc=Utils.escapeHTML;
  const modules=()=>({sat:Satellites,air:Aircraft,ship:Vessels});
  const identity=(type,obj)=>String(type==='sat'?obj.id:type==='air'?obj.icao24:obj.mmsi);
  const nameOf=(type,obj)=>type==='sat'?obj.name:type==='air'?(obj.callsign||obj.icao24):obj.name;
  function current(){return selection&&index!==null?modules()[selection.type].list[index]:null;}
  function mesh(){return selection&&index!==null?modules()[selection.type].meshes[index]:null;}
  function selectedName(){const o=current();return o?nameOf(selection.type,o):'';}
  function init(){emptyDetail();buildDataLayers();buildList();
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))deselect();});
  }
  function openPanel(which){panel=which;for(const p of ['detail','news','cameras'])document.getElementById(p+'-panel').hidden=p!==which;
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.id==='nav-'+(which==='detail'?'globe':which)));
    document.body.classList.toggle('inspector-open',which!=='detail'||!!selection);
    if(which==='news')Feeds.loadNews();if(which==='cameras')Feeds.renderCameras();
  }
  function openConnections(){const d=document.getElementById('connections-dialog');d.querySelector('[name=apiBase]').value=window.GODS_EYE_FEEDS.apiBase||'';d.showModal();}
  function setView(next){view=next;Globe.canvas.classList.toggle('nvg',next==='nvg');if(next==='recon')Globe.enterGodView();else Globe.exitGodView();
    for(const v of ['natural','recon','nvg'])document.getElementById('view-'+v).classList.toggle('active',v===next);
    document.getElementById('map-mode').textContent={natural:'Natural color',recon:'Recon · public observations',nvg:'Night vision · visual effect'}[next];
  }
  function buildDataLayers(){
    const items=[['sat','Satellites',Satellites.list.length,Satellites.list.length?'Orbital elements':'Unavailable'],['air','Aircraft',Aircraft.list.length,Aircraft.status==='online'?'Reported positions':Aircraft.status],['mil','Military*',Aircraft.list.filter(a=>a.military).length,'Callsign hints'],['ship','Vessels',Vessels.list.length,Vessels.status==='unconfigured'?'Connect AIS feed':Vessels.status]];
    document.getElementById('data-layers-body').innerHTML=items.map(([type,label,count,status])=>`<button class="layer-card ${layers[type]===false?'disabled':''}" onclick="UI.toggleLayer('${type}')" aria-label="${label}: ${esc(status)}" ${type!=='mil'?`aria-pressed="${layers[type]}"`:''}>${Icons.svg(type,27)}<strong>${count.toLocaleString()} <span style="font-size:9px;font-weight:400">${label}</span></strong><small>${esc(status)}</small></button>`).join('');
  }
  function toggleLayer(type){if(type==='mil'){setFilterType('mil');return;}if(type==='ship'&&Vessels.status==='unconfigured'){openConnections();return;}
    layers[type]=!layers[type];applyLayers();if(selection?.type===type&&!layers[type])deselect();buildDataLayers();buildList();}
  function applyLayers(){Globe.satGroup.visible=layers.sat;Globe.airGroup.visible=layers.air;Globe.shipGroup.visible=layers.ship;}
  function setSearchQuery(q){search=q.trim().toLowerCase();buildList();}
  function setFilterType(t){filter=t;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===t));buildList();}
  function buildList(){
    const el=document.getElementById('list'),items=[];
    for(const [type,mod] of Object.entries(modules())){if(!layers[type])continue;if(filter!=='all'&&filter!==type&&!(filter==='mil'&&type==='air'))continue;
      mod.list.forEach((obj,idx)=>{
        if(filter==='mil'&&!obj.military)return;
        if(type==='air'&&!Aircraft.freshPosition(obj.time_position))return;
        if(type==='ship'&&Date.now()/1000-obj.observedAt>600)return;
        const name=nameOf(type,obj),id=identity(type,obj);
        if(search&&![name,id,obj.origin_country||''].join(' ').toLowerCase().includes(search))return;
        items.push({type,obj,idx,name,id});
      });
    }
    document.getElementById('lcount').textContent=items.length.toLocaleString();
    document.getElementById('list-label').textContent=items.length>300?'FIRST 300 / SEARCH TO FIND MORE':'AVAILABLE OBJECTS';
    if(!items.length){
      let title='No matching objects',message='Try another search or turn on a data layer.';
      if(!search&&['air','mil'].includes(filter)){title='Flight feed unavailable';message=Aircraft.error||'No recent aircraft observations were returned. Connect a feed server for authenticated access.';}
      if(!search&&filter==='ship'){title='Connect maritime data';message=Vessels.error||'Vessel tracking is ready for AIS observations. Connect your feed server to populate this layer.';}
      el.innerHTML=`<div class="empty-list"><strong>${esc(title)}</strong>${esc(message)}${['air','mil','ship'].includes(filter)?'<button class="primary-button" onclick="UI.openConnections()">Data connections</button>':''}</div>`;return;
    }
    el.innerHTML=items.slice(0,300).map(({type,obj,idx,name,id})=>`<button class="object-row ${selection?.type===type&&selection.id===id?'selected':''}" data-type="${type}" data-index="${idx}"><span class="object-icon">${Icons.svg(type==='air'&&obj.military?'mil':type,27)}</span><span class="object-text"><strong>${esc(name)}</strong><small>${type==='sat'?'NORAD':type==='air'?'ICAO':'MMSI'} ${esc(id)}</small></span><span class="object-type">${type==='sat'?(CONFIG.catMeta[obj.cat]?.label||'SAT'):type==='air'?(obj.military?'MIL*':'AIR'):'AIS'}</span></button>`).join('');
    el.querySelectorAll('[data-index]').forEach(b=>b.onclick=()=>select(b.dataset.type,Number(b.dataset.index)));
  }
  function select(type,idx){const o=modules()[type]?.list[idx];if(!o)return;
    Satellites.deselect();selection={type,id:identity(type,o)};index=idx;layers[type]=true;applyLayers();
    if(type==='sat')Satellites.select(idx);else Globe.track(mesh());
    openPanel('detail');document.body.classList.remove('explorer-open');
    document.getElementById('tracking-bar').hidden=false;document.getElementById('track-name').textContent=selectedName();
    document.getElementById('map-hint').hidden=true;buildList();renderDetail();
  }
  function rebindSelection(type){if(selection?.type!==type)return;index=modules()[type].list.findIndex(o=>identity(type,o)===selection.id);
    if(index<0){deselect();return;}Globe.track(mesh());renderDetail();}
  function deselect(){selection=null;index=null;Satellites.deselect();Globe.track(null);emptyDetail();document.getElementById('tracking-bar').hidden=true;document.getElementById('map-hint').hidden=false;document.body.classList.remove('inspector-open');buildList();}
  function resetView(){deselect();Globe.reset();}
  function toggleFollow(){Globe.setFollowing(!Globe.following);}
  const number=(n,d=1,unit='')=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d})+unit:'Unavailable';
  const row=(label,value)=>`<div class="detail-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  function emptyDetail(){document.getElementById('dname').textContent='Select an object';document.getElementById('detail-source').textContent='READY';
    document.getElementById('dbody').innerHTML=`<div class="empty-hero"><div class="empty-hero-icon">${Icons.svg('globe',36)}</div><h3>A world in motion.<br>A closer perspective.</h3><p>Select a satellite, aircraft or vessel on Earth to follow its position and inspect the available data.</p><div class="quick-facts"><div>${Icons.svg('sat')} Propagated satellite orbits</div><div>${Icons.svg('air')} Reported flight positions</div><div>${Icons.svg('ship')} Maritime AIS observations</div></div><p class="inspector-note">Public data powers this simulator. Availability and observation times vary by source.</p></div>`;
  }
  function renderDetail(){const o=current();if(!o)return;const type=selection.type;
    document.getElementById('dname').textContent=selectedName();
    document.getElementById('detail-source').textContent=type==='sat'?'CALCULATED':'OBSERVED';
    const icon=type==='air'&&o.military?'mil':type;
    const category=type==='sat'?(CONFIG.catMeta[o.cat]?.purpose||'Satellite'):type==='air'?(o.military?'Possible military aircraft':'Aircraft'):'AIS vessel';
    const observed=type==='air'?o.time_position:type==='ship'?o.observedAt:null;
    const age=observed?Math.max(0,Math.floor(Date.now()/1000-observed)):null;
    const epoch=type==='sat'&&Number.isFinite(o.satrec?.jdsatepoch)?new Date((o.satrec.jdsatepoch-2440587.5)*86400000).toISOString().replace('T',' ').slice(0,16)+' UTC':'Unavailable';
    let rows='',source='';
    if(type==='sat'){
      rows=row('Altitude',number(o.alt,1,' km'))+row('Orbital speed',number(o.vel,3,' km/s'))+row('Orbit class',o.alt<2000?'Low Earth orbit':o.alt<35000?'Medium Earth orbit':'High Earth orbit')+row('Inclination',number(o.satrec?.inclo*180/Math.PI,2,'°'))+row('Period',number(o.satrec?.no?2*Math.PI/o.satrec.no:null,1,' min'))+row('Element epoch',epoch);
      source='CelesTrak orbital elements, propagated with SGP4. This is a calculated position, not a live satellite camera.';
    }else if(type==='air'){
      rows=row('Altitude',number((o.geo_altitude??o.baro_altitude)!==null?(o.geo_altitude??o.baro_altitude)/1000:null,2,' km'))+row('Ground speed',number(Number.isFinite(o.velocity)?o.velocity*1.94384:null,0,' kn'))+row('Heading',number(o.true_track,0,'°'))+row('Country',o.origin_country||'Unavailable')+row('Squawk',o.squawk||'Unavailable')+row('Classification',o.classification==='callsign hint'?'Unverified callsign hint':o.classification==='provider military feed'?'Provider military feed':'Unverified');
      source='OpenSky reported position. Icons briefly interpolate between received observations. No movement is invented after the last report.';
    }else{
      rows=row('MMSI',o.mmsi)+row('Speed over ground',number(o.speed,1,' kn'))+row('Course',number(o.course,0,'°'))+row('Heading',number(o.heading,0,'°'))+row('Source','AISStream')+row('Provider receipt time',new Date(o.observedAt*1000).toISOString().slice(11,19)+' UTC');
      source='AIS-reported position via your feed server; age is measured from provider receipt time. AIS coverage is incomplete; vessels without a recent received report are not shown.';
    }
    const scroll=document.getElementById('dbody').scrollTop;
    document.getElementById('dbody').innerHTML=`<div class="detail-hero"><div class="hero-icon">${Icons.svg(icon,36)}</div><div><strong>${esc(category)}</strong><small>${type==='sat'?'NORAD':type==='air'?'ICAO':'MMSI'} ${esc(identity(type,o))}</small></div></div><div class="position-grid"><div><span>LATITUDE</span><strong>${number(o.lat,3,'°')}</strong></div><div><span>LONGITUDE</span><strong>${number(o.lon,3,'°')}</strong></div></div><div class="detail-section"><div class="section-label">${type==='sat'?'ORBITAL TELEMETRY':'REPORTED TELEMETRY'}</div>${rows}</div>${age!==null?`<div class="observation-age ${age>60?'stale':''}">● ${type==='ship'?'Received':'Observed'} ${age}s ago${age>(type==='air'?120:600)?' · expired':''}</div>`:''}<div class="source-note"><strong>Source & accuracy</strong><br>${esc(source)}</div>`;
    document.getElementById('dbody').scrollTop=scroll;
  }
  function tick(){if(selection)renderDetail();document.getElementById('follow-btn').textContent=Globe.following?'Following':'Resume';}
  return {init,openPanel,openConnections,setView,buildDataLayers,buildList,applyLayers,toggleLayer,setSearchQuery,setFilterType,select,rebindSelection,deselect,resetView,toggleFollow,renderDetail,tick,
    selectSat:i=>select('sat',i),selectAir:i=>select('air',i),
    get selectedMesh(){return mesh();},get selectedName(){return selectedName();},get selectedType(){return selection?.type;},get selectedIdx(){return index;},get selectionKey(){return selection?selection.type+':'+selection.id:'';},get panel(){return panel;},get godMode(){return view==='recon';}
  };
})();
