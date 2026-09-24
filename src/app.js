/* Single frame loop: update positions -> transform/render Earth -> project markers. */
const App = (() => {
  let ready=false,refreshing=null,lastPropagation=0,lastTick=0,lastFrame=performance.now(),fpsAt=performance.now(),frames=0;
  let lastAircraft=0,lastVessels=0;
  async function refreshAircraft(){
    const ok=await Aircraft.fetch();Aircraft.buildMeshes();Aircraft.place();UI.rebindSelection('air');UI.applyLayers();
    document.getElementById('acnt').textContent=ok?`${Aircraft.list.length.toLocaleString()} aircraft · observed`:'Flights offline';
    UI.buildDataLayers();UI.buildList();lastAircraft=Date.now();
  }
  async function refreshVessels(){
    const ok=await Vessels.fetch();Vessels.buildMeshes();Vessels.animate();UI.rebindSelection('ship');UI.applyLayers();
    document.getElementById('ship-status').textContent=ok?`${Vessels.list.length.toLocaleString()} vessels · AIS`:Vessels.status==='unconfigured'?'AIS not connected':'AIS offline';UI.buildDataLayers();UI.buildList();lastVessels=Date.now();
  }
  function refreshFeeds(){if(refreshing)return refreshing;const button=document.getElementById('refresh-btn');button.disabled=true;
    refreshing=Promise.allSettled([refreshAircraft(),refreshVessels()]).finally(()=>{refreshing=null;button.disabled=false;});return refreshing;
  }
  function animate(now){requestAnimationFrame(animate);if(!ready)return;const dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
    if(now-lastPropagation>=1000){Satellites.propagate();lastPropagation=now;}
    Satellites.animate();Aircraft.animate();Vessels.animate();Globe.render(dt);Markers.render(now);
    if(now-lastTick>=1000){document.getElementById('utc').textContent=Utils.formatUTC();UI.tick();lastTick=now;}
    frames++;if(now-fpsAt>=1000){document.getElementById('frtcount').textContent=Math.round(frames*1000/(now-fpsAt))+' FPS';frames=0;fpsAt=now;}
  }
  async function init(){
    if(!Auth.isAuthenticated()){location.href='index.html';return;}
    try{
      Feeds.init();Globe.init();UI.init();Markers.init();ready=true;requestAnimationFrame(animate);
      refreshFeeds();
      const result=await Satellites.fetchAll((label,count)=>{document.getElementById('lmsg').textContent=`${label.toLowerCase()} · ${count.toLocaleString()} orbital elements`;});
      Satellites.list=result.sats;Satellites.buildMeshes();Satellites.propagate();UI.buildList();UI.buildDataLayers();
      document.getElementById('sstatus').textContent=result.fallback?'Satellite feed offline':`${result.sats.length.toLocaleString()} satellites · calculated`;
      const loading=document.getElementById('loading');loading.style.opacity='0';setTimeout(()=>loading.hidden=true,600);
      setInterval(()=>{if(document.hidden)return;const now=Date.now();if(now-lastAircraft>=(window.GODS_EYE_FEEDS.aircraftRefreshMs||90000))refreshAircraft();if(now-lastVessels>=(window.GODS_EYE_FEEDS.vesselsRefreshMs||15000))refreshVessels();},5000);
    }catch(e){document.getElementById('lmsg').textContent='The observatory could not start: '+e.message;console.error(e);}
  }
  init();return {refreshFeeds};
})();
