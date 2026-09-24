const Vessels = (() => {
  let list=[],meshes=[],status='unconfigured',error='',lastUpdate=null,pending=null;
  const maxAge=600;
  function normalize(data, now=Date.now()/1000){
    if(!Array.isArray(data))return [];
    const byId=new Map();
    for(const v of data){
      if(!/^\d{9}$/.test(String(v.mmsi))||!Number.isFinite(v.lat)||!Number.isFinite(v.lon)||Math.abs(v.lat)>90||Math.abs(v.lon)>180)continue;
      if(!Number.isFinite(v.observedAt)||v.observedAt>now+30||now-v.observedAt>maxAge)continue;
      const previous=byId.get(String(v.mmsi));if(previous&&previous.observedAt>v.observedAt)continue;
      byId.set(String(v.mmsi),{...v,mmsi:String(v.mmsi),name:String(v.name||'Vessel '+v.mmsi).slice(0,80)});
    }
    return [...byId.values()].slice(0,5000);
  }
  function fetchData(){if(pending)return pending;pending=fetchSnapshot().finally(()=>pending=null);return pending;}
  async function fetchSnapshot(){
    const base=(window.GODS_EYE_FEEDS?.apiBase||'').replace(/\/$/,'');
    if(!base){status='unconfigured';return false;}
    status='connecting';
    try{
      const r=await fetch(base+'/api/vessels',{signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw Error(r.status===503?'AIS feed is not connected':'AIS provider unavailable');
      const data=await r.json();list=normalize(data.vessels);status=list.length?'online':'empty';error='';lastUpdate=Date.now();return true;
    }catch(e){list=[];status='offline';error=e.message;return false;}
  }
  function buildMeshes(){
    const previous=new Map(meshes.map(m=>[m.userData.obj.mmsi,m.position.clone()]));Globe.shipGroup.clear();meshes=[];
    list.forEach((v,idx)=>{const m=new THREE.Object3D();m.userData={type:'ship',idx,obj:v,target:Utils.ll2v3(v.lat,v.lon,1.001),started:performance.now()};m.position.copy(previous.get(v.mmsi)||m.userData.target);m.userData.start=m.position.clone();Globe.shipGroup.add(m);meshes.push(m);});
  }
  function animate(){meshes.forEach(m=>{const t=Math.min(1,(performance.now()-m.userData.started)/1400);m.position.lerpVectors(m.userData.start,m.userData.target,t*t*(3-2*t));m.visible=Date.now()/1000-m.userData.obj.observedAt<=maxAge;});}
  return {fetch:fetchData,normalize,buildMeshes,animate,get list(){return list;},get meshes(){return meshes;},get status(){return status;},get error(){return error;},get lastUpdate(){return lastUpdate;}};
})();
